/**
 * Domain barrel exports
 *
 * Purpose:
 * - Give the app a single import path for pure business rules (domain).
 * - Keep outward dependencies stable while we refactor internals.
 *
 * Rules:
 * - Only export "pure" modules here (no Supabase, no browser APIs, no storage).
 */

export * from "./finance/finance";

// Avoid wildcard export here because both finance + period export `DateRange`.
// Re-export period explicitly to prevent name collisions in the barrel.
export {
  type DateRange as PeriodDateRange,
  getActivePeriodMonth,
  getActiveMonthRange,
  getPeriodDays,
  getRemainingDaysInPeriod,
  getDaysElapsedInPeriod,
  formatRange,
} from "./period/period";
