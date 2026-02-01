/**
 * Single source of truth for "billing period" (งวดเดือน).
 * - monthEndDay = 0 → calendar month (1..last day)
 * - monthEndDay = N (1-31) → period is [N of previous month .. N of period-end month].
 *   Any day after N belongs to the period that ends next month.
 */

import { getMonthRange } from './finance'

/** Normalize to date-only (midnight) for day math */
function toDateOnly(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** Number of days from `from` to `to` inclusive. Date-only (no time). */
function diffDaysInclusive(from: Date, to: Date): number {
  const t1 = toDateOnly(from).getTime()
  const t2 = toDateOnly(to).getTime()
  return Math.round((t2 - t1) / (24 * 60 * 60 * 1000))
}

/**
 * Returns the month (as first day) of the period END that contains `asOf`.
 * - monthEndDay = 0: calendar month containing asOf.
 * - monthEndDay = 27, asOf = Jan 15 → period ends Jan 27 → Jan.
 * - monthEndDay = 27, asOf = Jan 31 → period ends Feb 27 → Feb.
 */
export function getActivePeriodMonth(asOf: Date, monthEndDay: number): Date {
  if (monthEndDay <= 0) {
    return new Date(asOf.getFullYear(), asOf.getMonth(), 1)
  }
  const d = asOf.getDate()
  if (d <= monthEndDay) {
    return new Date(asOf.getFullYear(), asOf.getMonth(), 1)
  }
  return new Date(asOf.getFullYear(), asOf.getMonth() + 1, 1)
}

/**
 * Range { start, end } that always contains `asOf`.
 * Uses getMonthRange(activePeriodMonth, monthEndDay).
 */
export function getActiveMonthRange(
  asOf: Date,
  monthEndDay: number
): { start: Date; end: Date } {
  const activeMonth = getActivePeriodMonth(asOf, monthEndDay)
  return getMonthRange(activeMonth, monthEndDay)
}

export type DateRange = { start: Date; end: Date }

/** Total days in range (start..end inclusive) */
export function getPeriodDays(range: DateRange): number {
  return diffDaysInclusive(range.start, range.end) + 1
}

/** Days left from asOf to end (inclusive). 0 if asOf outside range. */
export function getRemainingDaysInPeriod(asOf: Date, range: DateRange): number {
  const a = toDateOnly(asOf).getTime()
  const start = toDateOnly(range.start).getTime()
  const end = toDateOnly(range.end).getTime()
  if (a < start) return 0
  if (a > end) return 0
  return diffDaysInclusive(asOf, range.end) + 1
}

/** Days elapsed from start to asOf (inclusive). 0 if asOf before start; full period if asOf after end. */
export function getDaysElapsedInPeriod(asOf: Date, range: DateRange): number {
  const a = toDateOnly(asOf).getTime()
  const start = toDateOnly(range.start).getTime()
  const end = toDateOnly(range.end).getTime()
  if (a < start) return 0
  if (a > end) return getPeriodDays(range)
  return diffDaysInclusive(range.start, asOf) + 1
}

/** Debug: format range as "YYYY-MM-DD..YYYY-MM-DD" */
export function formatRange(range: DateRange): string {
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return `${fmt(range.start)}..${fmt(range.end)}`
}
