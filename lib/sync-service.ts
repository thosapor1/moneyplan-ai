// Sync service สำหรับ sync ข้อมูลเมื่อกลับมาออนไลน์
import { supabase } from './supabase'
import { offlineDB, OfflineTransaction, OfflineProfile, OfflineForecast } from './offline-db'

/**
 * SyncService - Singleton service for syncing offline data to backend
 * 
 * Lifecycle:
 * - Instantiated once at module load
 * - Event listeners set up by initialize() method (called from AppInitializer)
 * - Syncs run from application runtime, not Service Worker
 */
export class SyncService {
  private isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true
  private syncInProgress = false
  private initialized = false
  private syncRetryCount = 0
  private readonly MAX_RETRIES = 3
  private readonly RETRY_DELAY = 2000 // 2 seconds

  /**
   * Initialize event listeners - should be called once from AppInitializer
   * This ensures listeners are set up exactly once
   */
  initialize(): void {
    if (this.initialized || typeof window === 'undefined') {
      return
    }

    console.log('[Sync Service] Initializing event listeners...')
    
    // Online/offline events
    window.addEventListener('online', this.handleOnline.bind(this))
    window.addEventListener('offline', this.handleOffline.bind(this))
    
    // Visibility change - sync when app regains focus
    document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this))
    
    // Focus event - sync when window regains focus
    window.addEventListener('focus', this.handleFocus.bind(this))
    
    this.initialized = true
    console.log('[Sync Service] Event listeners initialized')
  }

  private handleOnline(): void {
    console.log('[Sync Service] ⚡ Network online event detected')
    this.isOnline = true
    // Small delay to ensure network is stable
    setTimeout(() => this.attemptSync('online-event'), 500)
  }

  private handleOffline(): void {
    console.log('[Sync Service] 📴 Network offline event detected')
    this.isOnline = false
  }

  private handleVisibilityChange(): void {
    if (!document.hidden && this.isOnline) {
      console.log('[Sync Service] 👁️ App became visible, checking for sync...')
      this.attemptSync('visibility-change')
    }
  }

  private handleFocus(): void {
    if (this.isOnline) {
      console.log('[Sync Service] 🎯 Window gained focus, checking for sync...')
      this.attemptSync('focus-event')
    }
  }

  /**
   * Attempt sync with retry logic for session availability
   */
  private async attemptSync(trigger: string): Promise<void> {
    if (this.syncInProgress) {
      console.log(`[Sync Service] ⏸️ Sync already in progress, skipping (trigger: ${trigger})`)
      return
    }

    console.log(`[Sync Service] 🔄 Sync attempt triggered by: ${trigger}`)
    await this.syncAll()
  }

  /**
   * Main sync method - ensures session is available before syncing
   * Uses retry logic if session is not immediately available
   */
  async syncAll(): Promise<void> {
    // Guard: Check online status and prevent duplicate syncs
    this.isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true
    
    if (!this.isOnline) {
      console.log('[Sync Service] ❌ Skipping sync - offline')
      return
    }

    if (this.syncInProgress) {
      console.log('[Sync Service] ⏸️ Sync already in progress, skipping')
      return
    }

    this.syncInProgress = true
    this.syncRetryCount = 0
    console.log('[Sync Service] 🚀 Starting sync process...')

    try {
      // Wait for session with retry logic
      const session = await this.waitForSession()
      if (!session) {
        console.log('[Sync Service] ⚠️ No session available after retries, skipping sync')
        this.syncInProgress = false
        return
      }

      console.log(`[Sync Service] ✅ Session available for user: ${session.user.id}`)

      // Sync all data types in parallel
      const results = await Promise.allSettled([
        this.syncTransactions(session.user.id),
        this.syncProfile(session.user.id),
        this.syncForecasts(session.user.id),
      ])

      const successCount = results.filter(r => r.status === 'fulfilled').length
      const failureCount = results.filter(r => r.status === 'rejected').length
      
      console.log(`[Sync Service] ✅ Sync completed: ${successCount} successful, ${failureCount} failed`)

      // Log any failures
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          const types = ['transactions', 'profile', 'forecasts']
          console.error(`[Sync Service] ❌ Failed to sync ${types[index]}:`, result.reason)
        }
      })

      // Clean up synced transactions from IndexedDB to avoid duplicates
      if (successCount > 0) {
        try {
          await offlineDB.deleteSyncedTransactions()
          console.log('[Sync Service] 🧹 Cleaned up synced transactions from IndexedDB')
        } catch (error) {
          console.error('[Sync Service] ❌ Error cleaning up synced transactions:', error)
        }
      }

      // Dispatch sync complete event for UI updates
      if (typeof window !== 'undefined' && successCount > 0) {
        const event = new CustomEvent('sync-complete', { 
          detail: { successCount, totalCount: results.length } 
        })
        window.dispatchEvent(event)
        console.log('[Sync Service] 📢 Dispatched sync-complete event')
      }
    } catch (error) {
      console.error('[Sync Service] ❌ Fatal sync error:', error)
    } finally {
      this.syncInProgress = false
      console.log('[Sync Service] 🏁 Sync process finished')
    }
  }

  /**
   * Wait for Supabase session with retry logic
   * Returns session or null after max retries
   */
  private async waitForSession(): Promise<any> {
    for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (session) {
        if (attempt > 0) {
          console.log(`[Sync Service] ✅ Session available after ${attempt + 1} attempt(s)`)
        }
        return session
      }

      if (error) {
        console.warn(`[Sync Service] ⚠️ Session error (attempt ${attempt + 1}/${this.MAX_RETRIES}):`, error)
      } else {
        console.log(`[Sync Service] ⏳ No session yet (attempt ${attempt + 1}/${this.MAX_RETRIES})`)
      }

      // Wait before retry (except on last attempt)
      if (attempt < this.MAX_RETRIES - 1) {
        await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY))
      }
    }

    return null
  }

  async syncTransactions(userId: string): Promise<void> {
    try {
      console.log(`[Sync Service] 📊 Starting transaction sync for user: ${userId}`)
      const unsynced = await offlineDB.getUnsyncedTransactions()
      console.log(`[Sync Service] 📦 Found ${unsynced.length} total unsynced transactions in IndexedDB`)
      
      // Filter by user_id (user_id is optional offline, will be injected during sync)
      // Include transactions that either match userId or have no user_id (will be set during sync)
      const userUnsynced = unsynced.filter((t) => !t.user_id || t.user_id === userId)
      console.log(`[Sync Service] 👤 Found ${userUnsynced.length} unsynced transactions for current user`)

      if (userUnsynced.length === 0) {
        console.log('[Sync Service] ✅ No transactions to sync')
        return
      }

      console.log(`[Sync Service] 🔄 Syncing ${userUnsynced.length} transactions to backend...`)

      for (const offlineTx of userUnsynced) {
        try {
          // CRITICAL: Separate offline identity from DB identity
          // - local_id (temp_xxx) is ONLY for IndexedDB, NEVER sent to Supabase
          // - id (uuid) is ONLY from Supabase, set after successful sync
          
          // Validate that id is a UUID (not a temp string)
          // UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
          const isValidUUID = (str: string | undefined): str is string => {
            if (!str) return false
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
            return uuidRegex.test(str)
          }
          
          // Check if this transaction already has a valid DB UUID (was synced before)
          // If it has a valid UUID id, it means it exists in DB - we should UPDATE, not INSERT
          const hasValidDbId = offlineTx.id && isValidUUID(offlineTx.id) && offlineTx.synced === false
          
          if (hasValidDbId && offlineTx.id) {
            // UPDATE: Transaction exists in DB but was modified offline
            // CRITICAL: offlineTx.id is a valid UUID at this point (validated above)
            const dbId: string = offlineTx.id // TypeScript now knows this is a string
            
            const updatePayload = {
              type: offlineTx.type,
              amount: Number(offlineTx.amount), // Ensure it's a number
              category: offlineTx.category || null,
              date: offlineTx.date,
            }
            
            console.log(`[Sync Service] 🔄 Updating existing transaction:`)
            console.log(`[Sync Service] DB ID (UUID): ${dbId}`)
            console.log(`[Sync Service] Local ID: ${offlineTx.local_id}`)
            console.log(`[Sync Service] Update payload:`, JSON.stringify(updatePayload, null, 2))
            
            const result = await supabase
              .from('transactions')
              .update(updatePayload)
              .eq('id', dbId) // CRITICAL: Use DB UUID, never local_id
              .select()
              .single()

            if (result.error) {
              console.error(`[Sync Service] ❌ Update failed for transaction ${dbId}:`, result.error)
              console.error(`[Sync Service] Error details:`, {
                code: result.error.code,
                message: result.error.message,
                details: result.error.details,
                hint: result.error.hint,
              })
              console.error(`[Sync Service] Update payload:`, JSON.stringify(updatePayload, null, 2))
              throw result.error
            }

            console.log(`[Sync Service] ✅ Successfully updated transaction ${dbId}`)
            
            // Mark as synced
            await offlineDB.markTransactionSyncedById(dbId)
            console.log(`[Sync Service] ✅ Marked transaction ${dbId} as synced in IndexedDB`)
            
          } else {
            // INSERT: New transaction - has no DB ID yet
            // CRITICAL: Never include id or local_id in insert payload
            // CRITICAL: Always use authenticated userId (not from offline transaction)
            // CRITICAL: Always include created_at
            
            const createdAt = offlineTx.created_at || new Date().toISOString()
            
            // Validate local_id exists
            if (!offlineTx.local_id) {
              console.error(`[Sync Service] ❌ Transaction missing local_id, skipping`)
              throw new Error('Transaction missing local_id')
            }
            
            // Map OfflineTransaction → DbTransaction explicitly
            // Only include fields that exist in DB schema
            const insertPayload = {
              // REQUIRED: Always use authenticated userId (RLS requirement)
              user_id: userId,
              // REQUIRED: created_at must exist (NOT NULL constraint)
              created_at: createdAt,
              // Required fields
              type: offlineTx.type,
              amount: Number(offlineTx.amount), // Ensure it's a number
              date: offlineTx.date, // Should be YYYY-MM-DD format
              // Optional fields (only include fields that exist in DB schema)
              category: offlineTx.category || null,
              // Note: 'description' field does not exist in transactions table schema
              // Note: Never include 'id' (DB generates UUID)
              // Note: Never include 'local_id' (offline-only)
            }
            
            console.log(`[Sync Service] 📤 Inserting new transaction to Supabase:`)
            console.log(`[Sync Service] Local ID: ${offlineTx.local_id}`)
            console.log(`[Sync Service] Insert payload:`, JSON.stringify(insertPayload, null, 2))
            
            const result = await supabase
              .from('transactions')
              .insert(insertPayload)
              .select()
              .single()

            if (result.error) {
              console.error(`[Sync Service] ❌ Insert failed:`, result.error)
              console.error(`[Sync Service] Error code: ${result.error.code}, message: ${result.error.message}`)
              console.error(`[Sync Service] Error details:`, result.error.details)
              console.error(`[Sync Service] Error hint:`, result.error.hint)
              console.error(`[Sync Service] Insert payload:`, JSON.stringify(insertPayload, null, 2))
              console.error(`[Sync Service] Offline transaction:`, JSON.stringify(offlineTx, null, 2))
              throw result.error
            }

            if (!result.data || !result.data.id) {
              throw new Error('Insert succeeded but no data or ID returned from Supabase')
            }

            const dbId = result.data.id // UUID from Supabase
            console.log(`[Sync Service] ✅ Successfully inserted transaction`)
            console.log(`[Sync Service] Local ID: ${offlineTx.local_id} → DB ID: ${dbId}`)
            console.log(`[Sync Service] Inserted data:`, JSON.stringify(result.data, null, 2))
            
            // Mark as synced in IndexedDB using local_id
            // This updates the offline record with the DB UUID
            if (offlineTx.local_id) {
              await offlineDB.markTransactionSynced(offlineTx.local_id, dbId)
              console.log(`[Sync Service] ✅ Marked transaction ${offlineTx.local_id} as synced (DB ID: ${dbId})`)
            } else {
              console.error(`[Sync Service] ❌ No local_id found for synced transaction, cannot mark in IndexedDB`)
              throw new Error('Cannot mark transaction as synced: missing local_id')
            }
          }
        } catch (error: any) {
          console.error(`[Sync Service] ❌ Failed to sync transaction:`, error)
          console.error(`[Sync Service] Error details:`, {
            code: error?.code,
            message: error?.message,
            details: error?.details,
            hint: error?.hint,
          })
          console.error(`[Sync Service] Offline transaction:`, JSON.stringify(offlineTx, null, 2))
          // Continue with next transaction - don't fail entire sync
        }
      }
      
      console.log(`[Sync Service] ✅ Transaction sync completed for user: ${userId}`)
    } catch (error) {
      console.error(`[Sync Service] ❌ Fatal error syncing transactions:`, error)
      throw error // Re-throw to be caught by Promise.allSettled
    }
  }

  async syncProfile(userId: string): Promise<void> {
    try {
      const profile = await offlineDB.getProfile(userId)
      if (!profile || profile.synced) return

      console.log('[Sync Service] Syncing profile...')

      const { data, error } = await supabase
        .from('profiles')
        .upsert({
          id: profile.id,
          full_name: profile.full_name,
          email: profile.email,
          phone: profile.phone,
        })
        .select()
        .single()

      if (error) throw error

      if (data) {
        await offlineDB.markProfileSynced(userId)
      }
    } catch (error) {
      console.error('[Sync Service] Error syncing profile:', error)
    }
  }

  async syncForecasts(userId: string): Promise<void> {
    try {
      const unsynced = await offlineDB.getUnsyncedForecasts()
      const userUnsynced = unsynced.filter((f) => f.user_id === userId)

      if (userUnsynced.length === 0) return

      console.log(`[Sync Service] Syncing ${userUnsynced.length} forecasts...`)

      for (const forecast of userUnsynced) {
        try {
          const { data, error } = await supabase
            .from('forecasts')
            .upsert({
              user_id: forecast.user_id,
              month_index: forecast.month_index,
              income: forecast.income,
              expense: forecast.expense,
              note: forecast.note,
            })
            .select()
            .single()

          if (error) throw error

          if (data && forecast.temp_id) {
            // Mark as synced (simplified - forecasts don't need temp_id tracking)
            await offlineDB.saveForecast({
              ...forecast,
              id: data.id,
              synced: true,
            })
          }
        } catch (error) {
          console.error('[Sync Service] Failed to sync forecast:', error)
        }
      }
    } catch (error) {
      console.error('[Sync Service] Error syncing forecasts:', error)
    }
  }

  async saveTransactionOffline(transaction: OfflineTransaction): Promise<void> {
    // Ensure local_id exists (will be generated if not provided)
    const txWithLocalId: OfflineTransaction = {
      ...transaction,
      local_id: transaction.local_id || `temp_${Date.now()}_${Math.random()}`,
    }
    
    await offlineDB.saveTransaction(txWithLocalId)

    // Try to sync immediately if online
    if (this.isOnline) {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        // Trigger sync but don't wait (fire and forget)
        this.syncTransactions(session.user.id).catch(err => {
          console.error('[Sync Service] Immediate sync failed:', err)
        })
      }
    }
  }

  async saveProfileOffline(profile: OfflineProfile): Promise<void> {
    await offlineDB.saveProfile(profile)

    // Try to sync immediately if online
    if (this.isOnline) {
      await this.syncProfile(profile.id)
    }
  }

  async saveForecastOffline(forecast: OfflineForecast): Promise<void> {
    await offlineDB.saveForecast(forecast)

    // Try to sync immediately if online
    if (this.isOnline) {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        await this.syncForecasts(session.user.id)
      }
    }
  }

  isOnlineStatus(): boolean {
    return this.isOnline
  }

  /**
   * Check if sync is currently in progress
   */
  isSyncing(): boolean {
    return this.syncInProgress
  }
}

/**
 * Singleton instance - instantiated once at module load
 * Event listeners are set up via initialize() method called from AppInitializer
 */
export const syncService = new SyncService()
