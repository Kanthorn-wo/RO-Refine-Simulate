// Vercel Serverless: proxy ดึงข้อมูลไอเทมจาก divine-pride
// ซ่อน API key ไว้ฝั่ง server (เดิม hardcode ใน client = exposed) + ผ่าน same-origin เลี่ยง CSP
// ENV: DIVINE_PRIDE_API_KEY
export default async function handler(req, res) {
  // รองรับทั้ง Vercel (req.query) และ dev shim (อ่านจาก req.url)
  const url = new URL(req.url, 'http://localhost')
  const id = ((req.query && req.query.id) ?? url.searchParams.get('id') ?? '').toString().trim()

  // จำกัดเป็นตัวเลขล้วน (กัน proxy ถูกใช้ยิง endpoint อื่น)
  if (!/^\d{1,8}$/.test(id)) {
    return res.status(400).json({ error: 'invalid id' })
  }
  const key = process.env.DIVINE_PRIDE_API_KEY
  if (!key) return res.status(500).json({ error: 'DIVINE_PRIDE_API_KEY ยังไม่ได้ตั้ง' })

  try {
    const r = await fetch(`https://www.divine-pride.net/api/database/Item/${id}?apiKey=${key}`)
    if (!r.ok) return res.status(r.status).json({ error: `upstream ${r.status}` })
    const data = await r.json()
    res.setHeader('cache-control', 's-maxage=86400, stale-while-revalidate=604800')
    return res.status(200).json(data)
  } catch {
    return res.status(502).json({ error: 'fetch failed' })
  }
}
