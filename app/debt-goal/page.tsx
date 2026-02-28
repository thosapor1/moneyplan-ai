'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase, Profile, fetchDebtItems } from '@/lib/supabase'
import BottomNavigation from '@/components/BottomNavigation'
import FormattedAnalysis from '@/components/FormattedAnalysis'
import { Card, CardContent } from '@/components/ui/card'
import { addMonths, format } from 'date-fns'

/** Simple estimate: months to clear = totalDebt / monthlyPayment (no interest) */
function monthsToClear(totalDebt: number, monthlyPayment: number): number {
  if (monthlyPayment <= 0) return 0
  return Math.ceil(totalDebt / monthlyPayment)
}

/** Progress color: red → yellow → green by progress 0–100 */
function progressColor(percent: number): string {
  if (percent < 33) return '#f87171'
  if (percent < 66) return '#fbbf24'
  return '#4ade80'
}

/** Monthly remaining trend (last 6 months) from total + monthly payment */
function mockTrend(totalRemaining: number, monthlyPayment: number): { month: string; remaining: number }[] {
  const n = 6
  const arr: { month: string; remaining: number }[] = []
  let r = totalRemaining + monthlyPayment * n
  for (let i = n; i >= 0; i--) {
    const d = addMonths(new Date(), -i)
    arr.push({ month: format(d, 'MMM yy'), remaining: Math.max(0, Math.round(r)) })
    r -= monthlyPayment
  }
  return arr
}

export default function DebtGoalPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [debtItems, setDebtItems] = useState<{ id: string; name: string; remaining: number; interest_rate?: number; priority?: 'high' | 'normal' }[]>([])
  const [adviceLoading, setAdviceLoading] = useState(false)
  const [advice, setAdvice] = useState<string | null>(null)
  const [adviceError, setAdviceError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/auth/login')
        return
      }
      const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
      if (data) setProfile(data as Profile)
      const items = await fetchDebtItems(session.user.id)
      setDebtItems(items)
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

  const totalDebt = profile?.total_liabilities ?? 0
  const monthlyPayment = profile?.monthly_debt_payment ?? 0
  const extraPaymentThisMonth = 0
  const totalPaymentThisMonth = monthlyPayment + extraPaymentThisMonth

  const initialDebtMock = totalDebt > 0 ? Math.round(totalDebt * 1.15) : 0
  const progressPercent = initialDebtMock > 0
    ? Math.min(100, Math.round(((initialDebtMock - totalDebt) / initialDebtMock) * 100))
    : 0

  const monthsBase = monthsToClear(totalDebt, monthlyPayment || 1)
  const payoffDate = monthlyPayment > 0
    ? addMonths(new Date(), monthsBase)
    : null

  const extraThisMonth = Math.max(0, totalPaymentThisMonth - monthlyPayment)
  const daysEarlier = monthlyPayment > 0 ? Math.round((extraThisMonth / monthlyPayment) * 30) : 0
  const statusMessage =
    extraThisMonth > 0 && monthlyPayment > 0
      ? `เร็วขึ้นประมาณ ${daysEarlier} วัน`
      : totalPaymentThisMonth >= monthlyPayment && monthlyPayment > 0
        ? 'คุณกำลังทำได้ดี'
        : 'ตามแผนปกติ'

  const trendData = totalDebt > 0 && monthlyPayment > 0 ? mockTrend(totalDebt, monthlyPayment) : []
  const maxTrend = Math.max(...trendData.map((d) => d.remaining), 1)

  const fetchAdvice = async () => {
    setAdviceLoading(true)
    setAdviceError(null)
    setAdvice(null)
    try {
      const res = await fetch('/api/debt-advice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          totalDebt,
          monthlyPayment,
          debtItems: debtItems.map((d) => ({ name: d.name, remaining: d.remaining, rate: d.interest_rate, priority: d.priority })),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setAdviceError(data.error || 'ขอคำแนะนำไม่สำเร็จ')
        return
      }
      setAdvice(data.advice)
    } catch (e) {
      setAdviceError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด')
    } finally {
      setAdviceLoading(false)
    }
  }

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
            <h1 className="text-lg font-semibold text-foreground truncate">เป้าปลดหนี้</h1>
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
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">ภาพรวมหนี้</h2>
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
                <span className="text-xs text-muted-foreground">ปลดแล้ว</span>
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground mt-4">
              {totalDebt.toLocaleString('th-TH')} <span className="text-lg font-medium text-muted-foreground">บาท</span>
            </p>
            <p className="text-sm text-muted-foreground">ยอดหนี้คงเหลือ</p>
            {payoffDate && monthlyPayment > 0 && (
              <>
                <p className="text-success font-semibold mt-2">
                  คาดว่าจะหมดหนี้ {format(payoffDate, 'MMM yyyy')}
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
              <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">สถานะเดือนนี้</h2>
            </div>
            <p className="text-lg font-semibold text-foreground">{statusMessage}</p>
            {monthlyPayment > 0 && (
              <p className="text-sm text-muted-foreground mt-1">
                จ่ายเดือนละ {monthlyPayment.toLocaleString('th-TH')} บาท
              </p>
            )}
          </CardContent>
        </Card>

        {/* Section 3: Motivation Simulation */}
        {monthlyPayment > 0 && totalDebt > 0 && (
          <Card className="shadow-card border-0">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">ถ้าโปะเพิ่มทุกเดือน...</h2>
              </div>
              <div className="space-y-2">
                {[500, 1000, 2000].map((extra) => {
                  const newMonthly = monthlyPayment + extra
                  const monthsNew = monthsToClear(totalDebt, newMonthly)
                  const earlier = Math.max(0, monthsBase - monthsNew)
                  return (
                    <div
                      key={extra}
                      className="flex justify-between items-center py-2 px-3 rounded-xl bg-secondary"
                    >
                      <span className="text-foreground">+{extra.toLocaleString('th-TH')} บาท/เดือน</span>
                      <span className="text-success font-medium">
                        หมดเร็วขึ้น {earlier} เดือน
                      </span>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Section 4: Debt Breakdown */}
        <Card className="shadow-card border-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">รายการหนี้</h2>
            </div>
            {debtItems.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                ยังไม่มีรายการหนี้แยกประเภท เพิ่มได้ที่หน้า <Link href="/profile" className="text-primary underline">โปรไฟล์ (สุขภาพการเงิน)</Link> ในส่วน &quot;รายการหนี้แยกประเภท&quot;
              </p>
            ) : (
              <div className="space-y-3">
                {debtItems.map((item) => (
                  <div key={item.id} className="flex flex-col gap-1 p-3 rounded-xl bg-secondary border border-border">
                    <div className="flex justify-between items-start">
                      <span className="font-medium text-foreground">{item.name}</span>
                      {item.priority === 'high' && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-warning/20 text-warning">ควรโปะก่อน</span>
                      )}
                    </div>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>คงเหลือ {Number(item.remaining).toLocaleString('th-TH')} บาท</span>
                      {item.interest_rate != null && <span>ดอกเบี้ย ~{item.interest_rate}%/ปี</span>}
                    </div>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground text-center pt-1">แก้ไขรายการได้ที่หน้า <Link href="/profile" className="text-primary underline">โปรไฟล์</Link></p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section 5: Progress Over Time */}
        {trendData.length > 0 && (
          <Card className="shadow-card border-0">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/></svg>
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">แนวโน้มยอดหนี้</h2>
              </div>
              <div className="h-40 flex items-end gap-1">
                {trendData.map((d, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full rounded-t bg-success/30 min-h-[4px] transition-all"
                      style={{
                        height: `${(d.remaining / maxTrend) * 120}px`,
                      }}
                    />
                    <span className="text-xs text-muted-foreground truncate w-full text-center">
                      {d.month}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-center">ยอดคงเหลือแต่ละเดือน (ประมาณ)</p>
            </CardContent>
          </Card>
        )}

        {/* Section 6: AI คำแนะนำการปลดหนี้ */}
        <Card className="shadow-card border-0 overflow-hidden gradient-hero text-primary-foreground">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-primary-foreground/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
              </div>
              <h2 className="text-sm font-semibold text-primary-foreground">คำแนะนำจาก AI วิธีปลดหนี้</h2>
            </div>
            <p className="text-sm text-primary-foreground/90 mb-3">
              ให้ AI วิเคราะห์จากยอดหนี้และเงินผ่อนต่อเดือนของคุณ แล้วแนะนำแนวทางปลดหนี้ที่เหมาะกับคุณ
            </p>
            <button
              type="button"
              onClick={fetchAdvice}
              disabled={adviceLoading}
              className="w-full py-3 px-4 rounded-xl font-semibold bg-primary-foreground text-primary disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
            >
              {adviceLoading ? 'กำลังสร้างคำแนะนำ...' : 'ขอคำแนะนำจาก AI'}
            </button>
            {adviceError && (
              <div className="mt-3 p-3 rounded-xl bg-danger/20 border border-danger/50 text-danger text-sm">
                {adviceError}
              </div>
            )}
            {advice && (
              <div className="mt-4 p-4 rounded-xl bg-background/20 border border-primary-foreground/20 text-primary-foreground leading-relaxed">
                <FormattedAnalysis text={advice} />
              </div>
            )}
          </CardContent>
        </Card>

        <div className="h-4" />
      </div>

      <BottomNavigation />
    </div>
  )
}
