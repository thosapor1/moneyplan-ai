'use client'

import { format } from 'date-fns'
import { Card, CardContent } from '@/components/ui/card'

type ExpenseItem = { date: string; category: string; amount: number }

type Props = {
  items: ExpenseItem[]
}

export default function RecentBigExpenses({ items }: Props) {
  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="p-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            รายจ่ายก้อนใหญ่ล่าสุด
          </h3>
          <p className="text-sm text-muted-foreground">ยังไม่มีรายจ่ายในเดือนนี้</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-0">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-4 pt-4 pb-3">
          รายจ่ายก้อนใหญ่ล่าสุด
        </h3>
        <ul className="divide-y divide-border">
          {items.map((item, i) => (
            <li key={i} className="flex justify-between items-center px-4 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">{item.category}</p>
                <p className="text-xs text-muted-foreground">{format(new Date(item.date), 'dd/MM/yy')}</p>
              </div>
              <span className="text-sm font-bold tabular-nums text-danger">
                -฿{item.amount.toLocaleString('th-TH')}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
