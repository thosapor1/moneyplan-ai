import { createClient } from '@supabase/supabase-js'

/**
 * Infrastructure: Supabase client + thin data-access helpers.
 *
 * Clean Architecture notes:
 * - This file is allowed to do I/O (network) and read environment variables.
 * - Keep business rules out of here; put them in `src/domain/**` or `src/application/**`.
 * - Other layers should depend on these exports via stable interfaces (later we’ll add ports in application layer).
 */

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lcibdxdpvzzprhsukwkb.supabase.co'

/**
 * SECURITY NOTE:
 * - This fallback anon key exists for local/dev convenience but is not ideal.
 * - Prefer configuring `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local` / Vercel.
 * - Never place service-role keys in `NEXT_PUBLIC_*`.
 */
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjaWJkeGRwdnp6cHJoc3Vrd2tiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyOTk0ODEsImV4cCI6MjA4Mzg3NTQ4MX0.cYQNyO-wQJpxDlXcWx0Ff9IBfemwRkSt9UySoB69FAk'

// Create Supabase client with conservative defaults for a web app.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: { schema: 'public' },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  global: {
    headers: {
      'x-client-info': 'moneyplan-ai',
    },
  },
  // Reduce realtime chatter; this app appears to be request/response oriented.
  realtime: {
    params: { eventsPerSecond: 2 },
  },
})

/**
 * Data shapes used by the current app.
 * (Later we can map these to domain models via mappers in application/presentation.)
 */
export type ProfileRow = {
  id: string
  updated_at?: string
  monthly_debt_payment: number
  fixed_expense: number
  variable_expense: number
  saving: number
  investment: number
  liquid_assets: number
  total_assets: number
  total_liabilities: number
  /** 0 = calendar month, 1-31 = custom month end day */
  month_end_day?: number
}

export type TransactionRow = {
  id: string
  user_id: string
  created_at: string
  type: 'income' | 'expense'
  amount: number
  category?: string
  description?: string
  date: string
}

export type ForecastRow = {
  id: string
  user_id: string
  month_index: number
  income: number
  expense: number
  note?: string
}

export type CategoryBudgetRow = {
  id: string
  user_id: string
  category: string
  budget: number
  updated_at?: string
}

export type DebtItemRow = {
  id: string
  user_id: string
  name: string
  remaining: number
  interest_rate?: number
  priority?: 'high' | 'normal'
  sort_order: number
  created_at?: string
  updated_at?: string
}

/** Load per-category monthly budgets (บาท) for the user. */
export async function fetchCategoryBudgets(userId: string): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('category_budgets')
    .select('category, budget')
    .eq('user_id', userId)

  if (error) {
    console.error('fetchCategoryBudgets:', error)
    return {}
  }

  const result: Record<string, number> = {}
  for (const row of data || []) {
    const n = Number((row as any).budget)
    const category = String((row as any).category ?? '').trim()
    if (category && !Number.isNaN(n) && n >= 0) result[category] = n
  }
  return result
}

/**
 * Save per-category monthly budgets (upsert by user_id + category).
 * Returns `{ error }` to match the existing code’s calling style.
 */
export async function saveCategoryBudgets(
  userId: string,
  budgets: Record<string, number>
): Promise<{ error: Error | null }> {
  const rows = Object.entries(budgets).map(([category, budget]) => ({
    user_id: userId,
    category,
    budget: Number(budget) || 0,
    updated_at: new Date().toISOString(),
  }))

  const { error } = await supabase.from('category_budgets').upsert(rows, {
    onConflict: 'user_id,category',
  })

  if (error) {
    console.error('saveCategoryBudgets:', error)
    return { error }
  }
  return { error: null }
}

export async function fetchDebtItems(userId: string): Promise<DebtItemRow[]> {
  const { data, error } = await supabase
    .from('debt_items')
    .select('*')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) {
    console.error('fetchDebtItems:', error)
    return []
  }
  return (data || []).map((row: any) => ({
    id: row.id,
    user_id: row.user_id,
    name: String(row.name ?? ''),
    remaining: Number(row.remaining) ?? 0,
    interest_rate: row.interest_rate != null ? Number(row.interest_rate) : undefined,
    priority: row.priority === 'high' || row.priority === 'normal' ? row.priority : undefined,
    sort_order: Number(row.sort_order) ?? 0,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }))
}

export async function insertDebtItem(
  userId: string,
  item: { name: string; remaining: number; interest_rate?: number; priority?: 'high' | 'normal' }
): Promise<DebtItemRow | null> {
  const existing = await fetchDebtItems(userId)
  const { data, error } = await supabase
    .from('debt_items')
    .insert({
      user_id: userId,
      name: item.name.trim(),
      remaining: Number(item.remaining) || 0,
      interest_rate: item.interest_rate != null ? Number(item.interest_rate) : null,
      priority: item.priority ?? null,
      sort_order: existing.length,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single()
  if (error) {
    console.error('insertDebtItem:', error)
    return null
  }
  return data as DebtItemRow
}

export async function updateDebtItem(
  id: string,
  updates: { name?: string; remaining?: number; interest_rate?: number | null; priority?: 'high' | 'normal' | null }
): Promise<{ error: Error | null }> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (updates.name !== undefined) row.name = updates.name.trim()
  if (updates.remaining !== undefined) row.remaining = updates.remaining
  if (updates.interest_rate !== undefined) row.interest_rate = updates.interest_rate
  if (updates.priority !== undefined) row.priority = updates.priority
  const { error } = await supabase.from('debt_items').update(row).eq('id', id)
  if (error) {
    console.error('updateDebtItem:', error)
    return { error }
  }
  return { error: null }
}

export async function deleteDebtItem(id: string): Promise<{ error: Error | null }> {
  const { error } = await supabase.from('debt_items').delete().eq('id', id)
  if (error) {
    console.error('deleteDebtItem:', error)
    return { error }
  }
  return { error: null }
}
