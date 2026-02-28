/**
 * Infrastructure: localStorage-based settings
 *
 * Purpose:
 * - Keep browser storage (localStorage) access out of domain/application layers.
 * - Provide a small, well-typed API for user preferences stored locally.
 *
 * Notes for junior devs:
 * - This module MUST only be used in the browser. On the server (SSR), `window`
 *   and `localStorage` do not exist.
 * - All functions here are defensive: they never throw; they fall back to safe defaults.
 */

/** localStorage key: selected categories visible in Transactions page. Empty = show all. */
export const VISIBLE_CATEGORIES_KEY = 'moneyplan_visible_categories'

/** localStorage key: custom month end day (0 = calendar month, 1..31 = custom day). */
export const MONTH_END_DAY_KEY = 'moneyplan_month_end_day'

/**
 * Expense categories used across the app.
 * (Used for UI filters, budgets, and transaction categorization.)
 */
export const EXPENSE_CATEGORIES = [
  'อาหาร',
  'เดินทาง',
  'ช้อปปิ้ง',
  'บิล/ค่าใช้จ่าย',
  'สุขภาพ',
  'บันเทิง',
  'การศึกษา',
  'ผ่อนชำระหนี้',
  'ออมเงิน',
  'ลงทุน',
  'อื่นๆ',
] as const

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined'
}

/**
 * Read visible categories from localStorage.
 * - Returns [] when not set or invalid.
 * - [] means "show all categories" (current app behavior).
 */
export function getVisibleCategories(): string[] {
  if (!isBrowser()) return []
  try {
    const raw = localStorage.getItem(VISIBLE_CATEGORIES_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((c): c is string => typeof c === 'string')
  } catch {
    return []
  }
}

/**
 * Persist visible categories to localStorage.
 * - Pass [] to mean "show all".
 */
export function setVisibleCategories(categories: string[]): void {
  if (!isBrowser()) return
  try {
    localStorage.setItem(VISIBLE_CATEGORIES_KEY, JSON.stringify(categories))
  } catch (e) {
    console.error('setVisibleCategories:', e)
  }
}

/**
 * Read custom month end day from localStorage.
 * - Returns 0 (calendar month) if not set/invalid or SSR.
 * - Valid range: 0..31
 */
export function getMonthEndDay(): number {
  if (!isBrowser()) return 0
  try {
    const raw = localStorage.getItem(MONTH_END_DAY_KEY)
    if (raw == null || raw === '') return 0
    const n = Number.parseInt(raw, 10)
    if (Number.isNaN(n) || n < 0 || n > 31) return 0
    return n
  } catch {
    return 0
  }
}

/**
 * Persist custom month end day to localStorage.
 * - 0 = calendar month
 * - 1..31 = custom month end day
 */
export function setMonthEndDay(day: number): void {
  if (!isBrowser()) return
  try {
    const v = clampInt(day, 0, 31)
    localStorage.setItem(MONTH_END_DAY_KEY, String(v))
  } catch (e) {
    console.error('setMonthEndDay:', e)
  }
}

function clampInt(value: number, min: number, max: number): number {
  const n = Math.floor(Number(value))
  if (Number.isNaN(n)) return min
  return Math.max(min, Math.min(max, n))
}
