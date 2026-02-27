/**
 * Infrastructure: Sync Service (composition root)
 *
 * Purpose:
 * - Wire the application-layer `SyncCoordinator` with infrastructure adapters (Supabase, IndexedDB, browser APIs).
 * - Provide a small, stable API that the UI can use (initialize listeners, manual sync, save-offline helpers).
 *
 * Clean Architecture notes:
 * - `SyncCoordinator` lives in application layer and depends only on ports.
 * - This module is infrastructure because it touches browser globals and concrete adapters.
 * - During the incremental refactor, `lib/sync-service.ts` can re-export from here.
 *
 * SSR safety:
 * - This module is safe to import in Next.js, but calling `initialize()` should only happen on the client.
 */

import { SyncCoordinator } from "@/src/application/sync/sync-coordinator";
import type { SyncTrigger } from "@/src/application/sync/ports/sync-ports";

import { supabaseAuthSessionAdapter } from "@/src/infrastructure/sync/supabase-auth-session";
import { supabaseBackendSyncAdapter } from "@/src/infrastructure/sync/supabase-backend-sync";
import { offlineStoreAdapter } from "@/src/infrastructure/sync/offline-store-adapter";
import { browserNetworkStatusAdapter } from "@/src/infrastructure/sync/browser-network-status";
import { windowSyncEventBus } from "@/src/infrastructure/sync/window-sync-event-bus";

import { offlineDB, type OfflineForecast, type OfflineProfile, type OfflineTransaction } from "@/src/infrastructure/offline/offline-db";
import { supabase } from "@/src/infrastructure/supabase/supabase";

/**
 * `SyncService`:
 * - client-runtime singleton with event listener management
 * - delegates synchronization to `SyncCoordinator`
 *
 * Note for juniors:
 * - Keep this class "thin": it should not contain business rules.
 * - Most workflow belongs in `SyncCoordinator` (application layer).
 */
export class SyncService {
  private initialized = false;

  // Keep lightweight flags for UI
  private isOnlineValue = typeof navigator !== "undefined" ? navigator.onLine : true;

  private readonly coordinator: SyncCoordinator;

  constructor() {
    this.coordinator = new SyncCoordinator(
      {
        auth: supabaseAuthSessionAdapter,
        backend: supabaseBackendSyncAdapter,
        offline: offlineStoreAdapter,
        network: browserNetworkStatusAdapter,
        events: windowSyncEventBus,
        logger: console,
      },
      {
        maxSessionRetries: 3,
        sessionRetryDelayMs: 2000,
        cleanupSyncedTransactions: true,
        failFast: false,
      }
    );
  }

  /**
   * Initialize browser event listeners (call once from a client component, e.g. AppInitializer).
   * - online/offline
   * - visibilitychange
   * - focus
   */
  initialize(): void {
    if (this.initialized) return;
    if (typeof window === "undefined") return;

    console.log("[Sync Service] Initializing event listeners...");

    window.addEventListener("online", this.handleOnline);
    window.addEventListener("offline", this.handleOffline);
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
    window.addEventListener("focus", this.handleFocus);

    this.initialized = true;
    console.log("[Sync Service] Event listeners initialized");
  }

  /**
   * Manual entrypoint: trigger a full sync.
   * This is safe to call from UI buttons or after an offline save.
   */
  async syncAll(trigger: SyncTrigger = "manual"): Promise<void> {
    await this.coordinator.syncAll(trigger);
  }

  /**
   * Preserve the old API shape used by the app:
   * - used by UI banners and status
   */
  isOnlineStatus(): boolean {
    return this.isOnlineValue;
  }

  /**
   * Preserve the old API shape used by the app:
   * - used by UI banners and status
   */
  isSyncing(): boolean {
    return this.coordinator.isSyncing();
  }

  /**
   * Save transaction to offline store and attempt quick sync (fire-and-forget).
   * This mirrors previous behavior for incremental refactor safety.
   */
  async saveTransactionOffline(transaction: OfflineTransaction): Promise<void> {
    // Ensure local_id exists (offline identity)
    const txWithLocalId: OfflineTransaction = {
      ...transaction,
      local_id: transaction.local_id || `temp_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    };

    await offlineDB.saveTransaction(txWithLocalId);

    if (this.isOnlineStatus()) {
      // Best-effort: try immediate sync for the current user if session exists.
      const { data } = await supabase.auth.getSession();
      const session = (data as any)?.session;
      const userId = session?.user?.id as string | undefined;

      if (userId) {
        this.coordinator.syncTransactions(userId).catch((err) => {
          console.error("[Sync Service] Immediate transaction sync failed:", err);
        });
      }
    }
  }

  /**
   * Save profile to offline store and attempt quick sync.
   */
  async saveProfileOffline(profile: OfflineProfile): Promise<void> {
    await offlineDB.saveProfile(profile);

    if (this.isOnlineStatus()) {
      const userId = profile.id;
      // Best-effort: keep the same behavior (sync that specific profile)
      this.coordinator.syncProfile(userId).catch((err) => {
        console.error("[Sync Service] Immediate profile sync failed:", err);
      });
    }
  }

  /**
   * Save forecast to offline store and attempt quick sync.
   */
  async saveForecastOffline(forecast: OfflineForecast): Promise<void> {
    await offlineDB.saveForecast(forecast);

    if (this.isOnlineStatus()) {
      const { data } = await supabase.auth.getSession();
      const session = (data as any)?.session;
      const userId = session?.user?.id as string | undefined;

      if (userId) {
        this.coordinator.syncForecasts(userId).catch((err) => {
          console.error("[Sync Service] Immediate forecast sync failed:", err);
        });
      }
    }
  }

  // -------------------------
  // Event handlers (bound as arrow fns)
  // -------------------------

  private handleOnline = (): void => {
    console.log("[Sync Service] Network online event detected");
    this.isOnlineValue = true;

    // Small delay to allow network to stabilize
    setTimeout(() => {
      this.coordinator.syncAll("online-event").catch((err) => {
        console.error("[Sync Service] Sync on online-event failed:", err);
      });
    }, 500);
  };

  private handleOffline = (): void => {
    console.log("[Sync Service] Network offline event detected");
    this.isOnlineValue = false;
  };

  private handleVisibilityChange = (): void => {
    if (typeof document === "undefined") return;
    if (document.hidden) return;
    if (!this.isOnlineStatus()) return;

    console.log("[Sync Service] App became visible, checking for sync...");
    this.coordinator.syncAll("visibility-change").catch((err) => {
      console.error("[Sync Service] Sync on visibility-change failed:", err);
    });
  };

  private handleFocus = (): void => {
    if (!this.isOnlineStatus()) return;

    console.log("[Sync Service] Window gained focus, checking for sync...");
    this.coordinator.syncAll("focus-event").catch((err) => {
      console.error("[Sync Service] Sync on focus-event failed:", err);
    });
  };
}

/**
 * Singleton instance — matches previous `lib/sync-service.ts` export style.
 * UI should import this via legacy shim until we migrate imports to `src/**`.
 */
export const syncService = new SyncService();
