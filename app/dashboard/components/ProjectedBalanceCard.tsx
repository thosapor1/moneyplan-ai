'use client'

type Props = {
  projectedBalance: number
}

export default function ProjectedBalanceCard({ projectedBalance }: Props) {
  const isNegative = projectedBalance < 0

  return (
    <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
      <h3 className="text-sm font-semibold text-gray-800 mb-2">คาดการณ์เงินคงเหลือสิ้นเดือน</h3>
      <p className={`text-2xl font-bold ${isNegative ? 'text-red-600' : 'text-green-600'}`}>
        {projectedBalance.toLocaleString('th-TH')} บาท
      </p>
      {isNegative && (
        <p className="text-sm text-red-600 mt-1">คาดการณ์สิ้นเดือนติดลบ ควรลดรายจ่ายหรือเพิ่มรายรับ</p>
      )}
      {!isNegative && projectedBalance > 0 && (
        <p className="text-sm text-gray-500 mt-1">คำนวณจากยอดคงเหลือลบด้วยรายจ่ายเฉลี่ยต่อวัน × จำนวนวันที่เหลือ</p>
      )}
    </div>
  )
}
