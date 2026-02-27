/**
 * Legacy Supabase entrypoint (backward-compatible).
 *
 * Clean Architecture refactor:
 * - Supabase client + data-access helpers now live in `src/infrastructure/supabase/supabase.ts`.
 * - This file exists only to preserve existing imports like `@/lib/supabase`.
 *
 * Rules:
 * - Do NOT add new logic here.
 * - Add/modify Supabase logic in `src/infrastructure/supabase/supabase.ts` instead.
 *
 * Note:
 * - Use a relative import so test tooling (Vitest/Vite) does not depend on Next.js-only path aliases.
 */

export {
  supabase,
  fetchCategoryBudgets,
  saveCategoryBudgets,
  type ProfileRow as Profile,
  type TransactionRow as Transaction,
  type ForecastRow as Forecast,
  type CategoryBudgetRow,
  type DebtItemRow,
  fetchDebtItems,
  insertDebtItem,
  updateDebtItem,
  deleteDebtItem,
} from "../src/infrastructure/supabase/supabase";
