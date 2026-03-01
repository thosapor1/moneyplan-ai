/**
 * Application: Savings Goal Service
 *
 * Orchestrates domain functions and adds presentation-ready formatting
 * (estimated goal date via addMonths from date-fns).
 *
 * Clean Architecture rules:
 * - No Supabase / localStorage calls.
 * - Pure: all dependencies arrive as parameters.
 * - Depends only on src/domain/savings/savings-goal.
 */

import { addMonths } from 'date-fns'
import {
  calculateGoalProjection,
  calculateRequiredContribution,
  calculateGoalHealth,
  type GoalProjectionSuccess,
  type GoalHealthResult,
} from '../../domain/savings/savings-goal'

// ─── Date helpers ──────────────────────────────────────────────────────────────

/**
 * Full Thai month names (CE year — matches the rest of the app).
 * addMonths handles February 28/29 and month-end edge cases.
 */
const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
]

function formatGoalDate(baseDate: Date, months: number): string {
  const d = addMonths(baseDate, months)
  return `${THAI_MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

// ─── Shared summary shape ─────────────────────────────────────────────────────

export type GoalSummary = {
  monthsToGoal: number
  /** Thai month + CE year, e.g. "พฤษภาคม 2027" */
  estimatedGoalDate: string
  totalContribution: number
  totalInterestEarned: number
  schedule: GoalProjectionSuccess['schedule']
}

// ─── Mode 1: Goal projection ──────────────────────────────────────────────────

export type GoalProjectionServiceResult =
  | ({ ok: true } & GoalSummary)
  | { ok: false; error: string }

/**
 * Given a fixed monthly contribution, compute how long to reach the goal.
 *
 * @param currentAmount       Starting balance (฿).
 * @param targetAmount        Goal amount (฿).
 * @param monthlyContribution Monthly saving amount (฿).
 * @param annualInterestRate  Annual interest rate in % (e.g. 2.5). May be 0.
 * @param baseDate            Reference date for estimated goal date (default: today).
 */
export function computeGoalProjection(
  currentAmount: number,
  targetAmount: number,
  monthlyContribution: number,
  annualInterestRate: number,
  baseDate: Date = new Date(),
): GoalProjectionServiceResult {
  const result = calculateGoalProjection(currentAmount, targetAmount, monthlyContribution, annualInterestRate)
  if (!result.ok) return { ok: false, error: result.message }

  return {
    ok: true,
    monthsToGoal: result.monthsToGoal,
    estimatedGoalDate: formatGoalDate(baseDate, result.monthsToGoal),
    totalContribution: result.totalContribution,
    totalInterestEarned: result.totalInterestEarned,
    schedule: result.schedule,
  }
}

// ─── Mode 2: Required contribution ───────────────────────────────────────────

export type RequiredContributionServiceResult =
  | ({ ok: true; requiredMonthlyContribution: number } & GoalSummary)
  | { ok: false; error: string }

/**
 * Given a target deadline, compute the minimum monthly contribution needed.
 *
 * @param currentAmount      Starting balance (฿).
 * @param targetAmount       Goal amount (฿).
 * @param annualInterestRate Annual interest rate in % (e.g. 2.5). May be 0.
 * @param targetMonths       Desired months to reach goal.
 * @param baseDate           Reference date for estimated goal date (default: today).
 */
export function computeRequiredSavingContribution(
  currentAmount: number,
  targetAmount: number,
  annualInterestRate: number,
  targetMonths: number,
  baseDate: Date = new Date(),
): RequiredContributionServiceResult {
  const result = calculateRequiredContribution(currentAmount, targetAmount, annualInterestRate, targetMonths)
  if (!result.ok) return { ok: false, error: result.message }

  return {
    ok: true,
    requiredMonthlyContribution: result.requiredMonthlyContribution,
    monthsToGoal: result.simulation.monthsToGoal,
    estimatedGoalDate: formatGoalDate(baseDate, result.simulation.monthsToGoal),
    totalContribution: result.simulation.totalContribution,
    totalInterestEarned: result.simulation.totalInterestEarned,
    schedule: result.simulation.schedule,
  }
}

// ─── Goal health (re-export — no date needed) ─────────────────────────────────

export { calculateGoalHealth }
export type { GoalHealthResult }
