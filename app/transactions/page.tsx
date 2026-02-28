'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, Transaction, fetchCategoryBudgets } from '@/lib/supabase'
import BottomNavigation from '@/components/BottomNavigation'
import MonthSelector from '@/components/MonthSelector'
import CategoryIcon from '@/components/CategoryIcon'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { EXPENSE_CATEGORIES, getVisibleCategories, setVisibleCategories } from '@/lib/storage'
import {
  getMonthRange,
  computeSpentByCategory,
  computeRemainingBudgetByCategory,
  computeDailyBudgetFromRemaining,
} from '@/lib/finance'
import { getCategoryEmoji } from '@/lib/category-icons'
import { getActivePeriodMonth, getRemainingDaysInPeriod } from '@/lib/period'
import { getExpenseCategoryType, VARIABLE_EXPENSE_CATEGORIES } from '@/lib/forecast'

const formatCurrency = (n: number) => n.toLocaleString('th-TH')

export default function TransactionsPage() {
  const router = useRouter()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(new Date())
  const [visibleCategories, setVisibleCategoriesState] = useState<string[]>([])
  const [categoryBudgets, setCategoryBudgetsState] = useState<Record<string, number>>({})
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

  const incomeCategories = [
    'เงินเดือน', 'โบนัส', 'รายได้เสริม', 'เงินปันผล', 'ดอกเบี้ย', 'รายได้อื่นๆ',
  ]
  const expenseCategories = [...EXPENSE_CATEGORIES]
  const UNKNOWN_CATEGORY_LABEL = 'ไม่ระบุหมวด'

  const loadProfileAndBudgets = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/auth/login'); return }
    try {
      const budgets = await fetchCategoryBudgets(session.user.id)
      setCategoryBudgetsState(budgets)
      const { data: profileData } = await supabase
        .from('profiles').select('month_end_day').eq('id', session.user.id).single()
      setMonthEndDayState(profileData?.month_end_day ?? 0)
      setProfileLoaded(true)
    } catch (error) {
      console.error('Error loading profile:', error)
      setProfileLoaded(true)
      setLoading(false)
    }
  }, [router])

  const loadRequestRef = useRef(0)

  const loadMonthTransactions = useCallback(
    async (month: Date, monthEndDayVal: number) => {
      const requestId = ++loadRequestRef.current
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const range = getMonthRange(month, monthEndDayVal)
      try {
        const { data, error } = await supabase
          .from('transactions').select('*')
          .eq('user_id', session.user.id)
          .gte('date', format(range.start, 'yyyy-MM-dd'))
          .lte('date', format(range.end, 'yyyy-MM-dd'))
          .order('date', { ascending: false })
          .order('created_at', { ascending: false })
        if (error) throw error
        if (requestId !== loadRequestRef.current) return
        const sorted = (data || []).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        setTransactions(sorted as Transaction[])
      } catch (error) {
        console.error('Error loading month transactions:', error)
        if (requestId !== loadRequestRef.current) return
        setTransactions([])
      } finally {
        if (requestId === loadRequestRef.current) setLoading(false)
      }
    },
    [],
  )

  useEffect(() => { loadProfileAndBudgets() }, [loadProfileAndBudgets])
  useEffect(() => {
    if (!profileLoaded) return
    if (!initialMonthSetRef.current) {
      const correctMonth = getActivePeriodMonth(new Date(), monthEndDay)
      setSelectedMonth(correctMonth)
      initialMonthSetRef.current = true
      return
    }
    loadMonthTransactions(selectedMonth, monthEndDay)
  }, [profileLoaded, selectedMonth, monthEndDay, loadMonthTransactions])
  useEffect(() => {
    if (typeof window === 'undefined') return
    setVisibleCategoriesState(getVisibleCategories())
  }, [])

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
          .from('profiles').select('month_end_day').eq('id', session.user.id).single()
        const newMonthEndDay = profileData?.month_end_day ?? 0
        setMonthEndDayState(newMonthEndDay)
        loadMonthTransactionsRef.current(selectedMonthRef.current, newMonthEndDay)
      }
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const monthRange = getMonthRange(selectedMonth, monthEndDay)
  const remainingDays = getRemainingDaysInPeriod(new Date(), monthRange)
  const transactionsAsLike = transactions.map((t) => ({
    type: t.type as 'income' | 'expense',
    amount: Number(t.amount),
    category: t.category ?? undefined,
    date: t.date,
  }))
  const spentByCategory = computeSpentByCategory(transactionsAsLike, monthRange)
  const remainingByCategory = computeRemainingBudgetByCategory(categoryBudgets, spentByCategory)
  const dailyBudget = computeDailyBudgetFromRemaining(remainingByCategory, remainingDays, VARIABLE_EXPENSE_CATEGORIES)

  const isTodayInRange = todayStr >= format(monthRange.start, 'yyyy-MM-dd') && todayStr <= format(monthRange.end, 'yyyy-MM-dd')

  const isInSelectedCategories = (cat: string) => {
    const c = (cat || '').trim()
    const effective = c === '' || !(expenseCategories as readonly string[]).includes(c) ? UNKNOWN_CATEGORY_LABEL : c
    return visibleCategories.length === 0 || visibleCategories.includes(effective)
  }
  const expenseToday = isTodayInRange
    ? transactions.filter((t) => t.type === 'expense' && t.date === todayStr && isInSelectedCategories(t.category || ''))
        .reduce((sum, t) => sum + Number(t.amount), 0)
    : 0
  const remainingToday = Math.max(0, dailyBudget - expenseToday)

  const filteredTransactions = transactions.filter((t) => {
    if (visibleCategories.length === 0) return true
    const cat = (t.category || '').trim()
    const effectiveCat = cat === '' || !(expenseCategories as readonly string[]).includes(cat) ? UNKNOWN_CATEGORY_LABEL : cat
    return visibleCategories.includes(effectiveCat)
  })
  const displayedTransactions = filteredTransactions.slice(0, displayCount)
  const hasMore = filteredTransactions.length > displayCount

  const grouped = displayedTransactions.reduce<Record<string, Transaction[]>>((acc, tx) => {
    if (!acc[tx.date]) acc[tx.date] = []
    acc[tx.date].push(tx)
    return acc
  }, {})

  const toggleVisibleCategory = (category: string) => {
    setVisibleCategoriesState((prev) => {
      const next = prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
      setVisibleCategories(next)
      return next
    })
  }

  const showAllCategories = () => {
    setVisibleCategoriesState([])
    setVisibleCategories([])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { alert('กรุณาเข้าสู่ระบบก่อน'); return }
    if (!formData.category) { alert('กรุณาเลือกหมวดหมู่'); return }
    const amount = Number(formData.amount)
    if (!formData.amount || isNaN(amount) || amount <= 0) { alert('กรุณากรอกจำนวนเงินที่มากกว่า 0'); return }
    if (!formData.date) { alert('กรุณาเลือกวันที่'); return }

    try {
      if (editingTransaction) {
        const { error } = await supabase.from('transactions').update({
          type: formData.type, amount, category: formData.category || null,
          description: formData.description || null, date: formData.date,
        }).eq('id', editingTransaction.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('transactions').insert({
          user_id: session.user.id, type: formData.type, amount,
          category: formData.category || null, description: formData.description || null, date: formData.date,
        })
        if (error) throw error
      }
      setEditingTransaction(null)
      setShowModal(false)
      setFormData({ type: 'expense', amount: '', category: '', description: '', date: format(new Date(), 'yyyy-MM-dd') })
      await loadMonthTransactions(selectedMonth, monthEndDay)
    } catch (error: any) {
      console.error('Error saving transaction:', error)
      alert('เกิดข้อผิดพลาด: ' + (error.message || 'ไม่สามารถบันทึกข้อมูลได้'))
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบรายการนี้?')) return
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { alert('กรุณาเข้าสู่ระบบก่อน'); return }
      const { error } = await supabase.from('transactions').delete().eq('id', id)
      if (error) throw error
      await loadMonthTransactions(selectedMonth, monthEndDay)
    } catch (error: any) {
      console.error('Error deleting transaction:', error)
      alert('เกิดข้อผิดพลาด: ' + (error.message || 'ไม่สามารถลบข้อมูลได้'))
    }
  }

  const handleCancel = () => {
    setEditingTransaction(null)
    setShowModal(false)
    setFormData({ type: 'expense', amount: '', category: '', description: '', date: format(new Date(), 'yyyy-MM-dd') })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background pb-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary border-t-transparent mx-auto" />
          <p className="mt-4 text-muted-foreground">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-fade-in pb-20">
      {/* Header with logout */}
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-foreground">รายรับรายจ่าย</h1>
        <button
          type="button"
          onClick={async () => {
            await supabase.auth.signOut()
            router.push('/auth/login')
            router.refresh()
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
        >
          <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
          <span>ออกจากระบบ</span>
        </button>
      </div>

      <MonthSelector currentMonth={selectedMonth} onChange={setSelectedMonth} />

      {/* Daily Summary */}
      {isTodayInRange && (
        <div className="px-4 mb-4">
          <Card className="shadow-card border-0 gradient-hero text-white">
            <CardContent className="p-4">
              <p className="text-sm opacity-90 mb-1">ใช้จ่ายวันนี้</p>
              <p className="text-2xl font-bold tabular-nums">฿{formatCurrency(expenseToday)}</p>
              <p className="text-xs opacity-80 mt-1">งบรายวัน: ฿{formatCurrency(Math.round(dailyBudget))}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Budget Breakdown */}
      {isTodayInRange && (
        <div className="px-4 mb-4 grid grid-cols-3 gap-3">
          <StatBox label="เหลืออีก" value={`${remainingDays} วัน`} />
          <StatBox label="งบรายวัน" value={`฿${formatCurrency(Math.round(dailyBudget))}`} />
          <StatBox label="เหลือวันนี้" value={`฿${formatCurrency(Math.round(remainingToday))}`} />
        </div>
      )}

      {/* Filter Chips */}
      <div className="px-4 mb-4 overflow-x-auto">
        <div className="flex gap-2 pb-1">
          <FilterChip label="ทั้งหมด" active={visibleCategories.length === 0} onClick={showAllCategories} />
          {expenseCategories.map((cat) => (
            <FilterChip
              key={cat}
              label={cat}
              emoji={getCategoryEmoji(cat)}
              active={visibleCategories.includes(cat)}
              onClick={() => toggleVisibleCategory(cat)}
            />
          ))}
          <FilterChip
            label={UNKNOWN_CATEGORY_LABEL}
            emoji="📌"
            active={visibleCategories.includes(UNKNOWN_CATEGORY_LABEL)}
            onClick={() => toggleVisibleCategory(UNKNOWN_CATEGORY_LABEL)}
          />
        </div>
      </div>

      {/* Transaction List — grouped by date */}
      <div className="px-4 mb-6">
        {filteredTransactions.length === 0 ? (
          <Card className="shadow-card border-0">
            <CardContent className="p-8 text-center text-muted-foreground text-sm">
              ยังไม่มีรายการในเดือนนี้
            </CardContent>
          </Card>
        ) : (
          Object.entries(grouped)
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([date, txs]) => (
              <div key={date} className="mb-4">
                <p className="text-xs font-medium text-muted-foreground mb-2 sticky top-0 bg-background py-1">{date}</p>
                <Card className="shadow-card border-0">
                  <CardContent className="p-0">
                    {txs.map((tx, i) => (
                      <div key={tx.id} className={`flex items-center gap-3 px-4 py-3 ${i !== txs.length - 1 ? 'border-b border-border' : ''}`}>
                        <CategoryIcon category={tx.category || ''} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-foreground truncate">{tx.category || '-'}</p>
                            {tx.type === 'expense' && getExpenseCategoryType(tx.category || '') === 'fixed' && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">คงที่</Badge>
                            )}
                          </div>
                          {tx.description && tx.description.trim() !== '' && (
                            <p className="text-xs text-muted-foreground truncate">{tx.description}</p>
                          )}
                        </div>
                        <span className={`text-sm font-semibold tabular-nums ${tx.type === 'income' ? 'text-success' : 'text-foreground'}`}>
                          {tx.type === 'income' ? '+' : '-'}฿{formatCurrency(Number(tx.amount))}
                        </span>
                        <button
                          onClick={() => handleDelete(tx.id)}
                          className="p-1 text-muted-foreground hover:text-danger transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            ))
        )}
        {hasMore && (
          <button
            type="button"
            onClick={() => setDisplayCount((c) => c + PAGE_SIZE)}
            className="w-full py-3 rounded-xl border border-border text-muted-foreground text-sm font-medium hover:bg-secondary transition-colors"
          >
            โหลดเพิ่ม ({filteredTransactions.length - displayCount} รายการ)
          </button>
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => {
          setEditingTransaction(null)
          setFormData({ type: 'expense', amount: '', category: '', description: '', date: format(new Date(), 'yyyy-MM-dd') })
          setShowModal(true)
        }}
        className="fixed bottom-20 right-4 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:shadow-xl transition-shadow z-40"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl w-full max-w-md max-h-[90vh] flex flex-col shadow-xl">
            <div className="sticky top-0 bg-card border-b border-border px-4 py-3 flex justify-between items-center z-10 rounded-t-xl">
              <h2 className="text-lg font-semibold text-foreground">
                {editingTransaction ? 'แก้ไขรายการ' : 'เพิ่มรายการใหม่'}
              </h2>
              <button onClick={handleCancel} className="p-1 text-muted-foreground hover:text-foreground">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pb-4">
              <form onSubmit={handleSubmit} className="p-4 space-y-4 pb-8">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'expense', category: '' })}
                    className={`flex-1 py-3 rounded-xl font-medium transition-colors ${formData.type === 'expense' ? 'bg-danger/10 text-danger border border-danger/20' : 'bg-secondary text-secondary-foreground'}`}
                  >
                    รายจ่าย
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'income', category: '' })}
                    className={`flex-1 py-3 rounded-xl font-medium transition-colors ${formData.type === 'income' ? 'bg-success/10 text-success border border-success/20' : 'bg-secondary text-secondary-foreground'}`}
                  >
                    รายรับ
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">หมวดหมู่</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-primary text-foreground appearance-none bg-card"
                    required
                  >
                    <option value="">เลือกหมวดหมู่</option>
                    {(formData.type === 'income' ? incomeCategories : expenseCategories).map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">จำนวนเงิน (บาท)</label>
                  <input
                    type="number"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required min="0" step="0.01"
                    className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-primary text-foreground placeholder:text-muted-foreground"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">วันที่</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required
                    className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-primary text-foreground"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">หมายเหตุ</label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-primary text-foreground placeholder:text-muted-foreground"
                    placeholder="รายละเอียดเพิ่มเติม"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <Card className="shadow-card border-0">
      <CardContent className="p-3 text-center">
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        <p className="text-sm font-bold tabular-nums text-foreground">{value}</p>
      </CardContent>
    </Card>
  )
}

function FilterChip({ label, emoji, active, onClick }: { label: string; emoji?: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1 ${
        active ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
      }`}
    >
      {emoji && <span>{emoji}</span>}
      {label}
    </button>
  )
}
