import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import AppInitializer from '@/components/AppInitializer'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'MoneyPlan AI - วางแผนการเงินส่วนบุคคล',
  description: 'เว็บแอพสำหรับวางแผนและจัดการการเงินส่วนบุคคล',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'MoneyPlan AI',
  },
}

export const viewport: Viewport = {
  themeColor: '#1f2937',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="th">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="MoneyPlan AI" />
      </head>
      <body className={inter.className}>
        <AppInitializer>
          {children}
        </AppInitializer>
      </body>
    </html>
  )
}
