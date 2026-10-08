// Vercel Serverless: รายชื่อไอเทมเสริมสำหรับช่องค้นหาไอเทม (ตาราง extra_items) — จัดการผ่าน dashboard แท็บ "ไอเทม"
//   GET            → public: { add: [[id,label,armorLevel?]], deny: [id] }  (approved = เพิ่มเข้าช่องค้นหา, denied = ซ่อน)
//   GET ?all=1     → owner : ทุกแถว + โหมดอนุมัติ (autoApprove) — no-store
//   POST (owner)   → { action: 'lookup' | 'add' | 'setStatus' | 'delete', ... }
// โหมดอนุมัติ (item_auto_approve) เขียนผ่าน /api/settings; Action (scripts/find-missing-items.mjs) เขียนตารางตรง
// ENV: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, DASHBOARD_ALLOWED_EMAILS, DIVINE_PRIDE_API_KEY

import { getUser, isOwner } from './_lib/auth.js'
import { describeItem, normalizeItemKind } from './_lib/itemInfo.js'
import { dpItem, DivinePrideLimitError } from './_lib/divinePride.js'

const STATUSES = ['approved', 'pending', 'denied']
const ID_PATTERN = /^\d{1,8}$/
const MAX_LABEL = 120
const MAX_ROWS = 2000

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

// prefill ตอนเพิ่มด้วย Item ID: ขอ thROG แล้ว iRO ตามลำดับ (ทีละคำขอผ่านตัวคุมอัตรา; โดน rate limit = throw DivinePrideLimitError)
// คืนผลวิเคราะห์ + ข้อมูลดิบครบทุก field ให้ dashboard โชว์ไว้ตรวจก่อนบันทึก; ไม่มีชื่อจริงทั้งสองเซิร์ฟ = null
async function lookupItem(id) {
  const thai = (await dpItem(id, { server: 'thROG', lang: 'en' })).data
  const global = (await dpItem(id, { server: 'iRO', lang: 'en' })).data
  const info = describeItem(thai, global)
  return info && { id: Number(id), ...info, raw: { thROG: thai, iRO: global } }
}

const rowToItem = (r) => [Number(r.id), r.label, ...(r.armor_level === 2 ? [2] : [])]

export default async function handler(req, res) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'supabase env not set' })
  }
  const url = new URL(req.url || '/', 'http://localhost')

  // ── GET ──
  if (req.method === 'GET') {
    // owner: ทุกแถว + โหมดอนุมัติ
    if (url.searchParams.get('all') === '1') {
      const user = await getUser(req)
      if (!user) return res.status(401).json({ error: 'unauthorized' })
      if (!isOwner(user)) return res.status(403).json({ error: 'ไม่มีสิทธิ์เข้าถึง' })
      try {
        const [itemsRes, settingRes] = await Promise.all([
          sbFetch(`extra_items?select=id,label,armor_level,item_type,weapon_level,level_uncertain,status,source,created_at,updated_at&order=updated_at.desc&limit=${MAX_ROWS}`),
          sbFetch('site_settings?select=value&key=eq.item_auto_approve'),
        ])
        if (!itemsRes.ok || !settingRes.ok) return res.status(502).json({ error: 'read failed' })
        const items = await itemsRes.json()
        const setting = await settingRes.json()
        res.setHeader('cache-control', 'no-store')
        return res.status(200).json({ items, autoApprove: !!(setting[0] && setting[0].value === true) })
      } catch {
        return res.status(502).json({ error: 'read failed' })
      }
    }

    // public: ที่อนุมัติแล้ว (เพิ่ม) + ที่ปฏิเสธ (ซ่อน) — ไม่เปิดเผยแถว pending
    try {
      const r = await sbFetch(`extra_items?select=id,label,armor_level,status&status=in.(approved,denied)&limit=${MAX_ROWS}`)
      if (!r.ok) return res.status(502).json({ error: 'read failed' })
      const rows = await r.json()
      res.setHeader('cache-control', 's-maxage=300, stale-while-revalidate=900')
      return res.status(200).json({
        add: rows.filter((x) => x.status === 'approved').map(rowToItem),
        deny: rows.filter((x) => x.status === 'denied').map((x) => Number(x.id)),
      })
    } catch {
      return res.status(502).json({ error: 'read failed' })
    }
  }

  // ── POST (owner) ──
  if (req.method === 'POST') {
    const user = await getUser(req)
    if (!user) return res.status(401).json({ error: 'unauthorized' })
    if (!isOwner(user)) return res.status(403).json({ error: 'ไม่มีสิทธิ์เข้าถึง' })

    const body = await readBody(req)
    const action = String(body.action || '')
    const id = String(body.id ?? '').trim()
    if (!ID_PATTERN.test(id)) return res.status(400).json({ error: 'invalid id' })

    try {
      if (action === 'lookup') {
        if (!process.env.DIVINE_PRIDE_API_KEY) return res.status(500).json({ error: 'DIVINE_PRIDE_API_KEY ยังไม่ได้ตั้ง' })
        let info
        try { info = await lookupItem(id) } catch (e) {
          if (e instanceof DivinePrideLimitError) {
            res.setHeader('retry-after', String(e.retryAfter))
            return res.status(429).json({ error: `divine-pride จำกัดอัตราการเรียก ลองใหม่อีกครั้งใน ${e.retryAfter} วินาที` })
          }
          throw e
        }
        if (!info) return res.status(404).json({ error: 'ไม่พบข้อมูลไอเทมนี้' })
        const existing = await sbFetch(`extra_items?select=status&id=eq.${id}`)
        const rows = existing.ok ? await existing.json() : []
        return res.status(200).json({ ...info, existingStatus: rows[0] ? rows[0].status : null })
      }

      if (action === 'add') {
        const label = String(body.label || '').trim()
        if (!label || label.length > MAX_LABEL) return res.status(400).json({ error: 'invalid label' })
        const kind = normalizeItemKind(body)
        const status = body.status === undefined ? 'approved' : String(body.status)
        if (!STATUSES.includes(status)) return res.status(400).json({ error: 'invalid status' })
        const r = await sbFetch('extra_items?on_conflict=id', {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify({ id: Number(id), label, ...kind, status, source: 'manual', level_uncertain: false, updated_at: new Date().toISOString() }),
        })
        if (!r.ok) return res.status(502).json({ error: 'write failed' })
        return res.status(200).json({ ok: true })
      }

      if (action === 'setStatus') {
        const status = String(body.status || '')
        if (!STATUSES.includes(status)) return res.status(400).json({ error: 'invalid status' })
        const r = await sbFetch(`extra_items?id=eq.${id}`, {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          // อนุมัติ = คนตรวจเลเวลแล้ว → เคลียร์ป้ายไม่แน่ใจ
          body: JSON.stringify({ status, ...(status === 'approved' ? { level_uncertain: false } : {}), updated_at: new Date().toISOString() }),
        })
        if (!r.ok) return res.status(502).json({ error: 'write failed' })
        return res.status(200).json({ ok: true })
      }

      if (action === 'delete') {
        const r = await sbFetch(`extra_items?id=eq.${id}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } })
        if (!r.ok) return res.status(502).json({ error: 'write failed' })
        return res.status(200).json({ ok: true })
      }

      return res.status(400).json({ error: 'invalid action' })
    } catch {
      return res.status(502).json({ error: 'request failed' })
    }
  }

  return res.status(405).json({ error: 'method not allowed' })
}
