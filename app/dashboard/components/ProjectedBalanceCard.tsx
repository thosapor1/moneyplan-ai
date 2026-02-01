'use client'

type Props = {
  projectedBalance: number
  plannedRemaining?: number
}

export default function ProjectedBalanceCard({ projectedBalance, plannedRemaining = 0 }: Props) {
  const isNegative = projectedBalance < 0

  return (
    <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
      <h3 className="text-sm font-semibold text-gray-800 mb-2">คาดการณ์เงินคงเหลือสิ้นเดือน</h3>
      <p className={`text-2xl font-bold ${isNegative ? 'text-red-600' : 'text-green-600'}`}>
        {projectedBalance.toLocaleString('th-TH')} บาท
      </p>
      {plannedRemaining > 0 && (
        <p className="text-xs text-gray-500 mt-1">
          รายจ่ายคงที่ที่เหลือในเดือน {plannedRemaining.toLocaleString('th-TH')} บาท
        </p>
      )}
      {isNegative && (
        <p className="text-sm text-red-600 mt-1">คาดการณ์สิ้นเดือนติดลบ ควรลดรายจ่ายหรือเพิ่มรายรับ</p>
      )}
      {!isNegative && projectedBalance > 0 && (
        <p className="text-sm text-gray-500 mt-1">
          คำนวณจากยอดคงเหลือ − รายจ่ายคงที่ที่เหลือ − (ค่าใช้จ่ายผันแปรต่อวัน × วันที่เหลือ)
        </p>
      )}
    </div>
  )
}
