import { BetaAnalyticsDataClient } from '@google-analytics/data'
import { getUser, isOwner } from './_lib/auth.js'

// Vercel Serverless Function: ดึงข้อมูลสรุปจาก GA4 Data API
// ป้องกันด้วยการ verify Supabase access token ก่อน (ต้อง login ถึงเรียกได้)
//
// ENV ที่ต้องตั้งบน Vercel:
//   GA_PROPERTY_ID    — GA4 property id (ตัวเลขล้วน เช่น 123456789)
//   GA_CLIENT_EMAIL   — service account email
//   GA_PRIVATE_KEY    — service account private key (เก็บแบบมี \n literal ได้)
//   SUPABASE_URL      — เช่น https://xxxx.supabase.co
//   SUPABASE_ANON_KEY — anon key (ใช้ verify token)
//   DASHBOARD_ALLOWED_EMAILS — อีเมลเจ้าของที่เข้า dashboard ได้ (คั่นด้วย , — ถ้าไม่ตั้ง = ปฏิเสธทุกคน)

// ทุกรายงานดึง "ตั้งแต่เริ่มเก็บข้อมูลจนถึงวันนี้" — 2015-08-14 คือวันเริ่มต้นเร็วสุดที่ GA4 Data API รับ
// (GA คืนเฉพาะช่วงที่ property มีข้อมูลจริง; ค่า data retention 2/14 เดือนมีผลกับ Explore/ข้อมูลรายคน ไม่ใช่รายงานรวมนี้)
const RANGE = { startDate: '2015-08-14', endDate: 'today' }

// custom event ของเว็บ (ตรงกับ trackEvent ใน src/utils/analytics.js)
const FEATURE_EVENTS = ['refine_attempt', 'auto_start', 'sim_open', 'sim_run']
// path ของหน้าแอดมิน — ตรงกับเงื่อนไขที่ไม่ส่ง GA ใน index.html
const ADMIN_PATH = /^\/(dashboard|login)(\/|$)/


// "20260518" -> "05/18"
const fmtDate = (s) => (s && s.length === 8 ? `${s.slice(4, 6)}/${s.slice(6, 8)}` : s)
// "20260518" -> Date (UTC) / Date -> "20260518" — ใช้เติมวันที่ไม่มีข้อมูลในกราฟรายวัน
const parseYmd = (s) => new Date(Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8)))
const toYmd = (d) => d.toISOString().slice(0, 10).replace(/-/g, '')
const num = (v) => Number(v || 0)

export default async function handler(req, res) {
  const user = await getUser(req)
  if (!user) return res.status(401).json({ error: 'unauthorized' })
  if (!isOwner(user)) return res.status(403).json({ error: 'ไม่มีสิทธิ์เข้าถึง (เฉพาะเจ้าของเว็บ)' })

  const { GA_PROPERTY_ID, GA_CLIENT_EMAIL, GA_PRIVATE_KEY } = process.env
  if (!GA_PROPERTY_ID || !GA_CLIENT_EMAIL || !GA_PRIVATE_KEY) {
    return res.status(500).json({ error: 'GA env ยังไม่ครบ (GA_PROPERTY_ID / GA_CLIENT_EMAIL / GA_PRIVATE_KEY)' })
  }

  try {
    const client = new BetaAnalyticsDataClient({
      credentials: {
        client_email: GA_CLIENT_EMAIL,
        private_key: GA_PRIVATE_KEY.replace(/\\n/g, '\n'),
      },
    })
    const property = `properties/${GA_PROPERTY_ID}`

    const [totalsRes, tsRes, hourlyRes, pagesRes, devicesRes, countriesRes, eventsRes, newReturnRes, channelsRes, citiesRes] = await Promise.all([
      client.runReport({
        property,
        dateRanges: [RANGE],
        metrics: [
          { name: 'activeUsers' },
          { name: 'sessions' },
          { name: 'screenPageViews' },
          { name: 'averageSessionDuration' },
        ],
      }),
      client.runReport({
        property,
        dateRanges: [RANGE], // รายวันตั้งแต่เริ่ม — ฝั่ง client เลือกตัด 7/30/90/ทั้งหมด
        dimensions: [{ name: 'date' }],
        metrics: [{ name: 'activeUsers' }, { name: 'sessions' }, { name: 'screenPageViews' }],
        orderBys: [{ dimension: { dimensionName: 'date' } }],
      }),
      // รายชั่วโมงของวันนี้ (ตัวเลือก "วันนี้" ในกราฟแนวโน้ม)
      client.runReport({
        property,
        dateRanges: [{ startDate: 'today', endDate: 'today' }],
        dimensions: [{ name: 'hour' }],
        metrics: [{ name: 'activeUsers' }, { name: 'sessions' }, { name: 'screenPageViews' }],
        orderBys: [{ dimension: { dimensionName: 'hour' } }],
      }),
      client.runReport({
        property,
        dateRanges: [RANGE],
        dimensions: [{ name: 'pagePath' }],
        metrics: [{ name: 'screenPageViews' }],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      }),
      client.runReport({
        property,
        dateRanges: [RANGE],
        dimensions: [{ name: 'deviceCategory' }],
        metrics: [{ name: 'activeUsers' }],
      }),
      client.runReport({
        property,
        dateRanges: [RANGE],
        dimensions: [{ name: 'country' }],
        metrics: [{ name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
      }),
      client.runReport({
        property,
        dateRanges: [RANGE],
        dimensions: [{ name: 'eventName' }],
        metrics: [{ name: 'eventCount' }],
        dimensionFilter: {
          filter: {
            fieldName: 'eventName',
            inListFilter: { values: FEATURE_EVENTS },
          },
        },
      }),
      // ผู้ใช้ใหม่ vs กลับมาซ้ำ
      client.runReport({
        property,
        dateRanges: [RANGE],
        dimensions: [{ name: 'newVsReturning' }],
        metrics: [{ name: 'activeUsers' }, { name: 'sessions' }],
      }),
      // ช่องทาง/แหล่งที่มา
      client.runReport({
        property,
        dateRanges: [RANGE],
        dimensions: [{ name: 'sessionDefaultChannelGroup' }],
        metrics: [{ name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
      }),
      // เมือง
      client.runReport({
        property,
        dateRanges: [RANGE],
        dimensions: [{ name: 'city' }],
        metrics: [{ name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
      }),
    ])

    const totalRow = totalsRes[0].rows?.[0]?.metricValues || []
    const totals = {
      activeUsers: num(totalRow[0]?.value),
      sessions: num(totalRow[1]?.value),
      screenPageViews: num(totalRow[2]?.value),
      averageSessionDuration: num(totalRow[3]?.value),
    }

    // รายวันตั้งแต่วันแรกที่มีข้อมูล — GA คืนเฉพาะวันที่มีข้อมูล จึงเติมวันที่ขาดเป็น 0 ให้กราฟต่อเนื่องตามเวลาจริง
    const tsByDay = {}
    for (const r of tsRes[0].rows || []) tsByDay[r.dimensionValues?.[0]?.value] = r.metricValues
    const tsDays = Object.keys(tsByDay).sort()
    const timeseries = []
    if (tsDays.length) {
      // GA นับวันตาม timezone ของ property (ไทยนำ UTC) — ใช้วันที่ล่าสุดจาก GA ถ้าเลยวันนี้ของ UTC ไปแล้ว
      const end = [toYmd(new Date()), tsDays[tsDays.length - 1]].sort().pop()
      for (let d = parseYmd(tsDays[0]); toYmd(d) <= end; d.setUTCDate(d.getUTCDate() + 1)) {
        const mv = tsByDay[toYmd(d)] || []
        timeseries.push({
          date: fmtDate(toYmd(d)),
          activeUsers: num(mv[0]?.value),
          sessions: num(mv[1]?.value),
          screenPageViews: num(mv[2]?.value),
        })
      }
    }
    const firstDate = tsDays[0] ? `${tsDays[0].slice(0, 4)}-${tsDays[0].slice(4, 6)}-${tsDays[0].slice(6, 8)}` : null

    // รายชั่วโมง — เติมครบ 0..23 (ชั่วโมงที่ไม่มีข้อมูล = 0)
    const hourMap = {}
    for (const r of hourlyRes[0].rows || []) {
      hourMap[r.dimensionValues?.[0]?.value] = r.metricValues
    }
    const hourly = Array.from({ length: 24 }, (_, h) => {
      const key = String(h).padStart(2, '0')
      const mv = hourMap[key] || []
      return {
        hour: `${key}:00`,
        activeUsers: num(mv[0]?.value),
        sessions: num(mv[1]?.value),
        screenPageViews: num(mv[2]?.value),
      }
    })

    // หน้าผู้เล่นเท่านั้น: ตัดหน้าแอดมิน (ข้อมูลเก่าก่อนหยุดส่ง GA ใน index.html) + รวม path ซ้ำ (/en/index.html = /en/)
    const pageViews = {}
    for (const r of pagesRes[0].rows || []) {
      const path = (r.dimensionValues?.[0]?.value || '').replace(/index\.html$/, '')
      if (ADMIN_PATH.test(path)) continue
      pageViews[path] = (pageViews[path] || 0) + num(r.metricValues?.[0]?.value)
    }
    const topPages = Object.entries(pageViews)
      .map(([path, views]) => ({ path, views }))
      .sort((a, b) => b.views - a.views)

    const devices = (devicesRes[0].rows || []).map((r) => ({
      category: r.dimensionValues?.[0]?.value,
      users: num(r.metricValues?.[0]?.value),
    }))

    const countries = (countriesRes[0].rows || []).map((r) => ({
      country: r.dimensionValues?.[0]?.value,
      users: num(r.metricValues?.[0]?.value),
    }))

    const events = (eventsRes[0].rows || []).map((r) => ({
      name: r.dimensionValues?.[0]?.value,
      count: num(r.metricValues?.[0]?.value),
    }))

    // ผู้ใช้ใหม่ vs กลับมาซ้ำ (GA คืน 'new' / 'returning' / บางที '(not set)')
    let newUsers = 0
    let returningUsers = 0
    let returningSessions = 0
    for (const r of newReturnRes[0].rows || []) {
      const label = (r.dimensionValues?.[0]?.value || '').toLowerCase()
      const u = num(r.metricValues?.[0]?.value)
      const s = num(r.metricValues?.[1]?.value)
      if (label === 'returning') {
        returningUsers += u
        returningSessions += s
      } else if (label === 'new') {
        newUsers += u
      }
    }
    const audience = {
      newUsers,
      returningUsers,
      returningSessions,
      // เฉลี่ยจำนวนครั้งที่ผู้ใช้เก่ากลับมา (เซสชัน/ผู้ใช้เก่า)
      returningAvgVisits: returningUsers > 0 ? +(returningSessions / returningUsers).toFixed(1) : 0,
    }

    const channels = (channelsRes[0].rows || []).map((r) => ({
      channel: r.dimensionValues?.[0]?.value || '(ไม่ระบุ)',
      users: num(r.metricValues?.[0]?.value),
    }))

    const cities = (citiesRes[0].rows || [])
      .map((r) => ({ city: r.dimensionValues?.[0]?.value, users: num(r.metricValues?.[0]?.value) }))
      .filter((c) => c.city && c.city !== '(not set)')

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
    return res.status(200).json({
      range: { startDate: firstDate, endDate: 'today' },
      totals,
      timeseries,
      hourly,
      topPages,
      devices,
      countries,
      cities,
      channels,
      audience,
      events,
    })
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'GA report failed' })
  }
}
