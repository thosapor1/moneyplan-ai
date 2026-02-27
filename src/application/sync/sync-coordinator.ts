/**
 * Application: SyncCoordinator
 *
 * Orchestrates offline → online synchronization.
 *
 * This is an application-layer service:
 * - It contains workflow / orchestration logic.
 * - It depends ONLY on ports (interfaces), not on Supabase/IndexedDB directly.
 * - It is safe to unit-test by mocking ports.
 *
 * Responsibilities:
 * - Prevent concurrent sync runs.
 * - Ensure network is online before syncing.
 * - Wait for an auth session with retry logic (auth storage can be async on startup).
 * - Sync transactions, profile, and forecasts.
 * - Mark local rows as synced and optionally clean up.
 * - Emit a UI-friendly "sync-complete" event via an event bus port.
 */

import type {
  AuthSessionPort,
  BackendSyncPort,
  NetworkStatusPort,
  OfflineStorePort,
  SyncEventBusPort,
  SyncTrigger,
  UUID,
  OfflineTransaction,
  OfflineProfile,
  OfflineForecast,
} from "./ports/sync-ports";

export type SyncCoordinatorDeps = {
  auth: AuthSessionPort;
  backend: BackendSyncPort;
  offline: OfflineStorePort;
  network: NetworkStatusPort;
  events?: SyncEventBusPort;
  logger?: Pick<Console, "log" | "warn" | "error">;
};

export type SyncCoordinatorOptions = {
  /**
   * How many times to retry session retrieval before giving up.
   * Default: 3 (matches previous behavior).
   */
  maxSessionRetries?: number;

  /**
   * Delay (ms) between session retries.
   * Default: 2000ms.
   */
  sessionRetryDelayMs?: number;

  /**
   * If true, delete synced transactions from offline store after a successful run.
   * Default: true (matches previous behavior).
   */
  cleanupSyncedTransactions?: boolean;

  /**
   * If true, fail-fast when one category fails.
   * Default: false (best-effort, like Promise.allSettled).
   */
  failFast?: boolean;
};

export type SyncRunSummary = {
  trigger: SyncTrigger;
  startedAt: string;
  finishedAt: string;
  /**
   * Total categories attempted (transactions/profile/forecasts) that were actually run.
   * (If no session, totalCount=0)
   */
  totalCount: number;
  /** Count of categories that completed without throwing. */
  successCount: number;
  /** Count of categories that threw. */
  failureCount: number;
  /** Whether a sync run was skipped because it was offline or already in progress. */
  skipped: boolean;
  skipReason?: "offline" | "in-progress" | "no-session";
  errors?: Array<{ category: SyncCategory; cause: unknown }>;
};

type SyncCategory = "transactions" | "profile" | "forecasts";

/** Simple UUID validation to distinguish server ids from temp ids. */
function isValidUUID(value: string | undefined): value is string {
  if (!value) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

function isoNow(): string {
  return new Date().toISOString();
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export class SyncCoordinator {
  private readonly auth: AuthSessionPort;
  private readonly backend: BackendSyncPort;
  private readonly offline: OfflineStorePort;
  private readonly network: NetworkStatusPort;
  private readonly events?: SyncEventBusPort;
  private readonly logger: Pick<Console, "log" | "warn" | "error">;

  private readonly maxSessionRetries: number;
  private readonly sessionRetryDelayMs: number;
  private readonly cleanupSyncedTransactions: boolean;
  private readonly failFast: boolean;

  private syncInProgress = false;

  constructor(deps: SyncCoordinatorDeps, options: SyncCoordinatorOptions = {}) {
    this.auth = deps.auth;
    this.backend = deps.backend;
    this.offline = deps.offline;
    this.network = deps.network;
    this.events = deps.events;
    this.logger = deps.logger ?? console;

    this.maxSessionRetries = options.maxSessionRetries ?? 3;
    this.sessionRetryDelayMs = options.sessionRetryDelayMs ?? 2000;
    this.cleanupSyncedTransactions = options.cleanupSyncedTransactions ?? true;
    this.failFast = options.failFast ?? false;
  }

  /**
   * True when a sync run is currently in progress.
   * Useful for UI "syncing..." indicators.
   */
  isSyncing(): boolean {
    return this.syncInProgress;
  }

  /**
   * Run a full sync attempt.
   * - Skips if offline
   * - Skips if another sync is running
   * - Waits for auth session with retries; if no session, skip
   */
  async syncAll(trigger: SyncTrigger = "manual"): Promise<SyncRunSummary> {
    const startedAt = isoNow();

    // Guard: online
    if (!this.network.isOnline()) {
      this.logger.log("[SyncCoordinator] Skipping sync - offline");
      return {
        trigger,
        startedAt,
        finishedAt: isoNow(),
        totalCount: 0,
        successCount: 0,
        failureCount: 0,
        skipped: true,
        skipReason: "offline",
      };
    }

    // Guard: concurrent runs
    if (this.syncInProgress) {
      this.logger.log(`[SyncCoordinator] Skipping sync - already in progress (trigger: ${trigger})`);
      return {
        trigger,
        startedAt,
        finishedAt: isoNow(),
        totalCount: 0,
        successCount: 0,
        failureCount: 0,
        skipped: true,
        skipReason: "in-progress",
      };
    }

    this.syncInProgress = true;

    try {
      this.logger.log(`[SyncCoordinator] Starting sync (trigger: ${trigger})`);

      const session = await this.waitForSession();
      if (!session) {
        this.logger.log("[SyncCoordinator] No session available after retries, skipping sync");
        return {
          trigger,
          startedAt,
          finishedAt: isoNow(),
          totalCount: 0,
          successCount: 0,
          failureCount: 0,
          skipped: true,
          skipReason: "no-session",
        };
      }

      const userId = session.user.id;
      this.logger.log(`[SyncCoordinator] Session available for user: ${userId}`);

      const errors: Array<{ category: SyncCategory; cause: unknown }> = [];
      const categories: Array<() => Promise<void>> = [
        () => this.syncTransactions(userId),
        () => this.syncProfile(userId),
        () => this.syncForecasts(userId),
      ];
      const names: SyncCategory[] = ["transactions", "profile", "forecasts"];

      let successCount = 0;
      let failureCount = 0;

      if (this.failFast) {
        for (let i = 0; i < categories.length; i++) {
          try {
            await categories[i]();
            successCount++;
          } catch (e) {
            failureCount++;
            errors.push({ category: names[i], cause: e });
            break;
          }
        }
      } else {
        const results = await Promise.allSettled(categories.map((fn) => fn()));
        results.forEach((r, i) => {
          if (r.status === "fulfilled") successCount++;
          else {
            failureCount++;
            errors.push({ category: names[i], cause: r.reason });
          }
        });
      }

      // Optional cleanup: remove synced transactions from offline DB.
      if (this.cleanupSyncedTransactions && successCount > 0) {
        try {
          await this.offline.deleteSyncedTransactions();
          this.logger.log("[SyncCoordinator] Cleaned up synced transactions from offline storage");
        } catch (e) {
          // Cleanup failure should not mark the entire run as failed.
          this.logger.warn("[SyncCoordinator] Failed to cleanup synced transactions:", e);
        }
      }

      const totalCount = categories.length;
      const summary: SyncRunSummary = {
        trigger,
        startedAt,
        finishedAt: isoNow(),
        totalCount,
        successCount,
        failureCount,
        skipped: false,
        errors: errors.length ? errors : undefined,
      };

      // Emit event for UI (optional)
      if (this.events) {
        try {
          this.events.emitSyncComplete({ successCount, totalCount });
        } catch (e) {
          // No-op: eventing is optional
          this.logger.warn("[SyncCoordinator] Failed to emit sync-complete event:", e);
        }
      }

      // Also optionally surface errors
      if (errors.length && this.events?.emitSyncError) {
        try {
          this.events.emitSyncError({ message: "One or more sync categories failed", cause: errors });
        } catch {
          // ignore
        }
      }

      this.logger.log(
        `[SyncCoordinator] Sync completed: ${successCount} successful, ${failureCount} failed`
      );

      if (errors.length) {
        errors.forEach(({ category, cause }) => {
          this.logger.error(`[SyncCoordinator] Failed to sync ${category}:`, cause);
        });
      }

      return summary;
    } catch (fatal) {
      this.logger.error("[SyncCoordinator] Fatal sync error:", fatal);

      if (this.events?.emitSyncError) {
        try {
          this.events.emitSyncError({ message: "Fatal sync error", cause: fatal });
        } catch {
          // ignore
        }
      }

      return {
        trigger,
        startedAt,
        finishedAt: isoNow(),
        totalCount: 0,
        successCount: 0,
        failureCount: 1,
        skipped: false,
        errors: [{ category: "transactions", cause: fatal }], // best-effort categorization
      };
    } finally {
      this.syncInProgress = false;
      this.logger.log("[SyncCoordinator] Sync finished");
    }
  }

  /**
   * Wait for auth session with retry logic.
   * This handles cases where auth state isn't immediately available after boot.
   */
  private async waitForSession(): Promise<{ user: { id: UUID } } | null> {
    for (let attempt = 0; attempt < this.maxSessionRetries; attempt++) {
      try {
        const session = await this.auth.getSession();
        if (session) {
          if (attempt > 0) {
            this.logger.log(`[SyncCoordinator] Session available after ${attempt + 1} attempt(s)`);
          }
          return session;
        }

        this.logger.log(
          `[SyncCoordinator] No session yet (attempt ${attempt + 1}/${this.maxSessionRetries})`
        );
      } catch (e) {
        this.logger.warn(
          `[SyncCoordinator] Session retrieval error (attempt ${attempt + 1}/${this.maxSessionRetries}):`,
          e
        );
      }

      if (attempt < this.maxSessionRetries - 1) {
        await sleep(this.sessionRetryDelayMs);
      }
    }
    return null;
  }

  /**
   * Sync offline transactions:
   * - New offline transactions (no valid UUID id): INSERT → mark synced by local_id with server id
   * - Previously synced transactions modified offline (valid UUID id + synced===false): UPDATE → mark synced by id
   *
   * IMPORTANT identity rules:
   * - `local_id` is offline-only and must never be sent to backend.
   * - `id` is server UUID and is used for updates.
   */
  async syncTransactions(userId: UUID): Promise<void> {
    this.logger.log(`[SyncCoordinator] Syncing transactions for user: ${userId}`);

    const unsynced = await this.offline.getUnsyncedTransactions();
    // Include rows for this user OR rows without user_id (created offline before session known).
    const userUnsynced = unsynced.filter((t) => !t.user_id || t.user_id === userId);

    this.logger.log(
      `[SyncCoordinator] Found ${userUnsynced.length} unsynced transaction(s) for current user`
    );

    if (userUnsynced.length === 0) return;

    for (const offlineTx of userUnsynced) {
      await this.syncSingleTransaction(userId, offlineTx);
    }
  }

  private async syncSingleTransaction(userId: UUID, offlineTx: OfflineTransaction): Promise<void> {
    try {
      const hasValidDbId = isValidUUID(offlineTx.id) && offlineTx.synced === false;

      if (hasValidDbId && offlineTx.id) {
        // UPDATE existing server row
        const dbId = offlineTx.id;

        await this.backend.updateTransactionById(dbId, {
          type: offlineTx.type,
          amount: Number(offlineTx.amount),
          category: (offlineTx.category ?? "").trim() ? offlineTx.category!.trim() : null,
          date: offlineTx.date,
        });

        await this.offline.markTransactionSyncedById(dbId);
        return;
      }

      // INSERT new server row
      if (!offlineTx.local_id) {
        // Without local_id we can't mark it synced; treat as an error for this row.
        throw new Error("Offline transaction missing local_id (cannot mark synced after insert).");
      }

      const createdAt = offlineTx.created_at || isoNow();

      const inserted = await this.backend.insertTransaction({
        user_id: userId,
        created_at: createdAt,
        type: offlineTx.type,
        amount: Number(offlineTx.amount),
        category: (offlineTx.category ?? "").trim() ? offlineTx.category!.trim() : null,
        date: offlineTx.date,
      });

      await this.offline.markTransactionSynced(offlineTx.local_id, inserted.id);
    } catch (e) {
      // Best-effort: do not fail the whole category because one row failed.
      this.logger.error("[SyncCoordinator] Failed to sync a transaction row:", e, offlineTx);
    }
  }

  /**
   * Sync profile:
   * - Reads profile from offline store
   * - If not present or already synced => no-op
   * - Upserts to backend then marks local as synced
   */
  async syncProfile(userId: UUID): Promise<void> {
    const profile = await this.offline.getProfile(userId);
    if (!profile || profile.synced) return;

    this.logger.log(`[SyncCoordinator] Syncing profile for user: ${userId}`);

    const result = await this.backend.upsertProfile({
      id: profile.id,
      full_name: profile.full_name,
      email: profile.email,
      phone: profile.phone,
    });

    // Mark local profile as synced (by user id)
    if (result?.id) {
      await this.offline.markProfileSynced(userId);
    }
  }

  /**
   * Sync forecasts:
   * - Loads unsynced forecasts and filters by user
   * - Upserts each forecast to backend
   * - Marks local forecast as synced by re-saving it with server id + synced=true
   *
   * Note: current offline store API does not have "markForecastSynced"; we keep compatibility.
   */
  async syncForecasts(userId: UUID): Promise<void> {
    const unsynced = await this.offline.getUnsyncedForecasts();
    const userUnsynced = unsynced.filter((f) => f.user_id === userId);

    if (userUnsynced.length === 0) return;

    this.logger.log(`[SyncCoordinator] Syncing ${userUnsynced.length} forecast(s) for user: ${userId}`);

    for (const forecast of userUnsynced) {
      try {
        const upserted = await this.backend.upsertForecast({
          user_id: forecast.user_id,
          month_index: forecast.month_index,
          income: forecast.income,
          expense: forecast.expense,
          note: forecast.note,
        });

        await this.offline.saveForecast({
          ...forecast,
          id: upserted.id,
          synced: true,
        });
      } catch (e) {
        // Best-effort: continue with next forecast
        this.logger.error("[SyncCoordinator] Failed to sync a forecast row:", e, forecast);
      }
    }
  }
}
