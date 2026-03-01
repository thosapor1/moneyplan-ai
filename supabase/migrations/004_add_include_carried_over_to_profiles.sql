-- เก็บค่าตั้งค่า "รวมยอดยกมาจากเดือนที่แล้ว" ใน dashboard (true = รวม, false = ไม่รวม)
-- รันใน Supabase Dashboard > SQL Editor

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS include_carried_over boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.profiles.include_carried_over IS 'true = แสดงยอดคงเหลือรวมยอดยกมาจากเดือนที่แล้ว, false = ไม่รวม';
