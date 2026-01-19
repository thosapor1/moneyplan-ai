// Service Worker สำหรับ MoneyPlan AI PWA
const CACHE_NAME = 'moneyplan-ai-v1'
const RUNTIME_CACHE = 'moneyplan-ai-runtime-v1'

// ไฟล์ที่ต้อง cache ตอน install
const STATIC_CACHE_URLS = [
  '/',
  '/dashboard',
  '/transactions',
  '/forecasts',
  '/profile',
  '/auth/login',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/icon.svg',
]

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...')
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching static assets')
      return cache.addAll(STATIC_CACHE_URLS).catch((err) => {
        console.log('[Service Worker] Cache addAll error:', err)
        // Continue even if some files fail to cache
      })
    })
  )
  self.skipWaiting()
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...')
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE)
          .map((name) => {
            console.log('[Service Worker] Deleting old cache:', name)
            return caches.delete(name)
          })
      )
    })
  )
  return self.clients.claim()
})

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return
  }

  // Skip Supabase API calls - handle them separately
  if (url.hostname.includes('supabase.co')) {
    // Use network-first strategy for API calls
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful responses
          if (response.ok) {
            const responseClone = response.clone()
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, responseClone)
            })
          }
          return response
        })
        .catch(() => {
          // If offline, try to get from cache
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse
            }
            // Return offline response
            return new Response(
              JSON.stringify({ error: 'Offline', cached: true }),
              {
                headers: { 'Content-Type': 'application/json' },
              }
            )
          })
        })
    )
    return
  }

  // For app pages, use cache-first strategy
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse
      }

      return fetch(request)
        .then((response) => {
          // Don't cache if not a valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response
          }

          const responseToCache = response.clone()
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(request, responseToCache)
          })

          return response
        })
        .catch(() => {
          // If offline and not in cache, return offline page
          if (request.mode === 'navigate') {
            return caches.match('/')
          }
        })
    })
  )
})

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('[Service Worker] Background sync:', event.tag)
  if (event.tag === 'sync-transactions') {
    event.waitUntil(syncTransactions())
  } else if (event.tag === 'sync-profile') {
    event.waitUntil(syncProfile())
  } else if (event.tag === 'sync-forecasts') {
    event.waitUntil(syncForecasts())
  }
})

// Sync functions (will be called from client)
async function syncTransactions() {
  // This will be handled by the client-side sync service
  console.log('[Service Worker] Syncing transactions...')
}

async function syncProfile() {
  console.log('[Service Worker] Syncing profile...')
}

async function syncForecasts() {
  console.log('[Service Worker] Syncing forecasts...')
}

// Message handler for communication with client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
