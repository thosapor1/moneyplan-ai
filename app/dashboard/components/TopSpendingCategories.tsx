'use client'

import CategoryIcon from '@/components/CategoryIcon'
import { getCategoryIconStyle } from '@/lib/category-icons'
import type { CategorySummary } from '@/lib/finance'
import { Card, CardContent } from '@/components/ui/card'

type Props = {
  categories: CategorySummary[]
  totalExpense: number
  categoryBudgets?: Record<string, number>
}

export default function TopSpendingCategories({ categories, totalExpense, categoryBudgets }: Props) {
  if (categories.length === 0) {
    return (
      <Card>
        <CardContent className="p-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            หมวดที่ใช้เงินสูงสุด
          </h3>
          <p className="text-sm text-muted-foreground">ยังไม่มีรายจ่ายในเดือนนี้</p>
        </CardContent>
      </Card>
    )
  }

  const displayedTotal = categories.reduce((sum, c) => sum + c.total, 0)
  const otherTotal = totalExpense - displayedTotal
  const otherPercent = totalExpense > 0 ? (otherTotal / totalExpense) * 100 : 0
  const maxTotal = Math.max(...categories.map((c) => c.total), otherTotal, 1)
  const showOtherRow = otherTotal > 0

  return (
    <Card>
      <CardContent className="p-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">
          หมวดที่ใช้เงินสูงสุด
        </h3>
        <div className="space-y-4">
          {categories.map((cat) => {
            const budget = categoryBudgets?.[cat.category] ?? 0
            const isOverBudget = budget > 0 && cat.total > budget
            const barPercent = (cat.total / maxTotal) * 100
            const style = getCategoryIconStyle(cat.category)
            return (
              <div key={cat.category} className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-foreground truncate pr-2 flex items-center gap-2">
                    <span
                      className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${style.bg} ${style.icon}`}
                    >
                      <CategoryIcon category={cat.category} iconOnly />
                    </span>
                    {cat.category}
                  </span>
                  <span className={`text-sm font-semibold tabular-nums shrink-0 ${isOverBudget ? 'text-danger' : 'text-foreground'}`}>
                    ฿{cat.total.toLocaleString('th-TH')}
                    <span className="text-xs font-normal text-muted-foreground ml-1">
                      ({cat.percent.toFixed(0)}%)
                    </span>
                  </span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${isOverBudget ? 'bg-danger' : 'bg-primary'}`}
                    style={{ width: `${Math.min(barPercent, 100)}%` }}
                  />
                </div>
              </div>
            )
          })}
          {showOtherRow && (
            <div className="space-y-1.5 pt-3 border-t border-border">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground truncate pr-2 flex items-center gap-2">
                  <span className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center bg-muted text-muted-foreground">
                    <CategoryIcon category="อื่นๆ" iconOnly />
                  </span>
                  รวมหมวดอื่น
                </span>
                <span className="font-semibold tabular-nums text-muted-foreground shrink-0">
                  ฿{otherTotal.toLocaleString('th-TH')}
                  <span className="text-xs font-normal text-muted-foreground ml-1">
                    ({otherPercent.toFixed(0)}%)
                  </span>
                </span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-muted-foreground/30 rounded-full transition-all"
                  style={{ width: `${(otherTotal / maxTotal) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
