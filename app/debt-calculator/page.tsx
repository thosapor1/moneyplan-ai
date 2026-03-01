'use client'

import { Suspense, useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import BottomNavigation from '@/components/BottomNavigation'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowLeftIcon } from '@/components/icons'
import {
  computeDebtPayoffDuration,
  computeRequiredMonthlyPayment,
  type DebtDurationResult,
  type DebtRequiredPaymentResult,
  type DebtPayoffSummary,
} from '@/src/application/debt/debt-payoff-service'
import type { AmortizationRow } from '@/src/domain/debt/debt-payoff'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtInt = (n: number) => Math.round(n).toLocaleString('th-TH')

function parsePositive(s: string): number {
  const n = parseFloat(s.replace(/,/g, ''))
  return isNaN(n) || n < 0 ? 0 : n
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string
  value: string
  sub?: string
  highlight?: boolean
}) {
  return (
    <Card className="shadow-card border-0">
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <p className={`text-lg font-bold tabular-nums ${highlight ? 'text-primary' : 'text-foreground'}`}>
          {value}
        </p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  )
}

function AmortizationTable({ schedule }: { schedule: AmortizationRow[] }) {
  const [showAll, setShowAll] = useState(false)
  const rows = showAll ? schedule : schedule.slice(0, 12)

  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-secondary text-muted-foreground">
              <th className="px-3 py-2 text-right font-medium">งวด</th>
              <th className="px-3 py-2 text-right font-medium">ยอดผ่อน</th>
              <th className="px-3 py-2 text-right font-medium">ดอกเบี้ย</th>
              <th className="px-3 py-2 text-right font-medium">เงินต้น</th>
              <th className="px-3 py-2 text-right font-medium">คงเหลือ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.month} className="border-t border-border hover:bg-secondary/50 transition-colors">
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{row.month}</td>
                <td className="px-3 py-2 text-right tabular-nums font-medium">{fmtInt(row.payment)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-danger">{fmtInt(row.interest)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-success">{fmtInt(row.principalPaid)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtInt(row.remainingBalance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {schedule.length > 12 && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="mt-2 w-full py-2 text-xs text-primary font-medium hover:bg-primary/5 rounded-xl transition-colors"
        >
          {showAll ? 'ย่อตาราง' : `แสดงทั้งหมด ${schedule.length} งวด`}
        </button>
      )}
    </div>
  )
}

function ResultSection({ summary, requiredPayment }: {
  summary: DebtPayoffSummary
  requiredPayment?: number
}) {
  const [showTable, setShowTable] = useState(false)

  return (
    <div className="mt-6 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {requiredPayment !== undefined && (
          <SummaryCard
            label="ยอดผ่อนที่แนะนำ"
            value={`฿${fmt(requiredPayment)}`}
            sub="ต่อเดือน"
            highlight
          />
        )}
        <SummaryCard
          label="ระยะเวลา"
          value={`${summary.monthsToPayoff} เดือน`}
          sub={`${Math.floor(summary.monthsToPayoff / 12)} ปี ${summary.monthsToPayoff % 12} เดือน`}
          highlight={requiredPayment === undefined}
        />
        <SummaryCard
          label="ชำระหมดภายใน"
          value={summary.estimatedPayoffDate}
        />
        <SummaryCard
          label="ดอกเบี้ยรวมทั้งหมด"
          value={`฿${fmtInt(summary.totalInterestPaid)}`}
          sub="ต้นทุนที่แท้จริงของหนี้"
        />
        <SummaryCard
          label="ยอดชำระรวมทั้งหมด"
          value={`฿${fmtInt(summary.totalAmountPaid)}`}
          sub="เงินต้น + ดอกเบี้ย"
        />
      </div>

      {/* Interest ratio bar */}
      <Card className="shadow-card border-0">
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground mb-2">สัดส่วนต้นทุน</p>
          <div className="flex h-3 rounded-full overflow-hidden bg-muted">
            {(() => {
              const principal = summary.totalAmountPaid - summary.totalInterestPaid
              const interestPct = Math.round((summary.totalInterestPaid / summary.totalAmountPaid) * 100)
              return (
                <>
                  <div
                    className="bg-primary transition-all"
                    style={{ width: `${100 - interestPct}%` }}
                    title={`เงินต้น ฿${fmtInt(principal)}`}
                  />
                  <div
                    className="bg-danger transition-all"
                    style={{ width: `${interestPct}%` }}
                    title={`ดอกเบี้ย ฿${fmtInt(summary.totalInterestPaid)}`}
                  />
                </>
              )
            })()}
          </div>
          <div className="flex justify-between mt-1.5 text-[10px]">
            <span className="text-primary font-medium">
              เงินต้น ฿{fmtInt(summary.totalAmountPaid - summary.totalInterestPaid)}
            </span>
            <span className="text-danger font-medium">
              ดอกเบี้ย ฿{fmtInt(summary.totalInterestPaid)} ({Math.round((summary.totalInterestPaid / summary.totalAmountPaid) * 100)}%)
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Amortization table toggle */}
      <button
        onClick={() => setShowTable((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-border bg-card hover:bg-secondary/50 transition-colors text-sm font-medium"
      >
        <span>ตารางผ่อนชำระ ({summary.monthsToPayoff} งวด)</span>
        <span className="text-muted-foreground text-xs">{showTable ? '▲ ซ่อน' : '▼ แสดง'}</span>
      </button>

      {showTable && <AmortizationTable schedule={summary.schedule} />}
    </div>
  )
}

// ─── Main calculator (inner — uses useSearchParams) ───────────────────────────

function DebtCalculatorContent() {
  const searchParams = useSearchParams()

  const [mode, setMode] = useState<'duration' | 'payment'>('duration')
  const [debtName, setDebtName] = useState('')

  // Shared inputs
  const [principal, setPrincipal] = useState('')
  const [rate, setRate] = useState('')

  // Mode-specific inputs
  const [monthlyPayment, setMonthlyPayment] = useState('')
  const [targetMonths, setTargetMonths] = useState('')

  // Results
  const [durationResult, setDurationResult] = useState<DebtDurationResult | null>(null)
  const [paymentResult, setPaymentResult] = useState<DebtRequiredPaymentResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Pre-fill from URL params (e.g. from Settings page debt items)
  useEffect(() => {
    const p = searchParams.get('principal')
    const r = searchParams.get('rate')
    const n = searchParams.get('name')
    if (p) setPrincipal(p)
    if (r) setRate(r)
    if (n) setDebtName(n)
  }, [searchParams])

  function handleCalculate() {
    setError(null)
    setDurationResult(null)
    setPaymentResult(null)

    const p = parsePositive(principal)
    const r = parsePositive(rate)

    if (p <= 0) { setError('กรุณากรอกยอดหนี้คงเหลือ'); return }
    if (r < 0) { setError('อัตราดอกเบี้ยต้องไม่ติดลบ'); return }

    if (mode === 'duration') {
      const mp = parsePositive(monthlyPayment)
      if (mp <= 0) { setError('กรุณากรอกยอดผ่อนต่อเดือน'); return }
      const result = computeDebtPayoffDuration(p, r, mp)
      if (!result.ok) { setError(result.error); return }
      setDurationResult(result)
    } else {
      const tm = Math.round(parsePositive(targetMonths))
      if (tm <= 0) { setError('กรุณากรอกระยะเวลาเป้าหมาย (เดือน)'); return }
      const result = computeRequiredMonthlyPayment(p, r, tm)
      if (!result.ok) { setError(result.error); return }
      setPaymentResult(result)
    }
  }

  // Clear results when inputs change
  function clearResults() {
    setDurationResult(null)
    setPaymentResult(null)
    setError(null)
  }

  const inputClass =
    'w-full px-4 py-3 border border-border rounded-xl focus:ring-2 focus:ring-primary text-foreground bg-card text-sm placeholder:text-muted-foreground'

  return (
    <div className="animate-fade-in px-4 pt-4 pb-28">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <Link href="/settings" className="p-2 rounded-xl hover:bg-secondary transition-colors text-muted-foreground">
          <ArrowLeftIcon size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-foreground leading-tight">คำนวณการผ่อนหนี้</h1>
          {debtName && <p className="text-xs text-muted-foreground">{debtName}</p>}
        </div>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-2 mb-5 p-1 bg-secondary rounded-xl">
        {(['duration', 'payment'] as const).map((m) => (
          <button
            key={m}
            onClick={() => { setMode(m); clearResults() }}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === m
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {m === 'duration' ? 'คำนวณระยะเวลา' : 'คำนวณยอดผ่อน'}
          </button>
        ))}
      </div>

      {/* Input form */}
      <Card className="shadow-card border-0 mb-4">
        <CardContent className="p-4 space-y-4">
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">ยอดหนี้คงเหลือ (฿)</label>
            <input
              type="number"
              inputMode="decimal"
              placeholder="เช่น 112000"
              value={principal}
              onChange={(e) => { setPrincipal(e.target.value); clearResults() }}
              className={inputClass}
              min="0"
            />
          </div>

          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">
              อัตราดอกเบี้ยต่อปี (%) <span className="text-muted-foreground/60">ใส่ 0 หากไม่คิดดอก</span>
            </label>
            <input
              type="number"
              inputMode="decimal"
              placeholder="เช่น 17"
              value={rate}
              onChange={(e) => { setRate(e.target.value); clearResults() }}
              className={inputClass}
              min="0"
              max="100"
              step="0.1"
            />
          </div>

          {mode === 'duration' ? (
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">ยอดผ่อนต่อเดือน (฿)</label>
              <input
                type="number"
                inputMode="decimal"
                placeholder="เช่น 5000"
                value={monthlyPayment}
                onChange={(e) => { setMonthlyPayment(e.target.value); clearResults() }}
                className={inputClass}
                min="0"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">ต้องการผ่อนหมดใน (เดือน)</label>
              <input
                type="number"
                inputMode="numeric"
                placeholder="เช่น 24"
                value={targetMonths}
                onChange={(e) => { setTargetMonths(e.target.value); clearResults() }}
                className={inputClass}
                min="1"
                step="1"
              />
              {targetMonths && parsePositive(targetMonths) > 0 && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  ≈ {Math.floor(parsePositive(targetMonths) / 12)} ปี {Math.round(parsePositive(targetMonths)) % 12} เดือน
                </p>
              )}
            </div>
          )}

          {error && (
            <p className="text-sm text-danger bg-danger/10 rounded-xl px-4 py-3">{error}</p>
          )}

          <button
            onClick={handleCalculate}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            คำนวณ
          </button>
        </CardContent>
      </Card>

      {/* Results */}
      {durationResult?.ok && (
        <ResultSection summary={durationResult} />
      )}
      {paymentResult?.ok && (
        <ResultSection
          summary={paymentResult}
          requiredPayment={paymentResult.requiredMonthlyPayment}
        />
      )}

      <BottomNavigation />
    </div>
  )
}

// ─── Page wrapper (Suspense required for useSearchParams in App Router) ────────

export default function DebtCalculatorPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
        </div>
      }
    >
      <DebtCalculatorContent />
    </Suspense>
  )
}
