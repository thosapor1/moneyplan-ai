'use client'

import type { CategorySummary } from '@/lib/finance'

type Props = {
  categories: CategorySummary[]
  totalExpense: number
}

export default function TopSpendingCategories({ categories, totalExpense }: Props) {
  if (categories.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
        <h3 className="text-sm font-semibold text-gray-800 mb-2">หมวดที่ใช้เงินสูงสุดเดือนนี้</h3>
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
    <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
      <h3 className="text-sm font-semibold text-gray-800 mb-3">หมวดที่ใช้เงินสูงสุดเดือนนี้</h3>
      <div className="space-y-3">
        {categories.map((cat) => (
          <div key={cat.category} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-700 truncate pr-2">{cat.category}</span>
              <span className="font-medium text-gray-900 shrink-0">
                {cat.total.toLocaleString('th-TH')} บาท ({cat.percent.toFixed(0)}%)
              </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-red-500 rounded-full transition-all"
                style={{ width: `${(cat.total / maxTotal) * 100}%` }}
              />
            </div>
          </div>
        ))}
        {showOtherRow && (
          <div className="space-y-1 pt-1 border-t border-gray-100">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 truncate pr-2">รวมหมวดที่เหลือ (อันดับ 4 เป็นต้นไป)</span>
              <span className="font-medium text-gray-600 shrink-0">
                {otherTotal.toLocaleString('th-TH')} บาท ({otherPercent.toFixed(0)}%)
              </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gray-400 rounded-full transition-all"
                style={{ width: `${(otherTotal / maxTotal) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
