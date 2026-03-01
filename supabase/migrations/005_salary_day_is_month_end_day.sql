-- Migration 005: Harden salary-day constraint + add comment to profiles
--
-- Context:
--   The domain layer uses "salaryDay" (SalaryConfig.salaryDay).
--   The DB stores this as `profiles.month_end_day`.
--   They are the same concept:
--     salaryDay (domain) ↔ month_end_day (DB) ↔ monthEndDay (localStorage)
--
--   Rules:
--     0     → Calendar month (no custom cycle)
--     1–31  → Salary-day cycle: starts on day N, ends on day N-1 next month
--             Values > last-day-of-month are clamped in application code.
--
--   Budget cycles are COMPUTED at runtime — never stored. No budget_cycles table needed.
--   Carry-forward (include_carried_over) now applies to ALL cycle types.

-- 1. Add a DB-level check so invalid values can never be persisted.
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_month_end_day_range
  CHECK (month_end_day >= 0 AND month_end_day <= 31);

-- 2. Self-documenting column comment so future engineers understand the convention.
COMMENT ON COLUMN public.profiles.month_end_day IS
  'Salary / billing cycle start day (0 = calendar month, 1–31 = custom cycle). '
  'Application alias: SalaryConfig.salaryDay. '
  'Budget cycle boundaries are computed at runtime; nothing is stored in a separate table.';
