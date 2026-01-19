// IndexedDB utility สำหรับเก็บข้อมูล offline
const DB_NAME = 'MoneyPlanAI'
const DB_VERSION = 1

export interface OfflineTransaction {
  id?: string
  user_id: string
  type: 'income' | 'expense'
  amount: number
  category?: string
  description?: string
  date: string
  created_at?: string
  updated_at?: string
  synced?: boolean
  temp_id?: string // สำหรับ pending transactions
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
            keyPath: 'temp_id',
            autoIncrement: true,
          })
          transactionStore.createIndex('user_id', 'user_id', { unique: false })
          transactionStore.createIndex('date', 'date', { unique: false })
          transactionStore.createIndex('synced', 'synced', { unique: false })
          transactionStore.createIndex('id', 'id', { unique: false })
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

      const data = {
        ...transaction,
        synced: false,
        temp_id: transaction.temp_id || `temp_${Date.now()}_${Math.random()}`,
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
      const index = store.index('synced')
      const request = index.getAll(IDBKeyRange.only(false))

      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(request.error)
    })
  }

  async markTransactionSynced(tempId: string, realId: string): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['transactions'], 'readwrite')
      const store = tx.objectStore('transactions')
      const getRequest = store.get(tempId)

      getRequest.onsuccess = () => {
        const data = getRequest.result
        if (data) {
          data.id = realId
          data.synced = true
          delete data.temp_id
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

  async deleteSyncedTransactions(): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['transactions'], 'readwrite')
      const store = tx.objectStore('transactions')
      const index = store.index('synced')
      const getRequest = index.getAll(IDBKeyRange.only(true))

      getRequest.onsuccess = () => {
        const syncedTransactions = getRequest.result || []
        if (syncedTransactions.length === 0) {
          resolve()
          return
        }

        const deletePromises = syncedTransactions.map((transaction) => {
          return new Promise<void>((res, rej) => {
            const deleteRequest = store.delete(transaction.temp_id)
            deleteRequest.onsuccess = () => res()
            deleteRequest.onerror = () => rej(deleteRequest.error)
          })
        })

        Promise.all(deletePromises)
          .then(() => {
            console.log(`[Offline DB] Deleted ${syncedTransactions.length} synced transactions`)
            resolve()
          })
          .catch(reject)
      }
      getRequest.onerror = () => reject(getRequest.error)
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
      const index = store.index('synced')
      const request = index.getAll(IDBKeyRange.only(false))

      request.onsuccess = () => resolve(request.result || [])
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
