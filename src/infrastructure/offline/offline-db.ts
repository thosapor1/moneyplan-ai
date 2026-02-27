/**
 * Infrastructure: Offline IndexedDB storage
 *
 * Purpose:
 * - Provide a small, well-documented API to store user data offline in the browser.
 * - Keep all IndexedDB + browser API usage in infrastructure layer.
 *
 * Clean Architecture notes:
 * - Domain/Application should NOT import this directly (we'll add ports/use-cases later).
 * - Presentation may call this for now, but prefer going through application layer.
 *
 * Data model:
 * - transactions store uses `local_id` as primary key (temp id) to allow offline creation.
 * - `id` is the server UUID (Supabase) set after successful sync.
 * - `synced` indicates whether the row has been confirmed synced to server.
 */

const DB_NAME = 'MoneyPlanAI'
const DB_VERSION = 1

export interface OfflineTransaction {
  /** Server UUID (Supabase). Only set after sync succeeds. */
  id?: string

  /** Local temp ID (primary key in IndexedDB). Never sent to Supabase. */
  local_id?: string

  /** User ID (optional offline; injected during sync). */
  user_id?: string

  /** Transaction data */
  type: 'income' | 'expense'
  amount: number
  category?: string
  /**
   * Stored offline for UI convenience; may not exist in DB schema.
   * (Sync layer decides what to send.)
   */
  description?: string
  /** Date string `YYYY-MM-DD` */
  date: string

  created_at?: string
  updated_at?: string

  /** Sync state */
  synced?: boolean
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
  /** Server UUID (if exists). */
  id?: string

  user_id: string
  month_index: number
  income: number
  expense: number
  note?: string

  /** Sync state */
  synced?: boolean

  /** Local temp ID (primary key in IndexedDB). */
  temp_id?: string
}

type StoreName = 'transactions' | 'profiles' | 'forecasts' | 'cache'

type CacheRecord = {
  key: string
  data: unknown
  timestamp: number
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof indexedDB !== 'undefined'
}

/**
 * Generate a reasonably unique local id without external dependencies.
 * Format: temp_<epochMs>_<random>
 */
function makeTempId(): string {
  return `temp_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

class OfflineDB {
  private db: IDBDatabase | null = null
  private initPromise: Promise<void> | null = null

  /**
   * Initialize the IndexedDB connection.
   * Safe to call multiple times; the first call wins.
   */
  async init(): Promise<void> {
    if (!isBrowser()) {
      // On server/SSR, there is no IndexedDB. This should never be called there.
      throw new Error('OfflineDB can only be used in the browser (IndexedDB not available).')
    }

    if (this.db) return
    if (this.initPromise) return this.initPromise

    this.initPromise = new Promise<void>((resolve, reject) => {
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

        // transactions
        if (!db.objectStoreNames.contains('transactions')) {
          const store = db.createObjectStore('transactions', {
            keyPath: 'local_id',
            autoIncrement: false,
          })
          store.createIndex('user_id', 'user_id', { unique: false })
          store.createIndex('date', 'date', { unique: false })
          store.createIndex('synced', 'synced', { unique: false })
          store.createIndex('id', 'id', { unique: false }) // server UUID index
          store.createIndex('local_id', 'local_id', { unique: true })
        }

        // profiles
        if (!db.objectStoreNames.contains('profiles')) {
          const store = db.createObjectStore('profiles', { keyPath: 'id' })
          store.createIndex('synced', 'synced', { unique: false })
        }

        // forecasts
        if (!db.objectStoreNames.contains('forecasts')) {
          const store = db.createObjectStore('forecasts', {
            keyPath: 'temp_id',
            autoIncrement: false,
          })
          store.createIndex('user_id', 'user_id', { unique: false })
          store.createIndex('synced', 'synced', { unique: false })
        }

        // cache
        if (!db.objectStoreNames.contains('cache')) {
          db.createObjectStore('cache', { keyPath: 'key' })
        }
      }
    })

    return this.initPromise
  }

  private async withStore<T>(
    storeName: StoreName,
    mode: IDBTransactionMode,
    fn: (store: IDBObjectStore, tx: IDBTransaction) => IDBRequest<T> | void
  ): Promise<T | void> {
    if (!this.db) await this.init()

    return new Promise<T | void>((resolve, reject) => {
      const tx = this.db!.transaction([storeName], mode)
      const store = tx.objectStore(storeName)

      let request: IDBRequest<T> | undefined
      try {
        const maybeRequest = fn(store, tx)
        if (maybeRequest) request = maybeRequest as IDBRequest<T>
      } catch (e) {
        reject(e)
        return
      }

      if (request) {
        request.onsuccess = () => resolve(request!.result)
        request.onerror = () => reject(request!.error)
      } else {
        // If caller uses cursor + manual resolve, still ensure tx errors are caught.
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
        tx.onabort = () => reject(tx.error)
      }
    })
  }

  // -------------------------
  // Transactions
  // -------------------------

  /**
   * Save (upsert) an offline transaction.
   * Ensures:
   * - `local_id` exists (primary key)
   * - `synced` defaults to false
   * - does NOT set server `id` unless provided
   */
  async saveTransaction(transaction: OfflineTransaction): Promise<void> {
    const data: OfflineTransaction = {
      ...transaction,
      local_id: transaction.local_id || makeTempId(),
      synced: false,
    }

    await this.withStore('transactions', 'readwrite', (store) => store.put(data))
  }

  async getTransactions(userId: string): Promise<OfflineTransaction[]> {
    if (!this.db) await this.init()

    return new Promise<OfflineTransaction[]>((resolve, reject) => {
      const tx = this.db!.transaction(['transactions'], 'readonly')
      const store = tx.objectStore('transactions')
      const index = store.index('user_id')
      const request = index.getAll(userId)

      request.onsuccess = () => resolve((request.result as OfflineTransaction[]) || [])
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Return all transactions where `synced` is false or undefined.
   * Uses cursor to avoid relying on an index filter.
   */
  async getUnsyncedTransactions(): Promise<OfflineTransaction[]> {
    if (!this.db) await this.init()

    return new Promise<OfflineTransaction[]>((resolve, reject) => {
      const tx = this.db!.transaction(['transactions'], 'readonly')
      const store = tx.objectStore('transactions')
      const request = store.openCursor()

      const unsynced: OfflineTransaction[] = []

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result
        if (!cursor) {
          resolve(unsynced)
          return
        }

        const row = cursor.value as OfflineTransaction
        if (row.synced === false || row.synced === undefined) unsynced.push(row)
        cursor.continue()
      }

      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Mark a transaction as synced after successful insert to server.
   * @param localId local primary key (`local_id`)
   * @param dbId server UUID returned from Supabase
   */
  async markTransactionSynced(localId: string, dbId: string): Promise<void> {
    if (!this.db) await this.init()

    return new Promise<void>((resolve, reject) => {
      const tx = this.db!.transaction(['transactions'], 'readwrite')
      const store = tx.objectStore('transactions')
      const getRequest = store.get(localId)

      getRequest.onsuccess = () => {
        const data = getRequest.result as OfflineTransaction | undefined
        if (!data) {
          // Not found; treat as no-op.
          resolve()
          return
        }

        data.id = dbId
        data.synced = true

        const putRequest = store.put(data)
        putRequest.onsuccess = () => resolve()
        putRequest.onerror = () => reject(putRequest.error)
      }

      getRequest.onerror = () => reject(getRequest.error)
    })
  }

  /**
   * Mark transaction(s) as synced by server `id`.
   * Useful if you only have server UUID.
   */
  async markTransactionSyncedById(id: string): Promise<void> {
    if (!this.db) await this.init()

    return new Promise<void>((resolve, reject) => {
      const tx = this.db!.transaction(['transactions'], 'readwrite')
      const store = tx.objectStore('transactions')
      const index = store.index('id')
      const getRequest = index.getAll(id)

      getRequest.onsuccess = () => {
        const results = (getRequest.result as OfflineTransaction[]) || []
        if (results.length === 0) {
          resolve()
          return
        }

        const updates = results.map(
          (row) =>
            new Promise<void>((res, rej) => {
              row.synced = true
              const put = store.put(row)
              put.onsuccess = () => res()
              put.onerror = () => rej(put.error)
            })
        )

        Promise.all(updates).then(() => resolve()).catch(reject)
      }

      getRequest.onerror = () => reject(getRequest.error)
    })
  }

  /** Delete transaction by local_id. Useful for local-only cleanups. */
  async deleteTransactionByLocalId(localId: string): Promise<void> {
    await this.withStore('transactions', 'readwrite', (store) => store.delete(localId))
  }

  /** Delete all transactions marked as synced=true. */
  async deleteSyncedTransactions(): Promise<void> {
    if (!this.db) await this.init()

    return new Promise<void>((resolve, reject) => {
      const tx = this.db!.transaction(['transactions'], 'readwrite')
      const store = tx.objectStore('transactions')
      const request = store.openCursor()

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result
        if (!cursor) {
          resolve()
          return
        }

        const row = cursor.value as OfflineTransaction
        if (row.synced === true) {
          const del = cursor.delete()
          del.onerror = () => reject(del.error)
          del.onsuccess = () => cursor.continue()
          return
        }

        cursor.continue()
      }

      request.onerror = () => reject(request.error)
    })
  }

  // -------------------------
  // Profile
  // -------------------------

  async saveProfile(profile: OfflineProfile): Promise<void> {
    const data: OfflineProfile = { ...profile, synced: false }
    await this.withStore('profiles', 'readwrite', (store) => store.put(data))
  }

  async getProfile(userId: string): Promise<OfflineProfile | null> {
    const result = (await this.withStore<OfflineProfile | undefined>('profiles', 'readonly', (store) =>
      store.get(userId)
    )) as OfflineProfile | undefined
    return result ?? null
  }

  async markProfileSynced(userId: string): Promise<void> {
    if (!this.db) await this.init()

    return new Promise<void>((resolve, reject) => {
      const tx = this.db!.transaction(['profiles'], 'readwrite')
      const store = tx.objectStore('profiles')
      const getRequest = store.get(userId)

      getRequest.onsuccess = () => {
        const row = getRequest.result as OfflineProfile | undefined
        if (!row) {
          resolve()
          return
        }

        row.synced = true
        const put = store.put(row)
        put.onsuccess = () => resolve()
        put.onerror = () => reject(put.error)
      }

      getRequest.onerror = () => reject(getRequest.error)
    })
  }

  // -------------------------
  // Forecasts
  // -------------------------

  async saveForecast(forecast: OfflineForecast): Promise<void> {
    const data: OfflineForecast = {
      ...forecast,
      temp_id: forecast.temp_id || makeTempId(),
      synced: false,
    }
    await this.withStore('forecasts', 'readwrite', (store) => store.put(data))
  }

  async getForecasts(userId: string): Promise<OfflineForecast[]> {
    if (!this.db) await this.init()

    return new Promise<OfflineForecast[]>((resolve, reject) => {
      const tx = this.db!.transaction(['forecasts'], 'readonly')
      const store = tx.objectStore('forecasts')
      const index = store.index('user_id')
      const request = index.getAll(userId)

      request.onsuccess = () => resolve((request.result as OfflineForecast[]) || [])
      request.onerror = () => reject(request.error)
    })
  }

  async getUnsyncedForecasts(): Promise<OfflineForecast[]> {
    if (!this.db) await this.init()

    return new Promise<OfflineForecast[]>((resolve, reject) => {
      const tx = this.db!.transaction(['forecasts'], 'readonly')
      const store = tx.objectStore('forecasts')
      const request = store.openCursor()

      const unsynced: OfflineForecast[] = []

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result
        if (!cursor) {
          resolve(unsynced)
          return
        }

        const row = cursor.value as OfflineForecast
        if (row.synced === false || row.synced === undefined) unsynced.push(row)
        cursor.continue()
      }

      request.onerror = () => reject(request.error)
    })
  }

  // -------------------------
  // Cache (generic)
  // -------------------------

  /**
   * Cache arbitrary data by key, with a timestamp.
   * NOTE: This is not encrypted. Do not store secrets.
   */
  async cacheData(key: string, data: unknown): Promise<void> {
    const record: CacheRecord = { key, data, timestamp: Date.now() }
    await this.withStore('cache', 'readwrite', (store) => store.put(record))
  }

  /**
   * Read cached data by key if not expired.
   * @param maxAgeMs default 24 hours
   */
  async getCachedData(key: string, maxAgeMs: number = 24 * 60 * 60 * 1000): Promise<unknown | null> {
    const record = (await this.withStore<CacheRecord | undefined>('cache', 'readonly', (store) =>
      store.get(key)
    )) as CacheRecord | undefined

    if (!record) return null
    const age = Date.now() - Number(record.timestamp || 0)
    if (age > maxAgeMs) return null
    return record.data ?? null
  }
}

/**
 * Singleton instance (matches previous `lib/offline-db.ts` usage).
 * Later we can inject this via application layer.
 */
export const offlineDB = new OfflineDB()
