'use client'

import { useEffect, useState } from 'react'
import { syncService } from '@/lib/sync-service'

export default function ServiceWorkerRegistration() {
  const [isOnline, setIsOnline] = useState(true)
  const [syncStatus, setSyncStatus] = useState<{ message: string; type: 'success' | 'error' | null }>({ message: '', type: null })

  useEffect(() => {
    // Check online status
    setIsOnline(navigator.onLine)

    // Note: SyncService handles online/offline events via its own listeners
    // We only update UI state here
    const handleOnline = () => {
      setIsOnline(true)
      console.log('[SW Registration] Network online - SyncService will handle sync')
    }
    const handleOffline = () => {
      setIsOnline(false)
      console.log('[SW Registration] Network offline')
    }

    // Listen for sync completion
    const handleSyncComplete = (event: CustomEvent) => {
      const { successCount, totalCount } = event.detail
      if (successCount > 0) {
        setSyncStatus({
          message: `ซิงค์ข้อมูลสำเร็จ ${successCount} รายการ`,
          type: 'success'
        })
        setTimeout(() => setSyncStatus({ message: '', type: null }), 3000)
      }
    }

    window.addEventListener('sync-complete', handleSyncComplete as EventListener)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Register Service Worker (already done in AppInitializer, but keep for updates)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('[SW] Service Worker registered:', registration)

          // Check for updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // New service worker available
                  console.log('[SW] New service worker available')
                  // Optionally show update notification
                }
              })
            }
          })
        })
        .catch((error) => {
          console.error('[SW] Service Worker registration failed:', error)
        })

      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        console.log('[SW] Message from service worker:', event.data)
      })
    }

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('sync-complete', handleSyncComplete as EventListener)
    }
  }, [])

  return (
    <>
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 bg-yellow-500 text-white text-center py-2 px-4 z-50">
          <p className="text-sm">
            คุณกำลังใช้งานแบบออฟไลน์ ข้อมูลจะถูกบันทึกและ sync อัตโนมัติเมื่อกลับมาออนไลน์
          </p>
        </div>
      )}
      {syncStatus.type === 'success' && (
        <div className="fixed top-0 left-0 right-0 bg-green-500 text-white text-center py-2 px-4 z-50 animate-slide-down">
          <p className="text-sm">{syncStatus.message}</p>
        </div>
      )}
      <style jsx>{`
        @keyframes slide-down {
          from {
            transform: translateY(-100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slide-down {
          animation: slide-down 0.3s ease-out;
        }
      `}</style>
    </>
  )
}
