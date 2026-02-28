'use client'

import type { FinancialStatus } from '@/lib/finance'
import { ShieldCheck, AlertTriangle, XCircle } from 'lucide-react'

type Props = {
  status: FinancialStatus
  currentBalance: number
  daysLeft: number
  remainingDays: number
  recommendation?: string
}

const STATUS_CONFIG: Record<
  FinancialStatus,
  { label: string; gradient: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  Healthy: {
    label: 'ปลอดภัย',
    gradient: 'gradient-hero',
    Icon: ShieldCheck,
  },
  Warning: {
    label: 'เสี่ยง',
    gradient: 'gradient-warning',
    Icon: AlertTriangle,
  },
  Risk: {
    label: 'อาจติดลบ',
    gradient: 'gradient-danger',
    Icon: XCircle,
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
  const { Icon } = config
  const daysLeftDisplay = daysLeft === Infinity ? '∞' : Math.floor(daysLeft)

  return (
    <div className={`rounded-xl p-5 text-white ${config.gradient}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-5 h-5" />
        <span className="text-sm font-medium opacity-90">{config.label}</span>
      </div>
      <p className="text-3xl font-bold tabular-nums">
        ฿{currentBalance.toLocaleString('th-TH')}
      </p>
      <p className="text-sm opacity-80 mt-1">ยอดคงเหลือประจำงวด</p>
      {recommendation && (
        <p className="text-sm opacity-90 mt-2 leading-relaxed">{recommendation}</p>
      )}
      <p className="text-xs opacity-70 mt-2">
        คงอยู่ได้ ~{daysLeftDisplay} วัน · เหลืออีก {remainingDays} วัน
      </p>
    </div>
  )
}
