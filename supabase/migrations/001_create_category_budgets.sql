-- งบรายจ่ายรายเดือนต่อหมวด (บาท) ต่อผู้ใช้
-- รันใน Supabase Dashboard > SQL Editor

-- สร้างตาราง category_budgets
CREATE TABLE IF NOT EXISTS public.category_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL,
  budget numeric NOT NULL DEFAULT 0 CHECK (budget >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, category)
);

-- สร้าง index สำหรับ query ตาม user_id
CREATE INDEX IF NOT EXISTS idx_category_budgets_user_id ON public.category_budgets(user_id);

-- เปิดใช้ Row Level Security (RLS)
ALTER TABLE public.category_budgets ENABLE ROW LEVEL SECURITY;

-- นโยบาย: ผู้ใช้เห็นและแก้ไขได้เฉพาะแถวของตัวเอง (ลบก่อนสร้างเพื่อให้รันซ้ำได้)
DROP POLICY IF EXISTS "Users can manage own category budgets" ON public.category_budgets;
CREATE POLICY "Users can manage own category budgets"
  ON public.category_budgets
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- หมายเหตุ: หลังรันแล้ว แอปจะโหลด/บันทึกงบต่อหมวดจากตารางนี้แทน localStorage
