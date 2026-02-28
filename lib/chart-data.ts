/**
 * Builds daily spending data for Recharts AreaChart (same shape as clarity-finance-hub).
 * Used for "ค่าใช้จ่ายรายวัน" on dashboard.
 */

import { format, differenceInDays, addDays } from 'date-fns'

export type DailySpendingDatum = {
  day: number
  expense: number
  income?: number
}

export type TransactionLike = {
  type: string
  amount: number
  date: string
}

/**
 * Returns one point per day in the range [start, end] (inclusive).
 * day = 1 for start date, 2 for start+1, etc.
 * expense/income = sum of transactions on that date.
 */
export function getDailySpendingForPeriod(
  transactions: TransactionLike[],
  start: Date,
  end: Date
): DailySpendingDatum[] {
  const daysCount = differenceInDays(end, start) + 1
  const result: DailySpendingDatum[] = []

  for (let i = 0; i < daysCount; i++) {
    const d = addDays(start, i)
    const dateStr = format(d, 'yyyy-MM-dd')
    const dayTransactions = transactions.filter((t) => t.date === dateStr)
    const expense = dayTransactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0)
    const income = dayTransactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount), 0)
    result.push({ day: i + 1, expense, income })
  }

  return result
}
