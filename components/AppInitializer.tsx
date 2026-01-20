'use client'

import { useEffect, useState } from 'react'
import { syncService } from '@/lib/sync-service'
import AppLoader from './AppLoader'

export default function AppInitializer({ children }: { children: React.ReactNode }) {
  const [isInitializing, setIsInitializing] = useState(true)
  const [initProgress, setInitProgress] = useState(0)
  const [initMessage, setInitMessage] = useState('กำลังเตรียมแอปพลิเคชัน...')

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Step 1: Initialize offline DB
        setInitMessage('กำลังเตรียมฐานข้อมูลออฟไลน์...')
        setInitProgress(20)
        const { offlineDB } = await import('@/lib/offline-db')
        await offlineDB.init()
        
        // Step 2: Register Service Worker
        setInitMessage('กำลังติดตั้ง Service Worker...')
        setInitProgress(40)
        
        if ('serviceWorker' in navigator) {
          try {
            const registration = await navigator.serviceWorker.register('/sw.js')
            console.log('[SW] Service Worker registered:', registration)
            
            // Wait for service worker to be ready
            if (registration.installing) {
              registration.installing.addEventListener('statechange', (e) => {
                const sw = e.target as ServiceWorker
                if (sw.state === 'installed') {
                  setInitProgress(60)
                }
              })
            } else if (registration.waiting) {
              setInitProgress(60)
            } else if (registration.active) {
              setInitProgress(60)
            }
          } catch (error) {
            console.error('[SW] Service Worker registration failed:', error)
          }
        }

        // Step 3: Check online status
        setInitMessage('กำลังตรวจสอบการเชื่อมต่อ...')
        setInitProgress(80)
        
        // Note: Sync will be triggered by SyncService.initialize() in useEffect below
        // This ensures sync happens after all initialization is complete

        // Step 4: Complete
        setInitMessage('พร้อมใช้งาน')
        setInitProgress(100)
        
        // Small delay to show completion
        await new Promise(resolve => setTimeout(resolve, 300))
        
        setIsInitializing(false)
      } catch (error) {
        console.error('[Init] Initialization error:', error)
        // Continue anyway
        setIsInitializing(false)
      }
    }

    initializeApp()
  }, [])

  // Initialize SyncService event listeners exactly once
  // This ensures sync triggers on: online, visibility change, focus
  useEffect(() => {
    console.log('[App Initializer] Setting up SyncService...')
    syncService.initialize()
    
    // Also trigger initial sync if online and session is available
    const triggerInitialSync = async () => {
      if (navigator.onLine) {
        // Small delay to ensure everything is initialized
        setTimeout(() => {
          console.log('[App Initializer] Triggering initial sync check...')
          syncService.syncAll().catch(err => {
            console.error('[App Initializer] Initial sync error:', err)
          })
        }, 1000)
      }
    }
    
    triggerInitialSync()
  }, [])

  if (isInitializing) {
    return <AppLoader message={initMessage} progress={initProgress} />
  }

  return <>{children}</>
}
