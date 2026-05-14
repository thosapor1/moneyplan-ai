-- Centralize expense-category catalog in the DB so the app picks them up
-- without code changes. Rows with user_id = NULL are global defaults; rows
-- with a user_id are per-user overrides.
--
-- Run in Supabase Dashboard > SQL Editor. Idempotent.

CREATE TABLE IF NOT EXISTS public.expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('fixed', 'variable')),
  icon_key text NOT NULL DEFAULT 'other',
  sort_order int NOT NULL DEFAULT 0,
  is_hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One row per (user, name). NULL user_id => global default; only one global
-- row per name allowed.
CREATE UNIQUE INDEX IF NOT EXISTS expense_categories_user_name_unique
  ON public.expense_categories (COALESCE(user_id::text, ''), name);

CREATE INDEX IF NOT EXISTS idx_expense_categories_user_id
  ON public.expense_categories(user_id);

-- RLS: users can read global rows (user_id IS NULL) and their own rows.
-- They can write only their own rows.
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read global + own expense categories"
  ON public.expense_categories;
CREATE POLICY "Read global + own expense categories"
  ON public.expense_categories
  FOR SELECT
  USING (user_id IS NULL OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Insert own expense categories"
  ON public.expense_categories;
CREATE POLICY "Insert own expense categories"
  ON public.expense_categories
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Update own expense categories"
  ON public.expense_categories;
CREATE POLICY "Update own expense categories"
  ON public.expense_categories
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Delete own expense categories"
  ON public.expense_categories;
CREATE POLICY "Delete own expense categories"
  ON public.expense_categories
  FOR DELETE
  USING (auth.uid() = user_id);

-- ─── Seed global defaults ────────────────────────────────────────────────────
-- All 27 categories (11 original + 16 from parse-kbank-statement parser).
-- Re-running is safe: ON CONFLICT keeps existing rows intact.

INSERT INTO public.expense_categories (user_id, name, kind, icon_key, sort_order)
VALUES
  -- Food family (variable)
  (NULL, 'ค่าอาหาร',              'variable', 'food',          10),
  (NULL, 'อาหารร้าน',             'variable', 'food',          11),
  (NULL, 'อาหารร้าน (QR)',        'variable', 'food',          12),
  (NULL, 'ฟู้ดเดลิเวอรี่',         'variable', 'food',          13),
  (NULL, 'คาเฟ่',                 'variable', 'food',          14),
  (NULL, 'ร้านสะดวกซื้อ',         'variable', 'food',          15),
  -- Transit (variable)
  (NULL, 'ค่าเดินทาง',            'variable', 'transit',       20),
  (NULL, 'BTS Rabbit Card',       'variable', 'transit',       21),
  -- Shopping (variable)
  (NULL, 'ช้อปปิ้ง',               'variable', 'shopping',      30),
  (NULL, 'ช้อปปิ้ง/ของใช้',        'variable', 'shopping',      31),
  -- Bills (fixed)
  (NULL, 'บิล/ค่าใช้จ่าย',         'fixed',    'utilities',     40),
  (NULL, 'มือถือ (AIS)',          'fixed',    'phone',         41),
  (NULL, 'TrueMoney (auto-debit)','fixed',    'utilities',     42),
  (NULL, 'บิลอื่นๆ',               'fixed',    'utilities',     43),
  -- Lifestyle (variable)
  (NULL, 'ค่าสุขภาพ',              'variable', 'health',        50),
  (NULL, 'ค่าบันเทิง',             'variable', 'entertainment', 51),
  (NULL, 'ค่าการศึกษา',            'variable', 'education',     52),
  -- Debt (fixed)
  (NULL, 'ผ่อนชำระหนี้',           'fixed',    'debt',          60),
  (NULL, 'หนี้ TTB Cash Card',     'fixed',    'debt',          61),
  (NULL, 'หนี้บัตรเครดิต KBank',   'fixed',    'debt',          62),
  -- Savings / transfers (fixed-ish)
  (NULL, 'ออมเงิน',                'fixed',    'savings',       70),
  (NULL, 'ค่าบ้าน+เงินเก็บ (เมีย)','fixed',    'home',          71),
  (NULL, 'โอนไปบัญชีตัวเอง',       'fixed',    'savings',       72),
  (NULL, 'ลงทุน',                  'fixed',    'investment',    73),
  -- Other (variable — counts toward daily safe-spend)
  (NULL, 'โอนให้คน',               'variable', 'other',         80),
  (NULL, 'ถอนเงินสด',              'variable', 'other',         81),
  (NULL, 'อื่นๆ',                  'variable', 'other',         82)
ON CONFLICT (COALESCE(user_id::text, ''), name) DO NOTHING;
