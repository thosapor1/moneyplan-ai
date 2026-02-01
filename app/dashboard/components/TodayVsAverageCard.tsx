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
    <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
      <h3 className="text-sm font-semibold text-gray-800 mb-3">วันนี้ใช้เงินเทียบกับค่าเฉลี่ย</h3>
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">วันนี้ใช้</span>
          <span className={`text-sm font-semibold ${isOverAvg ? 'text-red-600' : 'text-green-600'}`}>
            {todayExpense.toLocaleString('th-TH')} บาท
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">ค่าใช้จ่ายผันแปรเฉลี่ยต่อวัน (median 14 วันล่าสุด)</span>
          <span className="text-sm font-medium text-gray-800">
            {variableDailyRate.toLocaleString('th-TH')} บาท
          </span>
        </div>
        <p className="text-xs text-gray-400">เฉพาะหมวดผันแปร (อาหาร, ค่าเดินทาง, สุขภาพ, บันเทิง, ฯลฯ)</p>
        {hasAvg && (
          <div className="flex justify-between items-center pt-2 border-t border-gray-100">
            <span className="text-sm text-gray-600">เทียบกับค่าเฉลี่ย</span>
            <span className={`text-sm font-semibold ${isOverAvg ? 'text-red-600' : 'text-green-600'}`}>
              {percentDiff > 0 ? '+' : ''}{percentDiff.toFixed(0)}%
            </span>
          </div>
        )}
      </div>
      {!hasAvg && (
        <p className="text-xs text-gray-500 mt-2">ยังไม่มีข้อมูลรายจ่ายผันแปร 14 วันล่าสุดสำหรับคำนวณ</p>
      )}
    </div>
  )
}
