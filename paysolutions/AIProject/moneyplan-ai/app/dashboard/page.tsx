'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase, Profile, Transaction } from '@/lib/supabase'
import BottomNavigation from '@/components/BottomNavigation'
import FinancialAnalysis from '@/components/FinancialAnalysis'
import { format, startOfMonth, endOfMonth, subMonths, eachMonthOfInterval, startOfDay, endOfDay, eachDayOfInterval, subDays, startOfWeek, endOfWeek, eachWeekOfInterval, subWeeks, startOfYear, endOfYear, eachYearOfInterval, subYears } from 'date-fns'

export default function DashboardPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([])
  const [totalIncome, setTotalIncome] = useState(0)
  const [totalExpense, setTotalExpense] = useState(0)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [selectedMonth, setSelectedMonth] = useState(new Date())
  const [chartPeriod, setChartPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly')
  const [hoveredPoint, setHoveredPoint] = useState<{ label: string; income: number; expense: number; x: number; y: number } | null>(null)

  const checkUser = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/auth/login')
      return
    }
    setUser(session.user)
    loadProfile(session.user.id)
  }, [router])

  const loadProfile = async (userId: string) => {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Error loading profile:', profileError)
      } else if (profileData) {
        setProfile(profileData)
      }
    } catch (error) {
      console.error('Error loading profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadMonthData = useCallback(async (month: Date) => {
    if (!user) return
    
    try {
      const start = startOfMonth(month)
      const end = endOfMonth(month)

      const { data: transactionsData, error: transactionsError } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', format(start, 'yyyy-MM-dd'))
        .lte('date', format(end, 'yyyy-MM-dd'))
        .order('date', { ascending: false })

      if (transactionsError) {
        console.error('Error loading transactions:', transactionsError)
      } else if (transactionsData) {
        setTransactions(transactionsData)
        const income = transactionsData
          .filter(t => t.type === 'income')
          .reduce((sum, t) => sum + Number(t.amount), 0)
        const expense = transactionsData
          .filter(t => t.type === 'expense')
          .reduce((sum, t) => sum + Number(t.amount), 0)
        setTotalIncome(income)
        setTotalExpense(expense)
      }
    } catch (error) {
      console.error('Error loading month data:', error)
    }
  }, [user])

  const loadAllTransactions = useCallback(async () => {
    if (!user) return
    
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })

      if (error) {
        console.error('Error loading all transactions:', error)
      } else {
        setAllTransactions(data || [])
      }
    } catch (error) {
      console.error('Error loading all transactions:', error)
    }
  }, [user])

  useEffect(() => {
    checkUser()
  }, [checkUser])

  useEffect(() => {
    if (user) {
      loadMonthData(selectedMonth)
      loadAllTransactions()
    }
  }, [user, selectedMonth, loadMonthData, loadAllTransactions])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  const changeMonth = (direction: 'prev' | 'next') => {
    const newMonth = new Date(selectedMonth)
    if (direction === 'prev') {
      newMonth.setMonth(newMonth.getMonth() - 1)
    } else {
      newMonth.setMonth(newMonth.getMonth() + 1)
    }
    setSelectedMonth(newMonth)
  }

  // คำนวณกราฟตามช่วงเวลา
  const getTrendData = () => {
    const now = new Date()
    const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

    switch (chartPeriod) {
      case 'daily': {
        // รายวัน - 30 วันล่าสุด
        const thirtyDaysAgo = subDays(now, 29)
        const days = eachDayOfInterval({ start: thirtyDaysAgo, end: now })

        return days.map(day => {
          const dayStart = startOfDay(day)
          const dayEnd = endOfDay(day)
          
          const dayTransactions = allTransactions.filter(t => {
            const tDate = new Date(t.date)
            if (isNaN(tDate.getTime())) return false
            return tDate >= dayStart && tDate <= dayEnd
          })

          const income = dayTransactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + Number(t.amount), 0)
          
          const expense = dayTransactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + Number(t.amount), 0)

          return {
            label: format(day, 'dd/MM'),
            labelShort: format(day, 'dd'),
            income,
            expense,
          }
        }).filter(d => d.income > 0 || d.expense > 0)
      }

      case 'weekly': {
        // รายสัปดาห์ - 12 สัปดาห์ล่าสุด
        const twelveWeeksAgo = subWeeks(now, 11)
        const weeks = eachWeekOfInterval({ start: twelveWeeksAgo, end: now }, { weekStartsOn: 1 })

        return weeks.map(week => {
          const weekStart = startOfWeek(week, { weekStartsOn: 1 })
          const weekEnd = endOfWeek(week, { weekStartsOn: 1 })
          
          const weekTransactions = allTransactions.filter(t => {
            const tDate = new Date(t.date)
            if (isNaN(tDate.getTime())) return false
            return tDate >= weekStart && tDate <= weekEnd
          })

          const income = weekTransactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + Number(t.amount), 0)
          
          const expense = weekTransactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + Number(t.amount), 0)

          return {
            label: `${format(weekStart, 'dd/MM')} - ${format(weekEnd, 'dd/MM')}`,
            labelShort: format(weekStart, 'dd/MM'),
            income,
            expense,
          }
        }).filter(d => d.income > 0 || d.expense > 0)
      }

      case 'monthly': {
        // รายเดือน - 12 เดือนล่าสุด
        const twelveMonthsAgo = subMonths(now, 11)
        const months = eachMonthOfInterval({ start: twelveMonthsAgo, end: now })

        return months.map(month => {
          const monthStart = startOfMonth(month)
          const monthEnd = endOfMonth(month)
          
          const monthTransactions = allTransactions.filter(t => {
            const tDate = new Date(t.date)
            if (isNaN(tDate.getTime())) return false
            return tDate >= monthStart && tDate <= monthEnd
          })

          const income = monthTransactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + Number(t.amount), 0)
          
          const expense = monthTransactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + Number(t.amount), 0)

          return {
            label: `${monthNames[month.getMonth()]} ${month.getFullYear()}`,
            labelShort: monthNames[month.getMonth()],
            income,
            expense,
          }
        }).filter(d => d.income > 0 || d.expense > 0)
      }

      case 'yearly': {
        // รายปี - 5 ปีล่าสุด
        const fiveYearsAgo = subYears(now, 4)
        const years = eachYearOfInterval({ start: fiveYearsAgo, end: now })

        return years.map(year => {
          const yearStart = startOfYear(year)
          const yearEnd = endOfYear(year)
          
          const yearTransactions = allTransactions.filter(t => {
            const tDate = new Date(t.date)
            if (isNaN(tDate.getTime())) return false
            return tDate >= yearStart && tDate <= yearEnd
          })

          const income = yearTransactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + Number(t.amount), 0)
          
          const expense = yearTransactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + Number(t.amount), 0)

          return {
            label: `${year.getFullYear()}`,
            labelShort: `${year.getFullYear()}`,
            income,
            expense,
          }
        }).filter(d => d.income > 0 || d.expense > 0)
      }
    }
  }

  const trendData = getTrendData()
  const maxTrendValue = Math.max(
    ...trendData.map(d => Math.max(d.income, d.expense)),
    1
  )

  // Category icons
  const getCategoryIcon = (category: string, type: 'income' | 'expense') => {
    const iconMap: { [key: string]: JSX.Element } = {
      'เงินเดือน': (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      'ที่พัก/ค่าเช่า': (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
      'ช้อปปิ้ง': (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
      ),
    }

    return iconMap[category] || (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  }

  const monthNames = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
  const currentMonthName = monthNames[selectedMonth.getMonth()]
  const currentYear = selectedMonth.getFullYear() + 543 // Convert to Buddhist year

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 pb-16">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 pb-16">
        <div className="bg-gray-800 text-white px-4 py-3 flex justify-between items-center">
          <h1 className="text-lg font-semibold">ภาพรวม</h1>
          <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
        </div>
        <div className="max-w-md mx-auto px-4 py-8">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-yellow-800 mb-2">
              ยังไม่มีข้อมูลสุขภาพการเงิน
            </h2>
            <p className="text-yellow-700 mb-4">
              กรุณากรอกข้อมูลสุขภาพการเงินของคุณก่อนเพื่อดูการวิเคราะห์
            </p>
            <Link
              href="/profile"
              className="inline-block bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              กรอกข้อมูลสุขภาพการเงิน
            </Link>
          </div>
        </div>
        <BottomNavigation />
      </div>
    )
  }

  const balance = totalIncome - totalExpense

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* Header */}
      <div className="bg-gray-800 text-white px-4 py-3 flex justify-between items-center">
        <h1 className="text-lg font-semibold">ภาพรวม</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={handleLogout}
            className="p-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            title="ออกจากระบบ"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
          <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-4">
        {/* Month Selector */}
        <div className="bg-gray-800 text-white px-4 py-3 rounded-lg mb-4 flex items-center justify-between">
          <button onClick={() => changeMonth('prev')} className="p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="font-medium">{currentMonthName} {currentYear}</span>
          <button onClick={() => changeMonth('next')} className="p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Financial Summary Cards */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <p className="text-xs text-gray-500 mb-1">รายรับ</p>
            <p className="text-lg font-bold text-green-600">
              {totalIncome.toLocaleString('th-TH')}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <p className="text-xs text-gray-500 mb-1">รายจ่าย</p>
            <p className="text-lg font-bold text-red-600">
              {totalExpense.toLocaleString('th-TH')}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <p className="text-xs text-gray-500 mb-1">คงเหลือ</p>
            <p className={`text-lg font-bold ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {balance.toLocaleString('th-TH')}
            </p>
          </div>
        </div>

        {/* Trend Graph */}
        {trendData.length > 0 && (
          <div className="bg-white p-4 rounded-lg shadow-sm mb-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-semibold text-gray-800">แนวโน้มรายรับรายจ่าย</h3>
              <select
                value={chartPeriod}
                onChange={(e) => setChartPeriod(e.target.value as 'daily' | 'weekly' | 'monthly' | 'yearly')}
                className="px-3 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
              >
                <option value="daily">รายวัน (30 วัน)</option>
                <option value="weekly">รายสัปดาห์ (12 สัปดาห์)</option>
                <option value="monthly">รายเดือน (12 เดือน)</option>
                <option value="yearly">รายปี (5 ปี)</option>
              </select>
            </div>
            <div className="h-40 relative" onMouseLeave={() => setHoveredPoint(null)}>
              <svg className="w-full h-full" viewBox="-10 -10 420 140" preserveAspectRatio="xMidYMid meet">
                {/* Grid lines */}
                {[0, 30, 60, 90, 120].map((y) => (
                  <line
                    key={y}
                    x1="10"
                    y1={10 + y}
                    x2="390"
                    y2={10 + y}
                    stroke="#e5e7eb"
                    strokeWidth="0.5"
                  />
                ))}
                
                {/* Income line (green) */}
                {trendData.length > 1 && (
                  <polyline
                    points={trendData.map((d, i) => {
                      const x = 10 + (i / (trendData.length - 1)) * 380
                      const y = 10 + (100 - (d.income / maxTrendValue) * 100)
                      return `${x},${y}`
                    }).join(' ')}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
                
                {/* Expense line (red) */}
                {trendData.length > 1 && (
                  <polyline
                    points={trendData.map((d, i) => {
                      const x = 10 + (i / (trendData.length - 1)) * 380
                      const y = 10 + (100 - (d.expense / maxTrendValue) * 100)
                      return `${x},${y}`
                    }).join(' ')}
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Interactive points for hover */}
                {trendData.map((d, i) => {
                  const x = trendData.length > 1 ? 10 + (i / (trendData.length - 1)) * 380 : 200
                  const incomeY = 10 + (100 - (d.income / maxTrendValue) * 100)
                  const expenseY = 10 + (100 - (d.expense / maxTrendValue) * 100)
                  
                  return (
                    <g key={i}>
                      {/* Income point with larger hit area */}
                      <circle
                        cx={x}
                        cy={incomeY}
                        r="10"
                        fill="transparent"
                        style={{ cursor: 'pointer' }}
                        onMouseEnter={() => {
                          const xPercent = ((x - 10) / 380) * 100
                          const yPercent = ((incomeY - 10) / 100) * 100
                          setHoveredPoint({
                            label: d.label,
                            income: d.income,
                            expense: d.expense,
                            x: xPercent,
                            y: yPercent
                          })
                        }}
                      />
                      <circle
                        cx={x}
                        cy={incomeY}
                        r="5"
                        fill="#10b981"
                        stroke="white"
                        strokeWidth="2"
                        style={{ pointerEvents: 'none' }}
                      />
                      {/* Expense point with larger hit area */}
                      <circle
                        cx={x}
                        cy={expenseY}
                        r="10"
                        fill="transparent"
                        style={{ cursor: 'pointer' }}
                        onMouseEnter={() => {
                          const xPercent = ((x - 10) / 380) * 100
                          const yPercent = ((expenseY - 10) / 100) * 100
                          setHoveredPoint({
                            label: d.label,
                            income: d.income,
                            expense: d.expense,
                            x: xPercent,
                            y: yPercent
                          })
                        }}
                      />
                      <circle
                        cx={x}
                        cy={expenseY}
                        r="5"
                        fill="#ef4444"
                        stroke="white"
                        strokeWidth="2"
                        style={{ pointerEvents: 'none' }}
                      />
                    </g>
                  )
                })}
              </svg>
              
              {/* Tooltip */}
              {hoveredPoint && (
                <div
                  className="absolute bg-gray-800 text-white text-xs rounded-lg px-3 py-2 shadow-lg z-10 pointer-events-none"
                  style={{
                    left: `${hoveredPoint.x}%`,
                    top: `${hoveredPoint.y}%`,
                    transform: 'translate(-50%, -100%)',
                    marginTop: '-8px',
                    minWidth: '140px'
                  }}
                >
                  <div className="font-semibold mb-2 text-center border-b border-gray-700 pb-1">
                    {hoveredPoint.label}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <span>รายรับ</span>
                      </div>
                      <span className="font-medium">{hoveredPoint.income.toLocaleString('th-TH')} บาท</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-red-500"></div>
                        <span>รายจ่าย</span>
                      </div>
                      <span className="font-medium">{hoveredPoint.expense.toLocaleString('th-TH')} บาท</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 pt-1 border-t border-gray-700">
                      <span className="text-gray-300">คงเหลือ</span>
                      <span className={`font-semibold ${(hoveredPoint.income - hoveredPoint.expense) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {(hoveredPoint.income - hoveredPoint.expense).toLocaleString('th-TH')} บาท
                      </span>
                    </div>
                  </div>
                  <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full">
                    <div className="border-4 border-transparent border-t-gray-800"></div>
                  </div>
                </div>
              )}
              
              {/* Labels */}
              <div className="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-gray-500 px-1">
                {trendData.map((d, i) => (
                  <span key={i} className="text-xs">{d.labelShort}</span>
                ))}
              </div>
            </div>
            {/* Legend */}
            <div className="flex justify-center gap-4 mt-3 pt-3 border-t border-gray-200">
              <div className="flex items-center gap-2">
                <div className="w-3 h-0.5 bg-green-500"></div>
                <span className="text-sm text-gray-600">รายรับ</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-0.5 bg-red-500"></div>
                <span className="text-sm text-gray-600">รายจ่าย</span>
              </div>
            </div>
          </div>
        )}

        {/* Financial Analysis from Profile and Transactions */}
        {profile && (
          <div className="bg-white p-4 rounded-lg shadow-sm mb-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <span>📊</span>
              วิเคราะห์การเงิน
            </h3>
            <FinancialAnalysis profile={profile} totalIncome={totalIncome} />
          </div>
        )}

        {/* Transaction Analysis */}
        {transactions.length > 0 && (
          <div className="bg-white p-4 rounded-lg shadow-sm mb-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <span>💰</span>
              สรุปรายรับรายจ่าย
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">รายรับรวม (เดือนนี้)</span>
                <span className="text-sm font-semibold text-green-600">
                  {totalIncome.toLocaleString('th-TH')} บาท
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">รายจ่ายรวม (เดือนนี้)</span>
                <span className="text-sm font-semibold text-red-600">
                  {totalExpense.toLocaleString('th-TH')} บาท
                </span>
              </div>
              <div className="pt-2 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-800">ยอดคงเหลือ</span>
                  <span className={`text-sm font-bold ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {balance.toLocaleString('th-TH')} บาท
                  </span>
                </div>
              </div>
              {profile && totalIncome > 0 && (
                <div className="pt-2 border-t border-gray-200 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">อัตราการออม (จากรายรับ)</span>
                    <span className={`text-sm font-medium ${
                      (balance / totalIncome) * 100 >= 10 ? 'text-green-600' : 'text-yellow-600'
                    }`}>
                      {((balance / totalIncome) * 100).toFixed(1)}%
                    </span>
                  </div>
                  {profile.fixed_expense > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">รายจ่ายคงที่ (จาก Profile)</span>
                      <span className="text-sm font-medium text-gray-800">
                        {profile.fixed_expense.toLocaleString('th-TH')} บาท
                      </span>
                    </div>
                  )}
                  {profile.variable_expense > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">รายจ่ายผันแปร (จาก Profile)</span>
                      <span className="text-sm font-medium text-gray-800">
                        {profile.variable_expense.toLocaleString('th-TH')} บาท
                      </span>
                    </div>
                  )}
                  {totalExpense > 0 && (
                    <div className="pt-2 border-t border-gray-100">
                      <div className="text-sm text-gray-500 mb-1">
                        เปรียบเทียบรายจ่ายจริง vs งบประมาณ
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">รายจ่ายจริง (เดือนนี้)</span>
                        <span className={`text-sm font-medium ${
                          totalExpense > (profile.fixed_expense + profile.variable_expense) 
                            ? 'text-red-600' 
                            : 'text-green-600'
                        }`}>
                          {totalExpense.toLocaleString('th-TH')} บาท
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">งบประมาณรายจ่าย</span>
                        <span className="text-sm font-medium text-gray-800">
                          {(profile.fixed_expense + profile.variable_expense).toLocaleString('th-TH')} บาท
                        </span>
                      </div>
                      {totalExpense > (profile.fixed_expense + profile.variable_expense) && (
                        <div className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded">
                          ⚠️ รายจ่ายจริงเกินงบประมาณ {(totalExpense - (profile.fixed_expense + profile.variable_expense)).toLocaleString('th-TH')} บาท
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Latest Transactions */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-800">รายการล่าสุด</h3>
          </div>
          {transactions.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">
              ยังไม่มีรายการในเดือนนี้
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {transactions.slice(0, 5).map((transaction) => (
                <div key={transaction.id} className="px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <div className={`p-2 rounded-lg ${
                      transaction.type === 'income' ? 'bg-green-100' : 'bg-red-100'
                    }`}>
                      {getCategoryIcon(transaction.category || '', transaction.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {transaction.category || '-'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {format(new Date(transaction.date), 'dd/MM/yyyy')}
                      </p>
                    </div>
                  </div>
                  <p className={`text-sm font-semibold ${
                    transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {transaction.type === 'income' ? '+' : '-'}
                    {Number(transaction.amount).toLocaleString('th-TH')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <BottomNavigation />
    </div>
  )
}
