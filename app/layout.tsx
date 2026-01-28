import type { Metadata } from 'next'
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
  themeColor: '#1f2937',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'MoneyPlan AI',
  },
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
        <meta name="theme-color" content="#1f2937" />
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
