// Vercel Serverless: Refine analytics v2
//   POST → บันทึก batch (public, anonymous) ผ่าน RPC record_refine_batch
//   GET  → อ่านสถิติ (เฉพาะเจ้าของ) + pagination + level×result breakdown
// ENV: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, DASHBOARD_ALLOWED_EMAILS

import { getRate } from '../src/constants/refineRates.js'
import { BSB_REQUIRED_NORMAL, BSB_REQUIRED_EVENT, isBsbLevel } from '../src/constants/refineConfig.js'
import { getUser, isOwner } from './_lib/auth.js'
import { POST_BATCH_CAP } from '../src/constants/limits.js'

const ITEM_TYPES = ['weapon1', 'weapon2', 'weapon3', 'weapon4', 'weapon5', 'armor1', 'armor2']
const STONES = ['normal', 'enriched', 'hd']
const RESULTS = ['success', 'fail', 'lost', 'drop']
const MODES = ['manual', 'auto']
const MAX_ROWS = POST_BATCH_CAP // ต้องตรงกับฝั่ง client (src/utils/usageStats.js CAP) และ api/stats.js

function sbFetch(pathAndQuery, init) {
  const base = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  return fetch(`${base}/rest/v1/${pathAndQuery}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'count=exact',
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

// เช็คว่า result ที่ส่งมาเป็นไปได้จริงตามตาราง rate/กติกาเกม ไม่ใช่แค่ type/range ถูก
// (กันเคสแบบ level=0 result='lost' ที่เจอมาแล้ว — rate 100% ที่ level ต่ำ ๆ ล้มไม่ได้เลย)
function isPlausibleResult({ item_type, level, stone, bsb, result, event_buff }) {
  if (result === 'success') return true // สำเร็จเป็นไปได้เสมอ (ไม่มี rate 0%)
  const useCash = stone === 'hd'
  const useEnriched = stone === 'enriched'
  const rate = getRate(event_buff, useCash, useEnriched, item_type, level)
  if (rate >= 100) return false // rate 100% ล้มไม่ได้เลย
  const bsbTable = event_buff ? BSB_REQUIRED_EVENT : BSB_REQUIRED_NORMAL
  const bsbActive = bsb && isBsbLevel(level) && (bsbTable[level] || 0) > 0
  if (bsbActive) return result === 'fail' // BSB ป้องกัน ระดับไม่เปลี่ยน
  const isSpecial = item_type === 'weapon5' || item_type === 'armor2'
  if (isSpecial) return result === (level >= 10 ? 'lost' : 'drop')
  return result === (useCash ? 'drop' : 'lost')
}

function cleanRow(r) {
  if (!r || typeof r !== 'object') return null
  if (!ITEM_TYPES.includes(r.item_type)) return null
  if (!STONES.includes(r.stone)) return null
  if (!RESULTS.includes(r.result)) return null
  const level = Math.floor(Number(r.level))
  // level >= 20 เป็นไปไม่ได้แล้ว (ปุ่มตี manual ล็อกที่ +20 เหมือน Auto) — เดิมเผื่อไว้ถึง 25 ตอนยังไม่มี cap
  if (!Number.isFinite(level) || level < 0 || level > 19) return null

  let itemId = null
  if (r.item_id != null) {
    const n = Math.floor(Number(r.item_id))
    if (Number.isFinite(n) && n > 0 && n < 100000000) itemId = n
  }
  let refineAfter = null
  if (r.refine_after != null) {
    const n = Math.floor(Number(r.refine_after))
    if (Number.isFinite(n) && n >= 0 && n <= 20) refineAfter = n
  }

  let rollPct = null
  if (r.roll_pct != null) {
    const n = parseFloat(r.roll_pct)
    if (Number.isFinite(n) && n >= 0 && n <= 100) rollPct = Math.round(n * 100) / 100
  }

  const cleaned = {
    item_type:    r.item_type,
    item_id:      itemId,
    item_name:    typeof r.item_name === 'string' ? r.item_name.slice(0, 120) : null,
    level,
    refine_after: refineAfter,
    stone:        r.stone,
    bsb:          !!r.bsb,
    bsb_amount:   Math.min(999, Math.max(0, Math.floor(Number(r.bsb_amount) || 0))),
    result:       r.result,
    event_buff:   !!r.event_buff,
    mode:         MODES.includes(r.mode) ? r.mode : null,
    roll_pct:     rollPct,
  }
  if (!isPlausibleResult(cleaned)) return null
  return cleaned
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

    // pagination + filter params
    const url = new URL(req.url || '/', `http://x`)
    const page  = Math.max(1, parseInt(url.searchParams.get('page')  || '1', 10))
    const limit = Math.min(100, Math.max(10, parseInt(url.searchParams.get('limit') || '50', 10)))
    const filterResult    = url.searchParams.get('result') || ''
    const filterStone     = url.searchParams.get('stone') || ''
    const filterItemType  = url.searchParams.get('item_type') || ''
    const filterMode      = url.searchParams.get('mode') || ''
    const rawQ = url.searchParams.get('q') || ''
    const filterQ = rawQ.trim().replace(/[,()*%]/g, ' ').trim().slice(0, 60)
    const offset = (page - 1) * limit

    try {
      // build log query with optional filters
      // order ต้องมี id.desc เป็น tiebreaker เสมอ — batch insert หลายแถวได้ created_at เท่ากันเป๊ะ (now() ค่าเดียวกันทั้ง statement)
      // ถ้า sort แค่ created_at.desc ลำดับของแถวที่เวลาเท่ากันจะไม่ deterministic (Postgres ไม่การันตี) ลำดับใน log ดูสลับมั่ว
      let logQ = 'refine_log?select=id,created_at,vid,item_type,item_id,item_name,level,refine_after,stone,bsb,bsb_amount,result,event_buff,mode,roll_pct&order=created_at.desc,id.desc'
      if (RESULTS.includes(filterResult))   logQ += `&result=eq.${filterResult}`
      if (STONES.includes(filterStone))     logQ += `&stone=eq.${filterStone}`
      if (ITEM_TYPES.includes(filterItemType)) logQ += `&item_type=eq.${filterItemType}`
      if (MODES.includes(filterMode))       logQ += `&mode=eq.${filterMode}`
      if (filterQ) {
        const enc = encodeURIComponent(`*${filterQ}*`)
        logQ += `&or=(item_name.ilike.${enc},vid.ilike.${enc})`
      }
      logQ += `&offset=${offset}&limit=${limit}`

      const [lbRes, bdRes, logRes] = await Promise.all([
        sbFetch('refine_item_stats?select=item_type,item_id,attempts,success,fail&order=attempts.desc&limit=100'),
        sbFetch('refine_breakdown?select=scope,dim,key,count,success&scope=eq.global'),
        sbFetch(logQ),
      ])

      const leaderboard   = lbRes.ok   ? await lbRes.json()   : []
      const breakdownRows = bdRes.ok   ? await bdRes.json()   : []
      const log           = logRes.ok  ? await logRes.json()  : []

      // total count จาก Content-Range header (Prefer: count=exact)
      const cr = logRes.headers?.get?.('content-range') || ''
      const total = cr ? parseInt(cr.split('/')[1] || '0', 10) || log.length : log.length

      // group breakdown เป็น { dim: { key: { count, success } } }
      const breakdown = {}
      for (const b of breakdownRows) {
        if (!breakdown[b.dim]) breakdown[b.dim] = {}
        breakdown[b.dim][b.key] = { count: Number(b.count || 0), success: Number(b.success || 0) }
      }

      // level×result (all-time) จาก breakdown dim 'level_result' (key = "<level>:<result>")
      const lrMap = {}
      const ensureLevel = (l) => (lrMap[l] || (lrMap[l] = { level: l, success: 0, fail: 0, drop: 0, lost: 0, weapon: 0, armor: 0 }))
      for (const [k, v] of Object.entries(breakdown.level_result || {})) {
        const idx = k.indexOf(':')
        const l = Number(k.slice(0, idx)) || 0
        const result = k.slice(idx + 1)
        const row = ensureLevel(l)
        if (result) row[result] = (row[result] || 0) + v.count
      }

      // stone usage (all-time) จาก breakdown dim 'stone_combo' (key = "<item_type>|<level>|<stone>")
      // ส่งเป็น aggregate ให้ client map เป็นชื่อแร่จริง (getOreName) เอง + เก็บ weapon/armor ต่อระดับ
      const stoneUsage = []
      let stoneUsageTotal = 0
      for (const [k, v] of Object.entries(breakdown.stone_combo || {})) {
        const [item_type, levelStr, stone] = k.split('|')
        const level = Number(levelStr) || 0
        stoneUsage.push({ item_type, level, stone, count: v.count })
        stoneUsageTotal += v.count
        const row = ensureLevel(level)
        if (item_type && item_type.startsWith('weapon')) row.weapon += v.count
        else row.armor += v.count
      }
      const levelResult = Object.values(lrMap).sort((a, b) => a.level - b.level)

      res.setHeader('cache-control', 'no-store')
      return res.status(200).json({ leaderboard, breakdown, log, total, page, limit, levelResult, stoneUsage, stoneUsageTotal })
    } catch {
      return res.status(502).json({ error: 'read failed' })
    }
  }

  return res.status(405).json({ error: 'method not allowed' })
}
