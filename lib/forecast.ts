/**
 * Monthly balance forecast — fixed vs variable expense logic.
 * Pure TypeScript utilities; no side effects.
 */

export const FIXED_EXPENSE_CATEGORIES = [
  'ที่พัก/ค่าเช่า',
  'สาธารณูปโภค',
  'โทรศัพท์/อินเทอร์เน็ต',
  'ผ่อนชำระหนี้',
  'ออมเงิน',
  'ลงทุน',
] as const

export const VARIABLE_EXPENSE_CATEGORIES = [
  'อาหาร',
  'ค่าเดินทาง',
  'สุขภาพ',
  'บันเทิง',
  'การศึกษา',
  'ช้อปปิ้ง',
  'อื่นๆ',
] as const

export type FixedCategory = (typeof FIXED_EXPENSE_CATEGORIES)[number]
export type VariableCategory = (typeof VARIABLE_EXPENSE_CATEGORIES)[number]

const FIXED_SET = new Set<string>(FIXED_EXPENSE_CATEGORIES)
const VARIABLE_SET = new Set<string>(VARIABLE_EXPENSE_CATEGORIES)

/** Returns 'fixed' | 'variable' for expense categories; null for income/unknown. */
export function getExpenseCategoryType(category: string): 'fixed' | 'variable' | null {
  const cat = (category ?? '').trim()
  if (FIXED_SET.has(cat)) return 'fixed'
  if (VARIABLE_SET.has(cat)) return 'variable'
  return null
}

export type TransactionLike = {
  type: 'income' | 'expense'
  amount: number
  category?: string
  date: string
}

/** Median of array; if empty returns 0 */
export function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[mid]
  return (sorted[mid - 1] + sorted[mid]) / 2
}

/** Mean of array; if empty returns 0 */
function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((s, v) => s + v, 0) / values.length
}

function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseDateStr(s: string): Date {
  const d = new Date(s)
  return isNaN(d.getTime()) ? new Date(0) : d
}

/** Variable daily rate: median of daily variable expense over last 14 days; fallback to mean if < 3 days. */
export function computeVariableDailyRate(
  transactions: TransactionLike[],
  today: Date
): number {
  const expenseOnly = transactions.filter(
    (t) => t.type === 'expense' && t.category != null && VARIABLE_SET.has(t.category.trim())
  )
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const start = new Date(end)
  start.setDate(start.getDate() - 13)
  const startStr = toDateStr(start)
  const endStr = toDateStr(end)

  const byDay = new Map<string, number>()
  expenseOnly.forEach((t) => {
    if (t.date >= startStr && t.date <= endStr) {
      const cur = byDay.get(t.date) ?? 0
      byDay.set(t.date, cur + Number(t.amount))
    }
  })
  const dailySums = Array.from(byDay.values())
  if (dailySums.length < 3) return mean(dailySums)
  return median(dailySums)
}

/** Planned remaining fixed expenses in the period: typical amounts for fixed categories not yet paid, when typical day is still ahead. */
export function computePlannedRemaining(
  transactions: TransactionLike[],
  today: Date,
  periodStart: Date,
  periodEnd: Date
): number {
  const todayStr = toDateStr(today)
  const periodStartStr = toDateStr(periodStart)
  const periodEndStr = toDateStr(periodEnd)

  const threeMonthsAgo = new Date(today)
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
  const threeMonthsAgoStr = toDateStr(threeMonthsAgo)

  let total = 0
  for (const cat of FIXED_EXPENSE_CATEGORIES) {
    const inRange = transactions.filter(
      (t) =>
        t.type === 'expense' &&
        (t.category?.trim() ?? '') === cat &&
        t.date >= threeMonthsAgoStr &&
        t.date <= todayStr
    )
    if (inRange.length === 0) continue

    const amounts = inRange.map((t) => Number(t.amount))
    const typicalAmount = median(amounts)
    const daysOfMonth = inRange.map((t) => parseDateStr(t.date).getDate())
    const typicalDayOfMonth = Math.round(median(daysOfMonth))

    const paidThisPeriod = transactions.some(
      (t) =>
        t.type === 'expense' &&
        (t.category?.trim() ?? '') === cat &&
        t.date >= periodStartStr &&
        t.date <= todayStr
    )
    if (paidThisPeriod) continue

    const typicalDayStillAhead = (() => {
      let d = new Date(today.getFullYear(), today.getMonth(), today.getDate())
      const end = parseDateStr(periodEndStr)
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
  forecastEnd: number
  variableDailyRate: number
  plannedRemaining: number
  forecastVariableSpend: number
}

/**
 * New forecast formula:
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
