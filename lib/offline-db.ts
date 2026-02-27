/**
 * Legacy Offline IndexedDB entrypoint (backward-compatible).
 *
 * Clean Architecture refactor:
 * - Offline IndexedDB implementation now lives in `src/infrastructure/offline/offline-db.ts`.
 * - This file exists only to preserve existing imports like `@/lib/offline-db`.
 *
 * Rules:
 * - Do NOT add new logic here.
 * - Add/modify offline DB logic in `src/infrastructure/offline/offline-db.ts` instead.
 *
 * Note:
 * - Use a relative import so test tooling does not depend on Next.js-only path aliases.
 */

export {
  offlineDB,
  type OfflineTransaction,
  type OfflineProfile,
  type OfflineForecast,
} from "../src/infrastructure/offline/offline-db";
