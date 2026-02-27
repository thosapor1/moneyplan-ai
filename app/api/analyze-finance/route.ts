import { NextResponse } from 'next/server'

/**
 * Request body: transactions from the app (type, amount, category, description?, date).
 * We summarize them server-side and send to OpenAI to avoid token limits.
 */
type TransactionInput = {
  type: 'income' | 'expense'
  amount: number
  category?: string
  description?: string
  date: string
}

function buildSummaryForAI(transactions: TransactionInput[]): string {
  const income = transactions.filter((t) => t.type === 'income')
  const expense = transactions.filter((t) => t.type === 'expense')
  const totalIncome = income.reduce((s, t) => s + Number(t.amount), 0)
  const totalExpense = expense.reduce((s, t) => s + Number(t.amount), 0)
  const balance = totalIncome - totalExpense

  const byCategory: Record<string, number> = {}
  expense.forEach((t) => {
    const cat = (t.category || '').trim() || 'ไม่ระบุหมวด'
    byCategory[cat] = (byCategory[cat] || 0) + Number(t.amount)
  })
  const categoryLines = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, sum]) => `  - ${cat}: ${Number(sum).toLocaleString('th-TH')} บาท`)
    .join('\n')

  const byIncomeCategory: Record<string, number> = {}
  income.forEach((t) => {
    const cat = (t.category || '').trim() || 'ไม่ระบุ'
    byIncomeCategory[cat] = (byIncomeCategory[cat] || 0) + Number(t.amount)
  })
  const incomeCategoryLines = Object.entries(byIncomeCategory)
    .map(([cat, sum]) => `  - ${cat}: ${Number(sum).toLocaleString('th-TH')} บาท`)
    .join('\n')

  const sortedExpense = [...expense].sort((a, b) => Number(b.amount) - Number(a.amount))
  const topExpenses = sortedExpense.slice(0, 15).map((t) => ({
    date: t.date,
    category: (t.category || '').trim() || '-',
    amount: Number(t.amount),
    desc: (t.description || '').slice(0, 50),
  }))

  return `
สรุปข้อมูลการเงินจากรายการธุรกรรม (บาท):

【รายรับ】
รวมรายรับ: ${totalIncome.toLocaleString('th-TH')} บาท
แยกตามหมวด:
${incomeCategoryLines || '  - ไม่มี'}

【รายจ่าย】
รวมรายจ่าย: ${totalExpense.toLocaleString('th-TH')} บาท
แยกตามหมวด:
${categoryLines || '  - ไม่มี'}

【ยอดคงเหลือ】 ${balance.toLocaleString('th-TH')} บาท

【รายจ่ายที่สูงสุด 15 รายการ】
${topExpenses.map((e) => `  ${e.date} | ${e.category} | ${e.amount.toLocaleString('th-TH')} บาท ${e.desc ? `| ${e.desc}` : ''}`).join('\n')}
`.trim()
}

const SYSTEM_PROMPT = `คุณเป็นที่ปรึกษาการเงินส่วนบุคคลที่พูดภาษาไทย
จากข้อมูลรายการธุรกรรม (รายรับ/รายจ่าย) ที่ให้มา ให้วิเคราะห์เป็นภาษาไทย โดยใช้รูปแบบ Markdown ดังนี้:

1. ใช้หัวข้อระดับ 2 (##) สำหรับส่วนหลัก เช่น "## ภาพรวม" "## จุดที่ควรระวัง" "## คำแนะนำ"
2. ใช้ bullet (- หรือ *) สำหรับรายการย่อยหรือคำแนะนำแต่ละข้อ
3. คั่นระหว่างส่วนด้วยบรรทัดว่าง
4. เขียนสั้น กระชับ อ่านง่าย

ตัวอย่างรูปแบบ:
## ภาพรวม
ยอดคงเหลือ X บาท รายจ่ายคิดเป็น Y% ของรายได้ ...

## จุดที่ควรระวัง
- หมวดอาหารใช้มากเกิน ...
- มีรายจ่ายก้อนใหญ่ ...

## คำแนะนำ
- ลดค่าอาหารลงวันละประมาณ ...
- เก็บออมอย่างน้อย 10% ...
`

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY is not configured. Add it in .env.local.' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const raw = body.transactions
    if (!Array.isArray(raw)) {
      return NextResponse.json(
        { error: 'Request body must include { "transactions": [...] }' },
        { status: 400 }
      )
    }

    const transactions: TransactionInput[] = raw
      .filter((t: unknown) => t && typeof t === 'object' && (t as any).type && typeof (t as any).amount === 'number' && (t as any).date)
      .map((t: any) => ({
        type: t.type === 'income' ? 'income' : 'expense',
        amount: Number(t.amount),
        category: t.category ?? '',
        description: t.description ?? '',
        date: String(t.date),
      }))

    if (transactions.length === 0) {
      return NextResponse.json(
        { error: 'No valid transactions to analyze. Add some transactions first.' },
        { status: 400 }
      )
    }

    const summary = buildSummaryForAI(transactions)

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: summary },
        ],
        max_tokens: 800,
        temperature: 0.5,
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error('OpenAI API error:', res.status, errText)
      return NextResponse.json(
        { error: 'AI analysis failed. Check OPENAI_API_KEY and try again.' },
        { status: 502 }
      )
    }

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content?.trim()
    if (!content) {
      return NextResponse.json(
        { error: 'No analysis returned from AI.' },
        { status: 502 }
      )
    }

    return NextResponse.json({ analysis: content })
  } catch (e) {
    console.error('analyze-finance error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Server error' },
      { status: 500 }
    )
  }
}
