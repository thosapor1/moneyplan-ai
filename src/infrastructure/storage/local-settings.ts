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

/** localStorage key: include carried-over balance from previous month in dashboard. true = include (default). */
export const INCLUDE_CARRIED_OVER_KEY = 'moneyplan_include_carried_over'

/**
 * Expense categories used across the app.
 * (Used for UI filters, budgets, and transaction categorization.)
 */
export const EXPENSE_CATEGORIES = [
  'ค่าอาหาร',
  'ค่าเดินทาง',
  'ช้อปปิ้ง',
  'บิล/ค่าใช้จ่าย',
  'ค่าสุขภาพ',
  'ค่าบันเทิง',
  'ค่าการศึกษา',
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

/**
 * Read "include carried over balance" from localStorage.
 * - Returns true if not set (default: include carried over).
 */
export function getIncludeCarriedOver(): boolean {
  if (!isBrowser()) return true
  try {
    const raw = localStorage.getItem(INCLUDE_CARRIED_OVER_KEY)
    if (raw == null || raw === '') return true
    return raw === 'true'
  } catch {
    return true
  }
}

/**
 * Persist "include carried over balance" preference.
 */
export function setIncludeCarriedOver(value: boolean): void {
  if (!isBrowser()) return
  try {
    localStorage.setItem(INCLUDE_CARRIED_OVER_KEY, String(value))
  } catch (e) {
    console.error('setIncludeCarriedOver:', e)
  }
}

function clampInt(value: number, min: number, max: number): number {
  const n = Math.floor(Number(value))
  if (Number.isNaN(n)) return min
  return Math.max(min, Math.min(max, n))
}

// ─── Salary Day (domain alias for month_end_day) ──────────────────────────────
//
// "salaryDay" is the domain-level name used in src/domain/budget/budget-cycle.ts.
// "monthEndDay" is the storage-level name (localStorage key + DB column name).
// They represent the same concept — these are thin aliases so callers can use
// the semantically correct name without touching storage keys.

/**
 * Read the salary day (= custom month-end day).
 * Alias for getMonthEndDay() with the domain-level name.
 * - Returns 0 when not set (calendar month, no custom cycle).
 * - Valid range: 0–31.
 */
export function getSalaryDay(): number {
  return getMonthEndDay()
}

/**
 * Persist the salary day (= custom month-end day).
 * Alias for setMonthEndDay() with the domain-level name.
 * - 0 = calendar month.
 * - 1–31 = salary/billing cycle start day.
 */
export function setSalaryDay(day: number): void {
  setMonthEndDay(day)
}
