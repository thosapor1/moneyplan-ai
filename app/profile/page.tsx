'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, Profile, fetchCategoryBudgets, saveCategoryBudgets, fetchDebtItems, insertDebtItem, updateDebtItem, deleteDebtItem, type DebtItemRow } from '@/lib/supabase'
import { format } from 'date-fns'
import FinancialAnalysis from '@/components/FinancialAnalysis'
import BottomNavigation from '@/components/BottomNavigation'
import { EXPENSE_CATEGORIES } from '@/lib/storage'
import { getActiveMonthRange } from '@/lib/period'
import { getExpenseCategoryType } from '@/lib/forecast'
import TypePill from '@/components/TypePill'

export default function ProfilePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [totalIncome, setTotalIncome] = useState(0)
  const [totalSavingFromTransactions, setTotalSavingFromTransactions] = useState<number | undefined>(undefined)
  const [totalDebtPaymentFromTransactions, setTotalDebtPaymentFromTransactions] = useState<number | undefined>(undefined)
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
    month_end_day: 0,
  })
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const initialProfileRef = useRef<Profile | null>(null)
  const profileRef = useRef<Profile>(profile)
  // เก็บค่าที่กำลังแก้เป็น string เพื่อให้ผู้ใช้ลบ 0 ได้ (แสดงช่องว่างแล้วค่อยแปลงเป็นตัวเลขตอน blur)
  const [numericInputs, setNumericInputs] = useState<Partial<Record<keyof Profile, string>>>({})
  // งบรายจ่ายรายเดือนต่อหมวด (จาก DB)
  const [categoryBudgets, setCategoryBudgetsState] = useState<Record<string, number>>({})
  // รายการหนี้แยกประเภท (จาก DB)
  const [debtItems, setDebtItems] = useState<DebtItemRow[]>([])

  // Keep profileRef in sync with profile state
  useEffect(() => {
    profileRef.current = profile
  }, [profile])

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
        setProfile({ ...data, month_end_day: data.month_end_day ?? 0 })
        initialProfileRef.current = { ...data, month_end_day: data.month_end_day ?? 0 }
      } else {
        // สร้าง profile ใหม่ถ้ายังไม่มี
        const newProfile: Profile = {
          id: session.user.id,
          monthly_debt_payment: 0,
          fixed_expense: 0,
          variable_expense: 0,
          saving: 0,
          investment: 0,
          liquid_assets: 0,
          total_assets: 0,
          total_liabilities: 0,
          month_end_day: 0,
        }
        setProfile(newProfile)
        initialProfileRef.current = newProfile
      }

      // โหลดรายได้จาก transactions ตามช่วงงวดที่ครอบคลุมวันนี้ (ถ้าวันนี้ 28–31 กับ endDay 27 → งวดจบ 27 เดือนถัดไป)
      const now = new Date()
      const monthEndDay = data?.month_end_day ?? 0
      const { start, end } = getActiveMonthRange(now, monthEndDay)

      const { data: transactionsData, error: transactionsError } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', session.user.id)
        .gte('date', format(start, 'yyyy-MM-dd'))
        .lte('date', format(end, 'yyyy-MM-dd'))

      if (!transactionsError && transactionsData) {
        const income = transactionsData
          .filter((t) => t.type === 'income')
          .reduce((sum, t) => sum + Number(t.amount), 0)
        setTotalIncome(income)
        // เงินออม+ลงทุนรายเดือนจากรายการในงวด (หมวด ออมเงิน, ลงทุน)
        const savingSum = transactionsData
          .filter(
            (t) =>
              t.type === 'expense' &&
              (t.category?.trim() === 'ออมเงิน' || t.category?.trim() === 'ลงทุน')
          )
          .reduce((sum, t) => sum + Number(t.amount), 0)
        setTotalSavingFromTransactions(savingSum)
        // เงินผ่อนหนี้จากรายการในงวด (หมวด ผ่อนชำระหนี้)
        const debtSum = transactionsData
          .filter(
            (t) => t.type === 'expense' && (t.category?.trim() === 'ผ่อนชำระหนี้')
          )
          .reduce((sum, t) => sum + Number(t.amount), 0)
        setTotalDebtPaymentFromTransactions(debtSum)
      } else {
        setTotalSavingFromTransactions(undefined)
        setTotalDebtPaymentFromTransactions(undefined)
      }

      // โหลดงบรายจ่ายรายเดือนต่อหมวดจาก DB
      const budgets = await fetchCategoryBudgets(session.user.id)
      setCategoryBudgetsState(budgets)

      const items = await fetchDebtItems(session.user.id)
      setDebtItems(items)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])


  const saveProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session || !profileRef.current.id) return

    try {
      setSaving(true)
      
      // Use the latest profile from ref
      const profileToSave = { ...profileRef.current }
      
      const { error } = await supabase
        .from('profiles')
        .upsert({
          ...profileToSave,
          id: session.user.id,
          updated_at: new Date().toISOString(),
        })

      if (error) throw error

      initialProfileRef.current = { ...profileToSave }
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

  type NumericField = 'fixed_expense' | 'variable_expense' | 'monthly_debt_payment' | 'saving' | 'investment' | 'liquid_assets' | 'total_assets' | 'total_liabilities'
  const getNumericDisplay = (field: NumericField) =>
    numericInputs[field] !== undefined ? numericInputs[field] : String(profile[field] ?? 0)
  const handleNumericChange = (field: NumericField, e: React.ChangeEvent<HTMLInputElement>) =>
    setNumericInputs((prev) => ({ ...prev, [field]: e.target.value }))
  const handleNumericBlur = (field: NumericField) => {
    const raw = numericInputs[field] ?? profile[field] ?? 0
    const num = typeof raw === 'string' ? (parseFloat(raw) || 0) : Number(raw) || 0
    handleFieldChange(field, num)
    setNumericInputs((prev) => {
      const next = { ...prev }
      delete next[field]
      return next
    })
    handleFieldBlur()
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
      {/* Header - match Dashboard */}
      <div className="bg-white shadow-sm px-4 py-3 flex justify-between items-center">
        <h1 className="text-lg font-semibold text-gray-800">สุขภาพการเงิน</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={async () => {
              await supabase.auth.signOut()
              router.push('/auth/login')
              router.refresh()
            }}
            className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
            title="ออกจากระบบ"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-4">

        {saving && (
          <div className="bg-sky-50 border border-sky-200 rounded-2xl p-3 flex items-center gap-2 mb-5">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-sky-500 border-t-transparent"></div>
            <span className="text-sm text-sky-800">กำลังบันทึกข้อมูล...</span>
          </div>
        )}

        <div className="space-y-5">
          {/* 🏦 Monthly Income & Fixed Expenses */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">🏦</span>
              <h3 className="text-base font-bold text-gray-800">รายได้และรายจ่ายรายเดือน</h3>
            </div>
            <p className="text-xs text-gray-500 mb-4">ตั้งค่ารายได้และรายจ่ายโดยประมาณ เพื่อให้แอปช่วยคำนวณงบและเป้าหมายได้แม่นยำ</p>
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
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                  <p className="text-xl font-bold text-emerald-700 mb-1">
                    {totalIncome.toLocaleString('th-TH')} บาท
                  </p>
                  <p className="text-xs text-emerald-600">คำนวณจากรายรับในหน้า &quot;รายรับรายจ่าย&quot;</p>
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
                    value={getNumericDisplay('fixed_expense')}
                    onChange={(e) => handleNumericChange('fixed_expense', e)}
                    onBlur={() => handleNumericBlur('fixed_expense')}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-gray-900 placeholder:text-gray-400 bg-white"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    <span>รายจ่ายผันแปร (บาท)</span>
                    <div className="group relative">
                      <span className="cursor-help text-sky-500 hover:text-sky-700">ℹ️</span>
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-2 bg-gray-800 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                        รายจ่ายที่เปลี่ยนแปลงได้ตามการใช้จ่าย เช่น ค่าอาหาร ค่าเดินทาง ค่าซื้อของใช้ส่วนตัว
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                          <div className="border-4 border-transparent border-t-gray-800"></div>
                        </div>
                      </div>
                    </div>
                  </label>
                  <input
                    type="number"
                    value={getNumericDisplay('variable_expense')}
                    onChange={(e) => handleNumericChange('variable_expense', e)}
                    onBlur={() => handleNumericBlur('variable_expense')}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-gray-900 placeholder:text-gray-400 bg-white"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    <span>เงินผ่อนหนี้ต่อเดือน (บาท)</span>
                    <div className="group relative">
                      <span className="cursor-help text-sky-500 hover:text-sky-700">ℹ️</span>
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-2 bg-gray-800 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                        จำนวนเงินที่จ่ายชำระหนี้ทุกเดือน เช่น ผ่อนบัตรเครดิต ผ่อนรถ ผ่อนบ้าน
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                          <div className="border-4 border-transparent border-t-gray-800"></div>
                        </div>
                      </div>
                    </div>
                  </label>
                  <input
                    type="number"
                    value={getNumericDisplay('monthly_debt_payment')}
                    onChange={(e) => handleNumericChange('monthly_debt_payment', e)}
                    onBlur={() => handleNumericBlur('monthly_debt_payment')}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-gray-900 placeholder:text-gray-400 bg-white"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 🎯 Financial Goals */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">🎯</span>
              <h3 className="text-base font-bold text-gray-800">เป้าหมายการเงิน</h3>
            </div>
            <p className="text-xs text-gray-500 mb-4">ตั้งค่าสินทรัพย์ หนี้ และเป้าหมายออม/ลงทุน เพื่อให้แอปช่วยติดตามเป้าปลดหนี้และเป้าออมเงิน</p>
            <div className="space-y-3">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <span>เงินออม (บาท)</span>
                  <div className="group relative">
                    <span className="cursor-help text-sky-500 hover:text-sky-700">ℹ️</span>
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-2 bg-gray-800 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                      เงินที่เก็บออมต่อเดือน เช่น เงินฝากออมทรัพย์ เพื่อใช้ในยามฉุกเฉินหรือเป้าหมายระยะสั้น
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                        <div className="border-4 border-transparent border-t-gray-800"></div>
                      </div>
                    </div>
                  </div>
                </label>
                <input
                  type="number"
                  value={getNumericDisplay('saving')}
                  onChange={(e) => handleNumericChange('saving', e)}
                  onBlur={() => handleNumericBlur('saving')}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-gray-900 placeholder:text-gray-400 bg-white"
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <span>เงินลงทุน (บาท)</span>
                  <div className="group relative">
                    <span className="cursor-help text-sky-500 hover:text-sky-700">ℹ️</span>
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-2 bg-gray-800 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                      เงินที่นำไปลงทุนต่อเดือน เช่น กองทุนรวม หุ้น เพื่อสร้างผลตอบแทนระยะยาว
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                        <div className="border-4 border-transparent border-t-gray-800"></div>
                      </div>
                    </div>
                  </div>
                </label>
                <input
                  type="number"
                  value={getNumericDisplay('investment')}
                  onChange={(e) => handleNumericChange('investment', e)}
                  onBlur={() => handleNumericBlur('investment')}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-gray-900 placeholder:text-gray-400 bg-white"
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <span>ทรัพย์สินสภาพคล่อง (บาท)</span>
                  <div className="group relative">
                    <span className="cursor-help text-sky-500 hover:text-sky-700">ℹ️</span>
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-2 bg-gray-800 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                      เงินที่ถอนใช้ได้ง่าย เช่น เงินสด เงินฝากออมทรัพย์ ใช้คำนวณเป้าออมเงิน
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                        <div className="border-4 border-transparent border-t-gray-800"></div>
                      </div>
                    </div>
                  </div>
                </label>
                <input
                  type="number"
                  value={getNumericDisplay('liquid_assets')}
                  onChange={(e) => handleNumericChange('liquid_assets', e)}
                  onBlur={() => handleNumericBlur('liquid_assets')}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-gray-900 placeholder:text-gray-400 bg-white"
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <span>ทรัพย์สินรวม (บาท)</span>
                  <div className="group relative">
                    <span className="cursor-help text-sky-500 hover:text-sky-700">ℹ️</span>
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-2 bg-gray-800 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                      มูลค่ารวมของทรัพย์สิน เช่น บ้าน รถ เงินฝาก เงินลงทุน
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                        <div className="border-4 border-transparent border-t-gray-800"></div>
                      </div>
                    </div>
                  </div>
                </label>
                <input
                  type="number"
                  value={getNumericDisplay('total_assets')}
                  onChange={(e) => handleNumericChange('total_assets', e)}
                  onBlur={() => handleNumericBlur('total_assets')}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-gray-900 placeholder:text-gray-400 bg-white"
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <span>หนี้สินรวม (บาท)</span>
                  <div className="group relative">
                    <span className="cursor-help text-sky-500 hover:text-sky-700">ℹ️</span>
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-2 bg-gray-800 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                      ยอดหนี้รวมที่ต้องชำระ เช่น หนี้บ้าน หนี้รถ บัตรเครดิต ใช้คำนวณเป้าปลดหนี้
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                        <div className="border-4 border-transparent border-t-gray-800"></div>
                      </div>
                    </div>
                  </div>
                </label>
                <input
                  type="number"
                  value={getNumericDisplay('total_liabilities')}
                  onChange={(e) => handleNumericChange('total_liabilities', e)}
                  onBlur={() => handleNumericBlur('total_liabilities')}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-gray-900 placeholder:text-gray-400 bg-white"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
          </div>

          {/* รายการหนี้แยกประเภท */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">📉</span>
              <h3 className="text-base font-bold text-gray-800">รายการหนี้แยกประเภท</h3>
            </div>
            <p className="text-xs text-gray-500 mb-4">เพิ่มรายการหนี้ เช่น บัตรเครดิต ผ่อนรถ ผ่อนบ้าน จะได้ใช้ในหน้าเป้าปลดหนี้และคำแนะนำจาก AI</p>
            <div className="space-y-3">
              {debtItems.map((item) => (
                <div key={item.id} className="flex flex-col gap-1 p-3 rounded-xl bg-gray-50 border border-gray-100">
                  <div className="flex justify-between items-start">
                    <span className="font-medium text-gray-800">{item.name}</span>
                    <div className="flex items-center gap-1">
                      {item.priority === 'high' && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">ควรโปะก่อน</span>
                      )}
                      <button
                        type="button"
                        onClick={async () => {
                          await deleteDebtItem(item.id)
                          const { data: { session } } = await supabase.auth.getSession()
                          if (session) setDebtItems(await fetchDebtItems(session.user.id))
                        }}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                        aria-label="ลบ"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>คงเหลือ {Number(item.remaining).toLocaleString('th-TH')} บาท</span>
                    {item.interest_rate != null && <span>ดอกเบี้ย ~{item.interest_rate}%/ปี</span>}
                  </div>
                </div>
              ))}
            </div>
            <form
              className="mt-4 flex flex-col gap-2"
              onSubmit={async (e) => {
                e.preventDefault()
                const form = e.currentTarget
                const name = (form.querySelector('[name="debt_name"]') as HTMLInputElement)?.value?.trim()
                const remaining = parseFloat((form.querySelector('[name="debt_remaining"]') as HTMLInputElement)?.value || '0')
                const interestRate = (form.querySelector('[name="debt_rate"]') as HTMLInputElement)?.value
                const priority = (form.querySelector('[name="debt_priority"]') as HTMLSelectElement)?.value as 'high' | 'normal'
                if (!name || remaining <= 0) return
                const { data: { session } } = await supabase.auth.getSession()
                if (!session) return
                const created = await insertDebtItem(session.user.id, {
                  name,
                  remaining,
                  interest_rate: interestRate ? parseFloat(interestRate) : undefined,
                  priority: priority === 'high' ? 'high' : 'normal',
                })
                if (created) {
                  setDebtItems(await fetchDebtItems(session.user.id))
                  form.reset()
                }
              }}
            >
              <input name="debt_name" type="text" placeholder="ชื่อหนี้ (เช่น บัตรเครดิต A)" className="w-full px-4 py-2 border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400" required />
              <div className="flex gap-2">
                <input name="debt_remaining" type="number" min="0" step="1" placeholder="ยอดคงเหลือ (บาท)" className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400" required />
                <input name="debt_rate" type="number" min="0" step="0.1" placeholder="ดอกเบี้ย %/ปี" className="w-24 px-4 py-2 border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400" />
              </div>
              <select name="debt_priority" className="w-full px-4 py-2 border border-gray-200 rounded-xl text-gray-900 bg-white">
                <option value="normal">ความสำคัญ: ปกติ</option>
                <option value="high">ควรโปะก่อน</option>
              </select>
              <button type="submit" className="py-2 px-4 rounded-xl bg-sky-600 text-white text-sm font-medium hover:bg-sky-700">เพิ่มรายการหนี้</button>
            </form>
          </div>

          {/* ⚙️ App Settings */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">⚙️</span>
              <h3 className="text-base font-bold text-gray-800">ตั้งค่าแอป</h3>
            </div>
            <p className="text-xs text-gray-500 mb-4">กำหนดวันสิ้นเดือนและงบสูงสุดต่อหมวด เพื่อให้การคำนวณงบรายวันและคำเตือนตรงกับชีวิตคุณ</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">วันสิ้นเดือน</label>
                <select
                  value={profile.month_end_day ?? 0}
                  onChange={async (e) => {
                    const v = Number(e.target.value)
                    setProfile((prev) => ({ ...prev, month_end_day: v }))
                    const { data: { session } } = await supabase.auth.getSession()
                    if (session) {
                      await supabase
                        .from('profiles')
                        .update({ month_end_day: v, updated_at: new Date().toISOString() })
                        .eq('id', session.user.id)
                    }
                  }}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-gray-900 bg-white"
                >
                  <option value={0}>ตามปฏิทิน (วันสุดท้ายของแต่ละเดือน)</option>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>วันที่ {d}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">ใช้คำนวณงบรายวันและเหลืออีกกี่วันในงวด</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">งบรายจ่ายรายเดือนต่อหมวด (บาท)</p>
                <p className="text-xs text-gray-500 mb-2">กำหนดงบสูงสุดต่อเดือนในแต่ละหมวด เพื่อติดตามและคำนวณงบต่อวัน</p>
            <div className="space-y-3">
              {EXPENSE_CATEGORIES.map((cat) => {
                const value = categoryBudgets[cat] ?? 0
                const tagType = getExpenseCategoryType(cat)
                return (
                  <div key={cat} className="flex items-center gap-2">
                    <label className="flex-1 min-w-0 text-sm text-gray-700" title={cat}>
                      <span className="block truncate">{cat}</span>
                    </label>
                    {tagType !== null && <TypePill type={tagType} />}
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={value === 0 ? '' : value}
                      onChange={async (e) => {
                        const v = e.target.value
                        const num = v === '' ? 0 : parseFloat(v) || 0
                        const next = { ...categoryBudgets, [cat]: num }
                        setCategoryBudgetsState(next)
                        const { data: { session } } = await supabase.auth.getSession()
                        if (session) await saveCategoryBudgets(session.user.id, next)
                      }}
                      placeholder="0"
                      className="w-28 px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-gray-900 text-right"
                    />
                    <span className="text-xs text-gray-400 w-6">บาท</span>
                  </div>
                )
              })}
            </div>
              </div>
            </div>
          </div>

          {/* ผลการวิเคราะห์การเงิน */}
          {profile.id && (
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
              <div className="mb-3">
                <h3 className="text-base font-bold text-gray-800">ผลการวิเคราะห์</h3>
                <p className="text-xs text-gray-500 mt-1">ภาพรวมสุขภาพการเงินจากข้อมูลที่ตั้งค่า</p>
              </div>
              <div className="profile-analysis">
                <FinancialAnalysis
                  profile={profile}
                  totalIncome={totalIncome > 0 ? totalIncome : ((profile.fixed_expense ?? 0) + (profile.variable_expense ?? 0) + (profile.saving ?? 0) + (profile.investment ?? 0))}
                  totalSavingFromTransactions={totalSavingFromTransactions}
                  totalDebtPaymentFromTransactions={totalDebtPaymentFromTransactions}
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
