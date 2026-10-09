// นิยามสิทธิ์ dashboard ฝั่ง UI — รูปแบบ 'section:action' (เช่น 'items-all:delete'); section id = id ของ section บนหน้า (ตรงกับ NAV_SECTIONS)
// ⚠ PAGES ต้องตรงกับ PAGE_SECTIONS ใน api/_lib/auth.js (import โค้ด server ไม่ได้ จึงก็อปไว้ — api/_lib/auth.test.js เช็คให้ตรงกัน)
// API บังคับสิทธิ์จริงเฉพาะส่วนที่มี endpoint แยก (ฟีด activity, refine, ตั้งค่า, action ของไอเทม, ผู้ใช้);
// หน้าที่ข้อมูลมาจาก endpoint เดียว (ภาพรวม/Analytics/Monitor) การซ่อนรายส่วนเป็นระดับ UI — API บังคับระดับ "หน้า"

export const ACTION_LABEL = { view: 'ดู', edit: 'แก้ไข', delete: 'ลบ' }
export const ACTIONS = Object.keys(ACTION_LABEL)

const V = ['view']
const VE = ['view', 'edit']
const VED = ['view', 'edit', 'delete']

export const PAGES = [
  { id: 'overview', label: 'ภาพรวม', sections: [
    { id: 'ov-kpi', label: 'ตัวเลขหลัก', actions: V },
    { id: 'ov-adoption', label: 'ผู้ใช้ทำอะไรบ้าง', actions: V },
    { id: 'ov-outcome', label: 'ผลการตีบวก', actions: V },
    { id: 'ov-level', label: 'ตีไปได้ไกลแค่ไหน', actions: V },
    { id: 'ov-return', label: 'กลับมากี่วัน', actions: V },
    { id: 'ov-consent', label: 'คุกกี้ / GA4', actions: V },
    { id: 'ov-items', label: 'ประเภทไอเทม', actions: V },
  ] },
  { id: 'analytics', label: 'Analytics', sections: [
    { id: 'an-kpi', label: 'ภาพรวม (KPI)', actions: V },
    { id: 'an-trend', label: 'แนวโน้ม', actions: V },
    { id: 'an-usage', label: 'การใช้งาน/อุปกรณ์', actions: V },
    { id: 'an-audience', label: 'ผู้ใช้/ช่องทางที่มา', actions: V },
    { id: 'an-pages', label: 'หน้ายอดนิยม', actions: V },
    { id: 'an-geo', label: 'ประเทศ/เมือง', actions: V },
  ] },
  { id: 'usage', label: 'Usage', sections: [
    { id: 'usage-traffic-kpi', label: 'ทราฟฟิกวันนี้', actions: V },
    { id: 'usage-traffic-trend', label: 'แนวโน้มผู้เข้าชม', actions: V },
    { id: 'usage-traffic-activity', label: 'กิจกรรมล่าสุด', actions: V },
    { id: 'refine-kpi', label: 'สรุปการตีบวก', actions: V },
    { id: 'refine-overview', label: 'ภาพรวมการตีบวก', actions: V },
    { id: 'refine-leaderboard', label: 'อันดับไอเทม', actions: V },
    { id: 'refine-log', label: 'ประวัติการตีบวก', actions: V },
    { id: 'usage-settings', label: 'ตั้งค่าแสดงผล', actions: VE },
  ] },
  { id: 'items', label: 'ไอเทม', sections: [
    { id: 'items-mode', label: 'โหมดอนุมัติ', actions: VE },
    { id: 'items-pending', label: 'รออนุมัติ', actions: VE },
    { id: 'items-add', label: 'เพิ่ม/ซ่อนไอเทม', actions: VE },
    { id: 'items-all', label: 'รายการทั้งหมด', actions: VED },
  ] },
  { id: 'monitor', label: 'Monitor', sections: [
    { id: 'monitor-kpi', label: 'ภาพรวม (KPI)', actions: V },
    { id: 'monitor-uptime', label: 'Uptime รายวัน', actions: V },
    { id: 'monitor-response', label: 'Response Time', actions: V },
    { id: 'monitor-lighthouse', label: 'Lighthouse Scores', actions: V },
    { id: 'monitor-pages', label: 'ผล Run รายหน้า', actions: V },
    { id: 'monitor-history', label: 'ประวัติ Monitor', actions: V },
  ] },
]

export const USERS_PERM = 'users:manage'

const permKey = (sectionId, action) => `${sectionId}:${action}`
const allSections = PAGES.flatMap((p) => p.sections)
const allPerms = (filter) => allSections.flatMap((s) => s.actions.filter(filter).map((a) => permKey(s.id, a)))

export const ALL_PERMS = allPerms(() => true)

// ชุดสิทธิ์สำเร็จรูป (กดเติม checkbox ทีเดียว)
export const PRESETS = [
  { id: 'viewer', label: 'ดูอย่างเดียว', perms: allPerms((a) => a === 'view') },
  { id: 'editor', label: 'ดู + แก้ไข',   perms: allPerms((a) => a !== 'delete') },
  { id: 'all',    label: 'ทุกอย่าง',      perms: ALL_PERMS },
]

export const can = (perms, sectionId, action = 'view') => perms.includes(permKey(sectionId, action))

// เข้าหน้านี้ได้ไหม = มีสิทธิ์ดูอย่างน้อย 1 section ของหน้า
export const canSeePage = (perms, pageId) => !!PAGES.find((p) => p.id === pageId)?.sections.some((s) => can(perms, s.id))

// section id ทั้งหมดที่ผู้ใช้ "ไม่มี" สิทธิ์ดู — ใช้ซ่อนบนหน้า
export const hiddenSectionIds = (perms) => allSections.filter((s) => !can(perms, s.id)).map((s) => s.id)

// ติ๊ก/เอาออก 1 สิทธิ์ — เอา view ออก = เอา edit/delete ของ section นั้นออกด้วย, ติ๊ก edit/delete = ติ๊ก view ให้ด้วย (ตรงกับ normalizePerms ฝั่ง API)
export function togglePerm(perms, sectionId, action) {
  const key = permKey(sectionId, action)
  const set = new Set(perms)
  if (set.has(key)) {
    set.delete(key)
    if (action === 'view') ACTIONS.forEach((a) => set.delete(permKey(sectionId, a)))
  } else {
    set.add(key)
    set.add(permKey(sectionId, 'view'))
  }
  return [...set]
}

// ติ๊ก/เอาออก action เดียวกันทั้งหน้า (ทุก section ที่มี action นั้น) — on = true เติมให้ครบ
export function setPagePerm(perms, pageId, action, on) {
  const page = PAGES.find((p) => p.id === pageId)
  let next = perms
  for (const s of page.sections) {
    if (!s.actions.includes(action)) continue
    if (can(next, s.id, action) !== on) next = togglePerm(next, s.id, action)
  }
  return next
}

// ติ๊ก/เอาออก action เดียวกันทุกหน้า (แถว "เปิดทั้งหมด" ต่อคอลัมน์) — action = null คือทุก action (ช่องหลัก "เปิดทั้งหมด")
export function setAllPerm(perms, action, on) {
  if (!action) return on ? ALL_PERMS : []
  return PAGES.reduce((acc, p) => setPagePerm(acc, p.id, action, on), perms)
}
