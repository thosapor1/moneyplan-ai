/**
 * Infrastructure: BrowserNetworkStatusAdapter
 *
 * Implements the application-layer `NetworkStatusPort` using browser APIs.
 *
 * Clean Architecture notes:
 * - This is infrastructure because it touches browser globals (`navigator`).
 * - Application layer should depend on the `NetworkStatusPort` interface only.
 *
 * SSR safety:
 * - On the server, `navigator` is not available, so we default to `true`
 *   (treat as online). The sync coordinator also guards against running
 *   in situations where it shouldn't.
 */

import type { NetworkStatusPort } from "@/src/application/sync/ports/sync-ports";

export class BrowserNetworkStatusAdapter implements NetworkStatusPort {
  isOnline(): boolean {
    // In SSR / non-browser environments, assume online to avoid blocking.
    // (The sync coordinator should only be used in client runtime anyway.)
    if (typeof navigator === "undefined") return true;

    // `navigator.onLine` is a coarse signal, but good enough for "should we attempt sync".
    // Real failures will be caught by backend adapter calls.
    return Boolean(navigator.onLine);
  }
}

/** Convenience singleton instance. Prefer injecting at a composition root. */
export const browserNetworkStatusAdapter = new BrowserNetworkStatusAdapter();
