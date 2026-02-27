/**
 * Infrastructure: SupabaseAuthSessionAdapter
 *
 * Implements the application-layer `AuthSessionPort` using Supabase auth.
 *
 * Clean Architecture notes:
 * - Application layer depends on the `AuthSessionPort` interface, not Supabase.
 * - This adapter is allowed to perform I/O and talk to Supabase SDK.
 *
 * Behavior:
 * - `getSession()` returns `{ user: { id } }` when logged in, otherwise `null`.
 * - Errors are logged and treated as "no session" (so sync can retry gracefully).
 */

import type { AuthSession, AuthSessionPort } from "@/src/application/sync/ports/sync-ports";
import { supabase } from "@/src/infrastructure/supabase/supabase";

export class SupabaseAuthSessionAdapter implements AuthSessionPort {
  async getSession(): Promise<AuthSession | null> {
    try {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        // Treat as transient; sync coordinator will retry based on its policy.
        console.warn("[SupabaseAuthSessionAdapter] getSession error:", {
          message: (error as any)?.message,
          status: (error as any)?.status,
          name: (error as any)?.name,
        });
        return null;
      }

      const session = (data as any)?.session;
      const userId = session?.user?.id;

      if (!userId || typeof userId !== "string") return null;

      return { user: { id: userId } };
    } catch (e) {
      console.warn("[SupabaseAuthSessionAdapter] getSession threw:", e);
      return null;
    }
  }
}

/** Convenience singleton instance. Prefer injecting at a composition root. */
export const supabaseAuthSessionAdapter = new SupabaseAuthSessionAdapter();
