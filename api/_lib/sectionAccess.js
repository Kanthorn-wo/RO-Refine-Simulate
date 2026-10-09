// กรองข้อมูลที่ API คืนตามสิทธิ์ "ดู" รายส่วน (section) — ใช้กับหน้าที่ข้อมูลทั้งหน้ามาจาก endpoint เดียว
// (ภาพรวม / Analytics / Monitor / สถิติตีบวก) เพื่อให้คนที่ดูได้แค่บาง section ไม่ได้ข้อมูลของ section อื่นไปด้วย
// ส่วนที่ไม่มีสิทธิ์ถูก "แทนด้วยค่าว่าง" (array → [], object → {}, อื่น ๆ → null) ไม่ใช่ลบ key — UI อ่านได้โดยไม่ crash
// กฎ: ทุก key/sub-key ต้องมีใน spec; key ที่ไม่มีใน spec (เช่นเพิ่ม field ใหม่แล้วลืมใส่) = ให้เฉพาะคนที่ดูได้ "ทุก section ของหน้า" (ปลอดภัยไว้ก่อน)
// spec: { key: ['section-id', ...] | '*' | { subKey: ['section-id', ...] | '*' } }  — มีสิทธิ์ดู section ใดก็ได้ในรายการ = ได้ค่านั้น
import { PAGE_SECTIONS } from './auth.js'

const emptyLike = (v) => (Array.isArray(v) ? [] : v && typeof v === 'object' ? {} : null)

export function redactBySections(data, spec, can, pageSections) {
  const full = pageSections.every(can)
  const allowed = (rule) => rule === '*' || (Array.isArray(rule) ? rule.some(can) : full)
  const out = {}
  for (const [key, value] of Object.entries(data || {})) {
    const rule = spec[key]
    if (rule && !Array.isArray(rule) && rule !== '*' && value && typeof value === 'object') {
      out[key] = Object.fromEntries(Object.entries(value).filter(([sub]) => allowed(rule[sub])))
    } else {
      out[key] = allowed(rule) ? value : emptyLike(value)
    }
  }
  return out
}

const SPECS = {
  // GET /api/ga
  analytics: {
    range: '*',
    totals: ['an-kpi'],
    timeseries: ['an-kpi', 'an-trend'],
    hourly: ['an-trend'],
    topPages: ['an-pages'],
    devices: ['an-usage'],
    events: ['an-usage'],
    channels: ['an-audience'],
    audience: ['an-audience'],
    countries: ['an-geo'],
    cities: ['an-geo'],
  },
  // GET /api/monitor
  monitor: {
    latestRun: ['monitor-kpi', 'monitor-pages'],
    uptimeTrend: ['monitor-kpi', 'monitor-uptime'],
    latestPages: ['monitor-kpi', 'monitor-pages'],
    latestLighthouse: ['monitor-kpi', 'monitor-lighthouse'],
    lighthouseTrend: ['monitor-lighthouse'],
    responseTimeTrend: ['monitor-response'],
    runs: ['monitor-history'],
  },
  // GET /api/stats?overview=1 (RPC overview_stats — docs/sql/overview-stats.sql)
  overview: {
    since: '*',
    visitors: {
      total: ['ov-kpi', 'ov-adoption', 'ov-return', 'ov-consent'],
      returning: ['ov-kpi', 'ov-return'],
      active_since_log: ['ov-kpi', 'ov-adoption'],
      days_1: ['ov-return'], days_2_3: ['ov-return'], days_4_7: ['ov-return'], days_8p: ['ov-return'],
      consent_accepted: ['ov-consent'], consent_rejected: ['ov-consent'], consent_unknown: ['ov-consent'],
    },
    adoption: ['ov-kpi', 'ov-adoption'],
    max_level: ['ov-level'],
    outcome: ['ov-outcome', 'ov-items'],
    breakdown: ['ov-kpi', 'ov-outcome', 'ov-items'],
    totals: ['ov-kpi', 'ov-outcome', 'ov-items'],
  },
  // GET /api/refine (หน้า Usage → การตีบวก)
  refine: {
    page: '*',
    limit: '*',
    breakdown: ['refine-kpi', 'refine-overview'],
    leaderboard: ['refine-kpi', 'refine-leaderboard'],
    levelResult: ['refine-overview'],
    stoneUsage: ['refine-overview'],
    stoneUsageTotal: ['refine-overview'],
    log: ['refine-log'],
    total: ['refine-kpi', 'refine-log'],
  },
}

// หน้าที่ใช้ section ไหนบ้างตอนกรอง (refine = section ตีบวกของหน้า usage)
const PAGE_OF = { analytics: 'analytics', monitor: 'monitor', overview: 'overview', refine: 'usage' }

// กรอง response ของ endpoint (analytics | monitor | overview | refine) ตามสิทธิ์ของผู้ใช้ (access จาก getAccess)
export function filterForUser(endpoint, data, access) {
  const can = (sectionId) => access.perms.includes(`${sectionId}:view`)
  const sections = Object.keys(PAGE_SECTIONS[PAGE_OF[endpoint]]).filter((id) => endpoint !== 'refine' || id.startsWith('refine-'))
  return redactBySections(data, SPECS[endpoint], can, sections)
}

export const SECTION_SPECS = SPECS
