/**
 * Backward-compatible re-export (legacy path).
 *
 * During the clean-architecture refactor we moved pure financial calculation
 * helpers into the domain layer at `src/domain/finance/finance.ts`.
 *
 * Keep this file so existing imports like `@/lib/finance` continue to work
 * while we migrate code incrementally.
 *
 * NOTE (Vitest/Vite):
 * - Use a relative path here to avoid relying on Next.js-only TS path aliases.
 *
 * Rules:
 * - Do NOT add new logic here.
 * - Add/modify logic in `src/domain/finance/finance.ts` instead.
 */

export * from "../src/domain/finance/finance";
