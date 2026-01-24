'use client'

import { Profile } from '@/lib/supabase'

interface FinancialAnalysisProps {
  profile: Profile
  totalIncome: number
}

export default function FinancialAnalysis({ profile, totalIncome }: FinancialAnalysisProps) {
  // คำนวณตัวชี้วัดทางการเงิน
  
  // อัตราส่วนการออมและการลงทุน = (เงินออมและเงินลงทุนรายเดือน x 100) / รายได้รวมต่อเดือน
  // เงินออมและเงินลงทุนรายเดือน = saving (ช่องเงินออมในงบรายรับรายจ่าย)
  // รายได้รวมต่อเดือน = totalIncome
  const savingRatio = totalIncome > 0 
    ? (profile.saving / totalIncome) * 100 
    : 0
  
  // อัตราส่วนเงินผ่อนชำระหนี้ต่อรายได้ = (เงินผ่อนชำระหนี้ต่อเดือน x 100) / รายได้รวมต่อเดือน
  // เงินผ่อนชำระหนี้ต่อเดือน = fixed_expense (รายจ่ายคงที่)
  // รายได้รวมต่อเดือน = totalIncome
  const debtRatio = totalIncome > 0 
    ? (profile.fixed_expense / totalIncome) * 100 
    : 0
  
  // อัตราส่วนเงินสำรองเผื่อฉุกเฉิน = ทรัพย์สินสภาพคล่อง / รายจ่ายรวมต่อเดือน
  // ทรัพย์สินสภาพคล่อง = liquid_assets
  // รายจ่ายรวมต่อเดือน = fixed_expense + variable_expense
  const monthlyExpense = profile.fixed_expense + profile.variable_expense
  const emergencyRatio = monthlyExpense > 0 
    ? profile.liquid_assets / monthlyExpense 
    : 0
  
  // ความมั่งคั่งสุทธิ = ทรัพย์สินรวม - หนี้สินรวม
  // ทรัพย์สินรวม = total_assets
  // หนี้สินรวม = total_liabilities
  const netWorth = profile.total_assets - profile.total_liabilities

  // วิเคราะห์สถานะการเงิน
  const getFinancialStatus = () => {
    let score = 0
    let issues: string[] = []
    
    if (savingRatio >= 10) score += 1
    else issues.push('อัตราส่วนการออมและการลงทุนต่ำกว่าเกณฑ์')
    
    if (debtRatio <= 50) score += 1
    else issues.push('อัตราส่วนเงินผ่อนชำระหนี้สูงเกินไป')
    
    if (emergencyRatio >= 6) score += 1
    else issues.push('เงินสำรองเผื่อฉุกเฉินไม่เพียงพอ')
    
    if (netWorth > 0) score += 1
    else issues.push('ความมั่งคั่งสุทธิเป็นค่าลบ')
    
    if (score === 4) return { level: 'ดี', color: 'text-green-600', bgColor: 'bg-green-50' }
    if (score === 3) return { level: 'พอใช้', color: 'text-blue-600', bgColor: 'bg-blue-50' }
    if (score === 2) return { level: 'เสี่ยง', color: 'text-yellow-600', bgColor: 'bg-yellow-50' }
    return { level: 'ควรเร่งปรับปรุง', color: 'text-red-600', bgColor: 'bg-red-50' }
  }

  const status = getFinancialStatus()

  // หาจุดแข็ง
  const getStrengths = () => {
    const strengths: string[] = []
    if (savingRatio >= 10) {
      strengths.push('มีการออมและการลงทุนในระดับที่ดี')
    }
    if (debtRatio <= 30) {
      strengths.push('ภาระหนี้สินอยู่ในระดับที่เหมาะสม')
    }
    if (emergencyRatio >= 6) {
      strengths.push('มีเงินสำรองเผื่อฉุกเฉินเพียงพอ')
    }
    if (netWorth > 0 && netWorth > profile.total_assets * 0.3) {
      strengths.push('มีความมั่งคั่งสุทธิในระดับดี')
    }
    if (strengths.length === 0) {
      strengths.push('กำลังเริ่มต้นการวางแผนการเงิน')
    }
    return strengths
  }

  // หาจุดอ่อน
  const getWeaknesses = () => {
    const weaknesses: string[] = []
    if (savingRatio < 10) {
      weaknesses.push(`อัตราส่วนการออมและการลงทุน (${savingRatio.toFixed(1)}%) ต่ำกว่าเกณฑ์ที่แนะนำ (10%)`)
    }
    if (debtRatio > 50) {
      weaknesses.push(`อัตราส่วนเงินผ่อนชำระหนี้ (${debtRatio.toFixed(1)}%) สูงเกินไป ควรไม่เกิน 50%`)
    } else if (debtRatio > 15 && profile.variable_expense > 0) {
      weaknesses.push('มีหนี้บริโภคที่อาจส่งผลกระทบต่อการออม')
    }
    if (emergencyRatio < 6) {
      weaknesses.push(`เงินสำรองเผื่อฉุกเฉิน (${emergencyRatio.toFixed(1)} เดือน) ไม่เพียงพอ ควรมากกว่า 6 เดือน`)
    }
    if (netWorth < 0) {
      weaknesses.push('ความมั่งคั่งสุทธิเป็นค่าลบ หมายความว่ามีหนี้สินมากกว่าทรัพย์สิน')
    }
    if (profile.variable_expense > profile.fixed_expense * 0.5) {
      weaknesses.push('รายจ่ายผันแปรสูง อาจส่งผลต่อความมั่นคงทางการเงิน')
    }
    if (weaknesses.length === 0) {
      weaknesses.push('สถานะการเงินโดยรวมอยู่ในระดับดี')
    }
    return weaknesses
  }

  // ความเสี่ยง
  const getRisks = () => {
    const risks: string[] = []
    if (emergencyRatio < 3) {
      risks.push('หากเกิดเหตุฉุกเฉินทางการเงิน อาจไม่สามารถรับมือได้ทันที')
    }
    if (debtRatio > 50) {
      risks.push('ภาระหนี้สูงอาจทำให้เกิดปัญหาการชำระหนี้หากรายได้ลดลง')
    }
    if (savingRatio < 5) {
      risks.push('การออมต่ำอาจทำให้ไม่สามารถบรรลุเป้าหมายทางการเงินในอนาคต')
    }
    if (netWorth < 0) {
      risks.push('ความมั่งคั่งสุทธิเป็นลบอาจทำให้เกิดปัญหาทางการเงินในระยะยาว')
    }
    if (risks.length === 0) {
      risks.push('ความเสี่ยงทางการเงินอยู่ในระดับต่ำ')
    }
    return risks
  }

  // คำแนะนำ
  const getRecommendations = () => {
    const recommendations: string[] = []
    
    if (savingRatio < 10) {
      const targetSaving = totalIncome * 0.1
      recommendations.push(`เพิ่มการออมและการลงทุนให้ได้อย่างน้อย ${targetSaving.toLocaleString('th-TH')} บาทต่อเดือน (10% ของรายได้)`)
    }
    
    if (emergencyRatio < 6) {
      const targetEmergency = monthlyExpense * 6
      const needed = targetEmergency - profile.liquid_assets
      if (needed > 0) {
        recommendations.push(`สะสมเงินสำรองเผื่อฉุกเฉินให้ได้ ${targetEmergency.toLocaleString('th-TH')} บาท (ยังขาดอีก ${needed.toLocaleString('th-TH')} บาท)`)
      }
    }
    
    if (debtRatio > 50) {
      recommendations.push('พิจารณาลดภาระหนี้โดยการปรับโครงสร้างหนี้หรือเพิ่มรายได้')
    } else if (debtRatio > 15) {
      recommendations.push('หลีกเลี่ยงการก่อหนี้ใหม่และวางแผนชำระหนี้ที่มีอยู่ให้เร็วขึ้น')
    }
    
    if (profile.variable_expense > profile.fixed_expense * 0.5) {
      recommendations.push('ควบคุมรายจ่ายผันแปรให้อยู่ในระดับที่เหมาะสม โดยตั้งงบประมาณรายจ่ายแต่ละประเภท')
    }
    
    if (netWorth < 0) {
      recommendations.push('เพิ่มทรัพย์สินและลดหนี้สินให้ความมั่งคั่งสุทธิเป็นค่าบวก')
    }
    
    if (recommendations.length === 0) {
      recommendations.push('รักษาสถานะการเงินที่ดีนี้ไว้ และพิจารณาเพิ่มการลงทุนเพื่อสร้างความมั่งคั่งในระยะยาว')
    }
    
    return recommendations
  }

  const strengths = getStrengths()
  const weaknesses = getWeaknesses()
  const risks = getRisks()
  const recommendations = getRecommendations()

  return (
    <div className="space-y-4">
      {/* สรุปภาพรวม */}
      <div className={`p-4 rounded-lg ${status.bgColor} border ${status.color.replace('text-', 'border-')}`}>
        <h2 className={`text-sm font-semibold mb-2 ${status.color}`}>
          สถานะการเงิน: {status.level}
        </h2>
        <p className="text-sm text-gray-700">
          สถานะการเงินของคุณอยู่ในระดับ <strong>{status.level}</strong> 
          {status.level === 'ดี' && ' ดีมาก! คุณมีการจัดการการเงินที่ดี'}
          {status.level === 'พอใช้' && ' มีจุดที่ควรปรับปรุงเพื่อให้ดีขึ้น'}
          {status.level === 'เสี่ยง' && ' ควรให้ความสนใจและปรับปรุงในหลายด้าน'}
          {status.level === 'ควรเร่งปรับปรุง' && ' ควรเร่งดำเนินการปรับปรุงเพื่อความมั่นคงทางการเงิน'}
        </p>
      </div>

      {/* ตัวชี้วัดทางการเงิน */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="text-sm font-semibold text-gray-800 mb-3">ตัวชี้วัดทางการเงิน</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white p-3 rounded">
            <p className="text-xs text-gray-600 mb-1">อัตราส่วนการออมและการลงทุน</p>
            <p className={`text-sm font-bold ${savingRatio >= 10 ? 'text-green-600' : 'text-red-600'}`}>
              {savingRatio.toFixed(1)}%
            </p>
            <p className="text-xs text-gray-500 mt-1">เกณฑ์ที่ดี ≥ 10%</p>
          </div>
          <div className="bg-white p-3 rounded">
            <p className="text-xs text-gray-600 mb-1">อัตราส่วนเงินผ่อนชำระหนี้</p>
            <p className={`text-sm font-bold ${debtRatio <= 50 ? 'text-green-600' : 'text-red-600'}`}>
              {debtRatio.toFixed(1)}%
            </p>
            <p className="text-xs text-gray-500 mt-1">ไม่ควรเกิน 50%</p>
          </div>
          <div className="bg-white p-3 rounded">
            <p className="text-xs text-gray-600 mb-1">เงินสำรองเผื่อฉุกเฉิน</p>
            <p className={`text-sm font-bold ${emergencyRatio >= 6 ? 'text-green-600' : 'text-red-600'}`}>
              {emergencyRatio.toFixed(1)} เดือน
            </p>
            <p className="text-xs text-gray-500 mt-1">ควรมากกว่า 6 เดือน</p>
          </div>
          <div className="bg-white p-3 rounded">
            <p className="text-xs text-gray-600 mb-1">ความมั่งคั่งสุทธิ</p>
            <p className={`text-sm font-bold ${netWorth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {netWorth.toLocaleString('th-TH')} บาท
            </p>
            <p className="text-xs text-gray-500 mt-1">ควรเป็นค่าบวก</p>
          </div>
        </div>
      </div>

      {/* จุดแข็ง */}
      <div className="bg-white p-4 rounded-lg">
        <h3 className="text-sm font-semibold mb-3 text-green-700">จุดแข็ง</h3>
        <ul className="space-y-2">
          {strengths.map((strength, index) => (
            <li key={index} className="flex items-start text-sm">
              <span className="text-green-500 mr-2">✓</span>
              <span className="text-gray-800">{strength}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* จุดที่ควรระวัง */}
      <div className="bg-white p-4 rounded-lg">
        <h3 className="text-sm font-semibold mb-3 text-yellow-700">จุดที่ควรระวัง</h3>
        <ul className="space-y-2">
          {weaknesses.map((weakness, index) => (
            <li key={index} className="flex items-start text-sm">
              <span className="text-yellow-500 mr-2">⚠</span>
              <span className="text-gray-800">{weakness}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* ความเสี่ยง */}
      <div className="bg-white p-4 rounded-lg">
        <h3 className="text-sm font-semibold mb-3 text-orange-700">ความเสี่ยงทางการเงิน</h3>
        <ul className="space-y-2">
          {risks.map((risk, index) => (
            <li key={index} className="flex items-start text-sm">
              <span className="text-orange-500 mr-2">⚠</span>
              <span className="text-gray-800">{risk}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* คำแนะนำเชิงปฏิบัติ */}
      <div className="bg-white p-4 rounded-lg">
        <h3 className="text-sm font-semibold mb-3 text-blue-700">คำแนะนำเชิงปฏิบัติ</h3>
        <ul className="space-y-2">
          {recommendations.map((rec, index) => (
            <li key={index} className="text-sm text-gray-700 flex items-start">
              <span className="text-blue-500 mr-2">•</span>
              <span>{rec}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
