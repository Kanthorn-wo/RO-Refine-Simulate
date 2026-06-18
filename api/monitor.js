import { createClient } from '@supabase/supabase-js'

// Vercel Serverless Function: ดึงข้อมูล monitoring จาก Supabase
// ป้องกันด้วย verify Supabase access token + email allowlist เหมือน api/ga.js
//
// ENV ที่ต้องตั้งบน Vercel (เพิ่มจากของเดิม):
//   SUPABASE_SERVICE_ROLE_KEY — service_role key (bypass RLS — เขียน/อ่านได้ทุกตาราง)

async function getUser(req) {
  const auth = req.headers.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token || !process.env.SUPABASE_URL) return null
  try {
    const r = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: process.env.SUPABASE_ANON_KEY || '',
      },
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
  const user = await getUser(req)
  if (!user) return res.status(401).json({ error: 'unauthorized' })
  if (!isOwner(user)) return res.status(403).json({ error: 'ไม่มีสิทธิ์เข้าถึง' })

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY ยังไม่ได้ตั้งบน Vercel' })
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  try {
    // ดึงข้อมูลพร้อมกัน 5 query
    const [runsRes, uptimeRes, lhTrendRes, pageHistRes, latestRunRes] = await Promise.all([
      // 1) ประวัติ run 30 รายการล่าสุด (timeline + status)
      sb.from('monitor_test_runs')
        .select('id,started_at,status,pages_total,pages_passed,pages_failed,notes')
        .order('started_at', { ascending: false })
        .limit(30),

      // 2) uptime รายวัน 30 วัน (จาก view)
      sb.from('monitor_daily_uptime')
        .select('day,checks,ok_checks,uptime_pct,avg_response_ms')
        .order('day', { ascending: true })
        .limit(30),

      // 3) Lighthouse trend รายวัน 30 วัน (จาก view)
      sb.from('monitor_lighthouse_trend')
        .select('day,label,performance,seo,accessibility,best_practices')
        .order('day', { ascending: true })
        .limit(60),

      // 4) response time รายวัน ต่อ label (30 วัน — aggregate ใน JS)
      sb.from('monitor_page_results')
        .select('label,response_time_ms,js_errors,failed_requests,checked_at,ok,http_status,page_size_bytes')
        .gte('checked_at', new Date(Date.now() - 30 * 86400e3).toISOString())
        .order('checked_at', { ascending: true }),

      // 5) run ล่าสุด: page_results + lighthouse_results
      sb.from('monitor_test_runs')
        .select('id,started_at,status,pages_total,pages_passed,pages_failed')
        .order('started_at', { ascending: false })
        .limit(1),
    ])

    // หา run ล่าสุด แล้วดึง detail
    const latestRun = latestRunRes.data?.[0] ?? null
    let latestPages = []
    let latestLighthouse = []
    if (latestRun) {
      const [lpRes, llRes] = await Promise.all([
        sb.from('monitor_page_results')
          .select('label,url,http_status,ok,response_time_ms,page_size_bytes,failed_requests,js_errors,js_error_samples,failed_request_samples')
          .eq('run_id', latestRun.id),
        sb.from('monitor_lighthouse_results')
          .select('label,url,performance,seo,accessibility,best_practices,lcp_ms,fcp_ms,tbt_ms,cls')
          .eq('run_id', latestRun.id),
      ])
      latestPages = lpRes.data ?? []
      latestLighthouse = llRes.data ?? []
    }

    // aggregate response time รายวัน ต่อ label (สำหรับ trend chart)
    const pageRows = pageHistRes.data ?? []
    const dayLabelMap = {}
    for (const r of pageRows) {
      const day = r.checked_at.slice(0, 10)
      const key = `${day}|${r.label}`
      if (!dayLabelMap[key]) dayLabelMap[key] = { day, label: r.label, total: 0, count: 0 }
      if (r.response_time_ms != null) {
        dayLabelMap[key].total += r.response_time_ms
        dayLabelMap[key].count++
      }
    }
    const responseTimeTrend = Object.values(dayLabelMap).map((v) => ({
      day: v.day,
      label: v.label,
      avgMs: v.count ? Math.round(v.total / v.count) : null,
    }))

    return res.status(200).json({
      runs: runsRes.data ?? [],
      uptimeTrend: uptimeRes.data ?? [],
      lighthouseTrend: lhTrendRes.data ?? [],
      responseTimeTrend,
      latestRun,
      latestPages,
      latestLighthouse,
    })
  } catch (err) {
    console.error('api/monitor error:', err)
    return res.status(500).json({ error: err.message })
  }
}
