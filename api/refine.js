// Vercel Serverless: Refine analytics
//   POST → บันทึก batch รายละเอียดการตีบวก (public, anonymous) ผ่าน RPC record_refine_batch
//   GET  → อ่าน leaderboard + breakdown + detail ล่าสุด (เฉพาะเจ้าของเว็บ — verify token + allowlist)
// ENV: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, DASHBOARD_ALLOWED_EMAILS

const ITEM_TYPES = ['weapon1', 'weapon2', 'weapon3', 'weapon4', 'weapon5', 'armor1', 'armor2']
const STONES = ['normal', 'enriched', 'hd']
const RESULTS = ['success', 'fail', 'lost', 'drop']
const MAX_ROWS = 200 // cap ต่อ request กัน abuse

function sbFetch(pathAndQuery, init) {
  const base = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  return fetch(`${base}/rest/v1/${pathAndQuery}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(init && init.headers),
    },
  })
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

// sanitize 1 แถว — คืน null ถ้าไม่ผ่าน (ทิ้งทั้งแถว กันข้อมูลขยะ)
function cleanRow(r) {
  if (!r || typeof r !== 'object') return null
  if (!ITEM_TYPES.includes(r.item_type)) return null
  if (!STONES.includes(r.stone)) return null
  if (!RESULTS.includes(r.result)) return null
  const level = Math.floor(Number(r.level))
  if (!Number.isFinite(level) || level < 0 || level > 25) return null
  let itemId = null
  if (r.item_id != null) {
    const n = Math.floor(Number(r.item_id))
    if (Number.isFinite(n) && n > 0 && n < 100000000) itemId = n
  }
  return { item_type: r.item_type, item_id: itemId, level, stone: r.stone, bsb: !!r.bsb, result: r.result }
}

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

export default async function handler(req, res) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'supabase env not set' })
  }

  // ── POST: บันทึก batch (public) ──
  if (req.method === 'POST') {
    try {
      const body = await readBody(req)
      const vid = typeof body.vid === 'string' && /^[\w-]{8,64}$/.test(body.vid) ? body.vid : null
      const rowsRaw = Array.isArray(body.rows) ? body.rows.slice(0, MAX_ROWS) : []
      const rows = rowsRaw.map(cleanRow).filter(Boolean)
      if (!rows.length) return res.status(200).json({ ok: true, saved: 0 })
      const r = await sbFetch('rpc/record_refine_batch', {
        method: 'POST',
        body: JSON.stringify({ p_vid: vid, p_rows: rows }),
      })
      if (!r.ok) return res.status(502).json({ error: 'write failed' })
      return res.status(200).json({ ok: true, saved: rows.length })
    } catch {
      return res.status(502).json({ error: 'write failed' })
    }
  }

  // ── GET: อ่านสถิติ (เฉพาะเจ้าของ) ──
  if (req.method === 'GET') {
    const user = await getUser(req)
    if (!user) return res.status(401).json({ error: 'unauthorized' })
    if (!isOwner(user)) return res.status(403).json({ error: 'ไม่มีสิทธิ์เข้าถึง' })
    try {
      const [lbRes, bdRes, logRes] = await Promise.all([
        sbFetch('refine_item_stats?select=item_type,item_id,attempts,success,fail&order=attempts.desc&limit=100'),
        sbFetch('refine_breakdown?select=dim,key,count'),
        sbFetch('refine_log?select=created_at,vid,item_type,item_id,level,stone,bsb,result&order=created_at.desc&limit=500'),
      ])
      const leaderboard = lbRes.ok ? await lbRes.json() : []
      const breakdownRows = bdRes.ok ? await bdRes.json() : []
      const log = logRes.ok ? await logRes.json() : []
      // group breakdown เป็น { dim: { key: count } }
      const breakdown = {}
      for (const b of breakdownRows) {
        (breakdown[b.dim] || (breakdown[b.dim] = {}))[b.key] = Number(b.count || 0)
      }
      res.setHeader('cache-control', 'no-store')
      return res.status(200).json({ leaderboard, breakdown, log })
    } catch {
      return res.status(502).json({ error: 'read failed' })
    }
  }

  return res.status(405).json({ error: 'method not allowed' })
}
