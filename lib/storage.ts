/**
 * ค่าคงที่และฟังก์ชันสำหรับเก็บข้อมูลใน localStorage
 * - หมวดที่เลือกให้แสดงในหน้ารายรับรายจ่าย (visible categories)
 * - วันสิ้นเดือนที่กำหนดเอง (0 = ตามปฏิทิน, 1-31 = วันที่)
 * หมายเหตุ: งบรายจ่ายรายเดือนต่อหมวดเก็บใน DB (ตาราง category_budgets)
 */

export const VISIBLE_CATEGORIES_KEY = 'moneyplan_visible_categories'
export const MONTH_END_DAY_KEY = 'moneyplan_month_end_day'

/** หมวดหมู่รายจ่าย (ใช้ร่วมกับ Profile งบต่อหมวด และ Transactions) */
export const EXPENSE_CATEGORIES = [
  'อาหาร',
  'ค่าเดินทาง',
  'ที่พัก/ค่าเช่า',
  'สาธารณูปโภค',
  'สุขภาพ',
  'บันเทิง',
  'การศึกษา',
  'ช้อปปิ้ง',
  'โทรศัพท์/อินเทอร์เน็ต',
  'ผ่อนชำระหนี้',
  'ลงทุน',
  'ออมเงิน',
  'อื่นๆ',
] as const

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]

/**
 * อ่านหมวดที่เลือกให้แสดงในหน้ารายรับรายจ่าย
 * ค่าว่าง = แสดงทุกหมวด
 */
export function getVisibleCategories(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(VISIBLE_CATEGORIES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((c): c is string => typeof c === 'string')
  } catch {
    return []
  }
}

/** บันทึกหมวดที่เลือกให้แสดง (ว่าง = แสดงทุกหมวด) */
export function setVisibleCategories(categories: string[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(VISIBLE_CATEGORIES_KEY, JSON.stringify(categories))
  } catch (e) {
    console.error('setVisibleCategories:', e)
  }
}

/**
 * อ่านวันสิ้นเดือนที่กำหนดเอง
 * คืนค่า 0 = ใช้ตามปฏิทิน (วันสุดท้ายของแต่ละเดือน), 1-31 = ใช้วันนั้นเป็นวันสิ้นเดือน
 */
export function getMonthEndDay(): number {
  if (typeof window === 'undefined') return 0
  try {
    const raw = localStorage.getItem(MONTH_END_DAY_KEY)
    if (raw == null || raw === '') return 0
    const n = parseInt(raw, 10)
    if (isNaN(n) || n < 0 || n > 31) return 0
    return n
  } catch {
    return 0
  }
}

/** บันทึกวันสิ้นเดือน (0 = ตามปฏิทิน, 1-31) */
export function setMonthEndDay(day: number): void {
  if (typeof window === 'undefined') return
  try {
    const v = Math.max(0, Math.min(31, Math.floor(day)))
    localStorage.setItem(MONTH_END_DAY_KEY, String(v))
  } catch (e) {
    console.error('setMonthEndDay:', e)
  }
}
