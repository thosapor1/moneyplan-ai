/**
 * Domain: Period (Billing Period / งวดเดือน)
 *
 * Single source of truth for how "a month" is interpreted in the app:
 * - monthEndDay = 0  -> calendar month (1..last day)
 * - monthEndDay = N  -> billing period ends on day N of some month.
 *   The period is [(N+1) of previous month .. N of end month] (inclusive),
 *   so each day belongs to exactly one period (e.g. salary on the 27th counts once).
 *   Clamped to month length when needed (e.g. Feb 30 -> Feb 28/29).
 *
 * This module is pure (no I/O, no browser APIs) and safe for unit tests.
 */

import { getMonthRange } from '../finance/finance'

/** Inclusive date range (date-only, midnight) */
export type DateRange = { start: Date; end: Date }

/** Normalize to date-only (midnight) for day math. */
function toDateOnly(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** Number of whole days from `from` to `to` inclusive (date-only). */
function diffDaysInclusive(from: Date, to: Date): number {
  const t1 = toDateOnly(from).getTime()
  const t2 = toDateOnly(to).getTime()
  return Math.round((t2 - t1) / (24 * 60 * 60 * 1000)) + 1
}

/**
 * Returns the month (as first day) of the period END that contains `asOf`.
 *
 * Examples:
 * - monthEndDay = 0, asOf = 2026-01-15 -> 2026-01-01
 * - monthEndDay = 27, asOf = 2026-01-15 -> period ends 2026-01-27 -> 2026-01-01
 * - monthEndDay = 27, asOf = 2026-01-31 -> period ends 2026-02-27 -> 2026-02-01
 */
export function getActivePeriodMonth(asOf: Date, monthEndDay: number): Date {
  if (monthEndDay <= 0) {
    return new Date(asOf.getFullYear(), asOf.getMonth(), 1)
  }

  const day = asOf.getDate()
  if (day <= monthEndDay) {
    return new Date(asOf.getFullYear(), asOf.getMonth(), 1)
  }

  // Days after the endDay belong to the period that ends next month.
  return new Date(asOf.getFullYear(), asOf.getMonth() + 1, 1)
}

/**
 * Range { start, end } that ALWAYS contains `asOf` (inclusive).
 *
 * Implementation note:
 * - Computes active period month end based on `asOf`,
 * - Then uses finance.getMonthRange(activePeriodMonth, monthEndDay).
 */
export function getActiveMonthRange(asOf: Date, monthEndDay: number): DateRange {
  const activeMonth = getActivePeriodMonth(asOf, monthEndDay)
  return getMonthRange(activeMonth, monthEndDay)
}

/** Total days in range (start..end inclusive). */
export function getPeriodDays(range: DateRange): number {
  return diffDaysInclusive(range.start, range.end)
}

/**
 * Days left from `asOf` to period end (inclusive).
 * Uses [asOf .. range.end] inclusive: both today (T) and the last day of the period count.
 * So it is "T to T" (today through period-end day), NOT "until T-1".
 * Returns 0 if `asOf` is outside the range.
 */
export function getRemainingDaysInPeriod(asOf: Date, range: DateRange): number {
  const a = toDateOnly(asOf).getTime()
  const start = toDateOnly(range.start).getTime()
  const end = toDateOnly(range.end).getTime()

  if (a < start) return 0
  if (a > end) return 0
  return diffDaysInclusive(asOf, range.end)
}

/**
 * Days elapsed from period start to `asOf` (inclusive).
 * - 0 if `asOf` before start
 * - full period days if `asOf` after end
 */
export function getDaysElapsedInPeriod(asOf: Date, range: DateRange): number {
  const a = toDateOnly(asOf).getTime()
  const start = toDateOnly(range.start).getTime()
  const end = toDateOnly(range.end).getTime()

  if (a < start) return 0
  if (a > end) return getPeriodDays(range)
  return diffDaysInclusive(range.start, asOf)
}

/** Debug helper: format range as "YYYY-MM-DD..YYYY-MM-DD". */
export function formatRange(range: DateRange): string {
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return `${fmt(range.start)}..${fmt(range.end)}`
}
