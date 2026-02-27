/**
 * Infrastructure: OfflineStoreAdapter (IndexedDB)
 *
 * Wraps the existing `offlineDB` (IndexedDB implementation) and exposes it via
 * the application-layer `OfflineStorePort`.
 *
 * Clean Architecture notes:
 * - Application layer depends on the `OfflineStorePort` interface only.
 * - This adapter is infrastructure and is allowed to use browser-only APIs indirectly.
 * - `offlineDB` already guards/initializes IndexedDB internally.
 */

import type {
  OfflineForecast,
  OfflineProfile,
  OfflineStorePort,
  OfflineTransaction,
  UUID,
} from "@/src/application/sync/ports/sync-ports";

import {
  offlineDB,
  type OfflineForecast as InfraOfflineForecast,
  type OfflineProfile as InfraOfflineProfile,
  type OfflineTransaction as InfraOfflineTransaction,
} from "@/src/infrastructure/offline/offline-db";

function toAppTransaction(t: InfraOfflineTransaction): OfflineTransaction {
  return {
    id: t.id,
    local_id: t.local_id,
    user_id: t.user_id as UUID | undefined,
    type: t.type,
    amount: Number(t.amount),
    category: t.category,
    description: t.description,
    date: t.date,
    created_at: t.created_at,
    updated_at: t.updated_at,
    synced: t.synced,
  };
}

function toAppProfile(p: InfraOfflineProfile): OfflineProfile {
  return {
    id: p.id as UUID,
    full_name: p.full_name,
    email: p.email,
    phone: p.phone,
    updated_at: p.updated_at,
    synced: p.synced,
  };
}

function toAppForecast(f: InfraOfflineForecast): OfflineForecast {
  return {
    id: f.id,
    user_id: f.user_id as UUID,
    month_index: f.month_index,
    income: Number(f.income),
    expense: Number(f.expense),
    note: f.note,
    synced: f.synced,
    temp_id: f.temp_id,
  };
}

function toInfraForecast(f: OfflineForecast): InfraOfflineForecast {
  return {
    id: f.id,
    user_id: f.user_id,
    month_index: f.month_index,
    income: Number(f.income),
    expense: Number(f.expense),
    note: f.note,
    synced: f.synced,
    temp_id: f.temp_id,
  };
}

/**
 * Adapter class that satisfies `OfflineStorePort` by delegating to `offlineDB`.
 */
export class OfflineStoreAdapter implements OfflineStorePort {
  // Transactions
  async getUnsyncedTransactions(): Promise<OfflineTransaction[]> {
    const rows = await offlineDB.getUnsyncedTransactions();
    return rows.map(toAppTransaction);
  }

  async markTransactionSynced(localId: string, dbId: UUID): Promise<void> {
    await offlineDB.markTransactionSynced(localId, dbId);
  }

  async markTransactionSyncedById(id: UUID): Promise<void> {
    await offlineDB.markTransactionSyncedById(id);
  }

  async deleteSyncedTransactions(): Promise<void> {
    await offlineDB.deleteSyncedTransactions();
  }

  // Profile
  async getProfile(userId: UUID): Promise<OfflineProfile | null> {
    const profile = await offlineDB.getProfile(userId);
    return profile ? toAppProfile(profile) : null;
  }

  async markProfileSynced(userId: UUID): Promise<void> {
    await offlineDB.markProfileSynced(userId);
  }

  // Forecasts
  async getUnsyncedForecasts(): Promise<OfflineForecast[]> {
    const rows = await offlineDB.getUnsyncedForecasts();
    return rows.map(toAppForecast);
  }

  async saveForecast(forecast: OfflineForecast): Promise<void> {
    await offlineDB.saveForecast(toInfraForecast(forecast));
  }
}

/** Convenience singleton instance. Prefer injecting this at the composition root. */
export const offlineStoreAdapter = new OfflineStoreAdapter();
