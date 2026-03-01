/**
 * Application: Budget Service
 *
 * Orchestrates all budget-cycle metrics from raw inputs.
 *
 * Clean Architecture rules (enforced here):
 * - NO I/O: no Supabase calls, no localStorage reads, no fetch.
 * - Pure computation: every dependency arrives as a function parameter.
 * - Depends only on domain modules (period, finance, forecast, budget-cycle).
 *
 * The caller (page component / hook) is responsible for:
 * 1. Loading transactions from Supabase / IndexedDB.
 * 2. Loading category budgets.
 * 3. Computing carry-forward from previous cycle.
 * 4. Passing everything into `computeBudgetCycleResult`.
 */

import { getActiveMonthRange } from '../../domain/period/period'
import {
  type TransactionLike,
  computeSpentByCategory,
} from '../../domain/finance/finance'
import {
  computeVariableDailyRate,
  computePlannedRemaining,
  computeForecastEnd,
  type ForecastResult,
} from '../../domain/forecast/forecast'
import {
  type BudgetCycle,
  type SalaryConfig,
  calculateRemainingDays,
  calculateDailySafeSpend,
  formatCycleLabel,
  formatCycleLabelEN,
} from '../../domain/budget/budget-cycle'

// ─── Input / Output types ─────────────────────────────────────────────────────

export type BudgetServiceInput = {
  /** Current date. Injectable so this function is deterministic in tests. */
  today: Date
  /** Salary cycle configuration (salaryDay maps to month_end_day in DB). */
  salaryConfig: SalaryConfig
  /** Per-category budget allocation for the cycle (category name → ฿). */
  budgetMap: Record<string, number>
  /**
   * ALL user transactions (not pre-filtered by date).
   * This service filters to the cycle window internally.
   * Passing all transactions also enables the 14-day variable-rate window
   * in the forecast module to cross cycle boundaries correctly.
   */
  transactions: TransactionLike[]
  /** Whether the carry-forward amount should be added to the balance. */
  carryForwardEnabled: boolean
  /**
   * Carry-forward balance from the previous cycle.
   * Positive = surplus carried in (adds to buying power).
   * Negative = deficit carried in (reduces buying power).
   * Pass 0 when not applicable.
   */
  carryForwardAmount: number
}

export type BudgetCycleResult = {
  /** The resolved cycle (dates + budget metadata). */
  cycle: BudgetCycle
  /** Thai label: "27 ก.พ. – 26 มี.ค." — use this, NOT "มีนาคม". */
  cycleLabel: string
  /** English label: "27 Feb – 26 Mar" */
  cycleLabelEN: string
  /** Days left in cycle, inclusive of today. 0 on the last day = last day still counts. */
  daysLeft: number
  /** Total expense transactions inside this cycle (฿). */
  spent: number
  /** cycleIncome − cycleExpense + effectiveCarryForward (฿). */
  currentBalance: number
  /** remainingBudget ÷ daysLeft (฿/day). 0 when budget is exhausted or cycle ended. */
  dailySafeSpend: number
  /** Forecast result for end-of-cycle balance using variable + planned fixed spend. */
  forecast: ForecastResult
  /** Per-category expense totals for this cycle (for breakdown UI). */
  spentByCategory: Record<string, number>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// ─── Main computation ─────────────────────────────────────────────────────────

/**
 * Compute all budget-cycle metrics from raw inputs.
 *
 * This is a pure function — invoke it AFTER all I/O (DB loads) has completed.
 *
 * @example
 * ```ts
 * const result = computeBudgetCycleResult({
 *   today: new Date(),
 *   salaryConfig: { salaryDay: 27 },
 *   budgetMap: { อาหาร: 5000, เดินทาง: 2000 },
 *   transactions: allTransactions,
 *   carryForwardEnabled: true,
 *   carryForwardAmount: 1500,   // from previous cycle
 * })
 * // result.cycleLabel  → "27 ก.พ. – 26 มี.ค."
 * // result.daysLeft    → 14
 * // result.dailySafeSpend → 285.71
 * ```
 */
export function computeBudgetCycleResult(input: BudgetServiceInput): BudgetCycleResult {
  const {
    today,
    salaryConfig,
    budgetMap,
    transactions,
    carryForwardEnabled,
    carryForwardAmount,
  } = input

  // ── 1. Resolve cycle date window ─────────────────────────────────────────
  // Period module handles all edge cases: Feb 28/29, salaryDay=31, etc.
  const cycleRange = getActiveMonthRange(today, salaryConfig.salaryDay)
  const cycleStartStr = toDateStr(cycleRange.start)
  const cycleEndStr = toDateStr(cycleRange.end)

  // ── 2. Filter transactions inside this cycle ──────────────────────────────
  const cycleTx = transactions.filter(
    (t) => t.date >= cycleStartStr && t.date <= cycleEndStr,
  )

  // ── 3. Income & expense totals for the cycle ──────────────────────────────
  const cycleIncome = cycleTx
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + Number(t.amount), 0)

  const cycleExpense = cycleTx
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + Number(t.amount), 0)

  // ── 4. Per-category spending breakdown ───────────────────────────────────
  // Uses the full transaction list but scoped to cycleRange internally.
  const spentByCategory = computeSpentByCategory(transactions, cycleRange)

  // ── 5. Budget totals ──────────────────────────────────────────────────────
  const totalBudget = Object.values(budgetMap).reduce((sum, v) => sum + v, 0)
  const effectiveCarryForward = carryForwardEnabled ? carryForwardAmount : 0
  // remainingBudget = unspent allocation + carry-forward surplus/deficit
  const remainingBudget = totalBudget - cycleExpense + effectiveCarryForward

  // ── 6. Days remaining (inclusive of today) ────────────────────────────────
  const daysLeft = calculateRemainingDays(
    { startDate: cycleRange.start, endDate: cycleRange.end },
    today,
  )

  // ── 7. Daily safe spend ───────────────────────────────────────────────────
  const dailySafeSpend = calculateDailySafeSpend(remainingBudget, daysLeft)

  // ── 8. Actual balance (cash position) ────────────────────────────────────
  const currentBalance = cycleIncome - cycleExpense + effectiveCarryForward

  // ── 9. End-of-cycle forecast ──────────────────────────────────────────────
  // Variable daily rate uses last 14 days across all transactions (may span cycles).
  // Planned remaining is anchored to the CURRENT CYCLE window — not calendar month.
  const variableDailyRate = computeVariableDailyRate(transactions, today)
  const plannedRemaining = computePlannedRemaining(
    transactions,
    today,
    cycleRange.start,
    cycleRange.end,
  )
  const forecast = computeForecastEnd(currentBalance, variableDailyRate, plannedRemaining, daysLeft)

  // ── 10. Assemble BudgetCycle value object ─────────────────────────────────
  const cycle: BudgetCycle = {
    startDate: cycleRange.start,
    endDate: cycleRange.end,
    totalBudget,
    remainingBudget,
    carryForwardEnabled,
  }

  return {
    cycle,
    cycleLabel: formatCycleLabel(cycle),
    cycleLabelEN: formatCycleLabelEN(cycle),
    daysLeft,
    spent: cycleExpense,
    currentBalance,
    dailySafeSpend,
    forecast,
    spentByCategory,
  }
}
