-- วันสิ้นเดือนที่กำหนดเอง (0 = ตามปฏิทิน, 1-31 = ใช้วันนั้นเป็นวันสิ้นเดือน)
-- รันใน Supabase Dashboard > SQL Editor

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS month_end_day integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.profiles.month_end_day IS '0=ตามปฏิทิน, 1-31=ใช้วันนั้นเป็นวันสิ้นเดือนสำหรับคำนวณช่วงและงบ';
