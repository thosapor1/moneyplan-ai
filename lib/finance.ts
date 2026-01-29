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

/** Days left in the current month (including today) */
export function getRemainingDaysInMonth(now: Date = new Date()): number {
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const today = now.getDate()
  const lastDay = end.getDate()
  return Math.max(0, lastDay - today + 1)
}

/** Days elapsed in the given month so far (1-based). For "current month" view, use today; for past month use last day. */
export function getDaysElapsedInMonth(month: Date, asOf: Date = new Date()): number {
  const sameMonth = month.getMonth() === asOf.getMonth() && month.getFullYear() === asOf.getFullYear()
  if (sameMonth) return Math.min(asOf.getDate(), new Date(asOf.getFullYear(), asOf.getMonth() + 1, 0).getDate())
  const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  return lastDay
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
