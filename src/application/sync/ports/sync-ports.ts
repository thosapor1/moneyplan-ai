/**
 * Application: Sync Ports
 *
 * These are *interfaces* (ports) used by the application layer to perform
 * offline→online synchronization without depending on any specific technology
 * (Supabase, IndexedDB, etc).
 *
 * Junior-friendly rule of thumb:
 * - Application layer defines WHAT it needs (ports).
 * - Infrastructure layer provides HOW to do it (adapters implementing these ports).
 */

export type UUID = string

export type SyncTrigger =
  | 'manual'
  | 'online-event'
  | 'offline-event'
  | 'visibility-change'
  | 'focus-event'
  | 'startup'
  | (string & {})

export type TransactionType = 'income' | 'expense'

/**
 * Session returned by your auth provider.
 * Keep it minimal: the sync use-case only needs the current user id.
 */
export type AuthSession = {
  user: {
    id: UUID
  }
}

/**
 * Port: Auth/session provider
 * - returns current session or null
 * - may transiently fail (e.g., storage not ready); caller can retry
 */
export interface AuthSessionPort {
  getSession(): Promise<AuthSession | null>
}

/**
 * Transaction shape used for syncing.
 * Notes:
 * - `local_id` is an offline-only identity (IndexedDB primary key).
 * - `id` is the server UUID (set after successful sync).
 * - `synced` tells whether the local row is confirmed synced.
 */
export type OfflineTransaction = {
  id?: UUID
  local_id?: string
  user_id?: UUID

  type: TransactionType
  amount: number
  category?: string
  description?: string
  date: string

  created_at?: string
  updated_at?: string

  synced?: boolean
}

export type OfflineProfile = {
  id: UUID
  full_name?: string
  email?: string
  phone?: string
  updated_at?: string
  synced?: boolean
}

export type OfflineForecast = {
  id?: UUID
  user_id: UUID
  month_index: number
  income: number
  expense: number
  note?: string
  synced?: boolean
  temp_id?: string
}

/**
 * Port: Offline storage
 * The application layer only cares about reading unsynced data and marking it synced.
 */
export interface OfflineStorePort {
  // Transactions
  getUnsyncedTransactions(): Promise<OfflineTransaction[]>
  markTransactionSynced(localId: string, dbId: UUID): Promise<void>
  markTransactionSyncedById(id: UUID): Promise<void>
  deleteSyncedTransactions(): Promise<void>

  // Profile
  getProfile(userId: UUID): Promise<OfflineProfile | null>
  markProfileSynced(userId: UUID): Promise<void>

  // Forecasts
  getUnsyncedForecasts(): Promise<OfflineForecast[]>
  saveForecast(forecast: OfflineForecast): Promise<void>
}

/**
 * Port: Backend persistence (remote data source)
 * This describes the minimum operations required for sync.
 *
 * Implementation will live in infrastructure (e.g. Supabase adapter).
 */
export interface BackendSyncPort {
  /**
   * Insert a new transaction. Must return the created row id (UUID).
   * Must NOT accept/require `local_id`.
   */
  insertTransaction(input: {
    user_id: UUID
    created_at: string
    type: TransactionType
    amount: number
    category: string | null
    date: string
  }): Promise<{ id: UUID }>

  /**
   * Update an existing transaction by server UUID.
   * Used when a previously synced transaction was modified offline.
   */
  updateTransactionById(
    id: UUID,
    input: {
      type: TransactionType
      amount: number
      category: string | null
      date: string
    }
  ): Promise<void>

  /**
   * Upsert profile fields.
   * (Keep it aligned with your backend schema; implementation can map fields as needed.)
   */
  upsertProfile(input: {
    id: UUID
    full_name?: string
    email?: string
    phone?: string
  }): Promise<{ id: UUID }>

  /**
   * Upsert forecast row for a user+month.
   */
  upsertForecast(input: {
    user_id: UUID
    month_index: number
    income: number
    expense: number
    note?: string
  }): Promise<{ id: UUID }>
}

/**
 * Port: Network status + scheduling hooks
 * Keep the application logic testable by abstracting browser APIs.
 */
export interface NetworkStatusPort {
  isOnline(): boolean
}

/**
 * Port: App eventing (optional)
 * Used to publish "sync complete" events to the UI without coupling.
 */
export interface SyncEventBusPort {
  emitSyncComplete(detail: { successCount: number; totalCount: number }): void
  emitSyncError?(detail: { message: string; cause?: unknown }): void
}
