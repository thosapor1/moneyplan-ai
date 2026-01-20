// IndexedDB utility สำหรับเก็บข้อมูล offline
const DB_NAME = 'MoneyPlanAI'
const DB_VERSION = 1

export interface OfflineTransaction {
  // DB identity (only set after successful sync)
  id?: string // UUID from Supabase (only present after sync)
  
  // Local identity (always present for offline records)
  local_id: string // Local temp ID like "temp_123..." (never sent to Supabase)
  
  // User identity (optional offline, required for sync)
  user_id?: string // User ID (optional offline, injected during sync)
  
  // Transaction data
  type: 'income' | 'expense'
  amount: number
  category?: string
  description?: string // Stored offline but not sent to DB (not in schema)
  date: string
  created_at?: string
  updated_at?: string
  
  // Sync state
  synced?: boolean // true if successfully synced to Supabase
}

export interface OfflineProfile {
  id: string
  full_name?: string
  email?: string
  phone?: string
  updated_at?: string
  synced?: boolean
}

export interface OfflineForecast {
  id?: string
  user_id: string
  month_index: number
  income: number
  expense: number
  note?: string
  synced?: boolean
  temp_id?: string
}

class OfflineDB {
  private db: IDBDatabase | null = null

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'))
      }

      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Create object stores
        if (!db.objectStoreNames.contains('transactions')) {
          const transactionStore = db.createObjectStore('transactions', {
            keyPath: 'local_id', // Use local_id as primary key
            autoIncrement: false, // We generate local_id ourselves
          })
          transactionStore.createIndex('user_id', 'user_id', { unique: false })
          transactionStore.createIndex('date', 'date', { unique: false })
          transactionStore.createIndex('synced', 'synced', { unique: false })
          transactionStore.createIndex('id', 'id', { unique: false }) // DB UUID index
          transactionStore.createIndex('local_id', 'local_id', { unique: true }) // Ensure local_id uniqueness
        }

        if (!db.objectStoreNames.contains('profiles')) {
          const profileStore = db.createObjectStore('profiles', {
            keyPath: 'id',
          })
          profileStore.createIndex('synced', 'synced', { unique: false })
        }

        if (!db.objectStoreNames.contains('forecasts')) {
          const forecastStore = db.createObjectStore('forecasts', {
            keyPath: 'temp_id',
            autoIncrement: true,
          })
          forecastStore.createIndex('user_id', 'user_id', { unique: false })
          forecastStore.createIndex('synced', 'synced', { unique: false })
        }

        if (!db.objectStoreNames.contains('cache')) {
          db.createObjectStore('cache', { keyPath: 'key' })
        }
      }
    })
  }

  // Transactions
  async saveTransaction(transaction: OfflineTransaction): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['transactions'], 'readwrite')
      const store = tx.objectStore('transactions')

      // Ensure local_id exists (generate if not provided)
      // CRITICAL: local_id is for offline use only, never sent to Supabase
      const data: OfflineTransaction = {
        ...transaction,
        local_id: transaction.local_id || `temp_${Date.now()}_${Math.random()}`,
        synced: false,
        // Do NOT set id here - it's only set after successful sync
        // user_id is optional offline, will be injected during sync
      }

      const request = store.put(data)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async getTransactions(userId: string): Promise<OfflineTransaction[]> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['transactions'], 'readonly')
      const store = tx.objectStore('transactions')
      const index = store.index('user_id')
      const request = index.getAll(userId)

      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(request.error)
    })
  }

  async getUnsyncedTransactions(): Promise<OfflineTransaction[]> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['transactions'], 'readonly')
      const store = tx.objectStore('transactions')
      
      // Use openCursor to filter unsynced transactions
      const request = store.openCursor()
      const unsynced: OfflineTransaction[] = []

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result
        if (cursor) {
          const transaction = cursor.value
          // Check if synced is false or undefined
          if (transaction.synced === false || transaction.synced === undefined) {
            unsynced.push(transaction)
          }
          cursor.continue()
        } else {
          resolve(unsynced)
        }
      }
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Mark transaction as synced after successful insert to Supabase
   * @param localId - The local_id (temp_xxx) from IndexedDB
   * @param dbId - The UUID returned from Supabase
   */
  async markTransactionSynced(localId: string, dbId: string): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['transactions'], 'readwrite')
      const store = tx.objectStore('transactions')
      const getRequest = store.get(localId)

      getRequest.onsuccess = () => {
        const data = getRequest.result
        if (data) {
          // Store the DB UUID and mark as synced
          // Keep local_id for reference but mark synced = true
          data.id = dbId // DB UUID from Supabase
          data.synced = true
          // Keep local_id - don't delete it (useful for debugging)
          const putRequest = store.put(data)
          putRequest.onsuccess = () => resolve()
          putRequest.onerror = () => reject(putRequest.error)
        } else {
          console.warn(`[Offline DB] Transaction with local_id ${localId} not found`)
          resolve()
        }
      }
      getRequest.onerror = () => reject(getRequest.error)
    })
  }

  async markTransactionSyncedById(id: string): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['transactions'], 'readwrite')
      const store = tx.objectStore('transactions')
      const index = store.index('id')
      const getRequest = index.getAll(id)

      getRequest.onsuccess = () => {
        const results = getRequest.result || []
        if (results.length > 0) {
          // Update all matching transactions (should be only one)
          const promises = results.map((data) => {
            return new Promise<void>((res, rej) => {
              data.synced = true
              const putRequest = store.put(data)
              putRequest.onsuccess = () => res()
              putRequest.onerror = () => rej(putRequest.error)
            })
          })
          Promise.all(promises)
            .then(() => resolve())
            .catch(reject)
        } else {
          resolve()
        }
      }
      getRequest.onerror = () => reject(getRequest.error)
    })
  }

  /**
   * Delete transaction by local_id (for local-only transactions)
   */
  async deleteTransactionByLocalId(localId: string): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['transactions'], 'readwrite')
      const store = tx.objectStore('transactions')
      const deleteRequest = store.delete(localId)

      deleteRequest.onsuccess = () => {
        console.log(`[Offline DB] Deleted transaction with local_id: ${localId}`)
        resolve()
      }
      deleteRequest.onerror = () => reject(deleteRequest.error)
    })
  }

  async deleteSyncedTransactions(): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['transactions'], 'readwrite')
      const store = tx.objectStore('transactions')
      
      // Use openCursor to find and delete synced transactions
      const request = store.openCursor()
      const deletePromises: Promise<void>[] = []

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result
        if (cursor) {
          const transaction = cursor.value
          // Check if synced is true
          if (transaction.synced === true) {
            const deletePromise = new Promise<void>((res, rej) => {
              const deleteRequest = cursor.delete()
              deleteRequest.onsuccess = () => res()
              deleteRequest.onerror = () => rej(deleteRequest.error)
            })
            deletePromises.push(deletePromise)
          }
          cursor.continue()
        } else {
          // All cursors processed, now delete
          if (deletePromises.length === 0) {
            resolve()
            return
          }
          
          Promise.all(deletePromises)
            .then(() => {
              console.log(`[Offline DB] Deleted ${deletePromises.length} synced transactions`)
              resolve()
            })
            .catch(reject)
        }
      }
      request.onerror = () => reject(request.error)
    })
  }

  // Profile
  async saveProfile(profile: OfflineProfile): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['profiles'], 'readwrite')
      const store = tx.objectStore('profiles')

      const data = {
        ...profile,
        synced: false,
      }

      const request = store.put(data)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async getProfile(userId: string): Promise<OfflineProfile | null> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['profiles'], 'readonly')
      const store = tx.objectStore('profiles')
      const request = store.get(userId)

      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  }

  async markProfileSynced(userId: string): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['profiles'], 'readwrite')
      const store = tx.objectStore('profiles')
      const getRequest = store.get(userId)

      getRequest.onsuccess = () => {
        const data = getRequest.result
        if (data) {
          data.synced = true
          const putRequest = store.put(data)
          putRequest.onsuccess = () => resolve()
          putRequest.onerror = () => reject(putRequest.error)
        } else {
          resolve()
        }
      }
      getRequest.onerror = () => reject(getRequest.error)
    })
  }

  // Forecasts
  async saveForecast(forecast: OfflineForecast): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['forecasts'], 'readwrite')
      const store = tx.objectStore('forecasts')

      const data = {
        ...forecast,
        synced: false,
        temp_id: forecast.temp_id || `temp_${Date.now()}_${Math.random()}`,
      }

      const request = store.put(data)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async getForecasts(userId: string): Promise<OfflineForecast[]> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['forecasts'], 'readonly')
      const store = tx.objectStore('forecasts')
      const index = store.index('user_id')
      const request = index.getAll(userId)

      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(request.error)
    })
  }

  async getUnsyncedForecasts(): Promise<OfflineForecast[]> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['forecasts'], 'readonly')
      const store = tx.objectStore('forecasts')
      
      // Use openCursor to filter unsynced forecasts
      const request = store.openCursor()
      const unsynced: OfflineForecast[] = []

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result
        if (cursor) {
          const forecast = cursor.value
          // Check if synced is false or undefined
          if (forecast.synced === false || forecast.synced === undefined) {
            unsynced.push(forecast)
          }
          cursor.continue()
        } else {
          resolve(unsynced)
        }
      }
      request.onerror = () => reject(request.error)
    })
  }

  // Cache
  async cacheData(key: string, data: any): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['cache'], 'readwrite')
      const store = tx.objectStore('cache')

      const request = store.put({
        key,
        data,
        timestamp: Date.now(),
      })

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async getCachedData(key: string): Promise<any | null> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['cache'], 'readonly')
      const store = tx.objectStore('cache')
      const request = store.get(key)

      request.onsuccess = () => {
        const result = request.result
        if (result) {
          // Check if cache is still valid (24 hours)
          const age = Date.now() - result.timestamp
          if (age < 24 * 60 * 60 * 1000) {
            resolve(result.data)
          } else {
            resolve(null)
          }
        } else {
          resolve(null)
        }
      }
      request.onerror = () => reject(request.error)
    })
  }
}

export const offlineDB = new OfflineDB()
