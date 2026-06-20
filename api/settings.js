// Vercel Serverless: ตั้งค่าเว็บ (feature flags) — เฉพาะเจ้าของเว็บเขียนได้
//   POST { key, value } → เซ็ตค่าใน site_settings (ตอนนี้รองรับ key 'show_stats')
// อ่าน flag ปัจจุบันให้ใช้ GET /api/stats (คืน showStats มาด้วยแล้ว)
// verify Supabase token + เช็ค email ใน DASHBOARD_ALLOWED_EMAILS (เหมือน api/ga.js)
// ENV: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, DASHBOARD_ALLOWED_EMAILS

const ALLOWED_KEYS = ['show_stats', 'show_online']

async function getUser(req) {
  const auth = req.headers.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token || !process.env.SUPABASE_URL) return null
  try {
    const r = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: process.env.SUPABASE_ANON_KEY || '' },
    })
    if (!r.ok) return null
    return await r.json()
  } catch {
    return null
  }
}

function isOwner(user) {
  const allow = (process.env.DASHBOARD_ALLOWED_EMAILS || '')
    .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
  const email = ((user && user.email) || '').toLowerCase()
  return allow.length > 0 && !!email && allow.includes(email)
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string') { try { return JSON.parse(req.body) } catch { return {} } }
  return await new Promise((resolve) => {
    let d = ''
    req.on('data', (c) => (d += c))
    req.on('end', () => { try { resolve(JSON.parse(d || '{}')) } catch { resolve({}) } })
    req.on('error', () => resolve({}))
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' })

  const user = await getUser(req)
  if (!user) return res.status(401).json({ error: 'unauthorized' })
  if (!isOwner(user)) return res.status(403).json({ error: 'ไม่มีสิทธิ์ (เฉพาะเจ้าของเว็บ)' })

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'supabase env not set' })
  }

  const body = await readBody(req)
  const key = String(body.key || '')
  if (!ALLOWED_KEYS.includes(key)) return res.status(400).json({ error: 'invalid key' })
  const value = Boolean(body.value)

  try {
    const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/site_settings?on_conflict=key`, {
      method: 'POST',
      headers: {
        apikey: sbKey,
        Authorization: `Bearer ${sbKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates', // upsert
      },
      body: JSON.stringify({ key, value, updated_at: new Date().toISOString() }),
    })
    if (!r.ok) return res.status(502).json({ error: 'write failed' })
    return res.status(200).json({ ok: true, key, value })
  } catch {
    return res.status(502).json({ error: 'write failed' })
  }
}
