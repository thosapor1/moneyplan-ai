/**
 * Built-in default expense categories.
 *
 * Used as a fallback when:
 * 1. The DB table `expense_categories` does not exist yet (migration 007 not applied).
 * 2. The fetch fails (offline / RLS / transient error).
 * 3. The DB returns an empty list.
 *
 * Keep this list aligned with the seed block in
 * `supabase/migrations/007_create_expense_categories.sql` so the rollout window
 * behaves identically with or without the DB table.
 */

import type {
  ExpenseCategoryKind,
  ExpenseCategoryRow,
} from '../../infrastructure/supabase/supabase'

type Seed = {
  name: string
  kind: ExpenseCategoryKind
  icon_key: string
  sort_order: number
}

const SEEDS: readonly Seed[] = [
  // Food
  { name: 'ค่าอาหาร',              kind: 'variable', icon_key: 'food',          sort_order: 10 },
  { name: 'อาหารร้าน',             kind: 'variable', icon_key: 'food',          sort_order: 11 },
  { name: 'อาหารร้าน (QR)',        kind: 'variable', icon_key: 'food',          sort_order: 12 },
  { name: 'ฟู้ดเดลิเวอรี่',         kind: 'variable', icon_key: 'food',          sort_order: 13 },
  { name: 'คาเฟ่',                 kind: 'variable', icon_key: 'food',          sort_order: 14 },
  { name: 'ร้านสะดวกซื้อ',         kind: 'variable', icon_key: 'food',          sort_order: 15 },
  // Transit
  { name: 'ค่าเดินทาง',            kind: 'variable', icon_key: 'transit',       sort_order: 20 },
  { name: 'BTS Rabbit Card',       kind: 'variable', icon_key: 'transit',       sort_order: 21 },
  // Shopping
  { name: 'ช้อปปิ้ง',               kind: 'variable', icon_key: 'shopping',      sort_order: 30 },
  { name: 'ช้อปปิ้ง/ของใช้',        kind: 'variable', icon_key: 'shopping',      sort_order: 31 },
  // Bills
  { name: 'บิล/ค่าใช้จ่าย',         kind: 'fixed',    icon_key: 'utilities',     sort_order: 40 },
  { name: 'มือถือ (AIS)',          kind: 'fixed',    icon_key: 'phone',         sort_order: 41 },
  { name: 'TrueMoney (auto-debit)', kind: 'fixed',   icon_key: 'utilities',     sort_order: 42 },
  { name: 'บิลอื่นๆ',               kind: 'fixed',    icon_key: 'utilities',     sort_order: 43 },
  // Lifestyle
  { name: 'ค่าสุขภาพ',              kind: 'variable', icon_key: 'health',        sort_order: 50 },
  { name: 'ค่าบันเทิง',             kind: 'variable', icon_key: 'entertainment', sort_order: 51 },
  { name: 'ค่าการศึกษา',            kind: 'variable', icon_key: 'education',     sort_order: 52 },
  // Debt
  { name: 'ผ่อนชำระหนี้',           kind: 'fixed',    icon_key: 'debt',          sort_order: 60 },
  { name: 'หนี้ TTB Cash Card',     kind: 'fixed',    icon_key: 'debt',          sort_order: 61 },
  { name: 'หนี้บัตรเครดิต KBank',   kind: 'fixed',    icon_key: 'debt',          sort_order: 62 },
  // Savings / transfers
  { name: 'ออมเงิน',                kind: 'fixed',    icon_key: 'savings',       sort_order: 70 },
  { name: 'ค่าบ้าน+เงินเก็บ (เมีย)', kind: 'fixed',   icon_key: 'home',          sort_order: 71 },
  { name: 'โอนไปบัญชีตัวเอง',       kind: 'fixed',    icon_key: 'savings',       sort_order: 72 },
  { name: 'ลงทุน',                  kind: 'fixed',    icon_key: 'investment',    sort_order: 73 },
  // Other (variable — counts toward daily safe-spend)
  { name: 'โอนให้คน',               kind: 'variable', icon_key: 'other',         sort_order: 80 },
  { name: 'ถอนเงินสด',              kind: 'variable', icon_key: 'other',         sort_order: 81 },
  { name: 'อื่นๆ',                  kind: 'variable', icon_key: 'other',         sort_order: 82 },
]

/** Default categories as ExpenseCategoryRow-shaped objects (with synthetic ids). */
export function getDefaultExpenseCategories(): ExpenseCategoryRow[] {
  return SEEDS.map((s) => ({
    id: `default:${s.name}`,
    user_id: null,
    name: s.name,
    kind: s.kind,
    icon_key: s.icon_key,
    sort_order: s.sort_order,
    is_hidden: false,
  }))
}
