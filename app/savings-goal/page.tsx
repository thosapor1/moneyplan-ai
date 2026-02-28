'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase, Profile } from '@/lib/supabase'
import BottomNavigation from '@/components/BottomNavigation'
import { Card, CardContent } from '@/components/ui/card'
import { addMonths, format } from 'date-fns'

/** Simple estimate: months to goal = (target - current) / monthlySaving */
function monthsToGoal(targetAmount: number, currentSaved: number, monthlySaving: number): number {
  const remaining = Math.max(0, targetAmount - currentSaved)
  if (monthlySaving <= 0) return 0
  return Math.ceil(remaining / monthlySaving)
}

/** Progress color: hopeful blues → greens (0–100%) */
function progressColor(percent: number): string {
  if (percent < 33) return '#7dd3fc' // sky-300
  if (percent < 66) return '#38bdf8' // sky-400
  return '#22c55e' // green-500
}

/** Mock savings goals when no DB list exists */
type SavingsGoalItem = { name: string; current: number; target: number }
const MOCK_GOALS: SavingsGoalItem[] = [
  { name: 'กองทุนฉุกเฉิน', current: 45000, target: 100000 },
  { name: 'เที่ยวปลายปี', current: 12000, target: 50000 },
  { name: 'ดาวน์บ้าน', current: 80000, target: 500000 },
]

/** Mock monthly savings growth (last 6 months, ascending) */
function mockSavingsGrowth(
  currentSaved: number,
  monthlySaving: number
): { month: string; saved: number }[] {
  const n = 6
  const arr: { month: string; saved: number }[] = []
  let s = Math.max(0, currentSaved - monthlySaving * n)
  for (let i = -n; i <= 0; i++) {
    const d = addMonths(new Date(), i)
    arr.push({ month: format(d, 'MMM yy'), saved: Math.round(s) })
    s += monthlySaving
  }
  return arr
}

export default function SavingsGoalPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/auth/login')
        return
      }
      const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
      if (data) setProfile(data as Profile)
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background pb-16">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  const currentSaved = profile?.liquid_assets ?? 0
  const monthlySaving = profile?.saving ?? 0
  const targetSavings = currentSaved > 0 ? Math.max(currentSaved * 2, 100000) : 200000
  const progressPercent =
    targetSavings > 0 ? Math.min(100, Math.round((currentSaved / targetSavings) * 100)) : 0

  const monthsBase = monthsToGoal(targetSavings, currentSaved, monthlySaving || 1)
  const goalDate =
    monthlySaving > 0 && currentSaved < targetSavings
      ? addMonths(new Date(), monthsBase)
      : currentSaved >= targetSavings
        ? new Date()
        : null

  const plannedMonthly = monthlySaving
  const savedThisMonth = monthlySaving
  const extraSavingsThisMonth = Math.max(0, savedThisMonth - plannedMonthly)
  const statusMessage =
    extraSavingsThisMonth > 0 && plannedMonthly > 0
      ? 'คุณกำลังเก็บได้เร็วกว่าแผน'
      : savedThisMonth >= plannedMonthly && plannedMonthly > 0
        ? 'เก็บตามแผน'
        : plannedMonthly > 0
          ? 'เดือนนี้เก็บได้น้อยลง เป้าอาจช้ากว่าเดิม'
          : 'เก็บตามแผน'

  const goalItems = currentSaved > 0 || monthlySaving > 0 ? MOCK_GOALS : []
  const growthData =
    monthlySaving > 0 ? mockSavingsGrowth(currentSaved, monthlySaving) : []
  const maxGrowth = Math.max(...growthData.map((d) => d.saved), 1)

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="bg-background border-b border-border sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/dashboard" className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors shrink-0">
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-lg font-semibold text-foreground truncate">เป้าออมเงิน</h1>
          </div>
          <button
            type="button"
            onClick={async () => { await supabase.auth.signOut(); router.push('/auth/login'); router.refresh() }}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors shrink-0"
            title="ออกจากระบบ"
          >
            <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
          </button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-6">
        {/* Section 1: Hero Summary */}
        <Card className="shadow-card border-0">
          <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">ภาพรวมเป้าหมาย</h2>
          </div>
          <div className="flex flex-col items-center">
            <div className="relative w-40 h-40">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke={progressColor(progressPercent)}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${progressPercent * 2.64} 264`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-foreground">{progressPercent}%</span>
                <span className="text-xs text-muted-foreground">ถึงเป้าแล้ว</span>
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground mt-4">
              {currentSaved.toLocaleString('th-TH')} <span className="text-lg font-medium text-muted-foreground">บาท</span>
            </p>
            <p className="text-sm text-muted-foreground">เก็บได้แล้ว</p>
            <p className="text-lg font-semibold text-success mt-1">
              เป้า {targetSavings.toLocaleString('th-TH')} บาท
            </p>
            {goalDate && currentSaved < targetSavings && monthlySaving > 0 && (
              <>
                <p className="text-success font-semibold mt-2">
                  คาดว่าจะถึงเป้า {format(goalDate, 'MMM yyyy')}
                </p>
                <p className="text-xs text-muted-foreground">ประมาณอีก {monthsBase} เดือน</p>
              </>
            )}
          </div>
        </CardContent>
        </Card>

        {/* Section 2: Status Card */}
        <Card className="shadow-card border-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">สถานะเดือนนี้</h2>
            </div>
            <p className="text-lg font-semibold text-foreground">{statusMessage}</p>
            {monthlySaving > 0 && (
              <p className="text-sm text-muted-foreground mt-1">
                เก็บเดือนละ {monthlySaving.toLocaleString('th-TH')} บาท
              </p>
            )}
          </CardContent>
        </Card>

        {/* Section 3: Motivation Simulation */}
        {monthlySaving > 0 && currentSaved < targetSavings && (
          <Card className="shadow-card border-0">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">ถ้าเก็บเพิ่มทุกเดือน...</h2>
              </div>
              <div className="space-y-2">
                {[500, 1000, 2000].map((extra) => {
                  const newMonthly = monthlySaving + extra
                  const monthsNew = monthsToGoal(targetSavings, currentSaved, newMonthly)
                  const sooner = Math.max(0, monthsBase - monthsNew)
                  return (
                    <div
                      key={extra}
                      className="flex justify-between items-center py-2 px-3 rounded-xl bg-secondary"
                    >
                      <span className="text-foreground">+{extra.toLocaleString('th-TH')} บาท/เดือน</span>
                      <span className="text-success font-medium">
                        ถึงเป้าเร็วขึ้น {sooner} เดือน
                      </span>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Section 4: Savings Progress Over Time */}
        {growthData.length > 0 && (
          <Card className="shadow-card border-0">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/></svg>
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">เงินออมเติบโตแต่ละเดือน</h2>
              </div>
              <div className="h-40 flex items-end gap-1">
                {growthData.map((d, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full rounded-t bg-success/30 min-h-[4px] transition-all"
                      style={{
                        height: `${(d.saved / maxGrowth) * 120}px`,
                      }}
                    />
                    <span className="text-xs text-muted-foreground truncate w-full text-center">
                      {d.month}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-center">ยอดสะสมโดยประมาณ</p>
            </CardContent>
          </Card>
        )}

        {/* Section 5: Multiple Savings Goals */}
        <Card className="shadow-card border-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">เป้าหมายออมเงิน</h2>
            </div>
            {goalItems.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                ยังไม่มีข้อมูลเป้าหมาย ตั้งค่ารายได้และเงินออมต่อเดือนในหน้าโปรไฟล์
              </p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground mb-2">
                  ตัวอย่างเป้าหมาย (ข้อมูลจริงจากโปรไฟล์ = ยอดรวมด้านบน)
                </p>
                <div className="space-y-3">
                  {goalItems.map((item, i) => {
                    const pct =
                      item.target > 0
                        ? Math.min(100, Math.round((item.current / item.target) * 100))
                        : 0
                    return (
                      <div
                        key={i}
                        className="flex flex-col gap-2 p-3 rounded-xl bg-secondary border border-border"
                      >
                        <div className="flex justify-between items-start">
                          <span className="font-medium text-foreground">{item.name}</span>
                          <span className="text-sm font-semibold text-success">{pct}%</span>
                        </div>
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>{item.current.toLocaleString('th-TH')} / {item.target.toLocaleString('th-TH')} บาท</span>
                        </div>
                        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-success transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="h-4" />
      </div>

      <BottomNavigation />
    </div>
  )
}
