/**
 * Application: Debt Payoff Service
 *
 * Orchestrates domain functions and adds presentation-ready formatting.
 * The only I/O concern here is date arithmetic (addMonths from date-fns).
 *
 * Clean Architecture rules enforced:
 * - No Supabase / localStorage calls.
 * - Pure: all dependencies arrive as parameters.
 * - Depends only on src/domain/debt/debt-payoff.
 */

import { addMonths } from 'date-fns'
import {
  calculateAmortization,
  calculateRequiredPayment,
  type AmortizationRow,
  type DebtPayoffSuccess,
} from '../../domain/debt/debt-payoff'

// ─── Date helpers ──────────────────────────────────────────────────────────────

/**
 * Full Thai month names (CE year, matching the rest of the app).
 * addMonths handles February 28/29 and month-end edge cases correctly.
 */
const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
]

function formatPayoffDate(baseDate: Date, months: number): string {
  const d = addMonths(baseDate, months)
  return `${THAI_MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

// ─── Shared summary shape ─────────────────────────────────────────────────────

export type DebtPayoffSummary = {
  monthsToPayoff: number
  /** Thai month + CE year, e.g. "มิถุนายน 2028" */
  estimatedPayoffDate: string
  totalInterestPaid: number
  totalAmountPaid: number
  schedule: AmortizationRow[]
}

// ─── Mode 1: Calculate payoff duration ────────────────────────────────────────

export type DebtDurationResult =
  | ({ ok: true } & DebtPayoffSummary)
  | { ok: false; error: string }

/**
 * Given a fixed monthly payment, compute how long until the debt is paid off.
 *
 * @param principal          Remaining balance (฿).
 * @param annualInterestRate Annual rate in % (e.g. 17).
 * @param monthlyPayment     Scheduled payment per month (฿).
 * @param baseDate           Reference date for payoff date calculation (default: today).
 */
export function computeDebtPayoffDuration(
  principal: number,
  annualInterestRate: number,
  monthlyPayment: number,
  baseDate: Date = new Date(),
): DebtDurationResult {
  const result = calculateAmortization(principal, annualInterestRate, monthlyPayment)
  if (!result.ok) return { ok: false, error: result.message }

  return {
    ok: true,
    monthsToPayoff: result.monthsToPayoff,
    estimatedPayoffDate: formatPayoffDate(baseDate, result.monthsToPayoff),
    totalInterestPaid: result.totalInterestPaid,
    totalAmountPaid: result.totalAmountPaid,
    schedule: result.schedule,
  }
}

// ─── Mode 2: Calculate required payment ───────────────────────────────────────

export type DebtRequiredPaymentResult =
  | ({ ok: true; requiredMonthlyPayment: number } & DebtPayoffSummary)
  | { ok: false; error: string }

/**
 * Given a target payoff duration (months), compute the minimum monthly payment.
 *
 * @param principal          Remaining balance (฿).
 * @param annualInterestRate Annual rate in % (e.g. 17).
 * @param targetMonths       Desired payoff duration in months.
 * @param baseDate           Reference date for payoff date calculation (default: today).
 */
export function computeRequiredMonthlyPayment(
  principal: number,
  annualInterestRate: number,
  targetMonths: number,
  baseDate: Date = new Date(),
): DebtRequiredPaymentResult {
  const result = calculateRequiredPayment(principal, annualInterestRate, targetMonths)
  if (!result.ok) return { ok: false, error: result.message }

  const { requiredMonthlyPayment, simulation } = result
  return {
    ok: true,
    requiredMonthlyPayment,
    monthsToPayoff: simulation.monthsToPayoff,
    estimatedPayoffDate: formatPayoffDate(baseDate, simulation.monthsToPayoff),
    totalInterestPaid: simulation.totalInterestPaid,
    totalAmountPaid: simulation.totalAmountPaid,
    schedule: simulation.schedule,
  }
}
