'use client'

import { BarChart2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

type Props = {
  todayExpense: number
  variableDailyRate: number
  percentDiff: number
}

export default function TodayVsAverageCard({ todayExpense, variableDailyRate, percentDiff }: Props) {
  const isOverAvg = percentDiff > 0
  const hasAvg = variableDailyRate > 0

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <BarChart2 className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            วันนี้ vs ปกติ
          </h3>
        </div>
        <div className="space-y-2.5">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">วันนี้ใช้</span>
            <span className={`text-sm font-semibold tabular-nums ${isOverAvg ? 'text-warning' : 'text-success'}`}>
              ฿{todayExpense.toLocaleString('th-TH')}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">ค่าเฉลี่ยต่อวัน</span>
            <span className="text-sm font-semibold tabular-nums text-foreground">
              ฿{variableDailyRate.toLocaleString('th-TH')}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">จาก 14 วันล่าสุด (หมวดผันแปร)</p>
          {hasAvg && (
            <div className="flex justify-between items-center pt-2.5 mt-1 border-t border-border">
              <span className="text-sm text-muted-foreground">ต่างจากปกติ</span>
              <span className={`text-sm font-bold tabular-nums ${isOverAvg ? 'text-warning' : 'text-success'}`}>
                {percentDiff > 0 ? '+' : ''}{percentDiff.toFixed(0)}%
              </span>
            </div>
          )}
        </div>
        {!hasAvg && (
          <p className="text-sm text-muted-foreground mt-2">ยังไม่มีข้อมูลพอเทียบ รออีกนิด</p>
        )}
      </CardContent>
    </Card>
  )
}
