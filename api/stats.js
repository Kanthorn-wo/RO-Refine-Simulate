import { isBotUA } from '../src/constants/botUA.js'
import { getUser, isOwner } from './_lib/auth.js'
import { bkkToday } from '../src/utils/date.js'
import { POST_BATCH_CAP } from '../src/constants/limits.js'
import { ORE_COLORS } from '../src/constants/ores.js'

// Vercel Serverless: ตัวนับการใช้งานรวม (social proof) — anonymous, ไม่เก็บข้อมูลส่วนตัว
//   GET  → ตัวเลขรวมสะสม + คนใช้วันนี้ + flag show_stats (public, cache สั้น)
//          ส่ง ?from=YYYY-MM-DD&to=YYYY-MM-DD หรือ ?history=N → แนบ daily[] รายวันสำหรับกราฟ
//   POST → เพิ่มยอด (batch ผ่าน sendBeacon) — เขียนทั้งยอดสะสม (usage_counters) + รายวัน (usage_daily)
//          cap delta ต่อ request กัน abuse
// เขียน/อ่านผ่าน service_role (RLS ล็อก table ไว้)
// ENV: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

const CAP = POST_BATCH_CAP // cap delta สูงสุดต่อ request — ต้องตรงกับฝั่ง client (src/utils/usageStats.js) เสมอ
const MAX_RANGE = 366    // เพดานช่วงวันที่ดึงรายวัน (กัน payload บวม)
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// ไล่วันจาก from → to (รวมปลายทั้งสอง) เป็น array ของ 'YYYY-MM-DD'
function eachDay(from, to) {
  const out = []
  let d = new Date(`${from}T00:00:00Z`)
  const end = new Date(`${to}T00:00:00Z`)
  while (d <= end && out.length <= MAX_RANGE) {
    out.push(d.toISOString().slice(0, 10))
    d = new Date(d.getTime() + 86400000)
  }
  return out
}

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

function bumpTotal(metric, delta) {
  return sbFetch('rpc/bump_counter', {
    method: 'POST',
    body: JSON.stringify({ p_metric: metric, p_delta: delta }),
  })
}

function bumpDaily(day, metric, delta) {
  return sbFetch('rpc/bump_daily', {
    method: 'POST',
    body: JSON.stringify({ p_day: day, p_metric: metric, p_delta: delta }),
  })
}

function recordVisit(vid, day) {
  return sbFetch('rpc/record_visit', {
    method: 'POST',
    body: JSON.stringify({ p_vid: vid, p_day: day }),
  })
}

// event แบบ discrete (action) ที่รับได้ — กันยัด type มั่ว
const ACTION_EVENTS = ['auto', 'simulate']
// ค่าที่ cookie bar ส่งมา (src/components/CookieConsent) — ตรงกับ check constraint ของ usage_visitors.consent
const CONSENT_VALUES = ['accepted', 'rejected']

// meta ของ simulate / auto (config + ผลสรุป) — whitelist ทุก field, ค่าผิดรูปแบบทิ้ง (ชุด type/stone ตรงกับ api/refine.js)
const META_ITEM_TYPES = ['weapon1', 'weapon2', 'weapon3', 'weapon4', 'weapon5', 'armor1', 'armor2']
const META_STONES = ['normal', 'enriched', 'hd']
const SIM_NUM_FIELDS = ['avg_attempts', 'min_attempts', 'max_attempts', 'median', 'p90', 'avg_successes', 'avg_fails', 'avg_lost', 'avg_ores', 'avg_bsb']
const ORE_NAMES = Object.keys(ORE_COLORS) // ชื่อแร่ทั้งหมดในระบบ — กันยัด key มั่วใน map แร่
const roundNum = (v) => {
  const n = Number(v)
  return v != null && Number.isFinite(n) && n >= 0 && n <= 1e6 ? Math.round(n * 100) / 100 : undefined
}
// { ชื่อแร่: จำนวน } — รับเฉพาะชื่อแร่ที่รู้จัก
const sanitizeOres = (o) => (o && typeof o === 'object'
  ? dropUndefined(Object.fromEntries(ORE_NAMES.filter((k) => k in o).map((k) => [k, roundNum(o[k])])))
  : null)
const AUTO_STOP_REASONS = ['target', 'lost', 'risk', 'stopped', 'closed']
// ลำดับการตีของรอบ auto: [ระดับก่อน, ระดับหลัง, ผล, หิน, BSB] — cap ต้องตรงกับ AUTO_STEP_CAP ใน Layout
const AUTO_STEP_CAP = 1000
const STEP_RESULTS = ['s', 'f', 'd', 'l', 'b'] // success / fail / level_drop / item_lost / bsb_protect
const STEP_STONES = ['n', 'e', 'h']            // normal / enriched / hd
const intIn = (v, min, max) => (Number.isInteger(v) && v >= min && v <= max ? v : undefined)
const boolOr = (v) => (typeof v === 'boolean' ? v : undefined)
const dropUndefined = (out) => {
  for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k]
  return Object.keys(out).length ? out : null
}
// field ที่ simulate กับ auto ใช้ร่วมกัน
const baseMeta = (m) => ({
  item_type: META_ITEM_TYPES.includes(m.item_type) ? m.item_type : undefined,
  item_id: intIn(m.item_id, 1, 99999999),
  item_name: typeof m.item_name === 'string' && m.item_name ? m.item_name.slice(0, 120) : undefined,
  start: intIn(m.start, 0, 20),
  target: intIn(m.target, 1, 20),
  event_rate: boolOr(m.event_rate),
})

function sanitizeSimMeta(m) {
  if (!m || typeof m !== 'object') return null
  const out = {
    ...baseMeta(m),
    stone: META_STONES.includes(m.stone) ? m.stone : undefined,
    bsb: boolOr(m.bsb),
    rounds: intIn(m.rounds, 1, 1000),
    aborted: intIn(m.aborted, 0, 1000),
    ores: sanitizeOres(m.ores) || undefined,
  }
  for (const k of SIM_NUM_FIELDS) out[k] = roundNum(m[k])
  return dropUndefined(out)
}

// auto 1 รอบ (เริ่ม→หยุด): แผนหินตามช่วง (rules) + เหตุผลที่หยุด + ผลรวมทั้งรอบ
function sanitizeAutoMeta(m) {
  if (!m || typeof m !== 'object') return null
  const rules = Array.isArray(m.rules)
    ? m.rules.slice(0, 20)
      .filter((r) => r && intIn(r.from, 1, 20) !== undefined && META_STONES.includes(r.stone))
      .map((r) => ({ from: r.from, stone: r.stone, bsb: r.bsb === true, stop: r.stop === true }))
    : undefined
  return dropUndefined({
    ...baseMeta(m),
    use_bsb: boolOr(m.use_bsb),
    rules: rules && rules.length ? rules : undefined,
    reason: AUTO_STOP_REASONS.includes(m.reason) ? m.reason : undefined,
    attempts: intIn(m.attempts, 0, 100000),
    successes: intIn(m.successes, 0, 100000),
    drops: intIn(m.drops, 0, 100000),
    lost: boolOr(m.lost),
    bsb_used: intIn(m.bsb_used, 0, 10000000),
    ores: sanitizeOres(m.ores) || undefined,
    final_level: intIn(m.final_level, 0, 20),
    max_level: intIn(m.max_level, 0, 20),
    duration_sec: intIn(m.duration_sec, 0, 86400),
    steps: Array.isArray(m.steps)
      ? m.steps.slice(0, AUTO_STEP_CAP)
        .filter((s) => Array.isArray(s) && intIn(s[0], 0, 19) !== undefined && intIn(s[1], 0, 20) !== undefined
          && STEP_RESULTS.includes(s[2]) && STEP_STONES.includes(s[3]))
        .map((s) => [s[0], s[1], s[2], s[3], intIn(s[4], 0, 999) ?? 0])
      : undefined,
    steps_truncated: boolOr(m.steps_truncated),
  })
}
const META_SANITIZERS = { simulate: sanitizeSimMeta, auto: sanitizeAutoMeta }

// อ่าน body ให้รองรับทั้ง Vercel (req.body parsed) และ dev shim (raw stream)
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

const clampInt = (v) => {
  const n = Math.floor(Number(v))
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.min(n, CAP)
}

// คำนวณช่วงวันที่จาก query (from/to หรือ history=N) — คืน null ถ้าไม่ขอ daily
function resolveRange(q, today) {
  const from = q('from')
  const to = q('to')
  if (DATE_RE.test(from || '') && DATE_RE.test(to || '')) {
    const [a, b] = from <= to ? [from, to] : [to, from]
    const days = eachDay(a, b)
    return days.length ? { from: days[0], to: days[days.length - 1], days } : null
  }
  const n = Math.floor(Number(q('history')))
  if (Number.isFinite(n) && n > 0) {
    const span = Math.min(n, MAX_RANGE)
    const start = new Date(`${today}T00:00:00Z`).getTime() - (span - 1) * 86400000
    const from2 = new Date(start).toISOString().slice(0, 10)
    return { from: from2, to: today, days: eachDay(from2, today) }
  }
  return null
}

// usage_events row → event ของ feed (id ใช้เป็น cursor ?before= ตอนโหลดหน้าถัดไป)
const mapEvent = (r) => ({ id: r.id, at: r.created_at, type: r.type, count: Number(r.count || 1), vid: r.vid || null, status: r.visitor_status || null, meta: r.meta || null })

export default async function handler(req, res) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'supabase env not set' })
  }
  const today = bkkToday()

  if (req.method === 'GET') {
    try {
      const url = new URL(req.url, 'http://localhost')
      const q = (k) => (req.query && req.query[k]) ?? url.searchParams.get(k)
      const range = resolveRange(q, today)
      const evN = Math.min(Math.max(Math.floor(Number(q('events'))) || 0, 0), 200)

      // ?events= คือ feed ระดับ per-vid (เหมือนที่ dashboard อื่นต้อง auth) — ต่างจากตัวเลขรวม/daily ที่ยังคง public
      if (evN) {
        const user = await getUser(req)
        if (!user) return res.status(401).json({ error: 'unauthorized' })
        if (!isOwner(user)) return res.status(403).json({ error: 'ไม่มีสิทธิ์เข้าถึง' })
      }

      // หน้าถัดไปของ feed (?before=<id>) / feed ของผู้ใช้คนเดียว (?vid=) → ส่งเฉพาะ events ไม่ดึงตัวเลขรวมซ้ำ
      // usage_events เก็บทุกแถวแล้ว (docs/sql/usage-events-keep-all.sql) — client ไล่หน้าจนครบ (hasMore=false)
      const before = Math.floor(Number(q('before'))) || 0
      const evVid = typeof q('vid') === 'string' && /^[\w-]{8,64}$/.test(q('vid')) ? q('vid') : ''
      if (evN && (before > 0 || evVid)) {
        let evQ = `usage_events?select=id,created_at,type,count,vid,visitor_status,meta&order=created_at.desc,id.desc&limit=${evN}`
        if (before > 0) evQ += `&id=lt.${before}`
        if (evVid) evQ += `&vid=eq.${encodeURIComponent(evVid)}`
        const r = await sbFetch(evQ)
        if (!r.ok) return res.status(502).json({ error: 'events failed' })
        const rows = await r.json()
        res.setHeader('cache-control', 'no-store')
        return res.status(200).json({ events: rows.map(mapEvent), hasMore: rows.length === evN })
      }

      // ?overview=1 → หน้า "ภาพรวม" (owner-only): สรุปทั้งหมดคำนวณใน RPC overview_stats (docs/sql/overview-stats.sql)
      if (q('overview')) {
        const user = await getUser(req)
        if (!user) return res.status(401).json({ error: 'unauthorized' })
        if (!isOwner(user)) return res.status(403).json({ error: 'ไม่มีสิทธิ์เข้าถึง' })
        const r = await sbFetch('rpc/overview_stats', { method: 'POST', body: '{}' })
        if (!r.ok) return res.status(502).json({ error: 'overview failed' })
        res.setHeader('cache-control', 'no-store')
        return res.status(200).json(await r.json())
      }

      const reqs = [
        sbFetch('usage_counters?select=metric,count&metric=in.(refine_total,stone_total,bsb_total)'),
        sbFetch(`usage_daily?select=metric,count&day=eq.${today}&metric=in.(refine,stone,bsb,visits,visits_new,visits_returning,auto,simulate)`),
        sbFetch('site_settings?select=key,value&key=in.(show_stats,show_online,track_online)'),
        sbFetch('usage_visitors?select=vid&limit=1', { headers: { Prefer: 'count=exact' } }),
      ]
      let dailyIdx = -1
      let eventsIdx = -1
      if (range) { dailyIdx = reqs.length; reqs.push(sbFetch(`usage_daily?select=day,metric,count&day=gte.${range.from}&day=lte.${range.to}&order=day`)) }
      // order ต้องมี id.desc เป็น tiebreaker — batch insert หลายแถวได้ created_at เท่ากันเป๊ะ (ดูคอมเมนต์เดียวกันใน api/refine.js)
      if (evN)   { eventsIdx = reqs.length; reqs.push(sbFetch(`usage_events?select=id,created_at,type,count,vid,visitor_status,meta&order=created_at.desc,id.desc&limit=${evN}`)) }
      const results = await Promise.all(reqs)
      const [cRes, vRes, sRes, visRes] = results
      const dRes = dailyIdx >= 0 ? results[dailyIdx] : null
      const eRes = eventsIdx >= 0 ? results[eventsIdx] : null
      const counters = cRes.ok ? await cRes.json() : []
      const todayRows = vRes.ok ? await vRes.json() : []
      const settings = sRes.ok ? await sRes.json() : []
      const get = (m) => Number((counters.find((x) => x.metric === m) || {}).count || 0)
      const todayOf = (m) => Number((todayRows.find((x) => x.metric === m) || {}).count || 0)
      const showRow = settings.find((x) => x.key === 'show_stats')
      const showStats = showRow ? showRow.value !== false : true // default = แสดง
      const onlineRow = settings.find((x) => x.key === 'show_online')
      const showOnline = onlineRow ? onlineRow.value !== false : true // default = แสดง
      const trackRow = settings.find((x) => x.key === 'track_online')
      const trackOnline = trackRow ? trackRow.value !== false : true // default = track
      // จำนวนผู้ใช้ไม่ซ้ำทั้งหมด (all-time) จาก content-range header ของ count=exact
      const visCR = visRes && visRes.ok ? (visRes.headers.get('content-range') || '') : ''
      const totalVisitors = Number((visCR.split('/')[1]) || 0)

      const payload = {
        refine: get('refine_total'),
        stone: get('stone_total'),
        bsb: get('bsb_total'),
        refineToday: todayOf('refine'),
        stoneToday: todayOf('stone'),
        bsbToday: todayOf('bsb'),
        visitsToday: todayOf('visits'),
        newToday: todayOf('visits_new'),
        returningToday: todayOf('visits_returning'),
        autoToday: todayOf('auto'),
        simToday: todayOf('simulate'),
        totalVisitors,
        showStats,
        showOnline,
        trackOnline,
      }

      if (range) {
        const rows = dRes && dRes.ok ? await dRes.json() : []
        const byDay = {}
        for (const r of rows) {
          (byDay[r.day] || (byDay[r.day] = {}))[r.metric] = Number(r.count || 0)
        }
        payload.daily = range.days.map((day) => {
          const m = byDay[day] || {}
          return {
            date: day,
            day: day.slice(5).replace('-', '/'), // 'MM/DD' สำหรับแกนกราฟ
            refine: m.refine || 0,
            stone: m.stone || 0,
            bsb: m.bsb || 0,
            visits: m.visits || 0,
            visits_new: m.visits_new || 0,
            visits_returning: m.visits_returning || 0,
            auto: m.auto || 0,
            simulate: m.simulate || 0,
          }
        })
      }

      if (eventsIdx >= 0) {
        const rows = eRes && eRes.ok ? await eRes.json() : []
        payload.events = rows.map(mapEvent)
        payload.hasMore = rows.length === evN
      }

      // ขอ events (feed) = อยาก realtime → ไม่ cache; อย่างอื่น cache 60 วิ
      res.setHeader('cache-control', evN ? 'no-store' : 's-maxage=60, stale-while-revalidate=300')
      return res.status(200).json(payload)
    } catch {
      return res.status(502).json({ error: 'read failed' })
    }
  }

  if (req.method === 'POST') {
    try {
      const body = await readBody(req)
      const refine = clampInt(body.refine)
      const stone = clampInt(body.stone)
      const bsb = clampInt(body.bsb)
      const tasks = []
      if (refine) { tasks.push(bumpTotal('refine_total', refine)); tasks.push(bumpDaily(today, 'refine', refine)) }
      if (stone)  { tasks.push(bumpTotal('stone_total', stone));   tasks.push(bumpDaily(today, 'stone', stone)) }
      if (bsb)    { tasks.push(bumpTotal('bsb_total', bsb));        tasks.push(bumpDaily(today, 'bsb', bsb)) }

      // vid = ID สุ่ม anonymous ต่อเบราว์เซอร์ (ไม่ผูกตัวตน) — ผูกกับ event เพื่อรู้ว่ามาจากคนเดียวกัน
      const vid = typeof body.vid === 'string' && /^[\w-]{8,64}$/.test(body.vid) ? body.vid : null

      // health-check bot (monitoring/run.js ผ่าน Playwright, UA เฉพาะ) — โชว์ใน feed แต่ไม่นับเข้าสถิติ/totalVisitors จริง
      const isBot = isBotUA(req.headers['user-agent'])

      // visit: bot ไม่นับเข้า usage_visitors/usage_daily, คนจริงใช้ record_visit (แยกคนใหม่/กลับมาซ้ำ), ไม่มี vid ก็นับรวมเฉย ๆ
      // เช็คก่อน recordVisit จะสร้าง row: ไม่เคยมี = 'new', มีแล้ว = 'returning' (เก็บลง event เพื่อโชว์ใน feed)
      let visitorStatus = null
      if (body.visit) {
        if (isBot) {
          visitorStatus = 'bot'
        } else if (vid) {
          const vr = await sbFetch(`usage_visitors?select=vid&vid=eq.${encodeURIComponent(vid)}&limit=1`)
          const existed = vr.ok ? ((await vr.json()).length > 0) : false
          visitorStatus = existed ? 'returning' : 'new'
          tasks.push(recordVisit(vid, today))
        } else {
          tasks.push(bumpDaily(today, 'visits', 1))
        }
      }

      // discrete action event (auto / simulate)
      const action = ACTION_EVENTS.includes(body.event) ? body.event : null
      if (action) tasks.push(bumpDaily(today, action, 1))
      // ตัวนับรายคน (usage_visitors.sim_runs / auto_runs) สำหรับหน้า "ภาพรวม" — bot ไม่นับ
      if (action && vid && !isBot) {
        tasks.push(sbFetch('rpc/bump_visitor_action', {
          method: 'POST',
          body: JSON.stringify({ p_vid: vid, p_action: action }),
        }))
      }

      // activity feed: 1 event ต่อ 1 batch (ตี = รวบทั้ง batch กัน row บวมจาก auto) — แนบ vid ของผู้ใช้
      const events = []
      if (refine) events.push({ type: 'refine', count: refine, vid })
      if (body.visit) events.push({ type: 'visit', count: 1, vid, visitor_status: visitorStatus })
      if (action) {
        // ใส่ key meta เฉพาะตอนมีค่า — event อื่นไม่แตะคอลัมน์นี้
        const meta = META_SANITIZERS[action](body.meta)
        events.push(meta ? { type: action, count: 1, vid, meta } : { type: action, count: 1, vid })
      }
      if (events.length) {
        tasks.push(sbFetch('usage_events', {
          method: 'POST',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify(events),
        }))
      }
      if (tasks.length) await Promise.all(tasks)

      // การตัดสินใจเรื่องคุกกี้ (ยอมรับ/ปฏิเสธ) ต่อ visitor — สำหรับสถิติ "GA4 เห็นกี่คน" ในหน้าภาพรวม
      // ทำหลัง tasks เพราะ row ของ usage_visitors สร้างโดย record_visit ใน request เดียวกันได้ (ไม่มี row = ข้าม รอบหน้าส่งใหม่)
      const consent = CONSENT_VALUES.includes(body.consent) ? body.consent : null
      if (consent && vid && !isBot) {
        await sbFetch('rpc/set_visitor_consent', {
          method: 'POST',
          body: JSON.stringify({ p_vid: vid, p_consent: consent }),
        })
      }
      return res.status(200).json({ ok: true })
    } catch {
      return res.status(502).json({ error: 'write failed' })
    }
  }

  return res.status(405).json({ error: 'method not allowed' })
}
