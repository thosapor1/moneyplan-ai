/**
 * Unit tests for forecast module: median and plannedRemaining logic.
 * Run: npm test
 */

import { describe, it, expect } from 'vitest'
import { median, computePlannedRemaining, computeVariableDailyRate, computeForecastEnd } from './forecast'

describe('median', () => {
  it('returns 0 for empty array', () => {
    expect(median([])).toBe(0)
  })
  it('returns single element', () => {
    expect(median([5])).toBe(5)
  })
  it('returns middle for odd length', () => {
    expect(median([1, 3, 2])).toBe(2)
  })
  it('returns average of two middles for even length', () => {
    expect(median([1, 3, 2, 4])).toBe(2.5)
  })
  it('ignores order', () => {
    expect(median([10, 1, 5, 3, 2])).toBe(3)
  })
})

describe('computeVariableDailyRate', () => {
  it('returns 0 when no variable expenses', () => {
    expect(computeVariableDailyRate([], new Date('2026-02-01'))).toBe(0)
  })
  it('returns median of daily sums over last 14 days', () => {
    const txs = [
      { type: 'expense' as const, amount: 100, category: 'อาหาร', date: '2026-01-30' },
      { type: 'expense' as const, amount: 50, category: 'อาหาร', date: '2026-01-30' },
      { type: 'expense' as const, amount: 200, category: 'อาหาร', date: '2026-01-31' },
    ]
    const rate = computeVariableDailyRate(txs, new Date('2026-02-01'))
    // Day 30 sum=150, day 31 sum=200 → median([150, 200]) = 175
    expect(rate).toBe(175)
  })
})

describe('computePlannedRemaining', () => {
  it('returns 0 when no fixed expenses', () => {
    expect(
      computePlannedRemaining(
        [],
        new Date('2026-02-01'),
        new Date('2026-01-28'),
        new Date('2026-02-27')
      )
    ).toBe(0)
  })
  it('does not count rent again when already paid this period', () => {
    const txs = [
      { type: 'expense' as const, amount: 20000, category: 'ที่พัก/ค่าเช่า', date: '2026-01-28' },
      { type: 'expense' as const, amount: 20000, category: 'ที่พัก/ค่าเช่า', date: '2025-12-28' },
      { type: 'expense' as const, amount: 20000, category: 'ที่พัก/ค่าเช่า', date: '2025-11-28' },
    ]
    const planned = computePlannedRemaining(
      txs,
      new Date('2026-02-01'),
      new Date('2026-01-28'),
      new Date('2026-02-27')
    )
    expect(planned).toBe(0)
  })
})

describe('computeForecastEnd', () => {
  it('applies formula: currentBalance - plannedRemaining - (variableDailyRate * daysRemaining)', () => {
    const r = computeForecastEnd(10000, 200, 5000, 10)
    expect(r.plannedRemaining).toBe(5000)
    expect(r.variableDailyRate).toBe(200)
    expect(r.forecastVariableSpend).toBe(2000)
    expect(r.forecastEnd).toBe(10000 - 5000 - 2000)
  })
})
