'use client'

type Props = {
  projectedBalance: number
  plannedRemaining?: number
}

export default function ProjectedBalanceCard({ projectedBalance, plannedRemaining = 0 }: Props) {
  const isNegative = projectedBalance < 0

  return (
    <div className="bg-white rounded-2xl shadow-sm p-4">
      <h3 className="text-sm font-medium text-gray-600 mb-1">เงินจะเหลือเท่าไหร่ปลายเดือน</h3>
      <p className={`text-xl font-semibold ${isNegative ? 'text-red-600' : 'text-emerald-600'}`}>
        {projectedBalance.toLocaleString('th-TH')} บาท
      </p>
      {plannedRemaining > 0 && (
        <p className="text-xs text-gray-500 mt-1">
          รายจ่ายคงที่ที่เหลือในเดือน {plannedRemaining.toLocaleString('th-TH')} บาท
        </p>
      )}
      {isNegative && (
        <p className="text-xs text-red-600/90 mt-1.5">ลองลดรายจ่ายหรือหารายได้เสริมนะ</p>
      )}
    </div>
  )
}
