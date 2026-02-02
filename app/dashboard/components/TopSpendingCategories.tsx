'use client'

import type { CategorySummary } from '@/lib/finance'

type Props = {
  categories: CategorySummary[]
  totalExpense: number
  /** Optional: category budget (บาท) to highlight over-budget in soft red */
  categoryBudgets?: Record<string, number>
}

const CATEGORY_ICONS: Record<string, string> = {
  'อาหาร': '🍜',
  'ค่าเดินทาง': '🚆',
  'ที่พัก/ค่าเช่า': '🏠',
  'สาธารณูปโภค': '💡',
  'สุขภาพ': '❤️',
  'บันเทิง': '🎬',
  'การศึกษา': '📚',
  'ช้อปปิ้ง': '🛍️',
  'โทรศัพท์/อินเทอร์เน็ต': '📱',
  'ผ่อนชำระหนี้': '📋',
  'ลงทุน': '📈',
  'ออมเงิน': '🐷',
  'อื่นๆ': '📌',
}

function getIcon(category: string): string {
  return CATEGORY_ICONS[category] ?? '📌'
}

export default function TopSpendingCategories({ categories, totalExpense, categoryBudgets }: Props) {
  if (categories.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <h3 className="text-sm font-medium text-gray-600 mb-2">หมวดที่ใช้เงินสูงสุดเดือนนี้</h3>
        <p className="text-sm text-gray-500">ยังไม่มีรายจ่ายในเดือนนี้</p>
      </div>
    )
  }

  const displayedTotal = categories.reduce((sum, c) => sum + c.total, 0)
  const otherTotal = totalExpense - displayedTotal
  const otherPercent = totalExpense > 0 ? (otherTotal / totalExpense) * 100 : 0
  const maxTotal = Math.max(...categories.map((c) => c.total), otherTotal, 1)
  const showOtherRow = otherTotal > 0

  return (
    <div className="bg-white rounded-2xl shadow-sm p-4">
      <h3 className="text-sm font-medium text-gray-600 mb-3">หมวดที่ใช้เงินสูงสุดเดือนนี้</h3>
      <div className="space-y-3">
        {categories.map((cat) => {
          const budget = categoryBudgets?.[cat.category] ?? 0
          const isOverBudget = budget > 0 && cat.total > budget
          const barPercent = (cat.total / maxTotal) * 100
          return (
            <div key={cat.category} className="space-y-1">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-700 truncate pr-2 flex items-center gap-1.5">
                  <span className="text-base" title={cat.category}>{getIcon(cat.category)}</span>
                  {cat.category}
                </span>
                <span className={`font-medium shrink-0 ${isOverBudget ? 'text-red-600/90' : 'text-gray-900'}`}>
                  {cat.total.toLocaleString('th-TH')} บาท ({cat.percent.toFixed(0)}%)
                </span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${isOverBudget ? 'bg-red-300' : 'bg-amber-200'}`}
                  style={{ width: `${Math.min(barPercent, 100)}%` }}
                />
              </div>
            </div>
          )
        })}
        {showOtherRow && (
          <div className="space-y-1 pt-1 border-t border-gray-100">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 truncate pr-2 flex items-center gap-1.5">
                <span className="text-base">📌</span>
                รวมหมวดอื่น
              </span>
              <span className="font-medium text-gray-600 shrink-0">
                {otherTotal.toLocaleString('th-TH')} บาท ({otherPercent.toFixed(0)}%)
              </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gray-300 rounded-full transition-all"
                style={{ width: `${(otherTotal / maxTotal) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
