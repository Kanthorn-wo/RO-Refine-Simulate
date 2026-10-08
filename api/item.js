// Vercel Serverless: proxy ดึงข้อมูลไอเทมจาก divine-pride
// ซ่อน API key ไว้ฝั่ง server (เดิม hardcode ใน client = exposed) + ผ่าน same-origin เลี่ยง CSP
// เรียก divine-pride ผ่าน api/_lib/divinePride.js เท่านั้น (คิว 1 req/วินาทีข้ามทุก instance + หยุดเมื่อโดน rate limit)
// ENV: DIVINE_PRIDE_API_KEY (+ SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY สำหรับคิวกลาง)
import { dpItem, DivinePrideLimitError } from './_lib/divinePride.js'

export default async function handler(req, res) {
  // รองรับทั้ง Vercel (req.query) และ dev shim (อ่านจาก req.url)
  const url = new URL(req.url, 'http://localhost')
  const id = ((req.query && req.query.id) ?? url.searchParams.get('id') ?? '').toString().trim()

  // จำกัดเป็นตัวเลขล้วน (กัน proxy ถูกใช้ยิง endpoint อื่น)
  if (!/^\d{1,8}$/.test(id)) {
    return res.status(400).json({ error: 'invalid id' })
  }
  if (!process.env.DIVINE_PRIDE_API_KEY) return res.status(500).json({ error: 'DIVINE_PRIDE_API_KEY ยังไม่ได้ตั้ง' })

  try {
    // thROG = เซิร์ฟไทย Global (ไม่ส่ง x-server = divine-pride ใช้ kROM ชื่อเกาหลี) + en
    const { status, data } = await dpItem(id, { server: 'thROG', lang: 'en' })
    if (!data) return res.status(status >= 400 ? status : 502).json({ error: `upstream ${status}` })
    res.setHeader('cache-control', 's-maxage=86400, stale-while-revalidate=604800')
    return res.status(200).json(data)
  } catch (err) {
    if (err instanceof DivinePrideLimitError) {
      // ไม่ cache คำตอบนี้ และบอก client ให้รอ — ห้ามยิง upstream ซ้ำระหว่างโดนจำกัด
      res.setHeader('cache-control', 'no-store')
      res.setHeader('retry-after', String(err.retryAfter))
      return res.status(429).json({ error: 'busy', retryAfter: err.retryAfter })
    }
    return res.status(502).json({ error: 'fetch failed' })
  }
}
