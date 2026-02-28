'use client'

import { TrendingUp } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

type Props = {
  projectedBalance: number
  plannedRemaining?: number
}

export default function ProjectedBalanceCard({ projectedBalance, plannedRemaining = 0 }: Props) {
  const isNegative = projectedBalance < 0

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            คาดการณ์สิ้นงวด
          </h3>
        </div>
        <p className={`text-xl font-bold tabular-nums ${isNegative ? 'text-danger' : 'text-success'}`}>
          ฿{projectedBalance.toLocaleString('th-TH')}
        </p>
        {plannedRemaining > 0 && (
          <p className="text-sm text-muted-foreground mt-1">
            รายจ่ายคงที่ที่เหลือ{' '}
            <span className="font-medium text-foreground tabular-nums">
              ฿{plannedRemaining.toLocaleString('th-TH')}
            </span>
          </p>
        )}
        {isNegative && (
          <p className="text-sm text-danger mt-2 font-medium">ลองลดรายจ่ายหรือหารายได้เสริม</p>
        )}
      </CardContent>
    </Card>
  )
}
