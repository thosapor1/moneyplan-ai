-- เพิ่มฟิลด์ original (ยอดหนี้เริ่มต้น) ใน debt_items
-- รันใน Supabase Dashboard > SQL Editor

ALTER TABLE public.debt_items
  ADD COLUMN IF NOT EXISTS original numeric NOT NULL DEFAULT 0 CHECK (original >= 0);

-- สำหรับ record เดิม: ให้ original = remaining (ยังไม่มีข้อมูลเริ่มต้น → ถือว่ายังไม่ผ่อน)
UPDATE public.debt_items
  SET original = remaining
  WHERE original = 0;
