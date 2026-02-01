/**
 * Pure financial calculation helpers for Dashboard insights.
 * All functions are side-effect free and testable.
 */

export type TransactionLike = {
  type: 'income' | 'expense'
  amount: number
  category?: string
  date: string
}

export type CategorySummary = {
  category: string
  total: number
  percent: number
}

export type FinancialStatus = 'Healthy' | 'Warning' | 'Risk'

/** Current balance in period = total income - total expense */
export function getCurrentBalance(totalIncome: number, totalExpense: number): number {
  return totalIncome - totalExpense
}

/**
 * วันสุดท้ายของ "เดือน" ตามที่กำหนด
 * customDay 0 = ใช้วันสิ้นเดือนจริงของเดือน, 1-31 = ใช้วันนั้น (ไม่เกินวันสิ้นเดือนจริง)
 */
export function getEffectiveLastDayOfMonth(month: Date, customDay: number): number {
  const calendarLast = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  if (customDay <= 0) return calendarLast
  return Math.min(customDay, calendarLast)
}

/**
 * จำนวนวันใน "เดือน" ตามวันสิ้นเดือนที่กำหนด (ใช้คำนวณงบรายวัน ฯลฯ)
 */
export function getDaysInMonth(month: Date, customMonthEndDay: number): number {
  return getEffectiveLastDayOfMonth(month, customMonthEndDay)
}

/**
 * ช่วงวันที่ของ "เดือน" ตามวันสิ้นเดือนที่กำหนด
 * customMonthEndDay 0 = วันที่ 1 ถึงวันสุดท้ายของเดือนตามปฏิทิน
 * customMonthEndDay 1-31 = ตั้งแต่วันที่เป็นวันสิ้นเดือนของเดือนก่อน ถึง วันสิ้นเดือนของเดือนนี้ (เช่น 27 = 27 ม.ค. ถึง 27 ก.พ.)
 */
export function getMonthRange(
  month: Date,
  customMonthEndDay: number
): { start: Date; end: Date } {
  if (customMonthEndDay <= 0) {
    return {
      start: new Date(month.getFullYear(), month.getMonth(), 1),
      end: new Date(month.getFullYear(), month.getMonth() + 1, 0),
    }
  }
  const lastDay = getEffectiveLastDayOfMonth(month, customMonthEndDay)
  const end = new Date(month.getFullYear(), month.getMonth(), lastDay)
  const prevMonthLastDay = new Date(month.getFullYear(), month.getMonth(), 0).getDate()
  const startDay = Math.min(customMonthEndDay, prevMonthLastDay)
  const start = new Date(month.getFullYear(), month.getMonth() - 1, startDay)
  return { start, end }
}

/** Days left in the current month (including today). customMonthEndDay 0 = ตามปฏิทิน, 1-31 = ใช้วันนั้นเป็นวันสิ้นเดือน */
export function getRemainingDaysInMonth(
  now: Date = new Date(),
  customMonthEndDay: number = 0
): number {
  const lastDay = getEffectiveLastDayOfMonth(now, customMonthEndDay)
  const today = now.getDate()
  return Math.max(0, lastDay - today + 1)
}

/**
 * จำนวนวันที่ผ่านไปใน "เดือน" (ช่วงตามวันสิ้นเดือนที่กำหนด)
 * customMonthEndDay 0 = ตามปฏิทิน; 1-31 = นับจากวันเริ่มช่วง (วันนั้น+1 ของเดือนก่อน) ถึง asOf
 */
export function getDaysElapsedInMonth(
  month: Date,
  asOf: Date = new Date(),
  customMonthEndDay: number = 0
): number {
  if (customMonthEndDay <= 0) {
    const lastDay = getEffectiveLastDayOfMonth(month, 0)
    const sameMonth = month.getMonth() === asOf.getMonth() && month.getFullYear() === asOf.getFullYear()
    if (sameMonth) return Math.min(asOf.getDate(), lastDay)
    return lastDay
  }
  const { start, end } = getMonthRange(month, customMonthEndDay)
  const asOfTime = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate()).getTime()
  const startTime = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime()
  const endTime = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime()
  if (asOfTime < startTime) return 0
  if (asOfTime > endTime) {
    const periodDays = Math.round((endTime - startTime) / (24 * 60 * 60 * 1000)) + 1
    return periodDays
  }
  const elapsed = Math.round((asOfTime - startTime) / (24 * 60 * 60 * 1000)) + 1
  return elapsed
}

/** Average daily expense. Uses daysInRange to avoid div by zero; if 0, returns 0. */
export function getAvgDailyExpense(totalExpense: number, daysInRange: number): number {
  if (daysInRange <= 0) return 0
  return totalExpense / daysInRange
}

/** How many days the current balance can last at current avg daily expense. Can be Infinity. */
export function getDaysLeft(currentBalance: number, avgDailyExpense: number): number {
  if (avgDailyExpense <= 0) return currentBalance >= 0 ? Infinity : 0
  return currentBalance / avgDailyExpense
}

/** Projected end-of-month balance: current balance minus (avg daily expense × remaining days). */
export function getProjectedEndOfMonthBalance(
  currentBalance: number,
  avgDailyExpense: number,
  remainingDays: number
): number {
  return currentBalance - avgDailyExpense * remainingDays
}

/** Status thresholds (tunable constants) */
const STATUS = {
  /** If projected balance > 0 and daysLeft > remaining days → Healthy */
  HEALTHY_DAYS_LEFT_MULTIPLIER: 1,
  /** If projected balance <= 0 → Risk */
} as const

/**
 * Overall financial status for the month.
 * - Healthy: projected balance > 0 and days left >= remaining days in month
 * - Warning: balance still positive but days left < remaining days
 * - Risk: projected end-of-month balance < 0
 */
export function getFinancialStatus(
  projectedBalance: number,
  daysLeft: number,
  remainingDays: number
): FinancialStatus {
  if (projectedBalance < 0) return 'Risk'
  if (daysLeft >= remainingDays && projectedBalance > 0) return 'Healthy'
  return 'Warning'
}

/** Sum of expenses for a given date (YYYY-MM-DD) */
export function getTodayExpense(transactions: TransactionLike[], todayStr: string): number {
  return transactions
    .filter((t) => t.type === 'expense' && t.date === todayStr)
    .reduce((sum, t) => sum + Number(t.amount), 0)
}

/** Number of days in range that have at least one transaction (for avg daily calc). If 0, use daysInMonth. */
export function getDaysWithExpense(transactions: TransactionLike[], startDate: Date, endDate: Date): number {
  const set = new Set<string>()
  const start = startDate.getTime()
  const end = endDate.getTime()
  transactions
    .filter((t) => t.type === 'expense')
    .forEach((t) => {
      const tDate = new Date(t.date).getTime()
      if (!isNaN(tDate) && tDate >= start && tDate <= end) set.add(t.date)
    })
  return set.size
}

/** Top N expense categories by total amount, with percentage of total expense */
export function getTopExpenseCategories(
  transactions: TransactionLike[],
  limit: number
): CategorySummary[] {
  const expenseOnly = transactions.filter((t) => t.type === 'expense')
  const totalExpense = expenseOnly.reduce((sum, t) => sum + Number(t.amount), 0)
  if (totalExpense <= 0) return []

  const byCategory = new Map<string, number>()
  expenseOnly.forEach((t) => {
    const raw = t.category?.trim()
    const cat = raw === '' || raw === undefined ? 'ไม่ระบุหมวด' : raw
    byCategory.set(cat, (byCategory.get(cat) || 0) + Number(t.amount))
  })

  const list = Array.from(byCategory.entries())
    .map(([category, total]) => ({ category, total, percent: (total / totalExpense) * 100 }))
    .sort((a, b) => b.total - a.total)

  return list.slice(0, limit)
}

/** Last N biggest expenses (by amount) in the given list */
export function getRecentBigExpenses(
  transactions: TransactionLike[],
  limit: number
): { date: string; category: string; amount: number }[] {
  return transactions
    .filter((t) => t.type === 'expense')
    .map((t) => ({ date: t.date, category: (t.category?.trim() || 'ไม่ระบุหมวด'), amount: Number(t.amount) }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit)
}

/** Percent difference: (today - avg) / avg. Returns 0 if avg is 0. */
export function getTodayVsAvgPercent(todayExpense: number, avgDailyExpense: number): number {
  if (avgDailyExpense <= 0) return 0
  return ((todayExpense - avgDailyExpense) / avgDailyExpense) * 100
}
