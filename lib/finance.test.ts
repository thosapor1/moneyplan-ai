/**
 * Unit tests for daily budget from remaining (finance module).
 * Run: npm test
 */

import { describe, it, expect } from 'vitest'
import {
  computeSpentByCategory,
  computeRemainingBudgetByCategory,
  computeDailyBudgetFromRemaining,
  getDailyBudgetBreakdown,
} from './finance'
import { VARIABLE_EXPENSE_CATEGORIES } from './forecast'

const variableCats = [...VARIABLE_EXPENSE_CATEGORIES]

describe('computeSpentByCategory', () => {
  it('sums expenses per category within range', () => {
    const range = { start: new Date(2026, 0, 1), end: new Date(2026, 0, 31) }
    const txs = [
      { type: 'expense' as const, amount: 500, category: 'เดินทาง', date: '2026-01-15' },
      { type: 'expense' as const, amount: 500, category: 'เดินทาง', date: '2026-01-20' },
      { type: 'expense' as const, amount: 300, category: 'อาหาร', date: '2026-01-10' },
    ]
    const spent = computeSpentByCategory(txs, range)
    expect(spent['เดินทาง']).toBe(1000)
    expect(spent['อาหาร']).toBe(300)
  })
})

describe('computeRemainingBudgetByCategory', () => {
  it('Travel budget 1000, spent 1000 -> remaining 0', () => {
    const budget = { 'เดินทาง': 1000 }
    const spent = { 'เดินทาง': 1000 }
    const remaining = computeRemainingBudgetByCategory(budget, spent)
    expect(remaining['เดินทาง']).toBe(0)
  })
  it('Travel budget 1000, spent 1200 -> remaining 0 (no negative)', () => {
    const budget = { 'เดินทาง': 1000 }
    const spent = { 'เดินทาง': 1200 }
    const remaining = computeRemainingBudgetByCategory(budget, spent)
    expect(remaining['เดินทาง']).toBe(0)
  })
  it('Multiple categories: remaining = max(0, budget - spent)', () => {
    const budget = { อาหาร: 3000, 'เดินทาง': 1000 }
    const spent = { อาหาร: 500, 'เดินทาง': 1000 }
    const remaining = computeRemainingBudgetByCategory(budget, spent)
    expect(remaining['อาหาร']).toBe(2500)
    expect(remaining['เดินทาง']).toBe(0)
  })
})

describe('computeDailyBudgetFromRemaining', () => {
  it('Travel fully spent (remaining 0) -> dailyBudget does not include travel', () => {
    const remaining = { 'เดินทาง': 0, อาหาร: 2000 }
    const daily = computeDailyBudgetFromRemaining(remaining, 10, variableCats)
    expect(daily).toBe(2000 / 10)
  })
  it('remainingDays 0 -> dailyBudget 0', () => {
    const remaining = { อาหาร: 3000 }
    expect(computeDailyBudgetFromRemaining(remaining, 0, variableCats)).toBe(0)
  })
  it('Multiple categories remaining -> dailyBudget = sumRemaining / remainingDays', () => {
    const remaining = { อาหาร: 2000, 'เดินทาง': 500 }
    const daily = computeDailyBudgetFromRemaining(remaining, 10, variableCats)
    expect(daily).toBe((2000 + 500) / 10)
  })
})

describe('getDailyBudgetBreakdown', () => {
  it('returns monthlyBudget, spentToDate, remainingBudget per variable category', () => {
    const budget = { อาหาร: 3000, 'เดินทาง': 1000 }
    const spent = { อาหาร: 500, 'เดินทาง': 1000 }
    const breakdown = getDailyBudgetBreakdown(budget, spent, variableCats)
    const food = breakdown.find((b) => b.category === 'อาหาร')
    const travel = breakdown.find((b) => b.category === 'เดินทาง')
    expect(food?.monthlyBudget).toBe(3000)
    expect(food?.spentToDate).toBe(500)
    expect(food?.remainingBudget).toBe(2500)
    expect(travel?.monthlyBudget).toBe(1000)
    expect(travel?.spentToDate).toBe(1000)
    expect(travel?.remainingBudget).toBe(0)
  })
})
