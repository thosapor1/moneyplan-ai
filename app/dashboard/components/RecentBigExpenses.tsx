'use client'

import { format } from 'date-fns'

type ExpenseItem = { date: string; category: string; amount: number }

type Props = {
  items: ExpenseItem[]
}

export default function RecentBigExpenses({ items }: Props) {
  if (items.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
        <h3 className="text-sm font-semibold text-gray-800 mb-2">รายการใช้จ่ายก้อนใหญ่ล่าสุด</h3>
        <p className="text-sm text-gray-500">ยังไม่มีรายจ่ายในเดือนนี้</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
      <h3 className="text-sm font-semibold text-gray-800 mb-3">รายการใช้จ่ายก้อนใหญ่ล่าสุด</h3>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex justify-between items-center text-sm">
            <div>
              <span className="text-gray-800">{item.category}</span>
              <span className="text-gray-500 ml-2">{format(new Date(item.date), 'dd/MM')}</span>
            </div>
            <span className="font-semibold text-red-600">-{item.amount.toLocaleString('th-TH')} บาท</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
