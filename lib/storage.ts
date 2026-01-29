/**
 * ค่าคงที่และฟังก์ชันสำหรับเก็บข้อมูลใน localStorage
 * - หมวดที่เลือกให้แสดงในหน้ารายรับรายจ่าย (visible categories)
 * หมายเหตุ: งบรายจ่ายรายเดือนต่อหมวดเก็บใน DB (ตาราง category_budgets)
 */

export const VISIBLE_CATEGORIES_KEY = 'moneyplan_visible_categories'

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
