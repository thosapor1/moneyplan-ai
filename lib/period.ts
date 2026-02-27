/**
 * Backward-compatible re-export (legacy path).
 *
 * During the clean-architecture refactor we moved pure period/billing-period
 * helpers into the domain layer at `src/domain/period/period.ts`.
 *
 * Keep this file so existing imports like `@/lib/period` continue to work
 * while we migrate code incrementally.
 *
 * Rules:
 * - Do NOT add new logic here.
 * - Add/modify logic in `src/domain/period/period.ts` instead.
 */

export * from "../src/domain/period/period";
