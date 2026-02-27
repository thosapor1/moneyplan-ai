/**
 * Legacy storage module (backward-compatible).
 *
 * Clean Architecture refactor:
 * - localStorage-backed settings + constants now live in
 *   `src/infrastructure/storage/local-settings.ts`
 * - This file exists only to preserve existing imports like `@/lib/storage`.
 *
 * Rules:
 * - Do NOT add new logic here.
 * - Add/modify storage logic in `src/infrastructure/storage/local-settings.ts` instead.
 *
 * Note:
 * - Use a relative import so test tooling does not depend on Next.js-only path aliases.
 */

export {
  VISIBLE_CATEGORIES_KEY,
  MONTH_END_DAY_KEY,
  EXPENSE_CATEGORIES,
  getVisibleCategories,
  setVisibleCategories,
  getMonthEndDay,
  setMonthEndDay,
  type ExpenseCategory,
} from "../src/infrastructure/storage/local-settings";
