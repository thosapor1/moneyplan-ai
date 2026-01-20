'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, Forecast } from '@/lib/supabase'
import { format, addMonths, startOfMonth } from 'date-fns'
import BottomNavigation from '@/components/BottomNavigation'

export default function ForecastsPage() {
  const router = useRouter()
  const [forecasts, setForecasts] = useState<Forecast[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<{ [key: string]: boolean }>({})
  const saveTimeoutRef = useRef<{ [key: string]: NodeJS.Timeout }>({})

  const loadForecasts = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/auth/login')
      return
    }

    try {
      const { data, error } = await supabase
        .from('forecasts')
        .select('*')
        .eq('user_id', session.user.id)
        .order('month_index', { ascending: true })
        .limit(12)

      if (error) throw error

      // สร้าง forecasts สำหรับ 12 เดือนถ้ายังไม่มี
      if (!data || data.length === 0) {
        const newForecasts = Array.from({ length: 12 }, (_, i) => ({
          user_id: session.user.id,
          month_index: i,
          income: 0,
          expense: 0,
          note: '',
        }))

        const { error: insertError } = await supabase
          .from('forecasts')
          .insert(newForecasts)

        if (insertError) throw insertError

        // จำกัดให้มีแค่ 12 แถว
        setForecasts(newForecasts.slice(0, 12) as Forecast[])
      } else {
        // เติมเดือนที่ขาดหายไป
        const existingIndices = new Set(data.map(f => f.month_index))
        const missingForecasts = []
        const userId = session.user.id

        for (let i = 0; i < 12; i++) {
          if (!existingIndices.has(i)) {
            missingForecasts.push({
              user_id: userId,
              month_index: i,
              income: 0,
              expense: 0,
              note: '',
            })
          }
        }

        if (missingForecasts.length > 0) {
          const { error: insertError } = await supabase
            .from('forecasts')
            .insert(missingForecasts)

          if (insertError) throw insertError
        }

        // โหลดใหม่ และจำกัดแค่ 12 แถวแรก
        const { data: updatedData, error: reloadError } = await supabase
          .from('forecasts')
          .select('*')
          .eq('user_id', session.user.id)
          .order('month_index', { ascending: true })
          .limit(12)

        if (reloadError) throw reloadError
        // จำกัดให้มีแค่ 12 แถว
        const limitedData = (updatedData || []).slice(0, 12)
        setForecasts(limitedData)
      }
    } catch (error) {
      console.error('Error loading forecasts:', error)
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    loadForecasts()
  }, [loadForecasts])

  const saveForecast = async (
    forecastId: string,
    field: 'income' | 'expense' | 'note',
    value: string | number
  ) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const updateData: any = {}
      if (field === 'income' || field === 'expense') {
        updateData[field] = Number(value) || 0
      } else {
        updateData[field] = value || null
      }

      const { error } = await supabase
        .from('forecasts')
        .update(updateData)
        .eq('id', forecastId)

      if (error) throw error

      // อัปเดต forecasts state หลังจากบันทึกสำเร็จ
      setForecasts(prev => 
        prev.map(f => 
          f.id === forecastId 
            ? { ...f, ...updateData }
            : f
        )
      )
    } catch (error: any) {
      console.error('Error saving forecast:', error)
      // โหลดข้อมูลใหม่เพื่อ revert การเปลี่ยนแปลง
      loadForecasts()
    } finally {
      setSaving(prev => {
        const newState = { ...prev }
        delete newState[forecastId]
        return newState
      })
      if (saveTimeoutRef.current[forecastId]) {
        delete saveTimeoutRef.current[forecastId]
      }
    }
  }

  const handleFieldChange = (
    forecastId: string,
    field: 'income' | 'expense' | 'note',
    value: string | number
  ) => {
    // อัปเดต state ทันทีเพื่อให้ UI responsive
    setForecasts(prev => 
      prev.map(f => 
        f.id === forecastId 
          ? { ...f, [field]: value }
          : f
      )
    )

    // ตั้งค่า debounce สำหรับบันทึกอัตโนมัติ
    if (saveTimeoutRef.current[forecastId]) {
      clearTimeout(saveTimeoutRef.current[forecastId])
    }

    setSaving(prev => ({ ...prev, [forecastId]: true }))

    saveTimeoutRef.current[forecastId] = setTimeout(() => {
      saveForecast(forecastId, field, value)
    }, 1000) // บันทึกหลังจากหยุดพิมพ์ 1 วินาที
  }

  const handleFieldBlur = (
    forecastId: string,
    field: 'income' | 'expense' | 'note',
    value: string | number
  ) => {
    // ยกเลิก timeout และบันทึกทันทีเมื่อ blur
    if (saveTimeoutRef.current[forecastId]) {
      clearTimeout(saveTimeoutRef.current[forecastId])
      delete saveTimeoutRef.current[forecastId]
    }
    saveForecast(forecastId, field, value)
  }

  const getMonthName = (index: number) => {
    const startDate = startOfMonth(new Date())
    const monthDate = addMonths(startDate, index)
    const monthNames = [
      'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
      'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ]
    return monthNames[monthDate.getMonth()]
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 pb-16">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    )
  }

  const totalIncome = forecasts.reduce((sum, f) => sum + Number(f.income), 0)
  const totalExpense = forecasts.reduce((sum, f) => sum + Number(f.expense), 0)

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* Header */}
      <div className="bg-gray-800 text-white px-4 py-3 flex justify-between items-center">
        <h1 className="text-lg font-semibold">แผน 12 เดือน</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={async () => {
              await supabase.auth.signOut()
              router.push('/auth/login')
              router.refresh()
            }}
            className="p-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            title="ออกจากระบบ"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
          <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-4">
        {/* สรุปยอด */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <p className="text-xs text-gray-500 mb-1">รายรับรวม</p>
            <p className="text-lg font-bold text-green-600">
              {totalIncome.toLocaleString('th-TH')}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <p className="text-xs text-gray-500 mb-1">รายจ่ายรวม</p>
            <p className="text-lg font-bold text-red-600">
              {totalExpense.toLocaleString('th-TH')}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <p className="text-xs text-gray-500 mb-1">คงเหลือ</p>
            <p className={`text-lg font-bold ${totalIncome - totalExpense >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {(totalIncome - totalExpense).toLocaleString('th-TH')}
            </p>
          </div>
        </div>

        {/* แผนรายเดือน */}
        <div className="space-y-3">
          {forecasts.slice(0, 12).map((forecast, index) => {
            const forecastId = forecast.id || ''
            const balance = Number(forecast.income) - Number(forecast.expense)
            
            if (!forecastId) {
              return null // ข้าม forecast ที่ยังไม่มี id
            }
            
            return (
              <div key={forecastId} className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
                {/* Header - เดือน */}
                <div className="mb-3 pb-2 border-b border-gray-200">
                  <h3 className="text-base font-semibold text-gray-800">{getMonthName(index)}</h3>
                </div>

                {/* รายรับและรายจ่าย */}
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">รายรับ (บาท)</label>
                    <input
                      type="number"
                      value={forecast.income ?? 0}
                      onChange={(e) => handleFieldChange(forecastId, 'income', e.target.value)}
                      onBlur={(e) => handleFieldBlur(forecastId, 'income', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900 placeholder:text-gray-400 text-sm"
                      min="0"
                      step="0.01"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">รายจ่าย (บาท)</label>
                    <input
                      type="number"
                      value={forecast.expense ?? 0}
                      onChange={(e) => handleFieldChange(forecastId, 'expense', e.target.value)}
                      onBlur={(e) => handleFieldBlur(forecastId, 'expense', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-gray-900 placeholder:text-gray-400 text-sm"
                      min="0"
                      step="0.01"
                      placeholder="0"
                    />
                  </div>
                </div>

                {/* ยอดคงเหลือ */}
                <div className="mb-3">
                  <div className="flex items-center justify-between p-2 rounded-lg bg-gray-50">
                    <span className="text-xs text-gray-600">ยอดคงเหลือ</span>
                    <span className={`text-sm font-semibold ${
                      balance >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {balance >= 0 ? '+' : ''}{balance.toLocaleString('th-TH')} บาท
                    </span>
                  </div>
                </div>

                {/* หมายเหตุ */}
                <div>
                  <label className="block text-xs text-gray-600 mb-1">หมายเหตุ</label>
                  <input
                    type="text"
                    value={forecast.note || ''}
                    onChange={(e) => handleFieldChange(forecastId, 'note', e.target.value)}
                    onBlur={(e) => handleFieldBlur(forecastId, 'note', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder:text-gray-400 text-sm"
                    placeholder="เพิ่มหมายเหตุ..."
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <BottomNavigation />
    </div>
  )
}
