/**
 * Domain: Savings Goal Calculator
 *
 * Pure financial math — no I/O, no dates, no UI dependencies.
 *
 * Design notes
 * ────────────────────────────────────────────────────────────────────────────
 * WHY SIMULATION over closed-form FV formula?
 *   FV = PV·(1+r)^n + PMT·((1+r)^n−1)/r
 *   Solving for n: n = ln((FV·r+PMT)/(PV·r+PMT)) / ln(1+r)
 *   This breaks at r=0, can't naturally handle "already achieved",
 *   and doesn't produce the monthly schedule needed for milestone display.
 *
 * MONTHLY COMPOUND MODEL:
 *   balance = balance × (1 + monthlyRate) + monthlyContribution
 *   Interest accrues on beginning balance; contribution added end-of-month.
 *   Matches standard Thai savings account behavior.
 *
 * BINARY SEARCH for required contribution:
 *   lo = 0 (interest alone might suffice)
 *   hi = (targetAmount − currentAmount) / targetMonths  (linear upper bound;
 *       compound interest always needs ≤ this amount, so hi is always valid)
 *   60 iterations → precision < ฿0.005 for any real-world balance.
 *
 * GOAL HEALTH (ratio-based, not history-based):
 *   We have no deposit start date or history in the DB.
 *   Health = actualContribution / requiredContribution for the given deadline.
 *   Thresholds: ≥100% → on_track, ≥85% → slightly_behind, <85% → off_track.
 * ────────────────────────────────────────────────────────────────────────────
 */

export const MAX_MONTHS_CAP = 600

// ─── Types ────────────────────────────────────────────────────────────────────

/** One row in the monthly projection schedule. */
export type GoalProjectionRow = {
  month: number
  /** Balance at end of this month (after interest + contribution). */
  balance: number
  /** Interest credited this month. */
  interest: number
  /** Contribution added this month. */
  contribution: number
}

export type GoalProjectionSuccess = {
  ok: true
  monthsToGoal: number
  totalContribution: number
  totalInterestEarned: number
  schedule: GoalProjectionRow[]
}

export type GoalProjectionError = {
  ok: false
  errorCode: 'ALREADY_ACHIEVED' | 'EXCEEDS_MAX_MONTHS' | 'INVALID_INPUT' | 'ZERO_PROGRESS'
  message: string
}

export type GoalProjectionResult = GoalProjectionSuccess | GoalProjectionError

export type RequiredContributionSuccess = {
  ok: true
  requiredMonthlyContribution: number
  simulation: GoalProjectionSuccess
}

export type RequiredContributionError = {
  ok: false
  message: string
}

export type RequiredContributionResult = RequiredContributionSuccess | RequiredContributionError

export type GoalHealthStatus = 'already_achieved' | 'on_track' | 'slightly_behind' | 'off_track'

export type GoalHealthResult = {
  status: GoalHealthStatus
  requiredMonthlyContribution: number
  actualMonthlyContribution: number
  shortfallPerMonth: number
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// ─── Core simulation ──────────────────────────────────────────────────────────

/**
 * Simulate monthly savings accumulation with compound interest.
 *
 * Monthly model: balance = balance × (1 + monthlyRate) + monthlyContribution
 *
 * @param currentAmount       Starting balance (฿). Must be ≥ 0.
 * @param targetAmount        Goal amount (฿). Must be > currentAmount.
 * @param monthlyContribution Monthly saving amount (฿). May be 0 if rate > 0.
 * @param annualInterestRate  Annual interest rate in % (e.g. 3.5). May be 0.
 *
 * @example
 * calculateGoalProjection(6_000, 100_000, 3_000, 2)
 * // → { ok: true, monthsToGoal: 31, totalContribution: 93_000, ... }
 */
export function calculateGoalProjection(
  currentAmount: number,
  targetAmount: number,
  monthlyContribution: number,
  annualInterestRate: number,
): GoalProjectionResult {
  if (targetAmount <= 0 || currentAmount < 0 || monthlyContribution < 0) {
    return { ok: false, errorCode: 'INVALID_INPUT', message: 'ข้อมูลไม่ถูกต้อง' }
  }
  if (currentAmount >= targetAmount) {
    return { ok: false, errorCode: 'ALREADY_ACHIEVED', message: 'บรรลุเป้าหมายแล้ว' }
  }
  if (monthlyContribution <= 0 && annualInterestRate <= 0) {
    return {
      ok: false,
      errorCode: 'ZERO_PROGRESS',
      message: 'ต้องระบุยอดออมต่อเดือน หรืออัตราดอกเบี้ย',
    }
  }

  const monthlyRate = annualInterestRate / 100 / 12
  const schedule: GoalProjectionRow[] = []
  let balance = round2(currentAmount)
  let totalContribution = 0
  let totalInterest = 0

  for (let month = 1; month <= MAX_MONTHS_CAP; month++) {
    const interest = round2(balance * monthlyRate)
    balance = round2(balance + interest + monthlyContribution)
    totalContribution = round2(totalContribution + monthlyContribution)
    totalInterest = round2(totalInterest + interest)

    schedule.push({ month, balance, interest, contribution: monthlyContribution })

    if (balance >= targetAmount) {
      return {
        ok: true,
        monthsToGoal: month,
        totalContribution,
        totalInterestEarned: totalInterest,
        schedule,
      }
    }
  }

  return {
    ok: false,
    errorCode: 'EXCEEDS_MAX_MONTHS',
    message: `ต้องใช้เวลามากกว่า ${MAX_MONTHS_CAP} เดือน กรุณาเพิ่มยอดออมต่อเดือน`,
  }
}

// ─── Required contribution (binary search) ────────────────────────────────────

/**
 * Find the minimum monthly contribution to reach targetAmount within targetMonths.
 *
 * Binary search invariant:
 *   lo — never achieves the target within targetMonths
 *   hi — always achieves the target within targetMonths
 *
 * hi = (target − current) / targetMonths is a tight linear upper bound
 * because compound interest always reduces the required amount vs no-interest.
 *
 * @example
 * calculateRequiredContribution(6_000, 100_000, 2, 36)
 * // → { ok: true, requiredMonthlyContribution: 2_538.45, ... }
 */
export function calculateRequiredContribution(
  currentAmount: number,
  targetAmount: number,
  annualInterestRate: number,
  targetMonths: number,
): RequiredContributionResult {
  if (targetAmount <= 0 || targetMonths <= 0 || currentAmount < 0) {
    return { ok: false, message: 'ข้อมูลไม่ถูกต้อง' }
  }
  if (currentAmount >= targetAmount) {
    return { ok: false, message: 'บรรลุเป้าหมายแล้ว' }
  }

  // ── Zero-interest shortcut ────────────────────────────────────────────────
  if (annualInterestRate <= 0) {
    const needed = round2(Math.ceil(((targetAmount - currentAmount) / targetMonths) * 100) / 100)
    const sim = calculateGoalProjection(currentAmount, targetAmount, needed, 0)
    if (sim.ok && sim.monthsToGoal <= targetMonths) {
      return { ok: true, requiredMonthlyContribution: needed, simulation: sim }
    }
    return { ok: false, message: 'ไม่สามารถคำนวณได้' }
  }

  // ── Check if interest alone reaches target ────────────────────────────────
  const interestOnlySim = calculateGoalProjection(currentAmount, targetAmount, 0, annualInterestRate)
  if (interestOnlySim.ok && interestOnlySim.monthsToGoal <= targetMonths) {
    return { ok: true, requiredMonthlyContribution: 0, simulation: interestOnlySim }
  }

  // ── Binary search ─────────────────────────────────────────────────────────
  let lo = 0
  // Linear upper bound: always achieves target (with interest you need ≤ this)
  let hi = round2((targetAmount - currentAmount) / targetMonths + 1)

  let bestContribution: number | null = null
  let bestSim: GoalProjectionSuccess | null = null

  for (let iter = 0; iter < 60; iter++) {
    if (hi - lo < 0.005) break
    const mid = round2((lo + hi) / 2)
    const sim = calculateGoalProjection(currentAmount, targetAmount, mid, annualInterestRate)

    if (!sim.ok) {
      lo = mid // Error (e.g. EXCEEDS_MAX_MONTHS) → increase contribution
    } else if (sim.monthsToGoal <= targetMonths) {
      bestContribution = mid
      bestSim = sim
      hi = mid // Try lower
    } else {
      lo = mid // Takes too long → increase
    }
  }

  if (bestContribution === null || bestSim === null) {
    return { ok: false, message: 'ไม่สามารถคำนวณยอดออมที่ต้องการได้' }
  }

  return { ok: true, requiredMonthlyContribution: bestContribution, simulation: bestSim }
}

// ─── Goal health indicator ────────────────────────────────────────────────────

/**
 * Compare actual monthly contribution against the minimum required to hit the
 * target on time.
 *
 * Requires targetMonths to be meaningful — without a deadline there is no
 * "behind" concept.
 *
 * Thresholds:
 *   actual ≥ required        → on_track
 *   actual ≥ required × 0.85 → slightly_behind
 *   actual  < required × 0.85 → off_track
 */
export function calculateGoalHealth(
  currentAmount: number,
  targetAmount: number,
  actualMonthlyContribution: number,
  annualInterestRate: number,
  targetMonths: number,
): GoalHealthResult {
  if (currentAmount >= targetAmount) {
    return {
      status: 'already_achieved',
      requiredMonthlyContribution: 0,
      actualMonthlyContribution,
      shortfallPerMonth: 0,
    }
  }

  const requiredResult = calculateRequiredContribution(
    currentAmount,
    targetAmount,
    annualInterestRate,
    targetMonths,
  )

  if (!requiredResult.ok) {
    return {
      status: 'off_track',
      requiredMonthlyContribution: 0,
      actualMonthlyContribution,
      shortfallPerMonth: 0,
    }
  }

  const required = requiredResult.requiredMonthlyContribution
  const shortfall = round2(Math.max(0, required - actualMonthlyContribution))
  const ratio = required > 0 ? actualMonthlyContribution / required : 1

  let status: GoalHealthStatus
  if (ratio >= 1.0) status = 'on_track'
  else if (ratio >= 0.85) status = 'slightly_behind'
  else status = 'off_track'

  return { status, requiredMonthlyContribution: required, actualMonthlyContribution, shortfallPerMonth: shortfall }
}
