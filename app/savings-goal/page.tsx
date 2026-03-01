'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import BottomNavigation from '@/components/BottomNavigation'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowLeftIcon, CheckCircleIcon, AlertTriangleIcon } from '@/components/icons'
import {
  computeGoalProjection,
  computeRequiredSavingContribution,
  calculateGoalHealth,
  type GoalProjectionServiceResult,
  type RequiredContributionServiceResult,
  type GoalHealthResult,
} from '@/src/application/savings/savings-goal-service'
import type { GoalProjectionRow } from '@/src/domain/savings/savings-goal'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) => Math.round(n).toLocaleString('th-TH')
const fmtDec = (n: number) =>
  n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function parsePositive(s: string): number {
  const n = parseFloat(s.replace(/,/g, ''))
  return isNaN(n) || n < 0 ? 0 : n
}

/** Pick up to `max` evenly-spaced milestones, always including the final row. */
function getMilestones(schedule: GoalProjectionRow[], max = 8): GoalProjectionRow[] {
  if (schedule.length <= max) return schedule
  const milestones: GoalProjectionRow[] = []
  const step = Math.floor(schedule.length / (max - 1))
  for (let i = step - 1; i < schedule.length - 1; i += step) {
    if (milestones.length < max - 1) milestones.push(schedule[i])
  }
  milestones.push(schedule[schedule.length - 1])
  return milestones
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
        <p className={`text-lg font-bold tabular-nums leading-tight ${highlight ? 'text-primary' : 'text-foreground'}`}>
          {value}
        </p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  )
}

function HealthIndicator({ health }: { health: GoalHealthResult }) {
  const config = {
    already_achieved: {
      bg: 'bg-success/10 border-success/20',
      text: 'text-success',
      Icon: CheckCircleIcon,
      label: 'บรรลุเป้าหมายแล้ว',
      desc: 'ยินดีด้วย! คุณถึงเป้าแล้ว',
    },
    on_track: {
      bg: 'bg-success/10 border-success/20',
      text: 'text-success',
      Icon: CheckCircleIcon,
      label: 'กำลังดี — ตามแผน',
      desc: 'ยอดออมปัจจุบันเพียงพอที่จะถึงเป้าในเวลาที่กำหนด',
    },
    slightly_behind: {
      bg: 'bg-warning/10 border-warning/20',
      text: 'text-warning',
      Icon: AlertTriangleIcon,
      label: 'เกือบถึงแผน',
      desc: 'ออมเพิ่มเล็กน้อยก็จะถึงเป้าตามกำหนด',
    },
    off_track: {
      bg: 'bg-danger/10 border-danger/20',
      text: 'text-danger',
      Icon: AlertTriangleIcon,
      label: 'ต่ำกว่าแผน',
      desc: 'ต้องเพิ่มยอดออมต่อเดือนเพื่อให้ถึงเป้าตามกำหนด',
    },
  }[health.status]

  const { Icon } = config

  return (
    <Card className={`shadow-card border ${config.bg}`}>
      <CardContent className="p-4">
        <div className={`flex items-center gap-2 mb-3 ${config.text}`}>
          <Icon size={16} />
          <span className="font-semibold text-sm">{config.label}</span>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">ออมปัจจุบัน</span>
            <span className="font-medium tabular-nums">
              ฿{fmt(health.actualMonthlyContribution)}/เดือน
            </span>
          </div>
          {health.status !== 'already_achieved' && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">ต้องออมอย่างน้อย</span>
              <span className="font-medium tabular-nums">
                ฿{fmtDec(health.requiredMonthlyContribution)}/เดือน
              </span>
            </div>
          )}
          {health.shortfallPerMonth > 0 && (
            <div className={`flex justify-between font-semibold pt-1 border-t border-border ${config.text}`}>
              <span>ต้องเพิ่มอีก</span>
              <span className="tabular-nums">฿{fmt(health.shortfallPerMonth)}/เดือน</span>
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-2">{config.desc}</p>
      </CardContent>
    </Card>
  )
}

function MilestoneTable({
  schedule,
  targetAmount,
}: {
  schedule: GoalProjectionRow[]
  targetAmount: number
}) {
  const milestones = getMilestones(schedule)
  const lastMonth = schedule[schedule.length - 1].month

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-secondary text-muted-foreground">
            <th className="px-3 py-2 text-right font-medium">เดือนที่</th>
            <th className="px-3 py-2 text-right font-medium">ยอดสะสม</th>
            <th className="px-3 py-2 text-right font-medium">ดอกเบี้ย</th>
            <th className="px-3 py-2 text-right font-medium">สัดส่วน</th>
          </tr>
        </thead>
        <tbody>
          {milestones.map((row) => {
            const pct = Math.min(100, Math.round((row.balance / targetAmount) * 100))
            const isGoal = row.month === lastMonth
            return (
              <tr
                key={row.month}
                className={`border-t border-border transition-colors ${
                  isGoal ? 'bg-success/5' : 'hover:bg-secondary/50'
                }`}
              >
                <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                  {row.month}
                  {isGoal && <span className="ml-1 text-success">✓</span>}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums font-medium">
                  ฿{fmt(row.balance)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-success">
                  +฿{fmt(row.interest)}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <div className="flex items-center gap-1.5 justify-end">
                    <div className="h-1.5 w-14 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="tabular-nums text-muted-foreground w-8 text-right">{pct}%</span>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function MotivationTable({
  currentAmount,
  targetAmount,
  baseMonthlyContribution,
  annualRate,
  baseMonths,
}: {
  currentAmount: number
  targetAmount: number
  baseMonthlyContribution: number
  annualRate: number
  baseMonths: number
}) {
  const extras = [500, 1000, 2000]
  const rows = extras
    .map((extra) => {
      const r = computeGoalProjection(
        currentAmount,
        targetAmount,
        baseMonthlyContribution + extra,
        annualRate,
      )
      return r.ok ? { extra, months: r.monthsToGoal, sooner: baseMonths - r.monthsToGoal } : null
    })
    .filter((r): r is NonNullable<typeof r> => r !== null && r.sooner > 0)

  if (rows.length === 0) return null

  return (
    <Card className="shadow-card border-0">
      <CardContent className="p-4">
        <p className="text-sm font-semibold text-foreground mb-3">ถ้าออมเพิ่มทุกเดือน...</p>
        <div className="space-y-2">
          {rows.map(({ extra, sooner }) => (
            <div
              key={extra}
              className="flex justify-between items-center py-2 px-3 rounded-xl bg-secondary text-sm"
            >
              <span className="text-foreground">+฿{fmt(extra)}/เดือน</span>
              <span className="text-success font-medium">ถึงเป้าเร็วขึ้น {sooner} เดือน</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SavingsGoalPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  // Profile baseline (for health indicator comparison in mode 2)
  const [profileSaving, setProfileSaving] = useState(0)

  // Shared inputs
  const [mode, setMode] = useState<'projection' | 'required'>('projection')
  const [targetAmount, setTargetAmount] = useState('')
  const [currentAmount, setCurrentAmount] = useState('')
  const [annualRate, setAnnualRate] = useState('0')

  // Mode-specific inputs
  const [monthlyContribution, setMonthlyContribution] = useState('') // mode: projection
  const [targetMonths, setTargetMonths] = useState('')               // mode: required

  // Results
  const [projResult, setProjResult] = useState<GoalProjectionServiceResult | null>(null)
  const [reqResult, setReqResult] = useState<RequiredContributionServiceResult | null>(null)
  const [healthResult, setHealthResult] = useState<GoalHealthResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // ── Load profile → pre-fill inputs ────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth/login'); return }
      const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
      if (data) {
        setCurrentAmount(String(data.liquid_assets ?? 0))
        setTargetAmount(String(data.saving ?? 0))
        setProfileSaving(data.saving ?? 0)
      }
      setLoading(false)
    }
    load()
  }, [router])

  function clearResults() {
    setProjResult(null)
    setReqResult(null)
    setHealthResult(null)
    setError(null)
  }

  function handleCalculate() {
    clearResults()

    const target = parsePositive(targetAmount)
    const current = parsePositive(currentAmount)
    const rate = parsePositive(annualRate)

    if (target <= 0) { setError('กรุณากรอกยอดเงินเป้าหมาย'); return }
    if (current >= target) { setError('ยอดออมปัจจุบันถึงเป้าหมายแล้ว'); return }

    if (mode === 'projection') {
      const contrib = parsePositive(monthlyContribution)
      if (contrib <= 0 && rate <= 0) { setError('กรุณากรอกยอดออมต่อเดือน หรืออัตราดอกเบี้ย'); return }
      const result = computeGoalProjection(current, target, contrib, rate)
      if (!result.ok) { setError(result.error); return }
      setProjResult(result)
    } else {
      const months = Math.round(parsePositive(targetMonths))
      if (months <= 0) { setError('กรุณากรอกระยะเวลาเป้าหมาย (เดือน)'); return }
      const result = computeRequiredSavingContribution(current, target, rate, months)
      if (!result.ok) { setError(result.error); return }
      setReqResult(result)
      // Goal health: compare profile.saving vs required contribution
      const health = calculateGoalHealth(current, target, profileSaving, rate, months)
      setHealthResult(health)
    }
  }

  const inputClass =
    'w-full px-4 py-3 border border-border rounded-xl focus:ring-2 focus:ring-primary text-foreground bg-card text-sm placeholder:text-muted-foreground'

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background pb-20">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  // Active result (either mode)
  const activeResult = projResult ?? reqResult
  const targetNum = parsePositive(targetAmount)

  return (
    <div className="animate-fade-in px-4 pt-4 pb-28">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <Link
          href="/profile"
          className="p-2 rounded-xl hover:bg-secondary transition-colors text-muted-foreground"
        >
          <ArrowLeftIcon size={18} />
        </Link>
        <h1 className="text-xl font-bold text-foreground">เป้าออมเงิน</h1>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-2 mb-5 p-1 bg-secondary rounded-xl">
        {(['projection', 'required'] as const).map((m) => (
          <button
            key={m}
            onClick={() => { setMode(m); clearResults() }}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === m
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {m === 'projection' ? 'คำนวณระยะเวลา' : 'คำนวณยอดออม'}
          </button>
        ))}
      </div>

      {/* Input card */}
      <Card className="shadow-card border-0 mb-4">
        <CardContent className="p-4 space-y-4">
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">
              ยอดเงินเป้าหมาย (฿) <span className="text-muted-foreground/60">เติมจากตั้งค่าเงินออม</span>
            </label>
            <input
              type="number"
              inputMode="decimal"
              placeholder="เช่น 120000"
              value={targetAmount}
              onChange={(e) => { setTargetAmount(e.target.value); clearResults() }}
              className={inputClass}
              min="0"
            />
          </div>

          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">
              ยอดออมปัจจุบัน (฿) <span className="text-muted-foreground/60">เติมจากทรัพย์สินสภาพคล่อง</span>
            </label>
            <input
              type="number"
              inputMode="decimal"
              placeholder="เช่น 6000"
              value={currentAmount}
              onChange={(e) => { setCurrentAmount(e.target.value); clearResults() }}
              className={inputClass}
              min="0"
            />
          </div>

          {mode === 'projection' ? (
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">
                ออมต่อเดือน (฿) <span className="text-muted-foreground/60">เติมจากตั้งค่าเงินออม</span>
              </label>
              <input
                type="number"
                inputMode="decimal"
                placeholder="เช่น 3000"
                value={monthlyContribution}
                onChange={(e) => { setMonthlyContribution(e.target.value); clearResults() }}
                className={inputClass}
                min="0"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">
                ต้องการออมหมดใน (เดือน)
              </label>
              <input
                type="number"
                inputMode="numeric"
                placeholder="เช่น 36"
                value={targetMonths}
                onChange={(e) => { setTargetMonths(e.target.value); clearResults() }}
                className={inputClass}
                min="1"
                step="1"
              />
              {targetMonths && parsePositive(targetMonths) > 0 && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  ≈ {Math.floor(parsePositive(targetMonths) / 12)} ปี{' '}
                  {Math.round(parsePositive(targetMonths)) % 12} เดือน
                </p>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">
              อัตราดอกเบี้ยต่อปี (%) <span className="text-muted-foreground/60">ใส่ 0 หากไม่มีดอก</span>
            </label>
            <input
              type="number"
              inputMode="decimal"
              placeholder="เช่น 1.5"
              value={annualRate}
              onChange={(e) => { setAnnualRate(e.target.value); clearResults() }}
              className={inputClass}
              min="0"
              max="100"
              step="0.1"
            />
          </div>

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

      {/* ── Results ──────────────────────────────────────────────────────────── */}
      {activeResult?.ok && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3">
            {reqResult?.ok && (
              <SummaryCard
                label="ยอดออมที่แนะนำ"
                value={`฿${fmtDec(reqResult.requiredMonthlyContribution)}`}
                sub="ต่อเดือน"
                highlight
              />
            )}
            <SummaryCard
              label="ระยะเวลา"
              value={`${activeResult.monthsToGoal} เดือน`}
              sub={`${Math.floor(activeResult.monthsToGoal / 12)} ปี ${activeResult.monthsToGoal % 12} เดือน`}
              highlight={!reqResult}
            />
            <SummaryCard
              label="ถึงเป้าภายใน"
              value={activeResult.estimatedGoalDate}
            />
            <SummaryCard
              label="ออมรวมทั้งหมด"
              value={`฿${fmt(activeResult.totalContribution)}`}
            />
            <SummaryCard
              label="ดอกเบี้ยที่ได้รับ"
              value={`฿${fmt(activeResult.totalInterestEarned)}`}
              sub={activeResult.totalInterestEarned > 0 ? 'กำไรจากเงินต้น' : 'ไม่มีดอกเบี้ย'}
            />
          </div>

          {/* Interest ratio bar (show only when there is interest) */}
          {activeResult.totalInterestEarned > 0 && (
            <Card className="shadow-card border-0">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-2">สัดส่วนเงินต้น vs ดอกเบี้ย</p>
                <div className="flex h-3 rounded-full overflow-hidden bg-muted">
                  {(() => {
                    const totalAmt = activeResult.totalContribution + activeResult.totalInterestEarned
                    const interestPct = Math.round((activeResult.totalInterestEarned / totalAmt) * 100)
                    return (
                      <>
                        <div className="bg-primary" style={{ width: `${100 - interestPct}%` }} />
                        <div className="bg-success" style={{ width: `${interestPct}%` }} />
                      </>
                    )
                  })()}
                </div>
                <div className="flex justify-between mt-1.5 text-[10px]">
                  <span className="text-primary font-medium">
                    เงินออม ฿{fmt(activeResult.totalContribution)}
                  </span>
                  <span className="text-success font-medium">
                    ดอกเบี้ย ฿{fmt(activeResult.totalInterestEarned)}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Goal health (mode 2 only) */}
          {healthResult && <HealthIndicator health={healthResult} />}

          {/* Motivation: "what if you save more" (mode 1 only) */}
          {projResult?.ok && (
            <MotivationTable
              currentAmount={parsePositive(currentAmount)}
              targetAmount={targetNum}
              baseMonthlyContribution={parsePositive(monthlyContribution)}
              annualRate={parsePositive(annualRate)}
              baseMonths={projResult.monthsToGoal}
            />
          )}

          {/* Milestone table */}
          <div>
            <p className="text-sm font-semibold text-foreground mb-2">
              ตารางเป้าหมาย ({activeResult.monthsToGoal} งวด)
            </p>
            <MilestoneTable schedule={activeResult.schedule} targetAmount={targetNum} />
          </div>
        </div>
      )}

      <BottomNavigation />
    </div>
  )
}
