// Smoke test เส้นทาง "ตีบวก → API จริง → DB → ตัวเลขทุกจุด" โดยไม่ต้องเปิดหน้าเว็บ
//
//   npm run smoke                     → ยิงที่ https://ro-refine.com
//   npm run smoke -- http://localhost:5173  (หรือ SMOKE_URL=...)
//
// ทำอะไร:
//   1. อ่านค่าก่อนทดสอบ (service role จาก .env.local)
//   2. POST /api/refine 3 แถว (ติด/BSB ล้ม/หาย) + POST /api/stats (refine + visit) ด้วย vid "smoke-<เวลา>" และ UA ของ health-check bot
//   3. เช็กว่า refine_log, ตัวนับรวม, รายวัน, อันดับไอเทม, breakdown, activity feed และ GET /api/stats ขยับตรงกัน
//   4. ลบแถวทดสอบทิ้งเสมอ (refine_log + usage_events ของ vid นี้) แม้เทสล้ม
//
// ข้อมูลทดสอบอยู่บน production ราว 2–10 วินาทีก่อนถูกลบ — ใช้ item_id 99999999 กันปนกับไอเทมจริงในอันดับ
// ENV: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (โหลดผ่าน node --env-file=.env.local ใน npm script)

import { BOT_UA_SIGNATURE } from '../src/constants/botUA.js'
import { BSB_REQUIRED_NORMAL } from '../src/constants/refineConfig.js'

const BASE = (process.argv[2] || process.env.SMOKE_URL || 'https://ro-refine.com').replace(/\/$/, '')
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env
const VID = `smoke-${Date.now()}`
const ITEM_ID = 99999999
const UA = `Mozilla/5.0 (compatible; ${BOT_UA_SIGNATURE}/1.0; smoke-test)`

// 3 แถวที่ server ต้องรับ (ผ่าน isPlausibleResult ใน api/refine.js) — weapon1 ปลอดภัยถึง +7
const BSB_AT_8 = BSB_REQUIRED_NORMAL[8]
const ROWS = [
  { item_type: 'weapon1', item_id: ITEM_ID, item_name: 'Smoke Test', level: 3, refine_after: 4, stone: 'normal', bsb: false, bsb_amount: 0, result: 'success', mode: 'manual' },
  { item_type: 'weapon1', item_id: ITEM_ID, item_name: 'Smoke Test', level: 8, refine_after: 8, stone: 'normal', bsb: true, bsb_amount: BSB_AT_8, result: 'fail', mode: 'manual' },
  { item_type: 'weapon1', item_id: ITEM_ID, item_name: 'Smoke Test', level: 10, refine_after: 0, stone: 'normal', bsb: false, bsb_amount: 0, result: 'lost', mode: 'manual' },
]
const N = ROWS.length

// ── Supabase (service role) ──
function sb(path, init = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  })
}
async function sbJson(path) {
  const r = await sb(path)
  if (!r.ok) throw new Error(`${path} → ${r.status} ${await r.text()}`)
  return r.json()
}

const bkkToday = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10)
const byKey = (rows, k, v) => Object.fromEntries(rows.map((r) => [r[k], Number(r[v])]))

async function snapshot() {
  const [counters, daily, result] = await Promise.all([
    sbJson('usage_counters?select=metric,count'),
    sbJson(`usage_daily?select=metric,count&day=eq.${bkkToday()}&metric=in.(refine,stone,bsb)`),
    sbJson('refine_breakdown?select=key,count&dim=eq.result'),
  ])
  return { counters: byKey(counters, 'metric', 'count'), daily: byKey(daily, 'metric', 'count'), result: byKey(result, 'key', 'count') }
}

// ── checks ──
const results = []
function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail })
}
const delta = (after, before, k) => (after[k] || 0) - (before[k] || 0)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function cleanup() {
  const enc = encodeURIComponent(VID)
  const [a, b] = await Promise.all([
    sb(`refine_log?vid=eq.${enc}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }),
    sb(`usage_events?vid=eq.${enc}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }),
  ])
  const left = await sbJson(`refine_log?select=id&vid=eq.${enc}`)
  check('cleanup: ลบข้อมูลทดสอบหมด', a.ok && b.ok && left.length === 0, `เหลือ ${left.length} แถว`)
}

async function run() {
  const before = await snapshot()

  // 1) ยิง API จริง (เหมือน client: refine batch + ตัวนับ/feed + visit)
  const refineRes = await fetch(`${BASE}/api/refine`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
    body: JSON.stringify({ vid: VID, rows: ROWS }),
  })
  const refineBody = await refineRes.json().catch(() => ({}))
  check('POST /api/refine บันทึกครบ', refineRes.ok && refineBody.saved === N, `status ${refineRes.status}, saved ${refineBody.saved}/${N}`)

  // ส่งแยก request เหมือน client จริง (flushUsage / pingVisitOncePerDay) — รวมกันแล้ว insert event หลายแบบใน batch เดียวจะไม่ผ่าน
  const postStats = (body) => fetch(`${BASE}/api/stats`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
    body: JSON.stringify({ ...body, vid: VID }),
  })
  const [statsRefine, statsVisit] = [await postStats({ refine: N }), await postStats({ visit: true })]
  check('POST /api/stats ตอบ 200', statsRefine.ok && statsVisit.ok, `refine ${statsRefine.status}, visit ${statsVisit.status}`)

  // 2) รอให้แถวเข้า refine_log (ปกติทันที — เผื่อ cold start)
  let logRows = []
  for (let i = 0; i < 10 && logRows.length < N; i++) {
    logRows = await sbJson(`refine_log?select=result,bsb,bsb_amount,level&vid=eq.${encodeURIComponent(VID)}`)
    if (logRows.length < N) await sleep(1000)
  }
  check('refine_log มีครบทุกแถว', logRows.length === N, `${logRows.length}/${N}`)
  const bsbRow = logRows.find((r) => r.result === 'fail')
  check('refine_log.bsb คำนวณจาก bsb_amount', bsbRow?.bsb === true && logRows.filter((r) => r.bsb).length === 1, `bsb_amount ${bsbRow?.bsb_amount}`)

  // 3) ตัวเลขสรุปทุกจุด (global อาจมีผู้ใช้จริงตีแทรก → เช็ก ≥, ส่วนของ item ทดสอบเช็กเป๊ะ)
  const after = await snapshot()
  const exp = { refine: N, stone: N, bsb: BSB_AT_8 }
  check('usage_counters ขยับ', delta(after.counters, before.counters, 'refine_total') >= exp.refine && delta(after.counters, before.counters, 'stone_total') >= exp.stone && delta(after.counters, before.counters, 'bsb_total') >= exp.bsb,
    `refine +${delta(after.counters, before.counters, 'refine_total')}, stone +${delta(after.counters, before.counters, 'stone_total')}, bsb +${delta(after.counters, before.counters, 'bsb_total')}`)
  check('usage_daily (วันนี้) ขยับ', delta(after.daily, before.daily, 'refine') >= exp.refine && delta(after.daily, before.daily, 'stone') >= exp.stone && delta(after.daily, before.daily, 'bsb') >= exp.bsb,
    `refine +${delta(after.daily, before.daily, 'refine')}, stone +${delta(after.daily, before.daily, 'stone')}, bsb +${delta(after.daily, before.daily, 'bsb')}`)
  check('refine_breakdown (ผลการตี) ขยับ', ['success', 'fail', 'lost'].every((k) => delta(after.result, before.result, k) >= 1),
    ['success', 'fail', 'lost'].map((k) => `${k} +${delta(after.result, before.result, k)}`).join(', '))

  const [stats] = await sbJson(`refine_item_stats?select=attempts,success,fail&item_type=eq.weapon1&item_id=eq.${ITEM_ID}`)
  check('refine_item_stats (อันดับไอเทม) ตรงเป๊ะ', stats && stats.attempts === N && stats.success === 1 && stats.fail === N - 1, stats ? `${stats.attempts} ครั้ง ติด ${stats.success} ไม่ติด ${stats.fail}` : 'ไม่พบแถว')

  // 4) activity feed + bot ต้องไม่ถูกนับเป็นผู้เข้าชม
  const events = await sbJson(`usage_events?select=type,count,visitor_status&vid=eq.${encodeURIComponent(VID)}`)
  const refineEv = events.find((e) => e.type === 'refine')
  const visitEv = events.find((e) => e.type === 'visit')
  check('activity feed มี event ตีบวก', refineEv?.count === N, refineEv ? `count ${refineEv.count}` : 'ไม่พบ')
  check('visit จาก bot ติดป้าย bot', visitEv?.visitor_status === 'bot', visitEv ? `status ${visitEv.visitor_status}` : 'ไม่พบ')
  const visitor = await sbJson(`usage_visitors?select=vid&vid=eq.${encodeURIComponent(VID)}`)
  check('bot ไม่ถูกนับในผู้เข้าชม', visitor.length === 0, `${visitor.length} แถว`)

  // 5) GET สาธารณะของเว็บจริง (cache-bust) — อ่านผ่าน view ได้และเห็นยอดใหม่
  const pub = await fetch(`${BASE}/api/stats?smoke=${VID}`).then((r) => r.json()).catch(() => null)
  check('GET /api/stats เห็นยอดใหม่', pub && pub.refine >= (before.counters.refine_total || 0) + N, pub ? `refine ${pub.refine}` : 'อ่านไม่ได้')
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('ต้องมี SUPABASE_URL และ SUPABASE_SERVICE_ROLE_KEY (npm run smoke โหลดจาก .env.local)')
    process.exit(2)
  }
  console.log(`smoke test → ${BASE}  (vid ${VID})\n`)
  try {
    await run()
  } catch (err) {
    check('ทดสอบรันจนจบ', false, err.message)
  } finally {
    await cleanup().catch((err) => check('cleanup: ลบข้อมูลทดสอบหมด', false, err.message))
  }

  for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  — ${r.detail}` : ''}`)
  const failed = results.filter((r) => !r.ok).length
  console.log(`\n${failed ? `${failed} FAIL` : 'ผ่านทั้งหมด'} (${results.length} checks)`)
  process.exit(failed ? 1 : 0)
}

main()
