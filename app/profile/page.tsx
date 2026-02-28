'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase, Profile, fetchCategoryBudgets, saveCategoryBudgets, fetchDebtItems, insertDebtItem, deleteDebtItem, type DebtItemRow } from '@/lib/supabase'
import { format } from 'date-fns'
import FinancialAnalysis from '@/components/FinancialAnalysis'
import BottomNavigation from '@/components/BottomNavigation'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { EXPENSE_CATEGORIES } from '@/lib/storage'
import { getActiveMonthRange } from '@/lib/period'
import { getExpenseCategoryType } from '@/lib/forecast'
import {
  TrendingUpIcon,
  TrendingDownIcon,
  PiggyBankIcon,
  CreditCardIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
} from '@/components/icons'

const formatCurrency = (n: number) => n.toLocaleString('th-TH')

export default function ProfilePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [totalIncome, setTotalIncome] = useState(0)
  const [totalSavingFromTransactions, setTotalSavingFromTransactions] = useState<number | undefined>(undefined)
  const [totalDebtPaymentFromTransactions, setTotalDebtPaymentFromTransactions] = useState<number | undefined>(undefined)
  const [profile, setProfile] = useState<Profile>({
    id: '', monthly_debt_payment: 0, fixed_expense: 0, variable_expense: 0,
    saving: 0, investment: 0, liquid_assets: 0, total_assets: 0, total_liabilities: 0, month_end_day: 0,
  })
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const initialProfileRef = useRef<Profile | null>(null)
  const profileRef = useRef<Profile>(profile)
  const [numericInputs, setNumericInputs] = useState<Partial<Record<keyof Profile, string>>>({})
  const [categoryBudgets, setCategoryBudgetsState] = useState<Record<string, number>>({})
  const [debtItems, setDebtItems] = useState<DebtItemRow[]>([])

  useEffect(() => { profileRef.current = profile }, [profile])

  const loadProfile = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/auth/login'); return }

    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
      if (error && error.code !== 'PGRST116') console.error('Error loading profile:', error)
      else if (data) {
        setProfile({ ...data, month_end_day: data.month_end_day ?? 0 })
        initialProfileRef.current = { ...data, month_end_day: data.month_end_day ?? 0 }
      } else {
        const newProfile: Profile = { id: session.user.id, monthly_debt_payment: 0, fixed_expense: 0, variable_expense: 0, saving: 0, investment: 0, liquid_assets: 0, total_assets: 0, total_liabilities: 0, month_end_day: 0 }
        setProfile(newProfile)
        initialProfileRef.current = newProfile
      }

      const now = new Date()
      const monthEndDay = 0
      const { start, end } = getActiveMonthRange(now, monthEndDay)
      const { data: transactionsData, error: transactionsError } = await supabase
        .from('transactions').select('*').eq('user_id', session.user.id)
        .gte('date', format(start, 'yyyy-MM-dd')).lte('date', format(end, 'yyyy-MM-dd'))

      if (!transactionsError && transactionsData) {
        setTotalIncome(transactionsData.filter((t) => t.type === 'income').reduce((sum, t) => sum + Number(t.amount), 0))
        setTotalSavingFromTransactions(transactionsData.filter((t) => t.type === 'expense' && (t.category?.trim() === 'ออมเงิน' || t.category?.trim() === 'ลงทุน')).reduce((sum, t) => sum + Number(t.amount), 0))
        setTotalDebtPaymentFromTransactions(transactionsData.filter((t) => t.type === 'expense' && t.category?.trim() === 'ผ่อนชำระหนี้').reduce((sum, t) => sum + Number(t.amount), 0))
      } else {
        setTotalSavingFromTransactions(undefined)
        setTotalDebtPaymentFromTransactions(undefined)
      }

      setCategoryBudgetsState(await fetchCategoryBudgets(session.user.id))
      setDebtItems(await fetchDebtItems(session.user.id))
    } catch (error) { console.error('Error:', error) } finally { setLoading(false) }
  }, [router])

  useEffect(() => { loadProfile() }, [loadProfile])

  const saveProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session || !profileRef.current.id) return
    try {
      setSaving(true)
      const profileToSave = { ...profileRef.current }
      const { error } = await supabase.from('profiles').upsert({ ...profileToSave, id: session.user.id, updated_at: new Date().toISOString() })
      if (error) throw error
      initialProfileRef.current = { ...profileToSave }
    } catch (error: any) {
      console.error('Error saving profile:', error)
      if (initialProfileRef.current) setProfile(initialProfileRef.current)
    } finally { setSaving(false) }
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

  type NumericField = 'fixed_expense' | 'variable_expense' | 'monthly_debt_payment' | 'saving' | 'investment' | 'liquid_assets' | 'total_assets' | 'total_liabilities'
  const getNumericDisplay = (field: NumericField) => numericInputs[field] !== undefined ? numericInputs[field] : String(profile[field] ?? 0)
  const handleNumericChange = (field: NumericField, e: React.ChangeEvent<HTMLInputElement>) => setNumericInputs((prev) => ({ ...prev, [field]: e.target.value }))
  const handleNumericBlur = (field: NumericField) => {
    const raw = numericInputs[field] ?? profile[field] ?? 0
    const num = typeof raw === 'string' ? (parseFloat(raw) || 0) : Number(raw) || 0
    handleFieldChange(field, num)
    setNumericInputs((prev) => { const next = { ...prev }; delete next[field]; return next })
    handleFieldBlur()
  }

  useEffect(() => { return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current) } }, [])

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

  const monthlyExpenses = (profile.fixed_expense ?? 0) + (profile.variable_expense ?? 0)
  const savingFromProfile = (profile.saving ?? 0) + (profile.investment ?? 0)
  const debtPaymentFromProfile = profile.monthly_debt_payment ?? 0

  // Fallback income: sum of all outflows when no income transactions recorded
  const effectiveIncome = totalIncome > 0
    ? totalIncome
    : (monthlyExpenses + savingFromProfile + debtPaymentFromProfile)

  // Prefer actual transaction amounts over profile targets (same logic as FinancialAnalysis)
  const actualSaving = totalSavingFromTransactions !== undefined && totalSavingFromTransactions >= 0
    ? totalSavingFromTransactions
    : savingFromProfile
  const actualDebtPayment = totalDebtPaymentFromTransactions !== undefined && totalDebtPaymentFromTransactions >= 0
    ? totalDebtPaymentFromTransactions
    : debtPaymentFromProfile

  const savingsRate = effectiveIncome > 0 ? Math.round((actualSaving / effectiveIncome) * 100) : 0
  const debtRatio = effectiveIncome > 0 ? Math.round((actualDebtPayment / effectiveIncome) * 100) : 0
  const emergencyMonths = monthlyExpenses > 0 ? Math.floor((profile.liquid_assets ?? 0) / monthlyExpenses) : 0
  const emergencyMonthsExact = monthlyExpenses > 0 ? (profile.liquid_assets ?? 0) / monthlyExpenses : 0
  const fixedExpenseRatio = effectiveIncome > 0 ? Math.round((profile.fixed_expense ?? 0) / effectiveIncome * 100) : 0

  // Health score: thresholds aligned with FinancialAnalysis (>=10% savings = good)
  let healthScore = 50
  if (savingsRate >= 20) healthScore += 15; else if (savingsRate >= 10) healthScore += 10; else if (savingsRate > 0) healthScore += 3
  if (debtRatio === 0) healthScore += 10; else if (debtRatio <= 30) healthScore += 5; else if (debtRatio <= 50) healthScore += 0; else healthScore -= 10
  if (emergencyMonths >= 6) healthScore += 15; else if (emergencyMonths >= 3) healthScore += 8; else if (emergencyMonths > 0) healthScore -= 2; else healthScore -= 5
  if (fixedExpenseRatio < 50) healthScore += 10; else if (fixedExpenseRatio < 70) healthScore += 3; else healthScore -= 5
  healthScore = Math.max(0, Math.min(100, healthScore))

  const totalDebt = profile.total_liabilities ?? 0
  const currentSaved = profile.liquid_assets ?? 0
  // Savings target: 6 months of expenses (standard emergency fund benchmark)
  const emergencyTarget = monthlyExpenses > 0 ? monthlyExpenses * 6 : 100000
  // Debt ring: use debtItems total if available, otherwise profile total_liabilities
  const debtItemsTotal = debtItems.length > 0
    ? debtItems.reduce((s, d) => s + Number(d.remaining), 0)
    : totalDebt
  // Debt paid = profile.total_liabilities - sum of debtItem remaining (if items exist)
  const debtPaidSoFar = debtItems.length > 0 && totalDebt > debtItemsTotal
    ? totalDebt - debtItemsTotal
    : 0

  const strengths: string[] = []
  const weaknesses: string[] = []
  if (savingsRate >= 20) strengths.push(`ออมเงินได้ ${savingsRate}% ของรายรับ สูงกว่าค่าเฉลี่ย`)
  else if (savingsRate >= 10) strengths.push(`อัตราออม ${savingsRate}% อยู่ในเกณฑ์ที่ดี`)
  if (debtRatio <= 30 && totalDebt > 0) strengths.push('อัตราหนี้ต่อรายได้ต่ำ ไม่น่าเป็นห่วง')
  if (totalDebt === 0 && debtPaymentFromProfile === 0) strengths.push('ไม่มีหนี้สินคงค้าง')
  if (emergencyMonths >= 6) strengths.push(`มีเงินฉุกเฉินพอ ${emergencyMonths} เดือน ถือว่าดีมาก`)
  else if (emergencyMonths >= 3) strengths.push(`มีเงินฉุกเฉิน ${emergencyMonths} เดือน`)
  if (emergencyMonths < 3 && monthlyExpenses > 0) weaknesses.push(`เงินฉุกเฉินมี ${emergencyMonthsExact.toFixed(1)} เดือน (ควร ≥ 6 เดือน)`)
  if (savingsRate < 10 && effectiveIncome > 0) weaknesses.push(`อัตราออม ${savingsRate}% ต่ำกว่าเกณฑ์ 10% ควรเพิ่มการออม`)
  if (debtRatio > 50) weaknesses.push(`อัตราหนี้ ${debtRatio}% สูงเกินไป (ควร ≤ 50%)`)
  else if (debtRatio > 30) weaknesses.push(`อัตราหนี้ ${debtRatio}% ค่อนข้างสูง ควรลดหนี้`)
  if (fixedExpenseRatio >= 70 && effectiveIncome > 0) weaknesses.push(`ค่าใช้จ่ายคงที่ ${fixedExpenseRatio}% สูงเกินไป`)
  if (strengths.length === 0) strengths.push('เริ่มบันทึกข้อมูลเพื่อดูจุดแข็ง')
  if (weaknesses.length === 0) weaknesses.push('ไม่พบจุดอ่อนที่ต้องปรับปรุง')

  return (
    <div className="animate-fade-in px-4 pt-4 pb-20">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-foreground">สุขภาพการเงิน</h1>
        <button
          type="button"
          onClick={async () => { await supabase.auth.signOut(); router.push('/auth/login'); router.refresh() }}
          className="flex items-center gap-2 px-3 py-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
          title="ออกจากระบบ"
        >
          <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
          <span className="text-sm font-medium">ออกจากระบบ</span>
        </button>
      </div>

      {saving && (
        <div className="bg-primary/10 border border-primary/20 rounded-xl p-3 flex items-center gap-2 mb-4">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent" />
          <span className="text-sm text-primary">กำลังบันทึก...</span>
        </div>
      )}

      {/* Health Score Gauge */}
      <Card className="shadow-card border-0 mb-6">
        <CardContent className="p-6 flex flex-col items-center">
          <div className="relative w-36 h-36 mb-4">
            <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
              <circle cx="60" cy="60" r="50" fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
              <circle
                cx="60" cy="60" r="50" fill="none"
                stroke={healthScore >= 70 ? 'hsl(var(--success))' : healthScore >= 40 ? 'hsl(var(--warning))' : 'hsl(var(--danger))'}
                strokeWidth="10" strokeLinecap="round"
                strokeDasharray={`${(healthScore / 100) * 314} 314`}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold tabular-nums text-foreground">{healthScore}</span>
              <span className="text-xs text-muted-foreground">คะแนน</span>
            </div>
          </div>
          <Badge className={`${healthScore >= 70 ? 'bg-success/10 text-success' : healthScore >= 40 ? 'bg-warning/10 text-warning' : 'bg-danger/10 text-danger'} border-0`}>
            {healthScore >= 70 ? 'สุขภาพดี' : healthScore >= 40 ? 'ต้องปรับปรุง' : 'ต้องแก้ไขเร่งด่วน'}
          </Badge>
        </CardContent>
      </Card>

      {/* Key Indicators */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <IndicatorCard icon={<TrendingUpIcon size={16} />} label="อัตราออม" value={`${savingsRate}%`} status={savingsRate >= 20 ? 'good' : savingsRate >= 10 ? 'warning' : 'bad'} />
        <IndicatorCard icon={<TrendingDownIcon size={16} />} label="หนี้/รายได้" value={`${debtRatio}%`} status={debtRatio < 20 ? 'good' : debtRatio < 35 ? 'warning' : 'bad'} />
        <IndicatorCard icon={<PiggyBankIcon size={16} />} label="เงินฉุกเฉิน" value={`${emergencyMonths} เดือน`} status={emergencyMonths >= 6 ? 'good' : emergencyMonths >= 3 ? 'warning' : 'bad'} />
        <IndicatorCard icon={<CreditCardIcon size={16} />} label="ค่าใช้จ่ายคงที่" value={`${fixedExpenseRatio}%`} status={fixedExpenseRatio < 50 ? 'good' : fixedExpenseRatio < 70 ? 'warning' : 'bad'} />
      </div>

      {/* Income */}
      <div className="mb-6">
        <h3 className="font-semibold text-foreground mb-3">รายรับ</h3>
        <Card className="shadow-card border-0">
          <CardContent className="p-4">
            <div className="flex justify-between mb-2">
              <span className="text-sm text-muted-foreground">รายรับจาก transactions</span>
              <span className="text-sm font-semibold tabular-nums text-success">฿{formatCurrency(totalIncome)}</span>
            </div>
            <p className="text-xs text-muted-foreground">คำนวณจากรายรับในหน้า &quot;รายรับรายจ่าย&quot;</p>
          </CardContent>
        </Card>
      </div>

      {/* Financial Goals (Ring) */}
      <div className="mb-6">
        <h3 className="font-semibold text-foreground mb-3">เป้าหมายการเงิน</h3>
        <div className="grid grid-cols-2 gap-3">
          <RingGoal label="เงินฉุกเฉิน" current={currentSaved} target={emergencyTarget} />
          {totalDebt > 0 && debtPaidSoFar > 0 && (
            <RingGoal label="ปลดหนี้" current={debtPaidSoFar} target={totalDebt} />
          )}
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <Link href="/savings-goal" className="text-sm text-primary font-medium hover:underline">เป้าออมเงิน</Link>
          <span className="text-muted-foreground">|</span>
          <Link href="/debt-goal" className="text-sm text-primary font-medium hover:underline">เป้าปลดหนี้</Link>
          <span className="text-muted-foreground">|</span>
          <Link href="/ai-analysis" className="text-sm text-primary font-medium hover:underline">AI วิเคราะห์</Link>
          <span className="text-muted-foreground">|</span>
          <Link href="/forecasts" className="text-sm text-primary font-medium hover:underline">แผน 12 เดือน</Link>
        </div>
      </div>

      {/* Debt */}
      {(totalDebt > 0 || actualDebtPayment > 0) && (
        <div className="mb-6">
          <h3 className="font-semibold text-foreground mb-3">หนี้สิน</h3>
          <Card className="shadow-card border-0">
            <CardContent className="p-4">
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">หนี้สินรวม</span>
                <span className="text-sm font-bold tabular-nums">฿{formatCurrency(totalDebt)}</span>
              </div>
              {totalDebt > 0 && actualDebtPayment > 0 && (
                <>
                  <Progress value={Math.min(100, Math.round((debtPaidSoFar / totalDebt) * 100))} className="h-2 mb-2" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>จ่ายรายเดือน ฿{formatCurrency(actualDebtPayment)}</span>
                    <span>คาดหมด ~{Math.ceil(debtItemsTotal / actualDebtPayment)} เดือน</span>
                  </div>
                </>
              )}
              {totalDebt > 0 && actualDebtPayment === 0 && (
                <p className="text-xs text-muted-foreground">ยังไม่มีข้อมูลการผ่อนชำระ</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Budget Table */}
      <div className="mb-6">
        <h3 className="font-semibold text-foreground mb-3">งบประมาณรายเดือน</h3>
        <Card className="shadow-card border-0">
          <CardContent className="p-0">
            <div className="flex items-center px-4 py-3 border-b border-border">
              <span className="flex-1 text-sm text-foreground">รายจ่ายคงที่</span>
              <Badge variant="secondary" className="text-[10px] mr-3">รายเดือน</Badge>
              <span className="text-sm font-semibold tabular-nums">฿{formatCurrency(profile.fixed_expense ?? 0)}</span>
            </div>
            <div className="flex items-center px-4 py-3 border-b border-border">
              <span className="flex-1 text-sm text-foreground">รายจ่ายผันแปร</span>
              <Badge variant="secondary" className="text-[10px] mr-3">รายเดือน</Badge>
              <span className="text-sm font-semibold tabular-nums">฿{formatCurrency(profile.variable_expense ?? 0)}</span>
            </div>
            <div className="flex items-center px-4 py-3 border-b border-border">
              <span className="flex-1 text-sm text-foreground">ผ่อนหนี้</span>
              <Badge variant="secondary" className="text-[10px] mr-3">รายเดือน</Badge>
              <span className="text-sm font-semibold tabular-nums">฿{formatCurrency(actualDebtPayment)}</span>
            </div>
            <div className="flex items-center px-4 py-3 border-b border-border">
              <span className="flex-1 text-sm text-foreground">ออม + ลงทุน</span>
              <Badge variant="secondary" className="text-[10px] mr-3">รายเดือน</Badge>
              <span className="text-sm font-semibold tabular-nums">฿{formatCurrency(actualSaving)}</span>
            </div>
            <div className="flex items-center px-4 py-3 bg-secondary/50 rounded-b-lg">
              <span className="flex-1 text-sm font-medium">เหลือ</span>
              <span className={`text-sm font-bold tabular-nums ${effectiveIncome - monthlyExpenses - actualDebtPayment - actualSaving >= 0 ? 'text-primary' : 'text-danger'}`}>
                ฿{formatCurrency(effectiveIncome - monthlyExpenses - actualDebtPayment - actualSaving)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Strengths & Weaknesses */}
      <div className="mb-6">
        <h3 className="font-semibold text-foreground mb-3">จุดแข็ง & จุดอ่อน</h3>
        <div className="space-y-2">
          {strengths.map((t, i) => (
            <div key={`s-${i}`} className="flex items-start gap-2">
              <CheckCircleIcon size={16} className="text-success shrink-0 mt-0.5" />
              <p className="text-sm text-foreground">{t}</p>
            </div>
          ))}
          {weaknesses.map((t, i) => (
            <div key={`w-${i}`} className="flex items-start gap-2">
              <AlertTriangleIcon size={16} className="text-warning shrink-0 mt-0.5" />
              <p className="text-sm text-foreground">{t}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Settings — Editable Fields */}
      <div className="mb-6">
        <h3 className="font-semibold text-foreground mb-3">ตั้งค่ารายรับรายจ่าย</h3>
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
              ['total_liabilities', 'หนี้สินรวม (บาท)'],
            ] as [NumericField, string][]).map(([field, label]) => (
              <div key={field}>
                <label className="block text-xs text-muted-foreground mb-1">{label}</label>
                <input
                  type="number"
                  value={getNumericDisplay(field)}
                  onChange={(e) => handleNumericChange(field, e)}
                  onBlur={() => handleNumericBlur(field)}
                  className="w-full px-4 py-2 border border-border rounded-xl focus:ring-2 focus:ring-primary text-foreground placeholder:text-muted-foreground bg-card text-sm"
                  min="0" step="0.01"
                />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Debt Items */}
      <div className="mb-6">
        <h3 className="font-semibold text-foreground mb-3">รายการหนี้แยกประเภท</h3>
        <Card className="shadow-card border-0">
          <CardContent className="p-4">
            {debtItems.length > 0 && (
              <div className="space-y-2 mb-4">
                {debtItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 rounded-xl bg-secondary border border-border">
                    <div>
                      <span className="text-sm font-medium text-foreground">{item.name}</span>
                      <div className="flex gap-2 text-xs text-muted-foreground">
                        <span>คงเหลือ ฿{formatCurrency(Number(item.remaining))}</span>
                        {item.interest_rate != null && <span>ดอกเบี้ย {item.interest_rate}%</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {item.priority === 'high' && <Badge variant="warning" className="text-[10px]">ควรโปะก่อน</Badge>}
                      <button
                        onClick={async () => {
                          await deleteDebtItem(item.id)
                          const { data: { session } } = await supabase.auth.getSession()
                          if (session) setDebtItems(await fetchDebtItems(session.user.id))
                        }}
                        className="p-1 text-muted-foreground hover:text-danger transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
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
                const remaining = parseFloat((form.querySelector('[name="debt_remaining"]') as HTMLInputElement)?.value || '0')
                const interestRate = (form.querySelector('[name="debt_rate"]') as HTMLInputElement)?.value
                const priority = (form.querySelector('[name="debt_priority"]') as HTMLSelectElement)?.value as 'high' | 'normal'
                if (!name || remaining <= 0) return
                const { data: { session } } = await supabase.auth.getSession()
                if (!session) return
                const created = await insertDebtItem(session.user.id, { name, remaining, interest_rate: interestRate ? parseFloat(interestRate) : undefined, priority: priority === 'high' ? 'high' : 'normal' })
                if (created) { setDebtItems(await fetchDebtItems(session.user.id)); form.reset() }
              }}
            >
              <input name="debt_name" type="text" placeholder="ชื่อหนี้ (เช่น บัตรเครดิต A)" className="w-full px-4 py-2 border border-border rounded-xl text-foreground text-sm placeholder:text-muted-foreground bg-card" required />
              <div className="flex gap-2">
                <input name="debt_remaining" type="number" min="0" step="1" placeholder="ยอดคงเหลือ" className="flex-1 px-4 py-2 border border-border rounded-xl text-foreground text-sm placeholder:text-muted-foreground bg-card" required />
                <input name="debt_rate" type="number" min="0" step="0.1" placeholder="ดอกเบี้ย %" className="w-24 px-4 py-2 border border-border rounded-xl text-foreground text-sm placeholder:text-muted-foreground bg-card" />
              </div>
              <select name="debt_priority" className="w-full px-4 py-2 border border-border rounded-xl text-foreground text-sm bg-card">
                <option value="normal">ความสำคัญ: ปกติ</option>
                <option value="high">ควรโปะก่อน</option>
              </select>
              <button type="submit" className="w-full py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">เพิ่มรายการหนี้</button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* App Settings */}
      <div className="mb-6">
        <h3 className="font-semibold text-foreground mb-3">ตั้งค่าแอป</h3>
        <Card className="shadow-card border-0">
          <CardContent className="p-4 space-y-4">
            <p className="text-xs text-muted-foreground">งวดรายเดือนใช้ตามปฏิทิน (1 ถึง สิ้นเดือน)</p>
            <div>
              <label className="block text-xs text-muted-foreground mb-2">งบรายจ่ายรายเดือนต่อหมวด</label>
              <Card className="shadow-card border-0">
                <CardContent className="p-0">
                  {EXPENSE_CATEGORIES.map((cat, i) => {
                    const value = categoryBudgets[cat] ?? 0
                    const tagType = getExpenseCategoryType(cat)
                    const frequency = tagType === 'fixed' ? 'รายเดือน' : 'รายวัน'
                    return (
                      <div key={cat} className={`flex items-center px-4 py-3 ${i !== EXPENSE_CATEGORIES.length - 1 ? 'border-b border-border' : ''}`}>
                        <span className="flex-1 text-sm text-foreground">{cat}</span>
                        <Badge variant="secondary" className="text-[10px] mr-3">{frequency}</Badge>
                        <input
                          type="number" min="0" step="1"
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
          </CardContent>
        </Card>
      </div>

      {/* Financial Analysis */}
      {profile.id && (
        <div className="mb-6">
          <h3 className="font-semibold text-foreground mb-3">ผลการวิเคราะห์</h3>
          <Card className="shadow-card border-0">
            <CardContent className="p-4">
              <div className="profile-analysis">
                <FinancialAnalysis
                  profile={profile}
                  totalIncome={effectiveIncome}
                  totalSavingFromTransactions={totalSavingFromTransactions}
                  totalDebtPaymentFromTransactions={totalDebtPaymentFromTransactions}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <BottomNavigation />
    </div>
  )
}

function IndicatorCard({ icon, label, value, status }: { icon: React.ReactNode; label: string; value: string; status: 'good' | 'warning' | 'bad' }) {
  const colors = { good: 'text-success bg-success/10', warning: 'text-warning bg-warning/10', bad: 'text-danger bg-danger/10' }
  return (
    <Card className="shadow-card border-0">
      <CardContent className="p-3">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center mb-2 ${colors[status]}`}>{icon}</div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-base font-bold tabular-nums text-foreground">{value}</p>
      </CardContent>
    </Card>
  )
}

function RingGoal({ label, current, target }: { label: string; current: number; target: number }) {
  const pct = target > 0 ? Math.round((current / target) * 100) : 0
  const color = pct >= 60 ? 'hsl(var(--success))' : 'hsl(var(--warning))'
  return (
    <Card className="shadow-card border-0">
      <CardContent className="p-4 flex flex-col items-center">
        <div className="relative w-16 h-16 mb-2">
          <svg viewBox="0 0 60 60" className="w-full h-full -rotate-90">
            <circle cx="30" cy="30" r="24" fill="none" stroke="hsl(var(--muted))" strokeWidth="5" />
            <circle cx="30" cy="30" r="24" fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
              strokeDasharray={`${(pct / 100) * 150.8} 150.8`} />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold tabular-nums">{pct}%</span>
        </div>
        <p className="text-xs font-medium text-foreground">{label}</p>
        <p className="text-[10px] text-muted-foreground">฿{formatCurrency(current)} / ฿{formatCurrency(target)}</p>
      </CardContent>
    </Card>
  )
}
