/**
 * Unit tests for period module: active period and range logic.
 * Run: npm test
 */

import { describe, it, expect } from 'vitest'
import {
  getActivePeriodMonth,
  getActiveMonthRange,
  getPeriodDays,
  getRemainingDaysInPeriod,
  getDaysElapsedInPeriod,
  formatRange,
} from './period'

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

describe('getActivePeriodMonth', () => {
  it('endDay=27, asOf=Jan 15 → Jan (period Dec 27..Jan 26, Jan 15 is before day 27)', () => {
    const m = getActivePeriodMonth(new Date(2026, 0, 15), 27)
    expect(toYMD(m)).toBe('2026-01-01')
  })
  it('endDay=27, asOf=Jan 27 → Feb (day 27 starts new period Jan 27..Feb 26)', () => {
    const m = getActivePeriodMonth(new Date(2026, 0, 27), 27)
    expect(toYMD(m)).toBe('2026-02-01')
  })
  it('endDay=27, asOf=Jan 31 → Feb (period Jan 27..Feb 26)', () => {
    const m = getActivePeriodMonth(new Date(2026, 0, 31), 27)
    expect(toYMD(m)).toBe('2026-02-01')
  })
  it('endDay=27, asOf=Feb 2 → Feb (period Jan 27..Feb 26)', () => {
    const m = getActivePeriodMonth(new Date(2026, 1, 2), 27)
    expect(toYMD(m)).toBe('2026-02-01')
  })
  it('endDay=0, asOf=Jan 31 → Jan (calendar month)', () => {
    const m = getActivePeriodMonth(new Date(2026, 0, 31), 0)
    expect(toYMD(m)).toBe('2026-01-01')
  })
})

describe('getActiveMonthRange', () => {
  it('endDay=27, asOf=Jan 31 → 2026-01-27..2026-02-26 (N-to-N-1 format)', () => {
    const range = getActiveMonthRange(new Date(2026, 0, 31), 27)
    expect(toYMD(range.start)).toBe('2026-01-27')
    expect(toYMD(range.end)).toBe('2026-02-26')
  })
  it('endDay=27, asOf=Jan 27 → 2026-01-27..2026-02-26 (day N starts new period)', () => {
    const range = getActiveMonthRange(new Date(2026, 0, 27), 27)
    expect(toYMD(range.start)).toBe('2026-01-27')
    expect(toYMD(range.end)).toBe('2026-02-26')
  })
  it('endDay=27, asOf=Jan 26 → 2025-12-27..2026-01-26 (before day 27, in prev period)', () => {
    const range = getActiveMonthRange(new Date(2026, 0, 26), 27)
    expect(toYMD(range.start)).toBe('2025-12-27')
    expect(toYMD(range.end)).toBe('2026-01-26')
  })
  it('endDay=0, asOf=Jan 31 → calendar Jan', () => {
    const range = getActiveMonthRange(new Date(2026, 0, 31), 0)
    expect(toYMD(range.start)).toBe('2026-01-01')
    expect(toYMD(range.end)).toBe('2026-01-31')
  })
})

describe('getPeriodDays', () => {
  it('Jan 27 to Feb 26 = 31 days', () => {
    const range = {
      start: new Date(2026, 0, 27),
      end: new Date(2026, 1, 26),
    }
    expect(getPeriodDays(range)).toBe(31)
  })
})

describe('getRemainingDaysInPeriod', () => {
  it('asOf=Jan 31, range Jan27–Feb26 → 27 days left', () => {
    const range = {
      start: new Date(2026, 0, 27),
      end: new Date(2026, 1, 26),
    }
    expect(getRemainingDaysInPeriod(new Date(2026, 0, 31), range)).toBe(27)
  })
  it('asOf before start → 0', () => {
    const range = {
      start: new Date(2026, 0, 27),
      end: new Date(2026, 1, 26),
    }
    expect(getRemainingDaysInPeriod(new Date(2026, 0, 15), range)).toBe(0)
  })
})

describe('getDaysElapsedInPeriod', () => {
  it('asOf=Jan 31, range Jan27–Feb26 → 5 days elapsed (Jan 27,28,29,30,31)', () => {
    const range = {
      start: new Date(2026, 0, 27),
      end: new Date(2026, 1, 26),
    }
    expect(getDaysElapsedInPeriod(new Date(2026, 0, 31), range)).toBe(5)
  })
})

describe('formatRange', () => {
  it('formats as YYYY-MM-DD..YYYY-MM-DD', () => {
    const range = {
      start: new Date(2026, 0, 27),
      end: new Date(2026, 1, 26),
    }
    expect(formatRange(range)).toBe('2026-01-27..2026-02-26')
  })
})
