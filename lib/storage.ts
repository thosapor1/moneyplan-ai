/**
 * ค่าคงที่และฟังก์ชันสำหรับเก็บข้อมูลใน localStorage
 * - งบรายจ่ายรายเดือนต่อหมวด (category budget)
 * - หมวดที่เลือกให้แสดงในหน้ารายรับรายจ่าย (visible categories)
 */

export const CATEGORY_BUDGET_KEY = 'moneyplan_category_budget'
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

/** อ่านงบรายจ่ายรายเดือนต่อหมวด (บาท) */
export function getCategoryBudgets(): Record<string, number> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(CATEGORY_BUDGET_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const result: Record<string, number> = {}
    for (const [k, v] of Object.entries(parsed)) {
      const n = Number(v)
      if (!isNaN(n) && n >= 0) result[k] = n
    }
    return result
  } catch {
    return {}
  }
}

/** บันทึกงบรายจ่ายรายเดือนต่อหมวด */
export function setCategoryBudgets(budgets: Record<string, number>): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(CATEGORY_BUDGET_KEY, JSON.stringify(budgets))
  } catch (e) {
    console.error('setCategoryBudgets:', e)
  }
}

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
