'use client'

import type { FinancialStatus } from '@/lib/finance'

type Props = {
  status: FinancialStatus
  currentBalance: number
  daysLeft: number
  remainingDays: number
  /** Short coach-style recommendation (e.g. "ค่าใช้จ่ายอาหารสูงกว่าปกติ ลองลดลงวันละ 50 บาท") */
  recommendation?: string
}

const STATUS_CONFIG: Record<FinancialStatus, { label: string; bg: string; text: string; soft: string }> = {
  Healthy: {
    label: 'ปลอดภัย',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    soft: 'bg-emerald-100/60',
  },
  Warning: {
    label: 'เสี่ยง',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    soft: 'bg-amber-100/60',
  },
  Risk: {
    label: 'อาจติดลบ',
    bg: 'bg-red-50',
    text: 'text-red-700',
    soft: 'bg-red-100/60',
  },
}

export default function FinancialStatusCard({
  status,
  currentBalance,
  daysLeft,
  remainingDays,
  recommendation,
}: Props) {
  const config = STATUS_CONFIG[status]
  const daysLeftDisplay = daysLeft === Infinity ? '∞' : Math.floor(daysLeft)

  return (
    <div className={`rounded-2xl p-5 ${config.bg} shadow-sm`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${config.soft} ${config.text}`}>
          {config.label}
        </span>
      </div>
      {recommendation && (
        <p className="text-sm text-gray-600 mb-3 leading-relaxed">{recommendation}</p>
      )}
      <p className="text-xs text-gray-500">
        ยอดคงเหลือตอนนี้ <span className="font-medium text-gray-700">{currentBalance.toLocaleString('th-TH')} บาท</span>
        {' · '}คงอยู่ได้ประมาณ {daysLeftDisplay} วัน (เหลืออีก {remainingDays} วันในเดือน)
      </p>
    </div>
  )
}
