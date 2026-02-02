'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase, Profile } from '@/lib/supabase'
import BottomNavigation from '@/components/BottomNavigation'
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

/** Mock debt items when no DB list exists */
type DebtItem = { name: string; remaining: number; rate?: number; priority?: 'high' | 'normal' }
const MOCK_DEBTS: DebtItem[] = [
  { name: 'บัตรเครดิต A', remaining: 45000, rate: 18, priority: 'high' },
  { name: 'สินเชื่อส่วนบุคคล', remaining: 120000, rate: 12, priority: 'normal' },
  { name: 'ผ่อนรถ', remaining: 280000, rate: 4.5, priority: 'normal' },
]

/** Mock monthly remaining trend (last 6 months, descending) */
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50 pb-16">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-emerald-500 border-t-transparent" />
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

  const debtItems = totalDebt > 0 ? MOCK_DEBTS : []
  const trendData = totalDebt > 0 && monthlyPayment > 0 ? mockTrend(totalDebt, monthlyPayment) : []
  const maxTrend = Math.max(...trendData.map((d) => d.remaining), 1)

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/dashboard" className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-lg font-semibold text-gray-800">เป้าปลดหนี้</h1>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-5 space-y-6">
        {/* Section 1: Hero Summary */}
        <section className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">🎯</span>
            <h2 className="text-sm font-medium text-gray-600">ภาพรวมหนี้</h2>
          </div>
          <div className="flex flex-col items-center">
            <div className="relative w-40 h-40">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="#f3f4f6" strokeWidth="8" />
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
                <span className="text-2xl font-bold text-gray-800">{progressPercent}%</span>
                <span className="text-xs text-gray-500">ปลดแล้ว</span>
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900 mt-4">
              {totalDebt.toLocaleString('th-TH')} <span className="text-lg font-medium text-gray-500">บาท</span>
            </p>
            <p className="text-sm text-gray-500">ยอดหนี้คงเหลือ</p>
            {payoffDate && monthlyPayment > 0 && (
              <>
                <p className="text-emerald-600 font-semibold mt-2">
                  คาดว่าจะหมดหนี้ {format(payoffDate, 'MMM yyyy')}
                </p>
                <p className="text-xs text-gray-500">ประมาณอีก {monthsBase} เดือน</p>
              </>
            )}
          </div>
        </section>

        {/* Section 2: Status Card */}
        <section className="bg-white rounded-2xl shadow-sm p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">⏳</span>
            <h2 className="text-sm font-medium text-gray-600">สถานะเดือนนี้</h2>
          </div>
          <p className="text-lg font-semibold text-gray-800">{statusMessage}</p>
          {monthlyPayment > 0 && (
            <p className="text-sm text-gray-500 mt-1">
              จ่ายเดือนละ {monthlyPayment.toLocaleString('th-TH')} บาท
            </p>
          )}
        </section>

        {/* Section 3: Motivation Simulation */}
        {monthlyPayment > 0 && totalDebt > 0 && (
          <section className="bg-white rounded-2xl shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">💰</span>
              <h2 className="text-sm font-medium text-gray-600">ถ้าโปะเพิ่มทุกเดือน...</h2>
            </div>
            <div className="space-y-2">
              {[500, 1000, 2000].map((extra) => {
                const newMonthly = monthlyPayment + extra
                const monthsNew = monthsToClear(totalDebt, newMonthly)
                const earlier = Math.max(0, monthsBase - monthsNew)
                return (
                  <div
                    key={extra}
                    className="flex justify-between items-center py-2 px-3 rounded-xl bg-gray-50"
                  >
                    <span className="text-gray-700">+{extra.toLocaleString('th-TH')} บาท/เดือน</span>
                    <span className="text-emerald-600 font-medium">
                      หมดเร็วขึ้น {earlier} เดือน
                    </span>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Section 4: Debt Breakdown */}
        <section className="bg-white rounded-2xl shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">📉</span>
            <h2 className="text-sm font-medium text-gray-600">รายการหนี้</h2>
          </div>
          {debtItems.length === 0 ? (
            <p className="text-sm text-gray-500 py-4 text-center">
              ยังไม่มีข้อมูลหนี้ แก้ไขหนี้สินรวมและเงินผ่อนต่อเดือนในหน้าโปรไฟล์
            </p>
          ) : (
            <>
            <p className="text-xs text-gray-500 mb-2">ตัวอย่างรายการ (ข้อมูลจริงจากโปรไฟล์ = ยอดรวมด้านบน)</p>
            <div className="space-y-3">
              {debtItems.map((item, i) => (
                <div
                  key={i}
                  className="flex flex-col gap-1 p-3 rounded-xl bg-gray-50 border border-gray-100"
                >
                  <div className="flex justify-between items-start">
                    <span className="font-medium text-gray-800">{item.name}</span>
                    {item.priority === 'high' && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                        ควรโปะก่อน
                      </span>
                    )}
                  </div>
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>คงเหลือ {item.remaining.toLocaleString('th-TH')} บาท</span>
                    {item.rate != null && <span>ดอกเบี้ย ~{item.rate}%/ปี</span>}
                  </div>
                </div>
              ))}
            </div>
            </>
          )}
        </section>

        {/* Section 5: Progress Over Time */}
        {trendData.length > 0 && (
          <section className="bg-white rounded-2xl shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">📊</span>
              <h2 className="text-sm font-medium text-gray-600">แนวโน้มยอดหนี้</h2>
            </div>
            <div className="h-40 flex items-end gap-1">
              {trendData.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t bg-emerald-200 min-h-[4px] transition-all"
                    style={{
                      height: `${(d.remaining / maxTrend) * 120}px`,
                    }}
                  />
                  <span className="text-xs text-gray-500 truncate w-full text-center">
                    {d.month}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2 text-center">ยอดคงเหลือแต่ละเดือน (ประมาณ)</p>
          </section>
        )}

        <div className="h-4" />
      </div>

      <BottomNavigation />
    </div>
  )
}
