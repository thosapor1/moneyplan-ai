/**
 * Legacy sync service module (backward-compatible).
 *
 * Clean Architecture refactor:
 * - The real implementation now lives in `src/infrastructure/sync/sync-service.ts`.
 * - This file exists only to preserve existing imports like `@/lib/sync-service`.
 *
 * Rules:
 * - Do NOT add new logic here.
 * - Add/modify sync behavior in `src/infrastructure/sync/sync-service.ts` instead.
 *
 * Note:
 * - Use a relative import so test tooling does not depend on Next.js-only path aliases.
 */

// Re-export the new implementation.
export {
  SyncService,
  syncService,
} from "../src/infrastructure/sync/sync-service";
