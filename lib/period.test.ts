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
  it('endDay=27, asOf=Jan 15 → Jan (period ends Jan 27)', () => {
    const m = getActivePeriodMonth(new Date(2026, 0, 15), 27)
    expect(toYMD(m)).toBe('2026-01-01')
  })
  it('endDay=27, asOf=Jan 31 → Feb (period ends Feb 27)', () => {
    const m = getActivePeriodMonth(new Date(2026, 0, 31), 27)
    expect(toYMD(m)).toBe('2026-02-01')
  })
  it('endDay=27, asOf=Feb 2 → Feb (period ends Feb 27)', () => {
    const m = getActivePeriodMonth(new Date(2026, 1, 2), 27)
    expect(toYMD(m)).toBe('2026-02-01')
  })
  it('endDay=0, asOf=Jan 31 → Jan (calendar month)', () => {
    const m = getActivePeriodMonth(new Date(2026, 0, 31), 0)
    expect(toYMD(m)).toBe('2026-01-01')
  })
})

describe('getActiveMonthRange', () => {
  it('endDay=27, asOf=Jan 31 → 2026-01-28..2026-02-27 (no overlap: 27th in one period only)', () => {
    const range = getActiveMonthRange(new Date(2026, 0, 31), 27)
    expect(toYMD(range.start)).toBe('2026-01-28')
    expect(toYMD(range.end)).toBe('2026-02-27')
  })
  it('endDay=0, asOf=Jan 31 → calendar Jan', () => {
    const range = getActiveMonthRange(new Date(2026, 0, 31), 0)
    expect(toYMD(range.start)).toBe('2026-01-01')
    expect(toYMD(range.end)).toBe('2026-01-31')
  })
})

describe('getPeriodDays', () => {
  it('Jan 28 to Feb 27 = 31 days', () => {
    const range = {
      start: new Date(2026, 0, 28),
      end: new Date(2026, 1, 27),
    }
    expect(getPeriodDays(range)).toBe(31)
  })
})

describe('getRemainingDaysInPeriod', () => {
  it('asOf=Jan 31, range Jan28–Feb27 → 28 days left', () => {
    const range = {
      start: new Date(2026, 0, 28),
      end: new Date(2026, 1, 27),
    }
    expect(getRemainingDaysInPeriod(new Date(2026, 0, 31), range)).toBe(28)
  })
  it('asOf before start → 0', () => {
    const range = {
      start: new Date(2026, 0, 28),
      end: new Date(2026, 1, 27),
    }
    expect(getRemainingDaysInPeriod(new Date(2026, 0, 15), range)).toBe(0)
  })
})

describe('getDaysElapsedInPeriod', () => {
  it('asOf=Jan 31, range Jan28–Feb27 → 4 days elapsed', () => {
    const range = {
      start: new Date(2026, 0, 28),
      end: new Date(2026, 1, 27),
    }
    expect(getDaysElapsedInPeriod(new Date(2026, 0, 31), range)).toBe(4)
  })
})

describe('formatRange', () => {
  it('formats as YYYY-MM-DD..YYYY-MM-DD', () => {
    const range = {
      start: new Date(2026, 0, 28),
      end: new Date(2026, 1, 27),
    }
    expect(formatRange(range)).toBe('2026-01-28..2026-02-27')
  })
})
