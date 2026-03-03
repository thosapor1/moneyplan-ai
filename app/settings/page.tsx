'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  supabase,
  Profile,
  fetchCategoryBudgets,
  saveCategoryBudgets,
  fetchDebtItems,
  insertDebtItem,
  updateDebtItem,
  deleteDebtItem,
  type DebtItemRow,
} from '@/lib/supabase'
import BottomNavigation from '@/components/BottomNavigation'
import { SettingsIcon } from '@/components/icons'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EXPENSE_CATEGORIES } from '@/lib/storage'
import { getActiveMonthRange } from '@/lib/period'
import { getExpenseCategoryType } from '@/lib/forecast'
import { formatCycleLabel } from '@/src/domain/budget/budget-cycle'

const formatCurrency = (n: number) => n.toLocaleString('th-TH')

export default function SettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
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
    include_carried_over: true,
  })
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const initialProfileRef = useRef<Profile | null>(null)
  const profileRef = useRef<Profile>(profile)
  const [numericInputs, setNumericInputs] = useState<Partial<Record<keyof Profile, string>>>({})
  const [categoryBudgets, setCategoryBudgetsState] = useState<Record<string, number>>({})
  const [debtItems, setDebtItems] = useState<DebtItemRow[]>([])
  const [editingDebtId, setEditingDebtId] = useState<string | null>(null)
  const [editingDebtValues, setEditingDebtValues] = useState<{ name: string; remaining: number; interest_rate: number | null; priority: 'high' | 'normal' }>({
    name: '', remaining: 0, interest_rate: null, priority: 'normal',
  })

  useEffect(() => { profileRef.current = profile }, [profile])

  const loadData = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/auth/login'); return }

    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
      if (error && error.code !== 'PGRST116') console.error('Error loading profile:', error)
      else if (data) {
        const p = { ...data, month_end_day: data.month_end_day ?? 0, include_carried_over: data.include_carried_over ?? true }
        setProfile(p)
        initialProfileRef.current = p
      } else {
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
          include_carried_over: true,
        }
        setProfile(newProfile)
        initialProfileRef.current = newProfile
      }

      const [budgets, debts] = await Promise.all([
        fetchCategoryBudgets(session.user.id),
        fetchDebtItems(session.user.id),
      ])
      setCategoryBudgetsState(budgets)
      setDebtItems(debts)

      // Auto-sync total_liabilities on load — use sum(remaining) so net worth = assets - current debt
      if (debts.length > 0) {
        const computedTotal = debts.reduce((s, d) => s + Number(d.remaining), 0)
        const storedTotal = data?.total_liabilities ?? 0
        if (computedTotal !== storedTotal) {
          setProfile((prev) => ({ ...prev, total_liabilities: computedTotal }))
          await supabase.from('profiles').update({ total_liabilities: computedTotal, updated_at: new Date().toISOString() }).eq('id', session.user.id)
        }
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { loadData() }, [loadData])

  const saveProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session || !profileRef.current.id) return
    try {
      setSaving(true)
      const payload = { ...profileRef.current, id: session.user.id, updated_at: new Date().toISOString() }
      const { error } = await supabase.from('profiles').upsert(payload)
      if (error) throw error
      initialProfileRef.current = { ...profileRef.current }
    } catch (error: any) {
      console.error('Error saving profile:', error)
      if (initialProfileRef.current) setProfile(initialProfileRef.current)
    } finally {
      setSaving(false)
    }
  }

  const handleFieldChange = (field: keyof Profile, value: number) => {
    setProfile((prev) => ({ ...prev, [field]: value }))
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    setSaving(true)
    saveTimeoutRef.current = setTimeout(() => { saveProfile() }, 1000)
  }

  const handleFieldBlur = () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveProfile()
  }

  /** Recompute total_liabilities = sum(debt_items.remaining) and save to DB + local state */
  const syncTotalLiabilities = async (userId: string) => {
    const items = await fetchDebtItems(userId)
    setDebtItems(items)
    const total = items.reduce((s, d) => s + Number(d.remaining), 0)
    setProfile((prev) => ({ ...prev, total_liabilities: total }))
    profileRef.current = { ...profileRef.current, total_liabilities: total }
    await supabase.from('profiles').update({ total_liabilities: total, updated_at: new Date().toISOString() }).eq('id', userId)
  }

  type NumericField =
    | 'fixed_expense'
    | 'variable_expense'
    | 'monthly_debt_payment'
    | 'saving'
    | 'investment'
    | 'liquid_assets'
    | 'total_assets'
    | 'total_liabilities'

  const getNumericDisplay = (field: NumericField) =>
    numericInputs[field] !== undefined ? numericInputs[field] : String(profile[field] ?? 0)

  const handleNumericChange = (field: NumericField, e: React.ChangeEvent<HTMLInputElement>) =>
    setNumericInputs((prev) => ({ ...prev, [field]: e.target.value }))

  const handleNumericBlur = (field: NumericField) => {
    const raw = numericInputs[field] ?? profile[field] ?? 0
    const num = typeof raw === 'string' ? (parseFloat(raw) || 0) : Number(raw) || 0
    handleFieldChange(field, num)
    setNumericInputs((prev) => { const next = { ...prev }; delete next[field]; return next })
    handleFieldBlur()
  }

  useEffect(() => {
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current) }
  }, [])

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
    <div className="animate-fade-in px-4 pt-4 pb-20">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-bold text-foreground">ตั้งค่าระบบ</h1>
        </div>
        {saving && (
          <div className="flex items-center gap-1.5 text-xs text-primary">
            <div className="animate-spin rounded-full h-3 w-3 border-2 border-primary border-t-transparent" />
            <span>กำลังบันทึก...</span>
          </div>
        )}
      </div>
      <p className="text-sm text-muted-foreground mb-4">จัดการวงรอบงวด งบประมาณ และจัดการหนี้สินของคุณ</p>

      {/* Salary Day — defines budget cycle boundary */}
      <div className="mb-6">
        <h3 className="font-semibold text-foreground mb-3">กำหนดงวดบัญชีของคุณ</h3>
        <Card className="shadow-card border-0">
          <CardContent className="p-4">
            <label className="block text-xs text-muted-foreground mb-2">วันที่รับเงินเดือน (กำหนดงวดบัญชี)</label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="0"
                max="31"
                step="1"
                value={profile.month_end_day ?? 0}
                onChange={(e) => {
                  const v = Math.max(0, Math.min(31, parseInt(e.target.value, 10) || 0))
                  handleFieldChange('month_end_day', v)
                }}
                onBlur={handleFieldBlur}
                className="w-20 px-3 py-2 border border-border rounded-xl focus:ring-2 focus:ring-primary text-foreground bg-card text-sm text-center"
              />
              <div>
                {(profile.month_end_day ?? 0) === 0 ? (
                  <p className="text-xs text-muted-foreground">ตามเดือนปฏิทิน (ค่าเริ่มต้น)</p>
                ) : (() => {
                  const range = getActiveMonthRange(new Date(), profile.month_end_day ?? 0)
                  return (
                    <p className="text-xs text-primary font-medium">
                      งวดปัจจุบัน: {formatCycleLabel({ startDate: range.start, endDate: range.end })}
                    </p>
                  )
                })()}
                <p className="text-[10px] text-muted-foreground mt-0.5">0 = ปฏิทิน · 1–31 = วันรับเงินเดือน เช่น 27</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Category Budgets */}
      <div className="mb-6">
        <h3 className="font-semibold text-foreground mb-3">งบประมาณต่อหมวดหมู่</h3>
        <Card className="shadow-card border-0">
          <CardContent className="p-0">
            {EXPENSE_CATEGORIES.map((cat, i) => {
              const value = categoryBudgets[cat] ?? 0
              const tagType = getExpenseCategoryType(cat)
              const frequency = tagType === 'fixed' ? 'รายเดือน' : 'รายวัน'
              return (
                <div
                  key={cat}
                  className={`flex items-center px-4 py-3 ${i !== EXPENSE_CATEGORIES.length - 1 ? 'border-b border-border' : ''}`}
                >
                  <span className="flex-1 text-sm text-foreground">{cat}</span>
                  <Badge variant="secondary" className="text-[10px] mr-3">{frequency}</Badge>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={value === 0 ? '' : value}
                    onChange={async (e) => {
                      const num = e.target.value === '' ? 0 : parseFloat(e.target.value) || 0
                      const next = { ...categoryBudgets, [cat]: num }
                      setCategoryBudgetsState(next)
                      const { data: { session } } = await supabase.auth.getSession()
                      if (session) await saveCategoryBudgets(session.user.id, next)
                    }}
                    placeholder="0"
                    className="w-24 px-3 py-2 border border-border rounded-xl text-foreground text-sm text-right bg-card"
                  />
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>

      {/* Budget Targets */}
      <div className="mb-6">
        <h3 className="font-semibold text-foreground mb-3">ข้อมูลทรัพย์สินและหนี้สิน</h3>
        <Card className="shadow-card border-0">
          <CardContent className="p-4 space-y-3">
            {([
              ['fixed_expense', 'รายจ่ายคงที่ (บาท)'],
              ['variable_expense', 'รายจ่ายผันแปร (บาท)'],
              ['monthly_debt_payment', 'ผ่อนหนี้ต่อเดือน (บาท)'],
              ['saving', 'เงินออม (บาท)'],
              ['investment', 'เงินลงทุน (บาท)'],
              ['liquid_assets', 'ทรัพย์สินสภาพคล่อง (บาท)'],
              ['total_assets', 'ทรัพย์สินรวม (บาท)'],
            ] as [NumericField, string][]).map(([field, label]) => (
              <div key={field}>
                <label className="block text-xs text-muted-foreground mb-1">{label}</label>
                <input
                  type="number"
                  value={getNumericDisplay(field)}
                  onChange={(e) => handleNumericChange(field, e)}
                  onBlur={() => handleNumericBlur(field)}
                  className="w-full px-4 py-2 border border-border rounded-xl focus:ring-2 focus:ring-primary text-foreground placeholder:text-muted-foreground bg-card text-sm"
                  min="0"
                  step="0.01"
                />
              </div>
            ))}
            {/* หนี้สินรวม — read-only, computed from รายการหนี้แยกประเภท */}
            <div>
              <label className="block text-xs text-muted-foreground mb-1">
                หนี้สินรวม (บาท) <span className="text-muted-foreground/60">คำนวณจากรายการหนี้ด้านล่าง</span>
              </label>
              <div className="w-full px-4 py-2 border border-border rounded-xl bg-secondary text-sm font-medium tabular-nums text-foreground">
                ฿{formatCurrency(debtItems.length > 0 ? debtItems.reduce((s, d) => s + Number(d.remaining), 0) : (profile.total_liabilities ?? 0))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Debt Items */}
      <div className="mb-6">
        <h3 className="font-semibold text-foreground mb-3">บริหารรายการหนี้ที่ต้องชำระ</h3>
        <Card className="shadow-card border-0">
          <CardContent className="p-4">
            {debtItems.length > 0 && (
              <div className="space-y-2 mb-4">
                {debtItems.map((item) => (
                  <div key={item.id}>
                    {editingDebtId === item.id ? (
                      // Edit Mode
                      <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">ชื่อหนี้</label>
                          <input
                            type="text"
                            value={editingDebtValues.name}
                            onChange={(e) => setEditingDebtValues({ ...editingDebtValues, name: e.target.value })}
                            className="w-full px-3 py-2 border border-border rounded-lg text-foreground text-sm bg-card"
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-xs text-muted-foreground mb-1">คงเหลือ</label>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={editingDebtValues.remaining}
                              onChange={(e) => setEditingDebtValues({ ...editingDebtValues, remaining: parseFloat(e.target.value) || 0 })}
                              className="w-full px-3 py-2 border border-border rounded-lg text-foreground text-sm bg-card"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-muted-foreground mb-1">ดอกเบี้ย %</label>
                            <input
                              type="number"
                              min="0"
                              step="0.1"
                              value={editingDebtValues.interest_rate ?? ''}
                              onChange={(e) => setEditingDebtValues({ ...editingDebtValues, interest_rate: e.target.value ? parseFloat(e.target.value) : null })}
                              className="w-full px-3 py-2 border border-border rounded-lg text-foreground text-sm bg-card"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-muted-foreground mb-1">ลำดับความสำคัญ</label>
                            <select
                              value={editingDebtValues.priority}
                              onChange={(e) => setEditingDebtValues({ ...editingDebtValues, priority: e.target.value as 'high' | 'normal' })}
                              className="w-full px-3 py-2 border border-border rounded-lg text-foreground text-sm bg-card"
                            >
                              <option value="normal">ปกติ</option>
                              <option value="high">สำคัญ</option>
                            </select>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={async () => {
                              await updateDebtItem(item.id, {
                                name: editingDebtValues.name,
                                remaining: editingDebtValues.remaining,
                                interest_rate: editingDebtValues.interest_rate,
                                priority: editingDebtValues.priority,
                              })
                              const { data: { session } } = await supabase.auth.getSession()
                              if (session) await syncTotalLiabilities(session.user.id)
                              setEditingDebtId(null)
                            }}
                            className="flex-1 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
                          >
                            บันทึก
                          </button>
                          <button
                            onClick={() => setEditingDebtId(null)}
                            className="flex-1 py-2 bg-secondary text-secondary-foreground text-sm font-medium rounded-lg hover:bg-secondary/80 transition-colors"
                          >
                            ยกเลิก
                          </button>
                        </div>
                      </div>
                    ) : (
                      // View Mode
                      <div className="flex items-center justify-between p-3 rounded-xl bg-secondary border border-border">
                        <div>
                          <span className="text-sm font-medium text-foreground">{item.name}</span>
                          <div className="flex gap-2 text-xs text-muted-foreground">
                            {item.original > 0 && item.original !== item.remaining && (
                              <span>เริ่มต้น ฿{formatCurrency(Number(item.original))}</span>
                            )}
                            <span>คงเหลือ ฿{formatCurrency(Number(item.remaining))}</span>
                            {item.interest_rate != null && <span>ดอกเบี้ย {item.interest_rate}%</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {item.priority === 'high' && (
                            <Badge variant="warning" className="text-[10px]">ควรโปะก่อน</Badge>
                          )}
                          <button
                            onClick={() => {
                              setEditingDebtValues({
                                name: item.name,
                                remaining: Number(item.remaining),
                                interest_rate: item.interest_rate ?? null,
                                priority: item.priority ?? 'normal',
                              })
                              setEditingDebtId(item.id)
                            }}
                            className="px-2 py-1 text-[10px] text-primary font-medium hover:bg-primary/10 rounded-lg transition-colors"
                          >
                            แก้ไข
                          </button>
                          <Link
                            href={`/debt-calculator?principal=${item.remaining}&rate=${item.interest_rate ?? 0}&name=${encodeURIComponent(item.name)}`}
                            className="px-2 py-1 text-[10px] text-primary font-medium hover:bg-primary/10 rounded-lg transition-colors"
                          >
                            คำนวณ
                          </Link>
                          <button
                            onClick={async () => {
                              await deleteDebtItem(item.id)
                              const { data: { session } } = await supabase.auth.getSession()
                              if (session) await syncTotalLiabilities(session.user.id)
                            }}
                            className="p-1 text-muted-foreground hover:text-danger transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <form
              className="space-y-2"
              onSubmit={async (e) => {
                e.preventDefault()
                const form = e.currentTarget
                const name = (form.querySelector('[name="debt_name"]') as HTMLInputElement)?.value?.trim()
                const original = parseFloat((form.querySelector('[name="debt_original"]') as HTMLInputElement)?.value || '0')
                const remaining = parseFloat((form.querySelector('[name="debt_remaining"]') as HTMLInputElement)?.value || '0')
                const interestRate = (form.querySelector('[name="debt_rate"]') as HTMLInputElement)?.value
                const priority = (form.querySelector('[name="debt_priority"]') as HTMLSelectElement)?.value as 'high' | 'normal'
                if (!name || remaining <= 0) return
                const { data: { session } } = await supabase.auth.getSession()
                if (!session) return
                const created = await insertDebtItem(session.user.id, {
                  name,
                  original: original > 0 ? original : remaining,
                  remaining,
                  interest_rate: interestRate ? parseFloat(interestRate) : undefined,
                  priority: priority === 'high' ? 'high' : 'normal',
                })
                if (created) {
                  await syncTotalLiabilities(session.user.id)
                  form.reset()
                }
              }}
            >
              <input
                name="debt_name"
                type="text"
                placeholder="ชื่อหนี้ (เช่น บัตรเครดิต A)"
                className="w-full px-4 py-2 border border-border rounded-xl text-foreground text-sm placeholder:text-muted-foreground bg-card"
                required
              />
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">เริ่มต้น</label>
                  <input
                    name="debt_original"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    className="w-full px-3 py-2 border border-border rounded-xl text-foreground text-sm placeholder:text-muted-foreground bg-card"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">คงเหลือ</label>
                  <input
                    name="debt_remaining"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    className="w-full px-3 py-2 border border-border rounded-xl text-foreground text-sm placeholder:text-muted-foreground bg-card"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">ดอกเบี้ย %</label>
                  <input
                    name="debt_rate"
                    type="number"
                    min="0"
                    step="0.1"
                    placeholder="0"
                    className="w-full px-3 py-2 border border-border rounded-xl text-foreground text-sm placeholder:text-muted-foreground bg-card"
                  />
                </div>
              </div>
              <select
                name="debt_priority"
                className="w-full px-4 py-2 border border-border rounded-xl text-foreground text-sm bg-card"
              >
                <option value="normal">ความสำคัญ: ปกติ</option>
                <option value="high">ควรโปะก่อน</option>
              </select>
              <button
                type="submit"
                className="w-full py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                เพิ่มรายการหนี้
              </button>
            </form>
          </CardContent>
        </Card>
      </div>

      <BottomNavigation />
    </div>
  )
}
