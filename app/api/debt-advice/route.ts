import { NextResponse } from 'next/server'

type DebtItemInput = {
  name: string
  remaining: number
  rate?: number
  priority?: string
}

function buildContext(body: { totalDebt: number; monthlyPayment: number; debtItems?: DebtItemInput[] }): string {
  const { totalDebt, monthlyPayment, debtItems = [] } = body
  const monthsToPay = monthlyPayment > 0 ? Math.ceil(totalDebt / monthlyPayment) : 0

  let text = `
ข้อมูลหนี้ของลูกค้า (บาท):
- ยอดหนี้รวม: ${totalDebt.toLocaleString('th-TH')} บาท
- เงินผ่อนต่อเดือน: ${monthlyPayment.toLocaleString('th-TH')} บาท
- คาดว่าจะหมดหนี้ในประมาณ ${monthsToPay} เดือน (ถ้าจ่ายเท่านี้ทุกเดือน)
`.trim()

  if (debtItems.length > 0) {
    text += '\n\nรายการหนี้แยกประเภท:\n'
    debtItems.forEach((d) => {
      text += `- ${d.name}: คงเหลือ ${d.remaining.toLocaleString('th-TH')} บาท`
      if (d.rate != null) text += `, ดอกเบี้ยประมาณ ${d.rate}%/ปี`
      if (d.priority === 'high') text += ' (ควรโปะก่อน)'
      text += '\n'
    })
  }

  return text
}

const SYSTEM_PROMPT = `คุณเป็นที่ปรึกษาการเงินส่วนบุคคลที่เชี่ยวชาญการปลดหนี้ พูดภาษาไทย
จากข้อมูลหนี้ที่ให้มา ให้แนะนำวิธีการปลดหนี้อย่างเป็นระบบ โดยใช้รูปแบบ Markdown ดังนี้:

1. ใช้หัวข้อระดับ 2 (##) สำหรับส่วนหลัก เช่น "## กลยุทธ์การปลดหนี้" "## แนวทางที่เหมาะกับคุณ" "## สิ่งที่ควรทำเพิ่ม"
2. ใช้ bullet (- หรือ *) สำหรับแต่ละข้อแนะนำ
3. คั่นระหว่างส่วนด้วยบรรทัดว่าง
4. ให้คำแนะนำที่เป็นไปได้จริง ปฏิบัติได้ ไม่เกิน 5–7 ข้อหลัก
5. ถ้ามีหลายก้อนหนี้ แนะนำว่าควรโปะก้อนไหนก่อน (เช่น ดอกเบี้ยสูงก่อน หรือ snowball)
6. แนะนำเรื่องการโปะเพิ่ม การลดรายจ่ายที่ไม่จำเป็น หรือหารายได้เสริม ถ้าเหมาะสม
7. หลีกเลี่ยงคำที่ฟังดูโหดร้าย ใช้ภาษากำลังใจแต่ตรงไปตรงมา`

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY is not configured.' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const totalDebt = Number(body.totalDebt) || 0
    const monthlyPayment = Number(body.monthlyPayment) || 0
    const debtItems = Array.isArray(body.debtItems)
      ? body.debtItems.map((d: any) => ({
          name: String(d.name || ''),
          remaining: Number(d.remaining) || 0,
          rate: d.rate != null ? Number(d.rate) : undefined,
          priority: d.priority,
        }))
      : []

    const context = buildContext({ totalDebt, monthlyPayment, debtItems })

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
          { role: 'user', content: context },
        ],
        max_tokens: 700,
        temperature: 0.5,
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error('OpenAI API error:', res.status, errText)
      return NextResponse.json(
        { error: 'ขอคำแนะนำไม่สำเร็จ ลองใหม่อีกครั้ง' },
        { status: 502 }
      )
    }

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content?.trim()
    if (!content) {
      return NextResponse.json(
        { error: 'ไม่มีคำแนะนำจาก AI' },
        { status: 502 }
      )
    }

    return NextResponse.json({ advice: content })
  } catch (e) {
    console.error('debt-advice error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Server error' },
      { status: 500 }
    )
  }
}
