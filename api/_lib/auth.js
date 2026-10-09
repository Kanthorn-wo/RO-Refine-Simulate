// ตรวจสอบตัวตน + สิทธิ์ของผู้ใช้ dashboard — ใช้ร่วมกันทุก endpoint ที่ต้อง login
// (ก่อนหน้านี้ก็อป getUser แยกไว้ในแต่ละไฟล์ api/*.js — รวมไว้ที่เดียวกันตัวเดียวชัวร์กว่า)
// ชื่อไฟล์ขึ้นต้น _ กัน Vercel เอาไปทำเป็น route (เฉพาะ api/*.js ระดับบนสุดถึงจะกลายเป็น endpoint)
//
// สิทธิ์ = 'section:action' (เช่น 'items-all:delete') แบบ checkbox ต่อผู้ใช้ เก็บในตาราง dashboard_users (docs/sql/dashboard-users.sql)
//   role 'owner'  = ทุกสิทธิ์ + 'users:manage' (จัดการผู้ใช้) | role 'member' = เฉพาะที่ติ๊กไว้ใน perms
//   อีเมลใน env DASHBOARD_ALLOWED_EMAILS = owner เสมอ (bootstrap, ไม่หมดอายุ); แถวในตารางมี expires_at ได้ — เลยเวลา = ไม่มีสิทธิ์
// ⚠ PAGE_SECTIONS ต้องตรงกับ PAGES ใน src/dashboard/permissions.js (ฝั่ง UI — import โค้ด server ไม่ได้ จึงก็อปไว้; auth.test.js เช็คให้ตรงกัน)
const V = ['view']
const VE = ['view', 'edit']
const VED = ['view', 'edit', 'delete']
export const PAGE_SECTIONS = {
  overview: { 'ov-kpi': V, 'ov-adoption': V, 'ov-outcome': V, 'ov-level': V, 'ov-return': V, 'ov-consent': V, 'ov-items': V },
  analytics: { 'an-kpi': V, 'an-trend': V, 'an-usage': V, 'an-audience': V, 'an-pages': V, 'an-geo': V },
  usage: {
    'usage-traffic-kpi': V, 'usage-traffic-trend': V, 'usage-traffic-activity': V,
    'refine-kpi': V, 'refine-overview': V, 'refine-leaderboard': V, 'refine-log': V,
    'usage-settings': VE,
  },
  items: { 'items-mode': VE, 'items-pending': VE, 'items-add': VE, 'items-all': VED },
  monitor: { 'monitor-kpi': V, 'monitor-uptime': V, 'monitor-response': V, 'monitor-lighthouse': V, 'monitor-pages': V, 'monitor-history': V },
}
export const USERS_PERM = 'users:manage'
export const ALL_PERMS = Object.values(PAGE_SECTIONS).flatMap((sections) =>
  Object.entries(sections).flatMap(([id, actions]) => actions.map((a) => `${id}:${a}`)))
export const ROLES = ['owner', 'member']

// สิทธิ์ view ทุก section ของหน้า — ใช้เช็ค "เข้าหน้านี้ได้ไหม" ของ endpoint ที่ข้อมูลทั้งหน้ามาจากตัวเดียว
export const pageViewPerms = (page) => Object.keys(PAGE_SECTIONS[page]).map((id) => `${id}:view`)

// กรองให้เหลือเฉพาะสิทธิ์ที่มีจริง + edit/delete ต้องมี view ของ section นั้นด้วย (เห็นไม่ได้ก็แก้ไม่ได้)
export function normalizePerms(input) {
  const set = new Set((Array.isArray(input) ? input : []).filter((p) => ALL_PERMS.includes(p)))
  for (const p of [...set]) set.add(`${p.slice(0, p.lastIndexOf(':'))}:view`)
  return ALL_PERMS.filter((p) => set.has(p))
}

export async function getUser(req) {
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

// อีเมล owner จาก env (ตัวพิมพ์เล็ก) — แก้สิทธิ์ของอีเมลเหล่านี้ผ่าน dashboard ไม่ได้
export function envOwnerEmails() {
  return (process.env.DASHBOARD_ALLOWED_EMAILS || '')
    .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
}

// { role, perms } ของผู้ใช้ — role null + perms [] = ไม่มีสิทธิ์เข้า dashboard (fail closed ทุกกรณีที่อ่านตารางไม่ได้)
export async function getAccess(user) {
  const none = { role: null, perms: [] }
  const email = ((user && user.email) || '').toLowerCase()
  if (!email) return none
  const owner = { role: 'owner', perms: [...ALL_PERMS, USERS_PERM] }
  if (envOwnerEmails().includes(email)) return owner
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return none
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/dashboard_users?select=role,perms,expires_at&email=eq.${encodeURIComponent(email)}&limit=1`, {
      headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
    })
    if (!r.ok) return none
    const row = (await r.json())[0]
    if (!row) return none
    if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) return none // หมดอายุแล้ว = เหมือนไม่มีสิทธิ์
    if (row.role === 'owner') return owner
    if (row.role === 'member') return { role: 'member', perms: normalizePerms(row.perms) }
    return none
  } catch {
    return none
  }
}

// ผู้ใช้คนนี้มีสิทธิ์ใดสิทธิ์หนึ่งใน perms ('section:action' หรือ USERS_PERM) ไหม
export async function canAny(user, perms) {
  const have = (await getAccess(user)).perms
  return perms.some((p) => have.includes(p))
}
