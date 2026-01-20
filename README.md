# MoneyPlan AI - เว็บแอพวางแผนการเงินส่วนบุคคล

เว็บแอพสำหรับวางแผนและจัดการการเงินส่วนบุคคล พร้อมระบบวิเคราะห์สถานะการเงินอัตโนมัติ

## ฟีเจอร์

- 🔐 ระบบ Authentication (Login/Register)
- 📊 Dashboard พร้อมการวิเคราะห์สถานะการเงิน
- 💰 จัดการรายรับรายจ่าย (Transactions)
- 📈 จัดการข้อมูลสุขภาพการเงิน (Profile)
- 📅 แผน 12 เดือน (Forecasts)
- 🤖 ระบบวิเคราะห์สถานะการเงินอัตโนมัติ

## เทคโนโลยีที่ใช้

- **Next.js 14** - React Framework
- **TypeScript** - Type Safety
- **Tailwind CSS** - Styling
- **Supabase** - Backend & Database
- **Vercel** - Deployment

## การติดตั้ง

1. Clone repository
```bash
git clone <repository-url>
cd moneyplan-ai
```

2. ติดตั้ง dependencies
```bash
npm install
```

3. ตั้งค่า environment variables
สร้างไฟล์ `.env.local` และเพิ่ม:
```
NEXT_PUBLIC_SUPABASE_URL=https://lcibdxdpvzzprhsukwkb.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjaWJkeGRwdnp6cHJoc3Vrd2tiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyOTk0ODEsImV4cCI6MjA4Mzg3NTQ4MX0.cYQNyO-wQJpxDlXcWx0Ff9IBfemwRkSt9UySoB69FAk
```

4. รัน development server
```bash
npm run dev
```

5. เปิดเบราว์เซอร์ไปที่ [http://localhost:3000](http://localhost:3000)

## การ Deploy บน Vercel

### วิธีที่ 1: Deploy ผ่าน Vercel Dashboard

1. **Push code ไปยัง GitHub repository**
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push origin main
   ```

2. **ไปที่ [Vercel](https://vercel.com) และ Sign in**
   - ใช้ GitHub account เพื่อเชื่อมต่อ

3. **Import Project**
   - คลิก "Add New..." → "Project"
   - เลือก repository `moneyplan-ai`
   - Vercel จะ detect Next.js อัตโนมัติ

4. **ตั้งค่า Environment Variables**
   - ในหน้า Project Settings → Environment Variables
   - เพิ่มตัวแปรต่อไปนี้:
     ```
     NEXT_PUBLIC_SUPABASE_URL=https://lcibdxdpvzzprhsukwkb.supabase.co
     NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjaWJkeGRwdnp6cHJoc3Vrd2tiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyOTk0ODEsImV4cCI6MjA4Mzg3NTQ4MX0.cYQNyO-wQJpxDlXcWx0Ff9IBfemwRkSt9UySoB69FAk
     ```
   - เลือก Environment: Production, Preview, Development (หรือเลือกทั้งหมด)

5. **Deploy!**
   - คลิก "Deploy"
   - รอให้ build เสร็จ (ประมาณ 2-3 นาที)
   - จะได้ URL สำหรับเข้าถึงแอป

### วิธีที่ 2: Deploy ผ่าน Vercel CLI

1. **ติดตั้ง Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **Login**
   ```bash
   vercel login
   ```

3. **Deploy**
   ```bash
   vercel
   ```
   - ตอบคำถามตามที่ถาม
   - เพิ่ม Environment Variables เมื่อถูกถาม

4. **Deploy Production**
   ```bash
   vercel --prod
   ```

### หมายเหตุ

- **Region**: Project ตั้งค่าให้ deploy ที่ `sin1` (Singapore) เพื่อความเร็วในประเทศไทย
- **Environment Variables**: ต้องตั้งค่าใน Vercel Dashboard หรือผ่าน CLI
- **Build Command**: `npm run build` (ตั้งค่าไว้ใน `vercel.json` แล้ว)
- **Framework**: Next.js (auto-detect)

### ตรวจสอบการ Deploy

หลังจาก deploy เสร็จ:
1. ตรวจสอบว่า build ผ่าน (ไม่มี error)
2. ทดสอบการเข้าสู่ระบบ
3. ทดสอบการใช้งานฟีเจอร์ต่างๆ

## Database Schema

### profiles
- `id` (uuid, primary key)
- `monthly_debt_payment` (numeric)
- `fixed_expense` (numeric)
- `variable_expense` (numeric)
- `saving` (numeric)
- `investment` (numeric)
- `liquid_assets` (numeric)
- `total_assets` (numeric)
- `total_liabilities` (numeric)

### transactions
- `id` (uuid, primary key)
- `user_id` (uuid, foreign key)
- `type` (text: 'income' | 'expense')
- `amount` (numeric)
- `category` (text)
- `date` (date)

### forecasts
- `id` (uuid, primary key)
- `user_id` (uuid, foreign key)
- `month_index` (int: 0-11)
- `income` (numeric)
- `expense` (numeric)
- `note` (text)

## License

MIT
