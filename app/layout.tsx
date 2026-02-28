import type { Metadata, Viewport } from 'next'
import './globals.css'
import AppInitializer from '@/components/AppInitializer'

export const metadata: Metadata = {
  title: 'MoneyPlan AI - วางแผนการเงินส่วนบุคคล',
  description: 'เว็บแอพสำหรับวางแผนและจัดการการเงินส่วนบุคคล',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/moneyplan-ai-icon.png', sizes: 'any', type: 'image/png' },
    ],
    apple: [
      { url: '/moneyplan-ai-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'MoneyPlan AI',
  },
}

export const viewport: Viewport = {
  themeColor: '#0f766e',
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
      <body className="bg-background text-foreground antialiased">
        <div className="min-h-screen max-w-lg mx-auto relative">
          <AppInitializer>
            {children}
          </AppInitializer>
        </div>
      </body>
    </html>
  )
}
