/**
 * Domain: Forecast
 *
 * Monthly balance forecast — fixed vs variable expense logic.
 *
 * Goals (junior-friendly):
 * - Keep all calculations pure and deterministic (no I/O, no browser APIs).
 * - Make category classification explicit and testable.
 * - Work with simple `TransactionLike` input to avoid coupling to infrastructure types.
 *
 * Terminology:
 * - "Fixed expenses"   = expenses that typically happen on specific day-of-month (rent, utilities, debt payment, etc.)
 * - "Variable expenses"= daily spending categories (food, travel, shopping, etc.)
 *
 * This module intentionally does NOT know about:
 * - Supabase schema
 * - IndexedDB/offline storage
 * - UI state
 */

export const FIXED_EXPENSE_CATEGORIES = [
  'บิล/ค่าใช้จ่าย',
  'ผ่อนชำระหนี้',
  'ออมเงิน',
  'ลงทุน',
] as const

export const VARIABLE_EXPENSE_CATEGORIES = [
  'อาหาร',
  'เดินทาง',
  'ช้อปปิ้ง',
  'สุขภาพ',
  'บันเทิง',
  'การศึกษา',
  'อื่นๆ',
] as const

export type FixedCategory = (typeof FIXED_EXPENSE_CATEGORIES)[number]
export type VariableCategory = (typeof VARIABLE_EXPENSE_CATEGORIES)[number]

const FIXED_SET = new Set<string>(FIXED_EXPENSE_CATEGORIES)
const VARIABLE_SET = new Set<string>(VARIABLE_EXPENSE_CATEGORIES)

/**
 * Maps legacy category names to current canonical names.
 * Keeps forecast module in sync with finance module aliases.
 */
const CATEGORY_ALIASES: Record<string, string> = {
  'ค่าเดินทาง': 'เดินทาง',
  'ที่พัก/ค่าเช่า': 'บิล/ค่าใช้จ่าย',
  'สาธารณูปโภค': 'บิล/ค่าใช้จ่าย',
  'โทรศัพท์/อินเทอร์เน็ต': 'บิล/ค่าใช้จ่าย',
}

function normalizeCat(cat: string): string {
  const trimmed = (cat ?? '').trim()
  return CATEGORY_ALIASES[trimmed] ?? trimmed
}

/**
 * Minimal transaction shape required by this domain module.
 * - `date` must be `YYYY-MM-DD` (lexicographically sortable)
 */
export type TransactionLike = {
  type: 'income' | 'expense'
  amount: number
  category?: string
  date: string
}

/** Returns 'fixed' | 'variable' for expense categories; null for income/unknown. */
export function getExpenseCategoryType(category: string): 'fixed' | 'variable' | null {
  const cat = (category ?? '').trim()
  if (FIXED_SET.has(cat)) return 'fixed'
  if (VARIABLE_SET.has(cat)) return 'variable'
  return null
}

/** Median of array; if empty returns 0. */
export function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[mid]
  return (sorted[mid - 1] + sorted[mid]) / 2
}

/** Mean of array; if empty returns 0. */
function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((s, v) => s + v, 0) / values.length
}

function toDateOnly(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** Format date-only as `YYYY-MM-DD`. */
function toDateStr(d: Date): string {
  const dd = toDateOnly(d)
  const y = dd.getFullYear()
  const m = String(dd.getMonth() + 1).padStart(2, '0')
  const day = String(dd.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Parse an ISO-ish date string into a Date.
 * If invalid, returns epoch (Jan 1, 1970) which is safe for comparisons in our use cases.
 */
function parseDateStr(s: string): Date {
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? new Date(0) : d
}

/**
 * Variable daily rate:
 * - Compute daily total of VARIABLE expenses over last 14 days (inclusive).
 * - If we have at least 3 distinct days, use median (robust to spikes).
 * - Otherwise fall back to mean (or 0 if no values).
 */
export function computeVariableDailyRate(transactions: TransactionLike[], today: Date): number {
  const expenseOnly = transactions.filter(
    (t) => t.type === 'expense' && t.category != null && VARIABLE_SET.has(normalizeCat(t.category))
  )

  const end = toDateOnly(today)
  const start = new Date(end)
  start.setDate(start.getDate() - 13)

  const startStr = toDateStr(start)
  const endStr = toDateStr(end)

  const byDay = new Map<string, number>()
  expenseOnly.forEach((t) => {
    if (t.date >= startStr && t.date <= endStr) {
      byDay.set(t.date, (byDay.get(t.date) ?? 0) + Number(t.amount))
    }
  })

  const dailySums = Array.from(byDay.values())
  if (dailySums.length < 3) return mean(dailySums)
  return median(dailySums)
}

/**
 * Planned remaining fixed expenses in the period:
 * For each FIXED category:
 * - Look back up to 3 months to learn "typical amount" and "typical day-of-month".
 * - If the category has NOT been paid yet in this period (periodStart..today),
 *   and the typical day-of-month still exists ahead in (today..periodEnd),
 *   then count typicalAmount as "planned remaining".
 */
export function computePlannedRemaining(
  transactions: TransactionLike[],
  today: Date,
  periodStart: Date,
  periodEnd: Date
): number {
  const todayStr = toDateStr(today)
  const periodStartStr = toDateStr(periodStart)
  const periodEndStr = toDateStr(periodEnd)

  const threeMonthsAgo = new Date(toDateOnly(today))
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
  const threeMonthsAgoStr = toDateStr(threeMonthsAgo)

  let total = 0

  for (const cat of FIXED_EXPENSE_CATEGORIES) {
    const historical = transactions.filter(
      (t) =>
        t.type === 'expense' &&
        normalizeCat(t.category ?? '') === cat &&
        t.date >= threeMonthsAgoStr &&
        t.date <= todayStr
    )

    if (historical.length === 0) continue

    const amounts = historical.map((t) => Number(t.amount))
    const typicalAmount = median(amounts)

    const daysOfMonth = historical.map((t) => parseDateStr(t.date).getDate())
    const typicalDayOfMonth = Math.round(median(daysOfMonth))

    const paidThisPeriod = transactions.some(
      (t) =>
        t.type === 'expense' &&
        normalizeCat(t.category ?? '') === cat &&
        t.date >= periodStartStr &&
        t.date <= todayStr
    )
    if (paidThisPeriod) continue

    const typicalDayStillAhead = (() => {
      // Walk day-by-day from today..periodEnd to see if the typical day-of-month occurs.
      let d = toDateOnly(today)
      const end = toDateOnly(parseDateStr(periodEndStr))
      while (d.getTime() <= end.getTime()) {
        if (d.getDate() === typicalDayOfMonth) return true
        d.setDate(d.getDate() + 1)
      }
      return false
    })()

    if (typicalDayStillAhead) total += typicalAmount
  }

  return total
}

export type ForecastResult = {
  /** Forecasted balance at the end of the period. */
  forecastEnd: number
  /** Variable spend per day (บาท/วัน). */
  variableDailyRate: number
  /** Remaining planned fixed expenses (บาท). */
  plannedRemaining: number
  /** Forecasted variable spend for remaining days (บาท). */
  forecastVariableSpend: number
}

/**
 * Forecast formula:
 * forecastEnd = currentBalance - plannedRemaining - (variableDailyRate * daysRemaining)
 */
export function computeForecastEnd(
  currentBalance: number,
  variableDailyRate: number,
  plannedRemaining: number,
  daysRemaining: number
): ForecastResult {
  const forecastVariableSpend = variableDailyRate * daysRemaining
  const forecastEnd = currentBalance - plannedRemaining - forecastVariableSpend

  return {
    forecastEnd,
    variableDailyRate,
    plannedRemaining,
    forecastVariableSpend,
  }
}
