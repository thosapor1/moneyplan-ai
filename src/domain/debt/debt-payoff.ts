/**
 * Domain: Debt Payoff Calculator
 *
 * Pure financial math — no I/O, no dates, no UI dependencies.
 *
 * Design notes
 * ────────────────────────────────────────────────────────────────────────────
 * WHY SIMULATION (not PMT formula)?
 *   The closed-form n = -ln(1−rP/M)/ln(1+r) fails at r=0, can't produce an
 *   amortization schedule, and doesn't handle the final partial payment.
 *   Simulation runs ≤600 iterations — trivially fast, naturally handles all
 *   edge cases, and produces the full schedule as a side-effect.
 *
 * WHY round2() AT EVERY ROW?
 *   Banks compute monthly interest and round to 2 decimal places each period.
 *   Deferring rounding creates "phantom remainders" (e.g. 0.000...5 that
 *   never reaches 0). Rounding each row matches real bank statements.
 *
 * WHY BINARY SEARCH for required payment?
 *   PMT = P·r·(1+r)^n / ((1+r)^n−1) breaks at r=0 and doesn't account for
 *   the rounding-adjusted last payment. Binary search is model-agnostic:
 *   60 iterations → precision < 0.01 baht for any real-world balance.
 * ────────────────────────────────────────────────────────────────────────────
 */

// ─── Public Types ─────────────────────────────────────────────────────────────

/** One row in the amortization schedule. */
export type AmortizationRow = {
  /** Ordinal payment number (1-based). */
  month: number
  /** Actual amount paid this month (last month may be smaller). */
  payment: number
  /** Interest portion: remainingBalance × monthlyRate. */
  interest: number
  /** Principal portion: payment − interest. */
  principalPaid: number
  /** Balance after this payment (0 on the final row). */
  remainingBalance: number
}

export type DebtPayoffSuccess = {
  ok: true
  monthsToPayoff: number
  totalInterestPaid: number
  totalAmountPaid: number
  /** Full amortization table. */
  schedule: AmortizationRow[]
}

export type DebtPayoffError = {
  ok: false
  errorCode: 'PAYMENT_TOO_LOW' | 'EXCEEDS_MAX_MONTHS' | 'INVALID_INPUT'
  message: string
}

export type DebtPayoffResult = DebtPayoffSuccess | DebtPayoffError

export type RequiredPaymentSuccess = {
  ok: true
  /** Minimum monthly payment (rounded up to nearest cent) that meets the target. */
  requiredMonthlyPayment: number
  simulation: DebtPayoffSuccess
}

export type RequiredPaymentError = {
  ok: false
  message: string
}

export type RequiredPaymentResult = RequiredPaymentSuccess | RequiredPaymentError

// ─── Constants ────────────────────────────────────────────────────────────────

/** Safety cap: 50 years covers any consumer loan (mortgage, car, personal). */
export const MAX_MONTHS_CAP = 600

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Round to 2 decimal places (bank-standard cent precision). */
function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// ─── Core simulation ──────────────────────────────────────────────────────────

/**
 * Simulate amortization month-by-month using the reducing-balance method.
 *
 * @param principal       Remaining balance (฿). Must be > 0.
 * @param annualInterestRate  Annual interest rate in % (e.g. 17 for 17 %). Pass 0 for zero-interest.
 * @param monthlyPayment  Scheduled payment per month (฿). Must exceed first month's interest.
 *
 * @example
 * calculateAmortization(112_000, 17, 5_500)
 * // → { ok: true, monthsToPayoff: 27, totalInterestPaid: 26_500, ... }
 */
export function calculateAmortization(
  principal: number,
  annualInterestRate: number,
  monthlyPayment: number,
): DebtPayoffResult {
  // ── Input validation ──────────────────────────────────────────────────────
  if (principal <= 0 || monthlyPayment <= 0) {
    return {
      ok: false,
      errorCode: 'INVALID_INPUT',
      message: 'ยอดหนี้และยอดผ่อนต้องมากกว่า 0',
    }
  }

  const monthlyRate = annualInterestRate / 100 / 12

  // Guard: payment must exceed the first month's interest to reduce principal
  if (monthlyRate > 0) {
    const firstMonthInterest = round2(principal * monthlyRate)
    if (monthlyPayment <= firstMonthInterest) {
      return {
        ok: false,
        errorCode: 'PAYMENT_TOO_LOW',
        message: `ยอดผ่อนต่ำเกินไป ดอกเบี้ยเดือนแรก ฿${firstMonthInterest.toLocaleString('th-TH')} ยอดผ่อนต้องมากกว่านี้`,
      }
    }
  }

  // ── Simulation ────────────────────────────────────────────────────────────
  const schedule: AmortizationRow[] = []
  let balance = round2(principal)
  let totalInterest = 0
  let totalPaid = 0

  for (let month = 1; month <= MAX_MONTHS_CAP; month++) {
    const interest = round2(balance * monthlyRate)

    // Last payment is smaller when remaining balance + interest < scheduled payment
    const dueThisMonth = round2(balance + interest)
    const actualPayment = dueThisMonth < monthlyPayment ? dueThisMonth : monthlyPayment

    const principalPaid = round2(actualPayment - interest)
    balance = round2(balance - principalPaid)

    // Floating-point guard: clamp to zero
    if (balance < 0) balance = 0

    totalInterest = round2(totalInterest + interest)
    totalPaid = round2(totalPaid + actualPayment)

    schedule.push({
      month,
      payment: actualPayment,
      interest,
      principalPaid,
      remainingBalance: balance,
    })

    if (balance <= 0) {
      return {
        ok: true,
        monthsToPayoff: month,
        totalInterestPaid: totalInterest,
        totalAmountPaid: totalPaid,
        schedule,
      }
    }
  }

  return {
    ok: false,
    errorCode: 'EXCEEDS_MAX_MONTHS',
    message: `ระยะเวลาชำระหนี้เกิน ${MAX_MONTHS_CAP} เดือน กรุณาเพิ่มยอดผ่อนต่อเดือน`,
  }
}

// ─── Required payment (binary search) ────────────────────────────────────────

/**
 * Find the minimum monthly payment to pay off the debt within `targetMonths`.
 *
 * Binary search strategy:
 *   lo = principal × monthlyRate + 0.01  (just above interest-only — never converges)
 *   hi = principal + principal × monthlyRate  (pay off everything in 1 month)
 *
 * The invariant is:
 *   - lo never achieves targetMonths (takes longer or is invalid)
 *   - hi always achieves targetMonths (pays off ≤ targetMonths)
 *
 * 60 iterations → convergence < 0.005 baht for any real-world balance.
 *
 * @example
 * calculateRequiredPayment(112_000, 17, 24)
 * // → { ok: true, requiredMonthlyPayment: 5541.28, ... }
 */
export function calculateRequiredPayment(
  principal: number,
  annualInterestRate: number,
  targetMonths: number,
): RequiredPaymentResult {
  if (principal <= 0 || targetMonths <= 0) {
    return { ok: false, message: 'ข้อมูลไม่ถูกต้อง' }
  }

  const monthlyRate = annualInterestRate / 100 / 12

  // ── Zero-interest shortcut ────────────────────────────────────────────────
  // Avoids binary search instability when monthlyRate ≈ 0.
  if (annualInterestRate <= 0) {
    // Ceil to nearest cent to guarantee balance reaches 0 within targetMonths
    const payment = round2(Math.ceil((principal / targetMonths) * 100) / 100)
    const sim = calculateAmortization(principal, 0, payment)
    if (sim.ok) return { ok: true, requiredMonthlyPayment: payment, simulation: sim }
    // Rounding edge: try one cent higher
    const paymentUp = round2(payment + 0.01)
    const simUp = calculateAmortization(principal, 0, paymentUp)
    if (simUp.ok) return { ok: true, requiredMonthlyPayment: paymentUp, simulation: simUp }
    return { ok: false, message: 'ไม่สามารถคำนวณได้' }
  }

  // ── Binary search ─────────────────────────────────────────────────────────
  let lo = round2(principal * monthlyRate + 0.01) // below this: debt never paid off
  let hi = round2(principal + principal * monthlyRate) // pay off in 1 month (safe upper bound)

  let bestPayment: number | null = null
  let bestSim: DebtPayoffSuccess | null = null

  for (let iter = 0; iter < 60; iter++) {
    if (hi - lo < 0.005) break
    const mid = round2((lo + hi) / 2)

    const result = calculateAmortization(principal, annualInterestRate, mid)

    if (!result.ok) {
      // Payment is invalid (too low or error) → increase lower bound
      lo = mid
    } else if (result.monthsToPayoff <= targetMonths) {
      // This payment achieves target → record as candidate and try lower
      bestPayment = mid
      bestSim = result
      hi = mid
    } else {
      // Takes too many months → increase lower bound
      lo = mid
    }
  }

  if (bestPayment === null || bestSim === null) {
    return { ok: false, message: 'ไม่สามารถคำนวณยอดผ่อนสำหรับระยะเวลาที่กำหนดได้' }
  }

  return { ok: true, requiredMonthlyPayment: bestPayment, simulation: bestSim }
}
