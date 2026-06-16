import { BetaAnalyticsDataClient } from '@google-analytics/data'

// Vercel Serverless Function: ดึงข้อมูลสรุปจาก GA4 Data API
// ป้องกันด้วยการ verify Supabase access token ก่อน (ต้อง login ถึงเรียกได้)
//
// ENV ที่ต้องตั้งบน Vercel:
//   GA_PROPERTY_ID    — GA4 property id (ตัวเลขล้วน เช่น 123456789)
//   GA_CLIENT_EMAIL   — service account email
//   GA_PRIVATE_KEY    — service account private key (เก็บแบบมี \n literal ได้)
//   SUPABASE_URL      — เช่น https://xxxx.supabase.co
//   SUPABASE_ANON_KEY — anon key (ใช้ verify token)

const RANGE = { startDate: '30daysAgo', endDate: 'today' }
const PREV_RANGE = { startDate: '60daysAgo', endDate: '31daysAgo' }

// custom event ของเว็บ (ตรงกับ trackEvent ใน src/utils/analytics.js)
const FEATURE_EVENTS = ['refine_attempt', 'auto_start', 'sim_open', 'sim_run']

async function verifyUser(req) {
  const auth = req.headers.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token || !process.env.SUPABASE_URL) return false
  try {
    const r = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: process.env.SUPABASE_ANON_KEY || '',
      },
    })
    return r.ok
  } catch {
    return false
  }
}

// "20260518" -> "05/18"
const fmtDate = (s) => (s && s.length === 8 ? `${s.slice(4, 6)}/${s.slice(6, 8)}` : s)
const num = (v) => Number(v || 0)

export default async function handler(req, res) {
  if (!(await verifyUser(req))) {
    return res.status(401).json({ error: 'unauthorized' })
  }

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

    const [totalsRes, prevTotalsRes, tsRes, pagesRes, devicesRes, countriesRes, eventsRes] = await Promise.all([
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
      // ช่วงก่อนหน้า (30 วันก่อนหน้านั้น) สำหรับคำนวณ % เปลี่ยนแปลง
      client.runReport({
        property,
        dateRanges: [PREV_RANGE],
        metrics: [
          { name: 'activeUsers' },
          { name: 'sessions' },
          { name: 'screenPageViews' },
          { name: 'averageSessionDuration' },
        ],
      }),
      client.runReport({
        property,
        dateRanges: [RANGE],
        dimensions: [{ name: 'date' }],
        metrics: [{ name: 'activeUsers' }, { name: 'sessions' }, { name: 'screenPageViews' }],
        orderBys: [{ dimension: { dimensionName: 'date' } }],
      }),
      client.runReport({
        property,
        dateRanges: [RANGE],
        dimensions: [{ name: 'pagePath' }],
        metrics: [{ name: 'screenPageViews' }],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: 10,
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
        limit: 8,
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
    ])

    const totalRow = totalsRes[0].rows?.[0]?.metricValues || []
    const totals = {
      activeUsers: num(totalRow[0]?.value),
      sessions: num(totalRow[1]?.value),
      screenPageViews: num(totalRow[2]?.value),
      averageSessionDuration: num(totalRow[3]?.value),
    }

    const prevRow = prevTotalsRes[0].rows?.[0]?.metricValues || []
    const prev = {
      activeUsers: num(prevRow[0]?.value),
      sessions: num(prevRow[1]?.value),
      screenPageViews: num(prevRow[2]?.value),
      averageSessionDuration: num(prevRow[3]?.value),
    }
    // % เปลี่ยนแปลงเทียบช่วงก่อน (null = ช่วงก่อนเป็น 0 เทียบไม่ได้)
    const pct = (c, p) => (p > 0 ? +(((c - p) / p) * 100).toFixed(1) : null)
    const deltas = {
      activeUsers: pct(totals.activeUsers, prev.activeUsers),
      sessions: pct(totals.sessions, prev.sessions),
      screenPageViews: pct(totals.screenPageViews, prev.screenPageViews),
      averageSessionDuration: pct(totals.averageSessionDuration, prev.averageSessionDuration),
    }

    const timeseries = (tsRes[0].rows || []).map((r) => ({
      date: fmtDate(r.dimensionValues?.[0]?.value),
      activeUsers: num(r.metricValues?.[0]?.value),
      sessions: num(r.metricValues?.[1]?.value),
      screenPageViews: num(r.metricValues?.[2]?.value),
    }))

    const topPages = (pagesRes[0].rows || []).map((r) => ({
      path: r.dimensionValues?.[0]?.value,
      views: num(r.metricValues?.[0]?.value),
    }))

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

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
    return res.status(200).json({
      range: { startDate: '30 วันก่อน', endDate: 'วันนี้' },
      totals,
      deltas,
      timeseries,
      topPages,
      devices,
      countries,
      events,
    })
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'GA report failed' })
  }
}
