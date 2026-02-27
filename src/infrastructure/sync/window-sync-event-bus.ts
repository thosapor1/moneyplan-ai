/**
 * Infrastructure: WindowSyncEventBus
 *
 * Emits browser `CustomEvent`s on `window` so UI components can listen for sync results.
 *
 * Current UI usage in this repo:
 * - `components/ServiceWorkerRegistration.tsx` listens for:
 *   - `window.addEventListener('sync-complete', ...)`
 *
 * Clean Architecture notes:
 * - Application layer depends on `SyncEventBusPort` interface only.
 * - This adapter is infrastructure because it touches browser globals (`window`).
 *
 * SSR safety:
 * - On the server there is no `window`, so emitting becomes a no-op.
 */

import type { SyncEventBusPort } from "@/src/application/sync/ports/sync-ports";

export type SyncCompleteDetail = { successCount: number; totalCount: number };
export type SyncErrorDetail = { message: string; cause?: unknown };

const SYNC_COMPLETE_EVENT_NAME = "sync-complete";
const SYNC_ERROR_EVENT_NAME = "sync-error";

function hasWindow(): boolean {
  return typeof window !== "undefined" && typeof window.dispatchEvent === "function";
}

export class WindowSyncEventBus implements SyncEventBusPort {
  emitSyncComplete(detail: SyncCompleteDetail): void {
    if (!hasWindow()) return;

    // Use CustomEvent so listeners can access `event.detail`.
    const evt = new CustomEvent<SyncCompleteDetail>(SYNC_COMPLETE_EVENT_NAME, { detail });
    window.dispatchEvent(evt);
  }

  emitSyncError(detail: SyncErrorDetail): void {
    if (!hasWindow()) return;

    const evt = new CustomEvent<SyncErrorDetail>(SYNC_ERROR_EVENT_NAME, { detail });
    window.dispatchEvent(evt);
  }
}

/**
 * Convenience singleton.
 * Prefer injecting at a composition root, but this is practical for incremental refactors.
 */
export const windowSyncEventBus = new WindowSyncEventBus();
