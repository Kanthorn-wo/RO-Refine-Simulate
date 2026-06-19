// Vercel Serverless: ตัวนับการใช้งานรวม (social proof) — anonymous, ไม่เก็บข้อมูลส่วนตัว
//   GET  → ตัวเลขรวมสะสม + คนใช้วันนี้ + flag show_stats (public, cache สั้น)
//          ส่ง ?from=YYYY-MM-DD&to=YYYY-MM-DD หรือ ?history=N → แนบ daily[] รายวันสำหรับกราฟ
//   POST → เพิ่มยอด (batch ผ่าน sendBeacon) — เขียนทั้งยอดสะสม (usage_counters) + รายวัน (usage_daily)
//          cap delta ต่อ request กัน abuse
// เขียน/อ่านผ่าน service_role (RLS ล็อก table ไว้)
// ENV: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

const CAP = 200          // cap delta สูงสุดต่อ request
const MAX_RANGE = 366    // เพดานช่วงวันที่ดึงรายวัน (กัน payload บวม)
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// วันที่ปัจจุบันโซนไทย (UTC+7, ไม่มี DST) เป็น 'YYYY-MM-DD'
function bkkToday() {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10)
}

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

      const reqs = [
        sbFetch('usage_counters?select=metric,count&metric=in.(refine_total,stone_total,bsb_total)'),
        sbFetch(`usage_daily?select=metric,count&day=eq.${today}&metric=in.(visits,visits_new,visits_returning,auto,simulate)`),
        sbFetch('site_settings?select=key,value&key=eq.show_stats'),
        sbFetch('usage_visitors?select=vid&limit=1', { headers: { Prefer: 'count=exact' } }),
      ]
      let dailyIdx = -1
      let eventsIdx = -1
      if (range) { dailyIdx = reqs.length; reqs.push(sbFetch(`usage_daily?select=day,metric,count&day=gte.${range.from}&day=lte.${range.to}&order=day`)) }
      if (evN)   { eventsIdx = reqs.length; reqs.push(sbFetch(`usage_events?select=created_at,type,count,vid&order=created_at.desc&limit=${evN}`)) }
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
      // จำนวนผู้ใช้ไม่ซ้ำทั้งหมด (all-time) จาก content-range header ของ count=exact
      const visCR = visRes && visRes.ok ? (visRes.headers.get('content-range') || '') : ''
      const totalVisitors = Number((visCR.split('/')[1]) || 0)

      const payload = {
        refine: get('refine_total'),
        stone: get('stone_total'),
        bsb: get('bsb_total'),
        visitsToday: todayOf('visits'),
        newToday: todayOf('visits_new'),
        returningToday: todayOf('visits_returning'),
        autoToday: todayOf('auto'),
        simToday: todayOf('simulate'),
        totalVisitors,
        showStats,
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
        payload.events = rows.map((r) => ({ at: r.created_at, type: r.type, count: Number(r.count || 1), vid: r.vid || null }))
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

      // visit: ถ้ามี vid ใช้ record_visit (แยกคนใหม่/กลับมาซ้ำ), ไม่มีก็นับรวมเฉย ๆ
      if (body.visit) {
        tasks.push(vid ? recordVisit(vid, today) : bumpDaily(today, 'visits', 1))
      }

      // discrete action event (auto / simulate)
      const action = ACTION_EVENTS.includes(body.event) ? body.event : null
      if (action) tasks.push(bumpDaily(today, action, 1))

      // activity feed: 1 event ต่อ 1 batch (ตี = รวบทั้ง batch กัน row บวมจาก auto) — แนบ vid ของผู้ใช้
      const events = []
      if (refine) events.push({ type: 'refine', count: refine, vid })
      if (body.visit) events.push({ type: 'visit', count: 1, vid })
      if (action) events.push({ type: action, count: 1, vid })
      if (events.length) {
        tasks.push(sbFetch('usage_events', {
          method: 'POST',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify(events),
        }))
      }
      if (tasks.length) await Promise.all(tasks)
      return res.status(200).json({ ok: true })
    } catch {
      return res.status(502).json({ error: 'write failed' })
    }
  }

  return res.status(405).json({ error: 'method not allowed' })
}
