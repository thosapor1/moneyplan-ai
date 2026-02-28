'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/src/infrastructure/supabase/supabase'
import type { TransactionRow as Transaction } from '@/src/infrastructure/supabase/supabase'
import BottomNavigation from '@/components/BottomNavigation'
import FormattedAnalysis from '@/components/FormattedAnalysis'
import { Card, CardContent } from '@/components/ui/card'
import { format, subMonths } from 'date-fns'

export default function AIAnalysisPage() {
  const router = useRouter()
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const checkUser = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/auth/login')
      return
    }
    setUser(session.user as { id: string })
  }, [router])

  const loadTransactions = useCallback(async (userId: string) => {
    try {
      const fromDate = format(subMonths(new Date(), 3), 'yyyy-MM-dd')
      const { data, error: err } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .gte('date', fromDate)
        .order('date', { ascending: false })

      if (err) {
        console.error('Error loading transactions:', err)
        setError('โหลดรายการไม่สำเร็จ')
        return
      }
      setTransactions(data || [])
      setError(null)
    } catch (e) {
      console.error(e)
      setError('โหลดรายการไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    checkUser()
  }, [checkUser])

  useEffect(() => {
    if (user) loadTransactions(user.id)
  }, [user, loadTransactions])

  const runAnalysis = async () => {
    if (!transactions.length) {
      setError('ยังไม่มีรายการธุรกรรม ให้เพิ่มรายรับรายจ่ายก่อนแล้วค่อยวิเคราะห์')
      return
    }
    setAnalyzing(true)
    setError(null)
    setAnalysis(null)
    try {
      const payload = transactions.map((t) => ({
        type: t.type,
        amount: t.amount,
        category: t.category ?? '',
        description: t.description ?? '',
        date: t.date,
      }))
      const res = await fetch('/api/analyze-finance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions: payload }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'วิเคราะห์ไม่สำเร็จ')
        return
      }
      setAnalysis(data.analysis)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด')
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 bg-background border-b border-border">
        <div className="max-w-lg mx-auto flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/dashboard" className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors shrink-0">
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div className="flex items-center gap-2 min-w-0">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-primary/10 text-primary shrink-0">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3l14 9-14 9V3z" />
                </svg>
              </span>
              <h1 className="text-lg font-semibold text-foreground truncate">วิเคราะห์การเงินด้วย AI</h1>
            </div>
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
      </header>

      <main className="p-4 max-w-lg mx-auto space-y-4">
        <Card className="shadow-card border-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-muted-foreground">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">เกี่ยวกับการวิเคราะห์</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              ใช้ข้อมูลรายรับรายจ่าย 3 เดือนล่าสุดของคุณ ให้ AI ช่วยสรุปภาพรวมและให้คำแนะนำการเงินเป็นภาษาไทย
            </p>
          </CardContent>
        </Card>

        {loading ? (
          <Card className="shadow-card border-0">
            <CardContent className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">กำลังโหลดรายการ...</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="shadow-card border-0">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">ข้อมูลที่ใช้วิเคราะห์</span>
                  </div>
                  <span className="text-sm font-semibold text-foreground">{transactions.length} รายการ</span>
                </div>
                <p className="text-xs text-muted-foreground mb-4">ข้อมูลรายรับรายจ่าย 3 เดือนล่าสุด</p>
                <button
                  type="button"
                  onClick={runAnalysis}
                  disabled={analyzing || transactions.length === 0}
                  className="w-full py-3 px-4 rounded-xl font-semibold bg-primary text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3l14 9-14 9V3z" />
                  </svg>
                  {analyzing ? 'กำลังวิเคราะห์...' : 'วิเคราะห์การเงินด้วย AI'}
                </button>
              </CardContent>
            </Card>

            {error && (
              <div className="p-4 rounded-xl bg-danger/10 border border-danger/30 text-danger text-sm">
                {error}
              </div>
            )}

            {analysis && (
              <Card className="shadow-card border-0">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-primary/10 text-primary">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3l14 9-14 9V3z" />
                      </svg>
                    </span>
                    <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">ผลวิเคราะห์จาก AI</h2>
                  </div>
                  <div className="text-foreground leading-relaxed text-sm">
                    <FormattedAnalysis text={analysis} />
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>

      <BottomNavigation />
    </div>
  )
}
