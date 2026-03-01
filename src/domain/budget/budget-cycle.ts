/**
 * Domain: Budget Cycle
 *
 * A "budget cycle" is a named billing period anchored to the user's salary day.
 * Example: salaryDay = 27 → cycle runs [27 Jan → 26 Feb], [27 Feb → 26 Mar], etc.
 *
 * Design principles:
 * - ALL date arithmetic is delegated to `src/domain/period/period.ts` — zero duplication.
 * - `salaryDay` (this module) and `monthEndDay` (period module) are the same concept;
 *   "salaryDay" is the domain-level name that expresses intent clearly.
 * - Pure: no I/O, no browser APIs, safe for unit tests.
 *
 * Edge cases handled by the period module (not here):
 * - salaryDay = 31 in a 28-day month → clamped to Feb 28/29.
 * - salaryDay = 0 → calendar month (1st to last day).
 */

import {
  getActiveMonthRange,
  getRemainingDaysInPeriod,
  getPeriodDays,
  type DateRange,
} from '../period/period'

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Salary / income configuration.
 * Maps 1:1 to `month_end_day` in the `profiles` DB table and
 * `getMonthEndDay()` in local-settings.ts — same concept, semantic alias.
 */
export type SalaryConfig = {
  /**
   * Day of month the salary arrives (1–31).
   * 0 = calendar month (no custom cycle).
   */
  salaryDay: number
}

/**
 * A single budget cycle (salary-to-salary period).
 * Cycles are COMPUTED, never stored in the DB.
 * The DB only stores the `salaryDay`; cycle boundaries are derived at runtime.
 */
export type BudgetCycle = {
  /** Period start (inclusive) — the salary day that opened this cycle. */
  startDate: Date
  /** Period end (inclusive) — the day before next salary. */
  endDate: Date
  /** Sum of all category budgets for this cycle (฿). */
  totalBudget: number
  /** totalBudget − spent + effectiveCarryForward. May be negative. */
  remainingBudget: number
  /** Whether carry-forward from the previous cycle is active. */
  carryForwardEnabled: boolean
}

// ─── Core computation ────────────────────────────────────────────────────────

/**
 * Build the BudgetCycle that contains `today`.
 * Delegates cycle boundary math entirely to the period module.
 */
export function calculateCurrentCycle(
  today: Date,
  config: SalaryConfig,
  totalBudget: number,
  remainingBudget: number,
  carryForwardEnabled: boolean,
): BudgetCycle {
  const range: DateRange = getActiveMonthRange(today, config.salaryDay)
  return {
    startDate: range.start,
    endDate: range.end,
    totalBudget,
    remainingBudget,
    carryForwardEnabled,
  }
}

/**
 * Days remaining from `today` to cycle end (inclusive of today).
 * Returns 0 if today is outside the cycle.
 */
export function calculateRemainingDays(
  cycle: Pick<BudgetCycle, 'startDate' | 'endDate'>,
  today: Date,
): number {
  return getRemainingDaysInPeriod(today, { start: cycle.startDate, end: cycle.endDate })
}

/** Total calendar days in this cycle (e.g., 28 for 27 Feb – 26 Mar). */
export function calculateCycleDays(cycle: Pick<BudgetCycle, 'startDate' | 'endDate'>): number {
  return getPeriodDays({ start: cycle.startDate, end: cycle.endDate })
}

/**
 * Safe-to-spend per day: spreads remainingBudget evenly over remainingDays.
 * Returns 0 when remainingDays ≤ 0 or remainingBudget ≤ 0 (no negative daily budget).
 */
export function calculateDailySafeSpend(remainingBudget: number, remainingDays: number): number {
  if (remainingDays <= 0 || remainingBudget <= 0) return 0
  return remainingBudget / remainingDays
}

// ─── Formatting ───────────────────────────────────────────────────────────────

const THAI_SHORT_MONTHS = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
]

const EN_SHORT_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

/**
 * Thai cycle label.
 * Output: "27 ก.พ. – 26 มี.ค."
 * Use this everywhere instead of "มีนาคม" or "March Budget".
 */
export function formatCycleLabel(cycle: Pick<BudgetCycle, 'startDate' | 'endDate'>): string {
  const s = cycle.startDate
  const e = cycle.endDate
  return `${s.getDate()} ${THAI_SHORT_MONTHS[s.getMonth()]} – ${e.getDate()} ${THAI_SHORT_MONTHS[e.getMonth()]}`
}

/**
 * English cycle label.
 * Output: "27 Feb – 26 Mar"
 */
export function formatCycleLabelEN(cycle: Pick<BudgetCycle, 'startDate' | 'endDate'>): string {
  const s = cycle.startDate
  const e = cycle.endDate
  return `${s.getDate()} ${EN_SHORT_MONTHS[s.getMonth()]} – ${e.getDate()} ${EN_SHORT_MONTHS[e.getMonth()]}`
}
