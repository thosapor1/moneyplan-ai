'use client'

import { useEffect, useState } from 'react'

interface AppLoaderProps {
  message?: string
  progress?: number
}

export default function AppLoader({ message = 'กำลังโหลด...', progress }: AppLoaderProps) {
  const [dots, setDots] = useState('')

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => {
        if (prev === '...') return ''
        return prev + '.'
      })
    }, 500)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center z-50">
      <div className="text-center">
        {/* Logo/Icon */}
        <div className="mb-8 relative">
          <div className="w-24 h-24 mx-auto bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center shadow-2xl transform animate-pulse">
            <span className="text-4xl font-bold text-white">฿</span>
          </div>
          {/* Rotating ring */}
          <div className="absolute inset-0 w-24 h-24 mx-auto border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
        </div>

        {/* App Name */}
        <h1 className="text-2xl font-bold text-white mb-2">MoneyPlan AI</h1>
        <p className="text-gray-400 text-sm mb-8">วางแผนการเงินส่วนบุคคล</p>

        {/* Loading Message */}
        <div className="flex items-center justify-center space-x-2 mb-6">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
          <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
        </div>

        <p className="text-gray-300 text-sm">
          {message}
          {dots}
        </p>

        {/* Progress Bar */}
        {progress !== undefined && (
          <div className="mt-6 w-64 mx-auto">
            <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-500 to-green-400 transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-400 mt-2">{progress}%</p>
          </div>
        )}
      </div>
    </div>
  )
}
