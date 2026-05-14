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
  it('sums expenses per category within range (and normalizes legacy names)', () => {
    const range = { start: new Date(2026, 0, 1), end: new Date(2026, 0, 31) }
    const txs = [
      { type: 'expense' as const, amount: 500, category: 'เดินทาง', date: '2026-01-15' },
      { type: 'expense' as const, amount: 500, category: 'เดินทาง', date: '2026-01-20' },
      { type: 'expense' as const, amount: 300, category: 'อาหาร', date: '2026-01-10' },
    ]
    const spent = computeSpentByCategory(txs, range)
    // Legacy names are normalized to canonical names (ค่าเดินทาง, ค่าอาหาร)
    expect(spent['ค่าเดินทาง']).toBe(1000)
    expect(spent['ค่าอาหาร']).toBe(300)
  })
})

describe('computeRemainingBudgetByCategory', () => {
  it('Travel budget 1000, spent 1000 -> remaining 0', () => {
    const budget = { 'ค่าเดินทาง': 1000 }
    const spent = { 'ค่าเดินทาง': 1000 }
    const remaining = computeRemainingBudgetByCategory(budget, spent)
    expect(remaining['ค่าเดินทาง']).toBe(0)
  })
  it('Travel budget 1000, spent 1200 -> remaining 0 (no negative)', () => {
    const budget = { 'ค่าเดินทาง': 1000 }
    const spent = { 'ค่าเดินทาง': 1200 }
    const remaining = computeRemainingBudgetByCategory(budget, spent)
    expect(remaining['ค่าเดินทาง']).toBe(0)
  })
  it('Multiple categories: remaining = max(0, budget - spent)', () => {
    const budget = { ค่าอาหาร: 3000, 'ค่าเดินทาง': 1000 }
    const spent = { ค่าอาหาร: 500, 'ค่าเดินทาง': 1000 }
    const remaining = computeRemainingBudgetByCategory(budget, spent)
    expect(remaining['ค่าอาหาร']).toBe(2500)
    expect(remaining['ค่าเดินทาง']).toBe(0)
  })
})

describe('computeDailyBudgetFromRemaining', () => {
  it('Travel fully spent (remaining 0) -> dailyBudget does not include travel', () => {
    const remaining = { 'ค่าเดินทาง': 0, ค่าอาหาร: 2000 }
    const daily = computeDailyBudgetFromRemaining(remaining, 10, variableCats)
    expect(daily).toBe(2000 / 10)
  })
  it('remainingDays 0 -> dailyBudget 0', () => {
    const remaining = { ค่าอาหาร: 3000 }
    expect(computeDailyBudgetFromRemaining(remaining, 0, variableCats)).toBe(0)
  })
  it('Multiple categories remaining -> dailyBudget = sumRemaining / remainingDays', () => {
    const remaining = { ค่าอาหาร: 2000, 'ค่าเดินทาง': 500 }
    const daily = computeDailyBudgetFromRemaining(remaining, 10, variableCats)
    expect(daily).toBe((2000 + 500) / 10)
  })
})

describe('getDailyBudgetBreakdown', () => {
  it('returns monthlyBudget, spentToDate, remainingBudget per variable category', () => {
    const budget = { ค่าอาหาร: 3000, 'ค่าเดินทาง': 1000 }
    const spent = { ค่าอาหาร: 500, 'ค่าเดินทาง': 1000 }
    const breakdown = getDailyBudgetBreakdown(budget, spent, variableCats)
    const food = breakdown.find((b) => b.category === 'ค่าอาหาร')
    const travel = breakdown.find((b) => b.category === 'ค่าเดินทาง')
    expect(food?.monthlyBudget).toBe(3000)
    expect(food?.spentToDate).toBe(500)
    expect(food?.remainingBudget).toBe(2500)
    expect(travel?.monthlyBudget).toBe(1000)
    expect(travel?.spentToDate).toBe(1000)
    expect(travel?.remainingBudget).toBe(0)
  })
})
