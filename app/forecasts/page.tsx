'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, Forecast } from '@/lib/supabase'
import { addMonths, startOfMonth } from 'date-fns'
import BottomNavigation from '@/components/BottomNavigation'
import { Card, CardContent } from '@/components/ui/card'
import {
  TrendingUpIcon,
  TrendingDownIcon,
  WalletIcon,
  ChevronDownIcon,
} from '@/components/icons'

const formatCurrency = (n: number) => n.toLocaleString('th-TH')
const MONTHS_TH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

export default function ForecastsPage() {
  const router = useRouter()
  const [forecasts, setForecasts] = useState<Forecast[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const saveTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({})

  const loadForecasts = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/auth/login'); return }
    try {
      const { data, error } = await supabase.from('forecasts').select('*')
        .eq('user_id', session.user.id).order('month_index', { ascending: true }).limit(12)
      if (error) throw error

      if (!data || data.length === 0) {
        const newForecasts = Array.from({ length: 12 }, (_, i) => ({
          user_id: session.user.id, month_index: i, income: 0, expense: 0, note: '',
        }))
        const { error: insertError } = await supabase.from('forecasts').insert(newForecasts)
        if (insertError) throw insertError
        setForecasts(newForecasts.slice(0, 12) as Forecast[])
      } else {
        const existingIndices = new Set(data.map((f) => f.month_index))
        const missing = []
        for (let i = 0; i < 12; i++) {
          if (!existingIndices.has(i)) missing.push({ user_id: session.user.id, month_index: i, income: 0, expense: 0, note: '' })
        }
        if (missing.length > 0) await supabase.from('forecasts').insert(missing)
        const { data: updatedData, error: reloadError } = await supabase.from('forecasts').select('*')
          .eq('user_id', session.user.id).order('month_index', { ascending: true }).limit(12)
        if (reloadError) throw reloadError
        setForecasts((updatedData || []).slice(0, 12))
      }
    } catch (error) { console.error('Error loading forecasts:', error) } finally { setLoading(false) }
  }, [router])

  useEffect(() => { loadForecasts() }, [loadForecasts])

  const saveForecast = async (forecastId: string, field: 'income' | 'expense' | 'note', value: string | number) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const updateData: any = {}
      if (field === 'income' || field === 'expense') updateData[field] = Number(value) || 0
      else updateData[field] = value || null
      const { error } = await supabase.from('forecasts').update(updateData).eq('id', forecastId)
      if (error) throw error
      setForecasts((prev) => prev.map((f) => (f.id === forecastId ? { ...f, ...updateData } : f)))
    } catch (error: any) {
      console.error('Error saving forecast:', error)
      loadForecasts()
    } finally {
      setSaving((prev) => { const n = { ...prev }; delete n[forecastId]; return n })
    }
  }

  const handleFieldChange = (forecastId: string, field: 'income' | 'expense' | 'note', value: string | number) => {
    setForecasts((prev) => prev.map((f) => (f.id === forecastId ? { ...f, [field]: value } : f)))
    if (saveTimeoutRef.current[forecastId]) clearTimeout(saveTimeoutRef.current[forecastId])
    setSaving((prev) => ({ ...prev, [forecastId]: true }))
    saveTimeoutRef.current[forecastId] = setTimeout(() => { saveForecast(forecastId, field, value) }, 1000)
  }

  const handleFieldBlur = (forecastId: string, field: 'income' | 'expense' | 'note', value: string | number) => {
    if (saveTimeoutRef.current[forecastId]) { clearTimeout(saveTimeoutRef.current[forecastId]); delete saveTimeoutRef.current[forecastId] }
    saveForecast(forecastId, field, value)
  }

  const getMonthLabel = (index: number) => {
    const d = addMonths(startOfMonth(new Date()), index)
    return MONTHS_TH[d.getMonth()]
  }

  const getMonthYear = (index: number) => {
    const d = addMonths(startOfMonth(new Date()), index)
    return d.getFullYear() + 543
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

  const totalIncome = forecasts.reduce((s, f) => s + Number(f.income), 0)
  const totalExpense = forecasts.reduce((s, f) => s + Number(f.expense), 0)
  const totalNet = totalIncome - totalExpense
  const currentYear = new Date().getFullYear() + 543

  return (
    <div className="animate-fade-in px-4 pt-4 pb-20">
      <div className="sticky top-0 z-10 bg-background -mx-4 px-4 py-3 flex items-center justify-between border-b border-border mb-4">
        <h1 className="text-xl font-bold text-foreground">แผน 12 เดือน — {currentYear}</h1>
        <button
          type="button"
          onClick={async () => { await supabase.auth.signOut(); router.push('/auth/login'); router.refresh() }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
        >
          <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
          <span>ออกจากระบบ</span>
        </button>
      </div>

      {/* Annual Summary */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <SummaryCard icon={<TrendingUpIcon size={16} />} label="รายรับรวม" amount={totalIncome} variant="success" />
        <SummaryCard icon={<TrendingDownIcon size={16} />} label="รายจ่ายรวม" amount={totalExpense} variant="danger" />
        <SummaryCard icon={<WalletIcon size={16} />} label="เงินออมสุทธิ" amount={totalNet} variant="primary" />
      </div>

      {/* Monthly Accordion */}
      <div className="space-y-2 mb-6">
        {forecasts.slice(0, 12).map((forecast, index) => {
          const forecastId = forecast.id || ''
          if (!forecastId) return null
          const isCurrent = index === 0
          const net = Number(forecast.income) - Number(forecast.expense)

          return (
            <MonthAccordion
              key={forecastId}
              month={getMonthLabel(index)}
              year={getMonthYear(index)}
              income={Number(forecast.income)}
              expenses={Number(forecast.expense)}
              net={net}
              note={forecast.note || ''}
              isCurrent={isCurrent}
              defaultOpen={isCurrent}
              onIncomeChange={(v) => handleFieldChange(forecastId, 'income', v)}
              onExpenseChange={(v) => handleFieldChange(forecastId, 'expense', v)}
              onNoteChange={(v) => handleFieldChange(forecastId, 'note', v)}
              onIncomeBlur={(v) => handleFieldBlur(forecastId, 'income', v)}
              onExpenseBlur={(v) => handleFieldBlur(forecastId, 'expense', v)}
              onNoteBlur={(v) => handleFieldBlur(forecastId, 'note', v)}
              isSaving={!!saving[forecastId]}
            />
          )
        })}
      </div>

      <BottomNavigation />
    </div>
  )
}

function SummaryCard({ icon, label, amount, variant }: {
  icon: React.ReactNode; label: string; amount: number; variant: 'success' | 'danger' | 'primary'
}) {
  const colors = { success: 'text-success bg-success/10', danger: 'text-danger bg-danger/10', primary: 'text-primary bg-primary/10' }
  return (
    <Card className="shadow-card border-0">
      <CardContent className="p-3">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center mb-2 ${colors[variant]}`}>{icon}</div>
        <p className="text-[10px] text-muted-foreground mb-0.5">{label}</p>
        <p className="text-sm font-bold tabular-nums text-foreground">฿{formatCurrency(amount)}</p>
      </CardContent>
    </Card>
  )
}

function MonthAccordion({ month, year, income, expenses, net, note, isCurrent, defaultOpen, onIncomeChange, onExpenseChange, onNoteChange, onIncomeBlur, onExpenseBlur, onNoteBlur, isSaving }: {
  month: string; year: number; income: number; expenses: number; net: number; note: string
  isCurrent: boolean; defaultOpen: boolean; isSaving: boolean
  onIncomeChange: (v: string) => void; onExpenseChange: (v: string) => void; onNoteChange: (v: string) => void
  onIncomeBlur: (v: string) => void; onExpenseBlur: (v: string) => void; onNoteBlur: (v: string) => void
}) {
  const [open, setOpen] = useState(defaultOpen)
  const isPositive = net >= 0

  return (
    <Card className={`shadow-card border-0 overflow-hidden ${isCurrent ? 'ring-2 ring-primary/30' : ''}`}>
      <button className="w-full" onClick={() => setOpen(!open)}>
        <div className="flex items-center px-4 py-3">
          <div className={`w-1 h-8 rounded-full mr-3 ${isPositive ? 'bg-success' : 'bg-danger'}`} />
          <span className="text-sm font-semibold text-foreground w-12">{month}</span>
          <div className="flex-1 grid grid-cols-3 gap-2 text-right">
            <span className="text-xs tabular-nums text-success">+฿{formatCurrency(income)}</span>
            <span className="text-xs tabular-nums text-danger">-฿{formatCurrency(expenses)}</span>
            <span className={`text-xs font-semibold tabular-nums ${isPositive ? 'text-success' : 'text-danger'}`}>
              ฿{formatCurrency(Math.abs(net))}
            </span>
          </div>
          <ChevronDownIcon size={16} className={`ml-2 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-border">
          <div className="grid grid-cols-3 gap-4 text-center py-3">
            <div>
              <p className="text-xs text-muted-foreground">รายรับ</p>
              <p className="text-sm font-bold tabular-nums text-success">฿{formatCurrency(income)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">รายจ่าย</p>
              <p className="text-sm font-bold tabular-nums text-danger">฿{formatCurrency(expenses)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">คงเหลือ</p>
              <p className={`text-sm font-bold tabular-nums ${isPositive ? 'text-success' : 'text-danger'}`}>
                ฿{formatCurrency(Math.abs(net))}
              </p>
            </div>
          </div>
          {isCurrent && <p className="text-xs text-primary font-medium text-center mb-3">📍 เดือนปัจจุบัน</p>}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">รายรับ (บาท)</label>
              <input
                type="number" value={income ?? 0}
                onChange={(e) => onIncomeChange(e.target.value)}
                onBlur={(e) => onIncomeBlur(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-xl focus:ring-2 focus:ring-primary text-foreground text-sm bg-background"
                min="0" step="0.01" placeholder="0"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">รายจ่าย (บาท)</label>
              <input
                type="number" value={expenses ?? 0}
                onChange={(e) => onExpenseChange(e.target.value)}
                onBlur={(e) => onExpenseBlur(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-xl focus:ring-2 focus:ring-primary text-foreground text-sm bg-background"
                min="0" step="0.01" placeholder="0"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">หมายเหตุ</label>
            <input
              type="text" value={note}
              onChange={(e) => onNoteChange(e.target.value)}
              onBlur={(e) => onNoteBlur(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-xl focus:ring-2 focus:ring-primary text-foreground text-sm bg-background"
              placeholder="เพิ่มหมายเหตุ..."
            />
          </div>
        </div>
      )}
    </Card>
  )
}
