'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, Profile, Transaction } from '@/lib/supabase'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import FinancialAnalysis from '@/components/FinancialAnalysis'
import BottomNavigation from '@/components/BottomNavigation'

export default function ProfilePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [totalIncome, setTotalIncome] = useState(0)
  const [profile, setProfile] = useState<Profile>({
    id: '',
    monthly_debt_payment: 0,
    fixed_expense: 0,
    variable_expense: 0,
    saving: 0,
    investment: 0,
    liquid_assets: 0,
    total_assets: 0,
    total_liabilities: 0,
  })
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const initialProfileRef = useRef<Profile | null>(null)

  const loadProfile = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/auth/login')
      return
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading profile:', error)
      } else if (data) {
        setProfile(data)
        initialProfileRef.current = data
      } else {
        // สร้าง profile ใหม่ถ้ายังไม่มี
        const newProfile = {
          ...profile,
          id: session.user.id,
        }
        setProfile(newProfile)
        initialProfileRef.current = newProfile
      }

      // โหลดรายได้จาก transactions ของเดือนนี้
      const now = new Date()
      const start = startOfMonth(now)
      const end = endOfMonth(now)

      const { data: transactionsData, error: transactionsError } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('type', 'income')
        .gte('date', format(start, 'yyyy-MM-dd'))
        .lte('date', format(end, 'yyyy-MM-dd'))

      if (!transactionsError && transactionsData) {
        const income = transactionsData.reduce((sum, t) => sum + Number(t.amount), 0)
        setTotalIncome(income)
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }, [router, profile])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  const saveProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session || !profile.id) return

    try {
      setSaving(true)
      const { error } = await supabase
        .from('profiles')
        .upsert({
          ...profile,
          id: session.user.id,
          updated_at: new Date().toISOString(),
        })

      if (error) throw error

      initialProfileRef.current = { ...profile }
    } catch (error: any) {
      console.error('Error saving profile:', error)
      // Revert to initial state on error
      if (initialProfileRef.current) {
        setProfile(initialProfileRef.current)
      }
    } finally {
      setSaving(false)
    }
  }

  const handleFieldChange = (field: keyof Profile, value: number) => {
    const newProfile = { ...profile, [field]: value }
    setProfile(newProfile)

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // Set new timeout for auto save
    setSaving(true)
    saveTimeoutRef.current = setTimeout(() => {
      saveProfile()
    }, 1000) // Save after 1 second of no changes
  }

  // Auto save on blur
  const handleFieldBlur = () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    saveProfile()
  }

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

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

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* Header */}
      <div className="bg-gray-800 text-white px-4 py-3 flex justify-between items-center">
        <h1 className="text-lg font-semibold">สุขภาพการเงิน</h1>
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

        {saving && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2 mb-4">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span className="text-sm text-blue-800">กำลังบันทึกข้อมูล...</span>
          </div>
        )}

        <div className="space-y-4">
          {/* งบรายรับรายจ่าย */}
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="mb-4 pb-3 border-b border-gray-200">
              <h3 className="text-base font-bold text-gray-800">งบรายรับรายจ่าย (รายเดือน)</h3>
            </div>
            <div className="space-y-4">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <span>รายได้รวมต่อเดือน (บาท)</span>
                  <div className="group relative">
                    <span className="cursor-help text-blue-500 hover:text-blue-700">ℹ️</span>
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-2 bg-gray-800 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                      รายได้รวมทั้งหมดที่ได้รับในแต่ละเดือน เช่น เงินเดือน โบนัส รายได้เสริม รายได้จากธุรกิจ หรือรายได้จาก transactions
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                        <div className="border-4 border-transparent border-t-gray-800"></div>
                      </div>
                    </div>
                  </div>
                </label>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-lg font-bold text-green-600 mb-1">
                    {totalIncome.toLocaleString('th-TH')} บาท
                  </p>
                  <p className="text-xs text-green-600">คำนวณจากรายรับในหน้า &quot;รายรับรายจ่าย&quot;</p>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    <span>รายจ่ายคงที่ (บาท)</span>
                    <div className="group relative">
                      <span className="cursor-help text-blue-500 hover:text-blue-700">ℹ️</span>
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-2 bg-gray-800 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                        รายจ่ายที่ต้องจ่ายทุกเดือนในจำนวนที่แน่นอน เช่น ค่าเช่าบ้าน ค่าไฟ ค่าน้ำ ค่าโทรศัพท์ ค่าประกัน
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                          <div className="border-4 border-transparent border-t-gray-800"></div>
                        </div>
                      </div>
                    </div>
                  </label>
                  <input
                    type="number"
                    value={profile.fixed_expense ?? 0}
                    onChange={(e) => handleFieldChange('fixed_expense', Number(e.target.value) || 0)}
                    onBlur={handleFieldBlur}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder:text-gray-400 bg-white"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    <span>รายจ่ายผันแปร (บาท)</span>
                    <div className="group relative">
                      <span className="cursor-help text-blue-500 hover:text-blue-700">ℹ️</span>
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-2 bg-gray-800 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                        รายจ่ายที่เปลี่ยนแปลงได้ตามการใช้จ่าย เช่น ค่าอาหาร ค่าเดินทาง ค่าซื้อของใช้ส่วนตัว ค่าเสื้อผ้า ค่าบันเทิง
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                          <div className="border-4 border-transparent border-t-gray-800"></div>
                        </div>
                      </div>
                    </div>
                  </label>
                  <input
                    type="number"
                    value={profile.variable_expense ?? 0}
                    onChange={(e) => handleFieldChange('variable_expense', Number(e.target.value) || 0)}
                    onBlur={handleFieldBlur}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder:text-gray-400 bg-white"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    <span>เงินออม (บาท)</span>
                    <div className="group relative">
                      <span className="cursor-help text-blue-500 hover:text-blue-700">ℹ️</span>
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-2 bg-gray-800 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                        เงินที่เก็บออมไว้ในรูปแบบที่ปลอดภัยและถอนได้ง่าย เช่น เงินฝากออมทรัพย์ เงินฝากประจำ เพื่อใช้ในยามฉุกเฉินหรือเป้าหมายระยะสั้น
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                          <div className="border-4 border-transparent border-t-gray-800"></div>
                        </div>
                      </div>
                    </div>
                  </label>
                  <input
                    type="number"
                    value={profile.saving ?? 0}
                    onChange={(e) => handleFieldChange('saving', Number(e.target.value) || 0)}
                    onBlur={handleFieldBlur}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder:text-gray-400 bg-white"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    <span>เงินลงทุน (บาท)</span>
                    <div className="group relative">
                      <span className="cursor-help text-blue-500 hover:text-blue-700">ℹ️</span>
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-2 bg-gray-800 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                        เงินที่นำไปลงทุนเพื่อสร้างผลตอบแทนในระยะยาว เช่น กองทุนรวม หุ้น พันธบัตร เพื่อเพิ่มมูลค่าทางการเงินในอนาคต
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                          <div className="border-4 border-transparent border-t-gray-800"></div>
                        </div>
                      </div>
                    </div>
                  </label>
                  <input
                    type="number"
                    value={profile.investment ?? 0}
                    onChange={(e) => handleFieldChange('investment', Number(e.target.value) || 0)}
                    onBlur={handleFieldBlur}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder:text-gray-400 bg-white"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* งบแสดงสถานะการเงิน */}
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="mb-4 pb-3 border-b border-gray-200">
              <h3 className="text-base font-bold text-gray-800">งบแสดงสถานะการเงิน</h3>
            </div>
            <div className="space-y-3">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <span>ทรัพย์สินสภาพคล่อง (บาท)</span>
                  <div className="group relative">
                    <span className="cursor-help text-blue-500 hover:text-blue-700">ℹ️</span>
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-2 bg-gray-800 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                      ทรัพย์สินที่สามารถแปลงเป็นเงินสดได้เร็วและง่าย เช่น เงินสด เงินฝากออมทรัพย์ เงินฝากประจำที่ถอนได้ กองทุนรวมตลาดเงิน
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                        <div className="border-4 border-transparent border-t-gray-800"></div>
                      </div>
                    </div>
                  </div>
                </label>
                  <input
                  type="number"
                  value={profile.liquid_assets ?? 0}
                  onChange={(e) => handleFieldChange('liquid_assets', Number(e.target.value) || 0)}
                  onBlur={handleFieldBlur}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder:text-gray-400 bg-white"
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <span>ทรัพย์สินรวม (บาท)</span>
                  <div className="group relative">
                    <span className="cursor-help text-blue-500 hover:text-blue-700">ℹ️</span>
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-2 bg-gray-800 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                      มูลค่ารวมของทรัพย์สินทั้งหมดที่คุณเป็นเจ้าของ เช่น บ้าน ที่ดิน รถยนต์ เงินฝากธนาคาร เงินลงทุน ทองคำ เครื่องประดับ
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                        <div className="border-4 border-transparent border-t-gray-800"></div>
                      </div>
                    </div>
                  </div>
                </label>
                  <input
                  type="number"
                  value={profile.total_assets ?? 0}
                  onChange={(e) => handleFieldChange('total_assets', Number(e.target.value) || 0)}
                  onBlur={handleFieldBlur}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder:text-gray-400 bg-white"
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <span>หนี้สินรวม (บาท)</span>
                  <div className="group relative">
                    <span className="cursor-help text-blue-500 hover:text-blue-700">ℹ️</span>
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-2 bg-gray-800 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                      มูลค่ารวมของหนี้สินทั้งหมดที่คุณต้องชำระ เช่น หนี้บ้าน หนี้รถ หนี้บัตรเครดิต หนี้สินเชื่อส่วนบุคคล หนี้กองทุนสำรองเลี้ยงชีพ
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                        <div className="border-4 border-transparent border-t-gray-800"></div>
                      </div>
                    </div>
                  </div>
                </label>
                  <input
                  type="number"
                  value={profile.total_liabilities ?? 0}
                  onChange={(e) => handleFieldChange('total_liabilities', Number(e.target.value) || 0)}
                  onBlur={handleFieldBlur}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder:text-gray-400 bg-white"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
          </div>

          {/* ผลการวิเคราะห์การเงิน */}
          {profile.id && (
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <div className="mb-4 pb-3 border-b border-gray-200">
                <h3 className="text-base font-bold text-gray-800">ผลการวิเคราะห์</h3>
              </div>
              <div className="profile-analysis">
                <FinancialAnalysis 
                  profile={profile} 
                  totalIncome={totalIncome > 0 ? totalIncome : (profile.fixed_expense + profile.variable_expense + profile.saving + profile.investment)} 
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <BottomNavigation />
    </div>
  )
}
