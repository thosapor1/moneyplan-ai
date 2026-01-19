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
      
      const userUnsynced = unsynced.filter((t) => t.user_id === userId)
      console.log(`[Sync Service] 👤 Found ${userUnsynced.length} unsynced transactions for current user`)

      if (userUnsynced.length === 0) {
        console.log('[Sync Service] ✅ No transactions to sync')
        return
      }

      console.log(`[Sync Service] 🔄 Syncing ${userUnsynced.length} transactions to backend...`)

      for (const transaction of userUnsynced) {
        try {
          let data: any = null
          let error: any = null

          // ถ้ามี id แสดงว่าเป็น transaction ที่มีอยู่แล้ว (update)
          if (transaction.id) {
            const result = await supabase
              .from('transactions')
              .update({
                type: transaction.type,
                amount: transaction.amount,
                category: transaction.category || null,
                description: transaction.description || null,
                date: transaction.date,
              })
              .eq('id', transaction.id)
              .select()
              .single()

            data = result.data
            error = result.error
          } else {
            // ถ้าไม่มี id แสดงว่าเป็น transaction ใหม่ (insert)
            const result = await supabase
              .from('transactions')
              .insert({
                user_id: transaction.user_id,
                type: transaction.type,
                amount: transaction.amount,
                category: transaction.category || null,
                description: transaction.description || null,
                date: transaction.date,
              })
              .select()
              .single()

            data = result.data
            error = result.error
          }

          if (error) throw error

          // Mark as synced in IndexedDB
          if (data) {
            if (transaction.temp_id) {
              // New transaction - use temp_id
              await offlineDB.markTransactionSynced(transaction.temp_id, data.id)
              console.log(`[Sync Service] ✅ Marked transaction ${transaction.temp_id} as synced (new ID: ${data.id})`)
            } else if (transaction.id) {
              // Updated transaction - use id
              await offlineDB.markTransactionSyncedById(transaction.id)
              console.log(`[Sync Service] ✅ Marked transaction ${transaction.id} as synced`)
            }
          }
        } catch (error) {
          console.error(`[Sync Service] ❌ Failed to sync transaction:`, error)
          console.error(`[Sync Service] Transaction data:`, JSON.stringify(transaction, null, 2))
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
    await offlineDB.saveTransaction(transaction)

    // Try to sync immediately if online
    if (this.isOnline) {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        await this.syncTransactions(session.user.id)
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
