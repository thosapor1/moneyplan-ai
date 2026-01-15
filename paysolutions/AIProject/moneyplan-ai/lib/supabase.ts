import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lcibdxdpvzzprhsukwkb.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjaWJkeGRwdnp6cHJoc3Vrd2tiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyOTk0ODEsImV4cCI6MjA4Mzg3NTQ4MX0.cYQNyO-wQJpxDlXcWx0Ff9IBfemwRkSt9UySoB69FAk'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

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
