// Sync service สำหรับ sync ข้อมูลเมื่อกลับมาออนไลน์
import { supabase } from './supabase'
import { offlineDB, OfflineTransaction, OfflineProfile, OfflineForecast } from './offline-db'

export class SyncService {
  private isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true
  private syncInProgress = false

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('[Sync Service] Back online, starting sync...')
        this.isOnline = true
        this.syncAll()
      })

      window.addEventListener('offline', () => {
        console.log('[Sync Service] Gone offline')
        this.isOnline = false
      })
    }
  }

  async syncAll(): Promise<void> {
    // Check online status again
    this.isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true
    
    if (!this.isOnline || this.syncInProgress) {
      console.log('[Sync Service] Skipping sync - online:', this.isOnline, 'inProgress:', this.syncInProgress)
      return
    }

    this.syncInProgress = true
    console.log('[Sync Service] Starting sync...')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        console.log('[Sync Service] No session found, skipping sync')
        this.syncInProgress = false
        return
      }

      const results = await Promise.allSettled([
        this.syncTransactions(session.user.id),
        this.syncProfile(session.user.id),
        this.syncForecasts(session.user.id),
      ])

      const successCount = results.filter(r => r.status === 'fulfilled').length
      console.log(`[Sync Service] Sync completed: ${successCount}/${results.length} successful`)

      // Show notification if in browser
      if (typeof window !== 'undefined' && successCount > 0) {
        const event = new CustomEvent('sync-complete', { 
          detail: { successCount, totalCount: results.length } 
        })
        window.dispatchEvent(event)
      }
    } catch (error) {
      console.error('[Sync Service] Sync error:', error)
    } finally {
      this.syncInProgress = false
    }
  }

  async syncTransactions(userId: string): Promise<void> {
    try {
      const unsynced = await offlineDB.getUnsyncedTransactions()
      const userUnsynced = unsynced.filter((t) => t.user_id === userId)

      if (userUnsynced.length === 0) return

      console.log(`[Sync Service] Syncing ${userUnsynced.length} transactions...`)

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

          // Mark as synced
          if (data) {
            if (transaction.temp_id) {
              // Transaction ใหม่ - ใช้ temp_id
              await offlineDB.markTransactionSynced(transaction.temp_id, data.id)
            } else if (transaction.id) {
              // Transaction ที่ update - ใช้ id
              await offlineDB.markTransactionSyncedById(transaction.id)
            }
          }
        } catch (error) {
          console.error('[Sync Service] Failed to sync transaction:', error)
          console.error('[Sync Service] Transaction data:', transaction)
          // Continue with next transaction
        }
      }
    } catch (error) {
      console.error('[Sync Service] Error syncing transactions:', error)
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
}

export const syncService = new SyncService()
