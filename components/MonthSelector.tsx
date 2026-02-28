'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { format, addMonths, subMonths } from 'date-fns'
import { th } from 'date-fns/locale'

interface MonthSelectorProps {
  currentMonth: Date
  onChange: (date: Date) => void
}

export default function MonthSelector({ currentMonth, onChange }: MonthSelectorProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <button
        onClick={() => onChange(subMonths(currentMonth, 1))}
        className="p-2 rounded-full hover:bg-secondary transition-colors"
        aria-label="เดือนก่อนหน้า"
      >
        <ChevronLeft className="w-5 h-5 text-muted-foreground" />
      </button>
      <h2 className="text-lg font-semibold text-foreground">
        {format(currentMonth, 'MMMM yyyy', { locale: th })}
      </h2>
      <button
        onClick={() => onChange(addMonths(currentMonth, 1))}
        className="p-2 rounded-full hover:bg-secondary transition-colors"
        aria-label="เดือนถัดไป"
      >
        <ChevronRight className="w-5 h-5 text-muted-foreground" />
      </button>
    </div>
  )
}
