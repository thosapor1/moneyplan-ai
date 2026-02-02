'use client'

type Props = {
  todayExpense: number
  variableDailyRate: number
  percentDiff: number
}

export default function TodayVsAverageCard({ todayExpense, variableDailyRate, percentDiff }: Props) {
  const isOverAvg = percentDiff > 0
  const hasAvg = variableDailyRate > 0

  return (
    <div className="bg-white rounded-2xl shadow-sm p-4">
      <h3 className="text-sm font-medium text-gray-600 mb-2">วันนี้ใช้มาก/น้อยกว่าปกติ</h3>
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">วันนี้ใช้</span>
          <span className={`text-sm font-semibold ${isOverAvg ? 'text-amber-600' : 'text-emerald-600'}`}>
            {todayExpense.toLocaleString('th-TH')} บาท
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">ปกติคุณใช้วันละ</span>
          <span className="text-sm font-medium text-gray-800">
            {variableDailyRate.toLocaleString('th-TH')} บาท
          </span>
        </div>
        <p className="text-xs text-gray-400">จาก 14 วันล่าสุด (หมวดผันแปร)</p>
        {hasAvg && (
          <div className="flex justify-between items-center pt-2 mt-2 border-t border-gray-100">
            <span className="text-sm text-gray-600">วันนี้ใช้มาก/น้อยกว่าปกติ</span>
            <span className={`text-sm font-semibold ${isOverAvg ? 'text-amber-600' : 'text-emerald-600'}`}>
              {percentDiff > 0 ? '+' : ''}{percentDiff.toFixed(0)}%
            </span>
          </div>
        )}
      </div>
      {!hasAvg && (
        <p className="text-xs text-gray-500 mt-2">ยังไม่มีข้อมูลพอเทียบนะ รออีกนิด</p>
      )}
    </div>
  )
}
