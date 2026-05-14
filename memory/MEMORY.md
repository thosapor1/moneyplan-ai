# MoneyPlan-AI — Project Memory

## Architecture
Clean Architecture: `src/domain` → `src/application` → `src/infrastructure` → `app/` (Next.js pages).

## Key Concepts
- **monthEndDay / salaryDay** — THE SAME CONCEPT. DB column: `profiles.month_end_day`. Domain name: `SalaryConfig.salaryDay`. localStorage key: `moneyplan_month_end_day`. Value 0 = calendar month; 1–31 = custom salary cycle.
- **Budget Cycle** — Computed at runtime from `today + salaryDay`. Never stored in DB. `getActiveMonthRange(today, salaryDay)` from `src/domain/period/period.ts` is the single source of truth for cycle boundaries.
- **Carry-forward** — Controlled by `profiles.include_carried_over`. Works for ALL cycle types (calendar + custom salary-day).

## Key Files
- `src/domain/period/period.ts` — Period math. `getActiveMonthRange`, `getRemainingDaysInPeriod`, `getPeriodDays`. Single source of truth for date arithmetic.
- `src/domain/finance/finance.ts` — Financial calculations. `getMonthRange`, `computeSpentByCategory`, `computeDailyBudgetFromRemaining`.
- `src/domain/forecast/forecast.ts` — `computeVariableDailyRate`, `computePlannedRemaining`, `computeForecastEnd`. Already cycle-aware (accepts `periodStart`/`periodEnd`).
- `src/domain/budget/budget-cycle.ts` — **NEW** BudgetCycle type, SalaryConfig type, `formatCycleLabel` ("27 ก.พ. – 26 มี.ค."), `calculateDailySafeSpend`.
- `src/application/budget/budget-service.ts` — **NEW** `computeBudgetCycleResult()` — pure orchestration of all cycle metrics from raw inputs.
- `src/infrastructure/storage/local-settings.ts` — `getSalaryDay`/`setSalaryDay` are aliases for `getMonthEndDay`/`setMonthEndDay`.
- `src/infrastructure/supabase/supabase.ts` — Supabase client + `ProfileRow`, `TransactionRow`, category budgets, debt items.

## Dashboard (app/dashboard/page.tsx)
- `monthEndDay` is now read from `profile?.month_end_day ?? 0` (was hardcoded to 0).
- Carry-forward now works for ALL cycle types (custom salaryDay included).
- Hero card shows "งวด 27 ก.พ. – 26 มี.ค." via `formatCycleLabel`.
- Forecast (`computePlannedRemaining`) already receives correct cycle dates via `monthRange`.

## No New DB Tables Needed
Budget cycles are derived/computed — not stored. `month_end_day` column (migration 002) is sufficient.

## Expense Categories (DB-driven, migration 007)
Categories now live in `public.expense_categories` (migration `007_create_expense_categories.sql`). Loaded via `fetchExpenseCategories(userId)` → hook `useExpenseCategories()` (cached at module scope, falls back to seed defaults if table missing).
- Domain helpers (`getExpenseCategoryType`, `computeVariableDailyRate`, `computePlannedRemaining`) now accept an optional category list / classification — pure-domain default falls back to the seed constants in `src/domain/forecast/forecast.ts`.
- Icons resolve via a runtime registry (`registerCategoryIcons` in `src/presentation/category-icons/category-icons.tsx`) populated by the hook — new DB categories get icons without a code change.
- Seed list = 27 categories (11 original + 16 from `scripts/parse-kbank-statement.mjs` auto-categorizer): food sub-cats (อาหารร้าน, อาหารร้าน (QR), ฟู้ดเดลิเวอรี่, คาเฟ่, ร้านสะดวกซื้อ), transit (BTS Rabbit Card), bills (TrueMoney auto-debit, มือถือ AIS, บิลอื่นๆ), debts (หนี้ TTB Cash Card, หนี้บัตรเครดิต KBank), transfers/cash (โอนให้คน, โอนไปบัญชีตัวเอง, ถอนเงินสด), spouse home savings (ค่าบ้าน+เงินเก็บ (เมีย)), shopping (ช้อปปิ้ง/ของใช้).
- Migration must be applied manually in Supabase Dashboard > SQL Editor. App works without it (falls back to hardcoded seeds in `src/presentation/categories/expense-category-defaults.ts`).
- Diagnostic script: `SUPABASE_SERVICE_ROLE_KEY=... node scripts/list-db-categories.mjs` lists distinct category values in transactions/budgets and flags novel names.
