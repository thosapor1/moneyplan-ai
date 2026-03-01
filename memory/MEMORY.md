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

## Thai UI conventions
- All categories in Thai: อาหาร, เดินทาง, ช้อปปิ้ง, บิล/ค่าใช้จ่าย, สุขภาพ, บันเทิง, การศึกษา, ผ่อนชำระหนี้, ออมเงิน, ลงทุน, อื่นๆ
- Fixed categories: บิล/ค่าใช้จ่าย, ผ่อนชำระหนี้, ออมเงิน, ลงทุน
- Variable categories: อาหาร, เดินทาง, ช้อปปิ้ง, สุขภาพ, บันเทิง, การศึกษา, อื่นๆ
