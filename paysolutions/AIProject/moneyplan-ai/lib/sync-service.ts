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
    if (!this.isOnline || this.syncInProgress) {
      return
    }

    this.syncInProgress = true

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        this.syncInProgress = false
        return
      }

      await Promise.all([
        this.syncTransactions(session.user.id),
        this.syncProfile(session.user.id),
        this.syncForecasts(session.user.id),
      ])

      console.log('[Sync Service] All data synced successfully')
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
          const { data, error } = await supabase
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

          if (error) throw error

          if (data && transaction.temp_id) {
            await offlineDB.markTransactionSynced(transaction.temp_id, data.id)
          }
        } catch (error) {
          console.error('[Sync Service] Failed to sync transaction:', error)
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
