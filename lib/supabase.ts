import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lcibdxdpvzzprhsukwkb.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjaWJkeGRwdnp6cHJoc3Vrd2tiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyOTk0ODEsImV4cCI6MjA4Mzg3NTQ4MX0.cYQNyO-wQJpxDlXcWx0Ff9IBfemwRkSt9UySoB69FAk'

// Create Supabase client with request deduplication
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: {
    schema: 'public',
  },
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
  // Disable realtime for better performance
  realtime: {
    params: {
      eventsPerSecond: 2,
    },
  },
})

export type Profile = {
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
}

export type Transaction = {
  id: string
  user_id: string
  created_at: string
  type: 'income' | 'expense'
  amount: number
  category?: string
  description?: string
  date: string
}

export type Forecast = {
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

/** โหลดงบรายจ่ายรายเดือนต่อหมวด (บาท) จาก DB */
export async function fetchCategoryBudgets(
  userId: string
): Promise<Record<string, number>> {
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
    const n = Number(row.budget)
    if (!isNaN(n) && n >= 0) result[row.category] = n
  }
  return result
}

/** บันทึกงบรายจ่ายรายเดือนต่อหมวดลง DB (upsert ตาม user_id + category) */
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
