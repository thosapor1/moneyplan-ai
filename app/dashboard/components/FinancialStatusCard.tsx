'use client'

import type { FinancialStatus } from '@/lib/finance'

type Props = {
  status: FinancialStatus
  currentBalance: number
  daysLeft: number
  remainingDays: number
}

const STATUS_CONFIG: Record<FinancialStatus, { label: string; bg: string; text: string; border: string; message: string }> = {
  Healthy: {
    label: 'แข็งแรง',
    bg: 'bg-green-50',
    text: 'text-green-800',
    border: 'border-green-200',
    message: 'ยอดคงเหลือเพียงพอสำหรับวันที่มีเหลือในเดือนนี้ ใช้จ่ายตามแผนได้',
  },
  Warning: {
    label: 'ควรระวัง',
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
    message: 'ยอดคงเหลืออาจไม่พอถึงสิ้นเดือน ลดรายจ่ายหรือเพิ่มรายรับ',
  },
  Risk: {
    label: 'มีความเสี่ยง',
    bg: 'bg-red-50',
    text: 'text-red-800',
    border: 'border-red-200',
    message: 'คาดการณ์สิ้นเดือนติดลบ ควรลดการใช้จ่ายหรือหาแหล่งรายได้เพิ่ม',
  },
}

export default function FinancialStatusCard({ status, currentBalance, daysLeft, remainingDays }: Props) {
  const config = STATUS_CONFIG[status]
  const daysLeftDisplay = daysLeft === Infinity ? '∞' : Math.floor(daysLeft)

  return (
    <div className={`rounded-xl border-2 p-4 ${config.bg} ${config.border}`}>
      <h2 className="text-lg font-bold text-gray-900 mb-2">สถานะการเงินเดือนนี้</h2>
      <div className="flex items-center gap-2 mb-2">
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${config.text} ${config.bg}`}>
          {config.label}
        </span>
      </div>
      <p className="text-sm text-gray-700 mb-2">{config.message}</p>
      <div className="text-xs text-gray-500">
        ยอดคงเหลือปัจจุบัน {currentBalance.toLocaleString('th-TH')} บาท · คงอยู่ได้ประมาณ {daysLeftDisplay} วัน (เหลืออีก {remainingDays} วันในเดือน)
      </div>
    </div>
  )
}
