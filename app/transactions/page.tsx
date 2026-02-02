'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, Transaction, fetchCategoryBudgets } from '@/lib/supabase'
import BottomNavigation from '@/components/BottomNavigation'
import CategoryIcon from '@/components/CategoryIcon'
import { format } from 'date-fns'
import { EXPENSE_CATEGORIES, getVisibleCategories, setVisibleCategories } from '@/lib/storage'
import {
  getMonthRange,
  computeSpentByCategory,
  computeRemainingBudgetByCategory,
  computeDailyBudgetFromRemaining,
  getDailyBudgetBreakdown,
} from '@/lib/finance'
import { getActivePeriodMonth, getRemainingDaysInPeriod } from '@/lib/period'
import { getExpenseCategoryType, VARIABLE_EXPENSE_CATEGORIES } from '@/lib/forecast'
import TypePill from '@/components/TypePill'

export default function TransactionsPage() {
  const router = useRouter()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(new Date())
  /** หมวดที่เลือกให้แสดง (ว่าง = แสดงทุกหมวด) ใช้ทั้งกรองรายการและคำนวณงบวันนี้ */
  const [visibleCategories, setVisibleCategoriesState] = useState<string[]>([])
  /** งบรายเดือนต่อหมวด (จาก DB) */
  const [categoryBudgets, setCategoryBudgetsState] = useState<Record<string, number>>({})
  /** วันสิ้นเดือนที่กำหนดเอง (0 = ตามปฏิทิน, 1-31) */
  const [monthEndDay, setMonthEndDayState] = useState(0)
  const [profileLoaded, setProfileLoaded] = useState(false)
  const initialMonthSetRef = useRef(false)
  const PAGE_SIZE = 30
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE)
  const [formData, setFormData] = useState({
    type: 'expense' as 'income' | 'expense',
    amount: '',
    category: '',
    description: '',
    date: format(new Date(), 'yyyy-MM-dd'),
  })

  // หมวดหมู่สำหรับ dropdown
  const incomeCategories = [
    'เงินเดือน',
    'โบนัส',
    'รายได้เสริม',
    'เงินปันผล',
    'ดอกเบี้ย',
    'รายได้อื่นๆ'
  ]

  const expenseCategories = [...EXPENSE_CATEGORIES]

  const loadProfileAndBudgets = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/auth/login')
      return
    }
    try {
      const budgets = await fetchCategoryBudgets(session.user.id)
      setCategoryBudgetsState(budgets)
      const { data: profileData } = await supabase
        .from('profiles')
        .select('month_end_day')
        .eq('id', session.user.id)
        .single()
      setMonthEndDayState(profileData?.month_end_day ?? 0)
      setProfileLoaded(true)
    } catch (error) {
      console.error('Error loading profile:', error)
      setProfileLoaded(true)
      setLoading(false)
    }
  }, [router])

  const loadMonthTransactions = useCallback(
    async (month: Date, monthEndDayVal: number) => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const range = getMonthRange(month, monthEndDayVal)
      const startStr = format(range.start, 'yyyy-MM-dd')
      const endStr = format(range.end, 'yyyy-MM-dd')
      try {
        const { data, error } = await supabase
          .from('transactions')
          .select('*')
          .eq('user_id', session.user.id)
          .gte('date', startStr)
          .lte('date', endStr)
          .order('date', { ascending: false })
          .order('created_at', { ascending: false })

        if (error) throw error
        const sorted = (data || []).sort((a, b) => {
          const dateA = new Date(a.date).getTime()
          const dateB = new Date(b.date).getTime()
          return dateB - dateA
        })
        setTransactions(sorted as Transaction[])
      } catch (error) {
        console.error('Error loading month transactions:', error)
        setTransactions([])
      } finally {
        setLoading(false)
      }
    },
    []
  )

  useEffect(() => {
    loadProfileAndBudgets()
  }, [loadProfileAndBudgets])

  useEffect(() => {
    if (!profileLoaded) return
    loadMonthTransactions(selectedMonth, monthEndDay)
  }, [profileLoaded, selectedMonth, monthEndDay, loadMonthTransactions])

  useEffect(() => {
    if (profileLoaded && !initialMonthSetRef.current) {
      setSelectedMonth(getActivePeriodMonth(new Date(), monthEndDay))
      initialMonthSetRef.current = true
    }
  }, [profileLoaded, monthEndDay])

  // โหลดหมวดที่แสดงจาก localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return
    setVisibleCategoriesState(getVisibleCategories())
  }, [])

  // โหลดงบรายเดือนและวันสิ้นเดือนใหม่เมื่อกลับมาที่แท็บ (เช่น หลังแก้ในโปรไฟล์)
  const loadMonthTransactionsRef = useRef(loadMonthTransactions)
  loadMonthTransactionsRef.current = loadMonthTransactions
  const selectedMonthRef = useRef(selectedMonth)
  selectedMonthRef.current = selectedMonth
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onFocus = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        const budgets = await fetchCategoryBudgets(session.user.id)
        setCategoryBudgetsState(budgets)
        const { data: profileData } = await supabase
          .from('profiles')
          .select('month_end_day')
          .eq('id', session.user.id)
          .single()
        const newMonthEndDay = profileData?.month_end_day ?? 0
        setMonthEndDayState(newMonthEndDay)
        loadMonthTransactionsRef.current(selectedMonthRef.current, newMonthEndDay)
      }
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const UNKNOWN_CATEGORY_LABEL = 'ไม่ระบุหมวด'

  // หมวดที่นำมาคิดงบวันนี้ (เหมือน "แสดงหมวด": ว่าง = ทุกหมวด, ไม่รวม "ไม่ระบุหมวด" สำหรับงบ)
  const budgetCategories =
    visibleCategories.length === 0
      ? expenseCategories
      : visibleCategories.filter((c) => c !== UNKNOWN_CATEGORY_LABEL)

  const monthRange = getMonthRange(selectedMonth, monthEndDay)
  const rangeStartStr = format(monthRange.start, 'yyyy-MM-dd')
  const rangeEndStr = format(monthRange.end, 'yyyy-MM-dd')
  const remainingDays = getRemainingDaysInPeriod(new Date(), monthRange)
  const transactionsAsLike = transactions.map((t) => ({
    type: t.type as 'income' | 'expense',
    amount: Number(t.amount),
    category: t.category ?? undefined,
    date: t.date,
  }))
  const spentByCategory = computeSpentByCategory(transactionsAsLike, monthRange)
  const remainingByCategory = computeRemainingBudgetByCategory(categoryBudgets, spentByCategory)
  const dailyBudget = computeDailyBudgetFromRemaining(
    remainingByCategory,
    remainingDays,
    VARIABLE_EXPENSE_CATEGORIES
  )
  const dailyBudgetBreakdown = getDailyBudgetBreakdown(
    categoryBudgets,
    spentByCategory,
    VARIABLE_EXPENSE_CATEGORIES
  )
  const isTodayInRange = todayStr >= rangeStartStr && todayStr <= rangeEndStr
  const hasAnyVariableBudget = VARIABLE_EXPENSE_CATEGORIES.some((cat) => (categoryBudgets[cat] ?? 0) > 0)

  const isInSelectedCategories = (cat: string) => {
    const c = (cat || '').trim()
    const effective =
      c === '' || !(expenseCategories as readonly string[]).includes(c)
        ? UNKNOWN_CATEGORY_LABEL
        : c
    return visibleCategories.length === 0 || visibleCategories.includes(effective)
  }
  const expenseToday = isTodayInRange
    ? transactions
        .filter(
          (t) =>
            t.type === 'expense' &&
            t.date === todayStr &&
            isInSelectedCategories(t.category || '')
        )
        .reduce((sum, t) => sum + Number(t.amount), 0)
    : 0
  const remainingToday = Math.max(0, dailyBudget - expenseToday)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    console.log('Form submitted:', formData)
    
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      alert('กรุณาเข้าสู่ระบบก่อน')
      return
    }

    // Validation
    if (!formData.category || formData.category === '') {
      alert('กรุณาเลือกหมวดหมู่')
      return
    }

    const amount = Number(formData.amount)
    if (!formData.amount || isNaN(amount) || amount <= 0) {
      alert('กรุณากรอกจำนวนเงินที่มากกว่า 0')
      return
    }

    if (!formData.date) {
      alert('กรุณาเลือกวันที่')
      return
    }

    try {
      if (editingTransaction) {
        // อัปเดต
        console.log('Updating transaction:', editingTransaction.id)
        
        const { error } = await supabase
          .from('transactions')
          .update({
            type: formData.type,
            amount: amount,
            category: formData.category || null,
            description: formData.description || null,
            date: formData.date,
          })
          .eq('id', editingTransaction.id)

        if (error) {
          console.error('Update error:', error)
          throw error
        }
        console.log('Transaction updated successfully')
      } else {
        // สร้างใหม่
        console.log('Creating new transaction')
        
        const { error } = await supabase
          .from('transactions')
          .insert({
            user_id: session.user.id,
            type: formData.type,
            amount: amount,
            category: formData.category || null,
            description: formData.description || null,
            date: formData.date,
          })

        if (error) {
          console.error('Insert error:', error)
          throw error
        }
        console.log('Transaction created successfully')
      }

      // Reset form and close modal
      setEditingTransaction(null)
      setShowModal(false)
      setFormData({
        type: 'expense',
        amount: '',
        category: '',
        description: '',
        date: format(new Date(), 'yyyy-MM-dd'),
      })
      
      // Reload current month transactions
      await loadMonthTransactions(selectedMonth, monthEndDay)
    } catch (error: any) {
      console.error('Error saving transaction:', error)
      alert('เกิดข้อผิดพลาด: ' + (error.message || 'ไม่สามารถบันทึกข้อมูลได้'))
    }
  }

  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction)
    setFormData({
      type: transaction.type,
      amount: transaction.amount.toString(),
      category: transaction.category || '',
      description: transaction.description || '',
      date: transaction.date,
    })
  }

  const handleDelete = async (id: string) => {
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบรายการนี้?')) return

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        alert('กรุณาเข้าสู่ระบบก่อน')
        return
      }

      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('Delete error:', error)
        throw error
      }
      await loadMonthTransactions(selectedMonth, monthEndDay)
    } catch (error: any) {
      console.error('Error deleting transaction:', error)
      alert('เกิดข้อผิดพลาด: ' + (error.message || 'ไม่สามารถลบข้อมูลได้'))
    }
  }

  const handleCancel = () => {
    setEditingTransaction(null)
    setShowModal(false)
    setFormData({
      type: 'expense',
      amount: '',
      category: '',
      description: '',
      date: format(new Date(), 'yyyy-MM-dd'),
    })
  }

  const changeMonth = (direction: 'prev' | 'next') => {
    const newMonth = new Date(selectedMonth)
    if (direction === 'prev') {
      newMonth.setMonth(newMonth.getMonth() - 1)
    } else {
      newMonth.setMonth(newMonth.getMonth() + 1)
    }
    setSelectedMonth(newMonth)
    setDisplayCount(PAGE_SIZE)
  }


  const monthNames = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
  const currentMonthName = monthNames[selectedMonth.getMonth()]
  const currentYear = selectedMonth.getFullYear() + 543

  // Filter by visible categories (transactions are already for current month from server)
  const filteredTransactions = transactions.filter(t => {
    if (visibleCategories.length === 0) return true
    const cat = (t.category || '').trim()
    const effectiveCat =
      cat === '' || !(expenseCategories as readonly string[]).includes(cat)
        ? UNKNOWN_CATEGORY_LABEL
        : cat
    return visibleCategories.includes(effectiveCat)
  })
  const displayedTransactions = filteredTransactions.slice(0, displayCount)
  const hasMore = filteredTransactions.length > displayCount

  // Top category spent today (for summary)
  const todayExpensesByCategory = isTodayInRange
    ? transactions
        .filter((t) => t.type === 'expense' && t.date === todayStr && isInSelectedCategories(t.category || ''))
        .reduce<Record<string, number>>((acc, t) => {
          const cat = t.category || UNKNOWN_CATEGORY_LABEL
          acc[cat] = (acc[cat] || 0) + Number(t.amount)
          return acc
        }, {})
    : {}
  const topCategoryToday =
    Object.keys(todayExpensesByCategory).length > 0
      ? Object.entries(todayExpensesByCategory).sort((a, b) => b[1] - a[1])[0]
      : null
  const dailyAverageForCompare = dailyBudget

  const toggleVisibleCategory = (category: string) => {
    setVisibleCategoriesState((prev) => {
      const next = prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
      setVisibleCategories(next)
      return next
    })
  }

  const showAllCategories = () => {
    setVisibleCategoriesState([])
    setVisibleCategories([])
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 pb-16">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-sky-500 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-gray-600">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* Header - match Dashboard */}
      <div className="bg-white shadow-sm px-4 py-3 flex justify-between items-center">
        <h1 className="text-lg font-semibold text-gray-800">รายรับรายจ่าย</h1>
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
        {/* Month Selector - card style */}
        <div className="bg-white text-gray-800 px-4 py-3 rounded-2xl shadow-sm mb-5 flex items-center justify-between">
          <button onClick={() => changeMonth('prev')} className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="font-medium text-gray-800">{currentMonthName} {currentYear}</span>
          <button onClick={() => changeMonth('next')} className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Summary: today's spending vs daily average + top category today */}
        {isTodayInRange && (
          <div className="bg-white rounded-2xl shadow-sm p-5 mb-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">📈</span>
              <h2 className="text-sm font-medium text-gray-600">วันนี้</h2>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {expenseToday.toLocaleString('th-TH')} <span className="text-base font-medium text-gray-500">บาท</span>
            </p>
            <p className="text-xs text-gray-500 mb-2">ใช้ไปวันนี้</p>
            {dailyAverageForCompare > 0 ? (
              expenseToday <= dailyAverageForCompare ? (
                <p className="text-base font-semibold text-emerald-600">วันนี้ใช้น้อยกว่าปกติ</p>
              ) : (
                <p className="text-base font-semibold text-amber-600">
                  วันนี้ใช้มากกว่าปกติ {Math.round(expenseToday - dailyAverageForCompare).toLocaleString('th-TH')} บาท
                </p>
              )
            ) : (
              <p className="text-sm text-gray-500">เทียบกับงบต่อวัน (ตั้งงบในหน้าโปรไฟล์)</p>
            )}
            {topCategoryToday && (
              <p className="text-sm text-gray-600 mt-2">
                หมวดที่ใช้มากวันนี้: <span className="font-medium text-gray-800">{topCategoryToday[0]}</span>
              </p>
            )}
          </div>
        )}

        {/* ตัวกรองหมวด */}
        <div className="mb-5 bg-white rounded-2xl shadow-sm p-4">
          <p className="text-sm font-medium text-gray-600 mb-2">แสดงหมวด (ใช้คำนวณงบวันนี้ด้วย)</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={showAllCategories}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                visibleCategories.length === 0
                  ? 'bg-sky-100 text-sky-800'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              ทั้งหมด
            </button>
            {expenseCategories.map((cat) => {
              const isSelected = visibleCategories.includes(cat)
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleVisibleCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    isSelected ? 'bg-sky-100 text-sky-800' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {cat}
                </button>
              )
            })}
            <button
              type="button"
              onClick={() => toggleVisibleCategory(UNKNOWN_CATEGORY_LABEL)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                visibleCategories.includes(UNKNOWN_CATEGORY_LABEL) ? 'bg-sky-100 text-sky-800' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {UNKNOWN_CATEGORY_LABEL}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {visibleCategories.length === 0
              ? 'แสดงทุกหมวด'
              : `แสดงเฉพาะ: ${visibleCategories.join(', ')}`}
          </p>
        </div>

        {/* งบรายจ่ายต่อวัน */}
        <div className="mb-5 bg-white rounded-2xl shadow-sm p-4">
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-600">งบรายจ่ายต่อวัน</p>
            <p className="text-xs text-gray-500">งบต่อวันจากงบที่เหลือในงวด (เฉพาะหมวดผันแปร)</p>
            {!hasAnyVariableBudget ? (
              <p className="text-sm text-amber-600 py-2">
                กำหนดงบรายเดือนต่อหมวดผันแปรในหน้าโปรไฟล์
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-500">งบวันนี้</p>
                  <p className="text-lg font-bold text-gray-800">
                    {Math.round(dailyBudget).toLocaleString('th-TH')}
                  </p>
                  <p className="text-xs text-gray-400">บาท</p>
                </div>
                <div className="bg-amber-50 rounded-xl p-3">
                  <p className="text-xs text-gray-500">ใช้ไปวันนี้</p>
                  <p className="text-lg font-bold text-amber-700">{expenseToday.toLocaleString('th-TH')}</p>
                  <p className="text-xs text-gray-400">บาท</p>
                </div>
                <div className="bg-emerald-50 rounded-xl p-3">
                  <p className="text-xs text-gray-500">คงเหลือ</p>
                  <p className="text-lg font-bold text-emerald-700">
                    {Math.round(remainingToday).toLocaleString('th-TH')}
                  </p>
                  <p className="text-xs text-gray-400">บาท</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Add Item Button - soft style */}
        <div className="mb-5">
          <button
            onClick={() => {
              setEditingTransaction(null)
              setFormData({
                type: 'expense',
                amount: '',
                category: '',
                description: '',
                date: format(new Date(), 'yyyy-MM-dd'),
              })
              setShowModal(true)
            }}
            className="w-full bg-sky-50 text-sky-800 border border-sky-200/60 px-4 py-3 rounded-2xl font-medium hover:bg-sky-100/80 transition-colors"
          >
            + เพิ่มรายการ
          </button>
        </div>

        {/* Transactions List - card style, more spacing, subtle type */}
        <div className="space-y-3">
          {filteredTransactions.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl shadow-sm text-center text-gray-500">
              ยังไม่มีรายการในเดือนนี้
            </div>
          ) : (
            <>
            {displayedTransactions.map((transaction) => (
              <div
                key={transaction.id}
                className="bg-white p-4 rounded-2xl shadow-sm flex items-center justify-between border border-gray-100"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <CategoryIcon category={transaction.category || ''} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 flex items-center gap-2 flex-wrap min-w-0">
                      <span className="min-w-0 truncate">{transaction.category || '-'}</span>
                      {transaction.type === 'expense' && (() => {
                        const tagType = getExpenseCategoryType(transaction.category || '')
                        if (tagType === 'fixed') return <TypePill type="fixed" />
                        return null
                      })()}
                    </p>
                    <p className="text-xs text-gray-500">
                      {format(new Date(transaction.date), 'dd MMM yyyy')}
                    </p>
                    {transaction.description && transaction.description.trim() !== '' && (
                      <p className="text-xs text-gray-500 truncate mt-0.5" title={transaction.description}>
                        {transaction.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <p className={`text-base font-bold ${
                    transaction.type === 'income' ? 'text-emerald-600' : 'text-amber-700'
                  }`}>
                    {transaction.type === 'income' ? '+' : '-'}
                    {Number(transaction.amount).toLocaleString('th-TH')}
                  </p>
                  <button
                    onClick={() => handleDelete(transaction.id)}
                    className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
            {hasMore && (
              <button
                type="button"
                onClick={() => setDisplayCount((c) => c + PAGE_SIZE)}
                className="w-full py-3 rounded-2xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                โหลดเพิ่ม ({filteredTransactions.length - displayCount} รายการ)
              </button>
            )}
            </>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col shadow-xl">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex justify-between items-center z-10">
              <h2 className="text-lg font-semibold text-gray-800">
                {editingTransaction ? 'แก้ไขรายการ' : 'เพิ่มรายการใหม่'}
              </h2>
              <button
                onClick={handleCancel}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pb-4">
              <form onSubmit={handleSubmit} className="p-4 space-y-4 pb-8">
              {/* Type Tabs */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: 'expense', category: '' })}
                  className={`flex-1 py-3 rounded-xl font-medium transition-colors ${
                    formData.type === 'expense'
                      ? 'bg-amber-100 text-amber-800 border border-amber-200'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  รายจ่าย
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: 'income', category: '' })}
                  className={`flex-1 py-3 rounded-xl font-medium transition-colors ${
                    formData.type === 'income'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  รายรับ
                </button>
              </div>

              {/* Category Dropdown */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  หมวดหมู่
                </label>
                <div className="relative">
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 appearance-none bg-white"
                    required
                  >
                    <option value="">เลือกหมวดหมู่</option>
                    {(formData.type === 'income' ? incomeCategories : expenseCategories).map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  จำนวนเงิน (บาท)
                </label>
                <input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  required
                  min="0"
                  step="0.01"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder:text-gray-400"
                  placeholder="0"
                />
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  วันที่
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                />
              </div>

              {/* Note */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  หมายเหตุ
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder:text-gray-400"
                  placeholder="รายละเอียดเพิ่มเติม"
                />
              </div>

              {/* Save Button */}
              <button
                type="submit"
                className="w-full bg-sky-500 text-white py-3 rounded-xl font-medium hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                disabled={!formData.category || !formData.amount || Number(formData.amount) <= 0 || !formData.date}
              >
                บันทึก
              </button>
              </form>
            </div>
          </div>
        </div>
      )}

      <BottomNavigation />
    </div>
  )
}
