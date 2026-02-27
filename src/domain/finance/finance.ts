/**
 * Domain: Finance
 * Pure financial calculation helpers for Dashboard insights.
 *
 * Rules:
 * - No side effects (no I/O, no browser APIs).
 * - Deterministic + easy to test.
 * - Date calculations should be date-only (ignore time-of-day) unless explicitly stated.
 */

export type TransactionType = 'income' | 'expense'

export type TransactionLike = {
  type: TransactionType
  amount: number
  category?: string
  /**
   * Date in ISO format `YYYY-MM-DD`.
   * (We treat it as a lexicographically sortable date string.)
   */
  date: string
}

export type CategorySummary = {
  category: string
  total: number
  percent: number
}

export type FinancialStatus = 'Healthy' | 'Warning' | 'Risk'

export type DateRange = { start: Date; end: Date }

/** Current balance in period = total income - total expense */
export function getCurrentBalance(totalIncome: number, totalExpense: number): number {
  return totalIncome - totalExpense
}

/**
 * Get the effective last day-of-month number for the given month.
 *
 * - customDay = 0 => use the real calendar last day.
 * - customDay 1..31 => clamp to [1..calendarLastDay].
 */
export function getEffectiveLastDayOfMonth(month: Date, customDay: number): number {
  const calendarLast = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  if (customDay <= 0) return calendarLast
  return Math.min(customDay, calendarLast)
}

/**
 * Returns "period end day-of-month" (1..31), not number of days in the period.
 *
 * @deprecated Prefer period utilities for period length.
 */
export function getDaysInMonth(month: Date, customMonthEndDay: number): number {
  return getEffectiveLastDayOfMonth(month, customMonthEndDay)
}

/**
 * Month range for "custom month-end day" billing.
 *
 * - customMonthEndDay = 0 => calendar month: [1st .. last day]
 * - customMonthEndDay = N (1..31) =>
 *   range is [(N+1) of previous month .. N of this month] (inclusive), clamped to month lengths.
 *   So each day belongs to exactly one period (no double-counting: salary on the 27th counts in one period only).
 *
 * Example: endDay=27 for Feb 2026 => start=Jan 28, end=Feb 27.
 */
export function getMonthRange(month: Date, customMonthEndDay: number): { start: Date; end: Date } {
  if (customMonthEndDay <= 0) {
    return {
      start: new Date(month.getFullYear(), month.getMonth(), 1),
      end: new Date(month.getFullYear(), month.getMonth() + 1, 0),
    }
  }

  const lastDay = getEffectiveLastDayOfMonth(month, customMonthEndDay)
  const end = new Date(month.getFullYear(), month.getMonth(), lastDay)

  const prevMonthCalendarLast = new Date(month.getFullYear(), month.getMonth(), 0).getDate()
  const startDay = customMonthEndDay + 1
  let start: Date
  if (startDay > prevMonthCalendarLast) {
    start = new Date(month.getFullYear(), month.getMonth(), 1)
  } else {
    start = new Date(month.getFullYear(), month.getMonth() - 1, startDay)
  }

  return { start, end }
}

/**
 * Days left in the current calendar/custom month (including today).
 *
 * @deprecated Prefer period utilities for billing-period logic spanning month boundary.
 */
export function getRemainingDaysInMonth(now: Date = new Date(), customMonthEndDay: number = 0): number {
  const lastDay = getEffectiveLastDayOfMonth(now, customMonthEndDay)
  const today = now.getDate()
  return Math.max(0, lastDay - today + 1)
}

/**
 * Days elapsed in the "month range" up to `asOf` (inclusive).
 * For custom month-end day, the elapsed count is within the computed month-range.
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

  const asOfTime = dateOnly(asOf).getTime()
  const startTime = dateOnly(start).getTime()
  const endTime = dateOnly(end).getTime()

  if (asOfTime < startTime) return 0
  if (asOfTime > endTime) return diffDaysInclusive(start, end)

  return diffDaysInclusive(start, asOf)
}

/** Average daily expense. Returns 0 if daysInRange <= 0. */
export function getAvgDailyExpense(totalExpense: number, daysInRange: number): number {
  if (daysInRange <= 0) return 0
  return totalExpense / daysInRange
}

/**
 * How many days the current balance can last at current avg daily expense.
 * - If avgDailyExpense <= 0: Infinity if balance >= 0 else 0
 */
export function getDaysLeft(currentBalance: number, avgDailyExpense: number): number {
  if (avgDailyExpense <= 0) return currentBalance >= 0 ? Infinity : 0
  return currentBalance / avgDailyExpense
}

/** Projected end-of-month balance: currentBalance - (avgDailyExpense × remainingDays). */
export function getProjectedEndOfMonthBalance(
  currentBalance: number,
  avgDailyExpense: number,
  remainingDays: number
): number {
  return currentBalance - avgDailyExpense * remainingDays
}

/**
 * Overall financial status for the month.
 * - Risk: projectedBalance < 0
 * - Healthy: projectedBalance > 0 and daysLeft >= remainingDays
 * - Warning: otherwise
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

/** Sum of expenses for a given date (YYYY-MM-DD). */
export function getTodayExpense(transactions: TransactionLike[], todayStr: string): number {
  return transactions
    .filter((t) => t.type === 'expense' && t.date === todayStr)
    .reduce((sum, t) => sum + Number(t.amount), 0)
}

/**
 * Sum of expenses per category within range (inclusive),
 * using date strings (YYYY-MM-DD) which are lexicographically sortable.
 */
export function computeSpentByCategory(transactions: TransactionLike[], range: DateRange): Record<string, number> {
  const startStr = formatDate(range.start)
  const endStr = formatDate(range.end)

  const out: Record<string, number> = {}

  transactions
    .filter(
      (t) =>
        t.type === 'expense' &&
        t.date >= startStr &&
        t.date <= endStr &&
        (t.category ?? '').trim() !== ''
    )
    .forEach((t) => {
      const cat = (t.category ?? '').trim()
      out[cat] = (out[cat] ?? 0) + Number(t.amount)
    })

  return out
}

/** remainingBudget[cat] = max(0, monthlyBudget[cat] - spent[cat]). */
export function computeRemainingBudgetByCategory(
  budgetMap: Record<string, number>,
  spentMap: Record<string, number>
): Record<string, number> {
  const out: Record<string, number> = {}
  const allCats = new Set([...Object.keys(budgetMap), ...Object.keys(spentMap)])

  allCats.forEach((cat) => {
    const budget = budgetMap[cat] ?? 0
    const spent = spentMap[cat] ?? 0
    out[cat] = Math.max(0, budget - spent)
  })

  return out
}

/**
 * Daily budget = sum(remaining for variable categories) / remainingDays.
 * Returns 0 if remainingDays <= 0.
 */
export function computeDailyBudgetFromRemaining(
  remainingBudgetMap: Record<string, number>,
  remainingDays: number,
  variableCategories: readonly string[]
): number {
  if (remainingDays <= 0) return 0

  const variableSet = new Set(variableCategories)
  let total = 0
  variableSet.forEach((cat) => {
    total += remainingBudgetMap[cat] ?? 0
  })

  return total / remainingDays
}

export type DailyBudgetBreakdownItem = {
  category: string
  monthlyBudget: number
  spentToDate: number
  remainingBudget: number
}

/** Breakdown for variable categories: monthlyBudget, spentToDate, remainingBudget (for UI). */
export function getDailyBudgetBreakdown(
  budgetMap: Record<string, number>,
  spentMap: Record<string, number>,
  variableCategories: readonly string[]
): DailyBudgetBreakdownItem[] {
  const remaining = computeRemainingBudgetByCategory(budgetMap, spentMap)
  return variableCategories.map((cat) => ({
    category: cat,
    monthlyBudget: budgetMap[cat] ?? 0,
    spentToDate: spentMap[cat] ?? 0,
    remainingBudget: remaining[cat] ?? 0,
  }))
}

/**
 * Number of distinct days in [startDate..endDate] that have at least one expense transaction.
 * Useful when you want avg expense on "active spend days".
 */
export function getDaysWithExpense(transactions: TransactionLike[], startDate: Date, endDate: Date): number {
  const set = new Set<string>()
  const start = dateOnly(startDate).getTime()
  const end = dateOnly(endDate).getTime()

  transactions
    .filter((t) => t.type === 'expense')
    .forEach((t) => {
      const tDate = dateOnly(new Date(t.date)).getTime()
      if (!Number.isNaN(tDate) && tDate >= start && tDate <= end) set.add(t.date)
    })

  return set.size
}

/** Top N expense categories by total amount, with percentage of total expense. */
export function getTopExpenseCategories(transactions: TransactionLike[], limit: number): CategorySummary[] {
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

/** Biggest expenses (by amount) from the given list. */
export function getRecentBigExpenses(
  transactions: TransactionLike[],
  limit: number
): { date: string; category: string; amount: number }[] {
  return transactions
    .filter((t) => t.type === 'expense')
    .map((t) => ({
      date: t.date,
      category: t.category?.trim() || 'ไม่ระบุหมวด',
      amount: Number(t.amount),
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit)
}

/** Percent difference: (today - avg) / avg. Returns 0 if avgDailyExpense <= 0. */
export function getTodayVsAvgPercent(todayExpense: number, avgDailyExpense: number): number {
  if (avgDailyExpense <= 0) return 0
  return ((todayExpense - avgDailyExpense) / avgDailyExpense) * 100
}

function dateOnly(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function diffDaysInclusive(from: Date, to: Date): number {
  const t1 = dateOnly(from).getTime()
  const t2 = dateOnly(to).getTime()
  return Math.round((t2 - t1) / (24 * 60 * 60 * 1000)) + 1
}

function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
