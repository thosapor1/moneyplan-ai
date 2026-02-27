-- รายการหนี้แยกประเภท ต่อผู้ใช้
-- รันใน Supabase Dashboard > SQL Editor

CREATE TABLE IF NOT EXISTS public.debt_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  remaining numeric NOT NULL DEFAULT 0 CHECK (remaining >= 0),
  interest_rate numeric CHECK (interest_rate IS NULL OR interest_rate >= 0),
  priority text CHECK (priority IS NULL OR priority IN ('high', 'normal')),
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_debt_items_user_id ON public.debt_items(user_id);

ALTER TABLE public.debt_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own debt items" ON public.debt_items;
CREATE POLICY "Users can manage own debt items"
  ON public.debt_items
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
