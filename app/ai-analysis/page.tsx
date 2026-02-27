'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/src/infrastructure/supabase/supabase'
import type { TransactionRow as Transaction } from '@/src/infrastructure/supabase/supabase'
import BottomNavigation from '@/components/BottomNavigation'
import FormattedAnalysis from '@/components/FormattedAnalysis'
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
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between px-4 h-14">
          <Link href="/dashboard" className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-lg font-semibold text-gray-800">วิเคราะห์การเงินด้วย AI</h1>
          <div className="w-10" />
        </div>
      </header>

      <main className="p-4 max-w-xl mx-auto">
        <p className="text-gray-600 text-sm mb-4">
          ใช้ข้อมูลรายรับรายจ่าย 3 เดือนล่าสุดของคุณ ให้ AI ช่วยสรุปภาพรวมและให้คำแนะนำการเงินเป็นภาษาไทย
        </p>

        {loading ? (
          <div className="py-8 text-center text-gray-500">กำลังโหลดรายการ...</div>
        ) : (
          <>
            <div className="mb-4 text-sm text-gray-600">
              พบ {transactions.length} รายการใน 3 เดือนล่าสุด
            </div>

            <button
              type="button"
              onClick={runAnalysis}
              disabled={analyzing || transactions.length === 0}
              className="w-full py-3 px-4 rounded-xl font-medium bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition"
            >
              {analyzing ? 'กำลังวิเคราะห์...' : 'วิเคราะห์การเงินด้วย AI'}
            </button>

            {error && (
              <div className="mt-4 p-4 rounded-xl bg-red-50 text-red-700 text-sm">
                {error}
              </div>
            )}

            {analysis && (
              <div className="mt-6 p-4 rounded-2xl bg-white shadow-sm border border-gray-100">
                <h2 className="text-sm font-medium text-gray-500 mb-3">ผลวิเคราะห์</h2>
                <div className="text-gray-800 leading-relaxed">
                  <FormattedAnalysis text={analysis} />
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <BottomNavigation />
    </div>
  )
}
