/**
 * Infrastructure: SupabaseBackendSyncAdapter
 *
 * Implements the application-layer `BackendSyncPort` using Supabase.
 *
 * Clean Architecture notes:
 * - This file is infrastructure (I/O allowed).
 * - It depends on Supabase client from `src/infrastructure/supabase/supabase.ts`.
 * - Application layer should only see the `BackendSyncPort` interface, not Supabase details.
 */

import type { BackendSyncPort, UUID } from "@/src/application/sync/ports/sync-ports";
import { supabase } from "@/src/infrastructure/supabase/supabase";

type SupabaseErrorLike = {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
};

function toError(e: unknown, context: string): Error {
  if (e instanceof Error) return e;
  const msg = typeof e === "string" ? e : JSON.stringify(e);
  return new Error(`${context}: ${msg}`);
}

function throwIfSupabaseError(error: SupabaseErrorLike | null, context: string): void {
  if (!error) return;
  const parts = [
    error.message ? `message=${error.message}` : null,
    error.code ? `code=${error.code}` : null,
    error.details ? `details=${error.details}` : null,
    error.hint ? `hint=${error.hint}` : null,
  ].filter(Boolean);
  throw new Error(`${context}${parts.length ? ` (${parts.join(", ")})` : ""}`);
}

/**
 * Adapter class (simple, stateless).
 * You can create one instance and reuse it.
 */
export class SupabaseBackendSyncAdapter implements BackendSyncPort {
  async insertTransaction(input: {
    user_id: UUID;
    created_at: string;
    type: "income" | "expense";
    amount: number;
    category: string | null;
    date: string;
  }): Promise<{ id: UUID }> {
    try {
      const result = await supabase
        .from("transactions")
        .insert({
          user_id: input.user_id,
          created_at: input.created_at,
          type: input.type,
          amount: Number(input.amount),
          category: input.category ?? null,
          date: input.date,
        })
        .select("id")
        .single();

      throwIfSupabaseError(result.error as any, "insertTransaction failed");

      const id = (result.data as any)?.id as UUID | undefined;
      if (!id) throw new Error("insertTransaction succeeded but no id returned");
      return { id };
    } catch (e) {
      throw toError(e, "SupabaseBackendSyncAdapter.insertTransaction");
    }
  }

  async updateTransactionById(
    id: UUID,
    input: {
      type: "income" | "expense";
      amount: number;
      category: string | null;
      date: string;
    }
  ): Promise<void> {
    try {
      const result = await supabase
        .from("transactions")
        .update({
          type: input.type,
          amount: Number(input.amount),
          category: input.category ?? null,
          date: input.date,
        })
        .eq("id", id)
        .select("id")
        .single();

      throwIfSupabaseError(result.error as any, `updateTransactionById failed (id=${id})`);

      // If `.single()` returns no row, it might be RLS or not found.
      const updatedId = (result.data as any)?.id as UUID | undefined;
      if (!updatedId) {
        throw new Error(`updateTransactionById succeeded but no row returned (id=${id})`);
      }
    } catch (e) {
      throw toError(e, "SupabaseBackendSyncAdapter.updateTransactionById");
    }
  }

  async upsertProfile(input: {
    id: UUID;
    full_name?: string;
    email?: string;
    phone?: string;
  }): Promise<{ id: UUID }> {
    try {
      const result = await supabase
        .from("profiles")
        .upsert({
          id: input.id,
          full_name: input.full_name,
          email: input.email,
          phone: input.phone,
        })
        .select("id")
        .single();

      throwIfSupabaseError(result.error as any, "upsertProfile failed");

      const id = (result.data as any)?.id as UUID | undefined;
      if (!id) throw new Error("upsertProfile succeeded but no id returned");
      return { id };
    } catch (e) {
      throw toError(e, "SupabaseBackendSyncAdapter.upsertProfile");
    }
  }

  async upsertForecast(input: {
    user_id: UUID;
    month_index: number;
    income: number;
    expense: number;
    note?: string;
  }): Promise<{ id: UUID }> {
    try {
      const result = await supabase
        .from("forecasts")
        .upsert({
          user_id: input.user_id,
          month_index: input.month_index,
          income: Number(input.income),
          expense: Number(input.expense),
          note: input.note,
        })
        .select("id")
        .single();

      throwIfSupabaseError(result.error as any, "upsertForecast failed");

      const id = (result.data as any)?.id as UUID | undefined;
      if (!id) throw new Error("upsertForecast succeeded but no id returned");
      return { id };
    } catch (e) {
      throw toError(e, "SupabaseBackendSyncAdapter.upsertForecast");
    }
  }
}

/**
 * Convenience singleton instance (optional).
 * Prefer injecting this into the SyncCoordinator at the composition root.
 */
export const supabaseBackendSyncAdapter = new SupabaseBackendSyncAdapter();
