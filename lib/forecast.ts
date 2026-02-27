/**
 * Legacy forecast module (backward-compatible).
 *
 * Clean Architecture refactor:
 * - Forecast calculation utilities now live in `src/domain/forecast/forecast.ts`.
 * - This file exists only to preserve existing imports like `@/lib/forecast`.
 *
 * Rules:
 * - Do NOT add new logic here.
 * - Add/modify forecast logic in `src/domain/forecast/forecast.ts` instead.
 *
 * Note:
 * - Use a relative import so test tooling does not depend on Next.js-only path aliases.
 */

export {
  FIXED_EXPENSE_CATEGORIES,
  VARIABLE_EXPENSE_CATEGORIES,
  getExpenseCategoryType,
  median,
  computeVariableDailyRate,
  computePlannedRemaining,
  computeForecastEnd,
  type FixedCategory,
  type VariableCategory,
  type TransactionLike,
  type ForecastResult,
} from "../src/domain/forecast/forecast";
