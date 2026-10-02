// ตัวเลขการใช้งานรวม (social proof) — ส่งแบบ batch, anonymous, ไม่เก็บข้อมูลส่วนตัว
// ยอดตีบวก/แร่/BSB คำนวณฝั่ง DB จาก refine_log (recordRefineDetail) — ที่นี่ส่งแค่จำนวนครั้งไว้ทำ activity feed + visit/action
// ยิงเป็น batch ตอนปิด/ซ่อนแท็บ หรือสะสมถึงเพดาน — ไม่ยิงทุกครั้งกัน request ท่วม

import { bkkToday } from './date.js'
import { POST_BATCH_CAP } from '../constants/limits.js'

const ENDPOINT = '/api/stats'
const REFINE_ENDPOINT = '/api/refine'
const CAP = POST_BATCH_CAP // ต้องตรงกับ cap ฝั่ง server (api/stats.js, api/refine.js) — flush ก่อนเกิน

let pending = { refine: 0 }
let flushTimer = null

// pending detail การตีบวก (analytics ละเอียด) — แยกจากตัวนับ social proof
let pendingDetail = []
let detailTimer = null

function post(url, body) {
  try {
    const blob = new Blob([JSON.stringify(body)], { type: 'application/json' })
    if (navigator.sendBeacon && navigator.sendBeacon(url, blob)) return
  } catch { /* fall through ไป fetch */ }
  try {
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
    })
  } catch { /* analytics ห้ามทำแอปพัง */ }
}

function flushUsage() {
  const { refine } = pending
  if (!refine) return
  pending = { refine: 0 }
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null }
  post(ENDPOINT, { refine, vid: getVisitorId() })
}

// ── analytics ละเอียด: เก็บทุก attempt (itemType/itemId/level/stone/bsb/result) ส่ง batch ──
function flushRefineDetail() {
  if (!pendingDetail.length) return
  const rows = pendingDetail
  pendingDetail = []
  if (detailTimer) { clearTimeout(detailTimer); detailTimer = null }
  post(REFINE_ENDPOINT, { vid: getVisitorId(), rows })
}

function scheduleDetailFlush() {
  if (detailTimer) return
  detailTimer = setTimeout(() => { detailTimer = null; flushRefineDetail() }, 10000)
}

// เรียกทุกครั้งที่ตีบวก (รวม auto) — เก็บรายละเอียดครบ 1 attempt
export function recordRefineDetail({
  itemType, itemId = null, itemName = null,
  level, refineAfter = null,
  stone, bsb = false, bsbAmount = 0,
  result, eventBuff = false, mode = 'manual',
  rollPct = null,
}) {
  if (!itemType || !stone || !result) return
  pendingDetail.push({
    item_type:    itemType,
    item_id:      itemId,
    item_name:    itemName ?? null,
    level,
    refine_after: refineAfter,
    stone,
    bsb:          !!bsb,
    bsb_amount:   bsbAmount || 0,
    result,
    event_buff:   !!eventBuff,
    mode,
    roll_pct:     rollPct != null ? Math.round(rollPct * 100) / 100 : null,
  })
  if (pendingDetail.length >= CAP - 10) flushRefineDetail()
  else scheduleDetailFlush()
}

function scheduleFlush() {
  if (flushTimer) return
  flushTimer = setTimeout(() => { flushTimer = null; flushUsage() }, 10000)
}

// เรียกทุกครั้งที่ตีบวก 1 ครั้ง (รวม auto) — นับจำนวนครั้งสำหรับ activity feed
export function recordRefine() {
  pending.refine += 1
  if (pending.refine >= CAP - 10) flushUsage()
  else scheduleFlush()
}

// ID สุ่ม anonymous ต่อเบราว์เซอร์ (ไม่ผูกตัวตน) — ใช้แยกคนใหม่/คนกลับมาซ้ำ
function getVisitorId() {
  try {
    let vid = localStorage.getItem('ro_stats_vid')
    if (!vid) {
      vid = (crypto.randomUUID && crypto.randomUUID()) || `${Date.now()}-${Math.random().toString(36).slice(2)}`
      localStorage.setItem('ro_stats_vid', vid)
    }
    return vid
  } catch {
    return null
  }
}

// คีย์เดียวกับ STORAGE_KEY ใน src/components/CookieConsent — ค่า 'accepted' | 'rejected' | ไม่มี (ยังไม่ตอบ)
const CONSENT_KEY = 'ro_refine_cookie_consent'

function savedConsent() {
  try {
    const v = localStorage.getItem(CONSENT_KEY)
    return v === 'accepted' || v === 'rejected' ? v : null
  } catch {
    return null
  }
}

// นับ "คนใช้วันนี้" 1 ครั้ง/เบราว์เซอร์/วัน — dedup ฝั่ง client ด้วย localStorage + ส่ง vid ให้แยก new/returning
// แนบการตัดสินใจเรื่องคุกกี้ไปด้วย (ถ้ามี) — คนที่ตอบไว้ก่อนเริ่มเก็บสถิตินี้จะถูกบันทึกตอนกลับมา
export function pingVisitOncePerDay() {
  try {
    const key = `ro_stats_visit_${bkkToday()}`
    if (localStorage.getItem(key)) return
    localStorage.setItem(key, '1')
    const consent = savedConsent()
    post(ENDPOINT, { visit: true, vid: getVisitorId(), ...(consent && { consent }) })
  } catch { /* ignore */ }
}

// บันทึกตอนผู้ใช้กดยอมรับ/ปฏิเสธใน cookie bar (สถิติรวมแบบไม่ระบุตัวตน — ไม่ใช่ข้อมูลของ GA)
export function recordConsent(consent) {
  if (consent !== 'accepted' && consent !== 'rejected') return
  post(ENDPOINT, { consent, vid: getVisitorId() })
}

// บันทึก action แบบครั้งเดียว (auto = เริ่มระบบ Auto, simulate = รันโหมดจำลอง)
// meta = รายละเอียดเสริม (ตอนนี้ใช้กับ simulate: config + ผลสรุป) — server whitelist field เอง
export function recordAction(type, meta = null) {
  if (type !== 'auto' && type !== 'simulate') return
  post(ENDPOINT, { event: type, vid: getVisitorId(), ...(meta && { meta }) })
}

export async function fetchUsage() {
  try {
    const r = await fetch(ENDPOINT)
    if (!r.ok) return null
    return await r.json()
  } catch {
    return null
  }
}

// flush ค้างตอนปิด/ซ่อนแท็บ (ทั้งตัวนับรวม + detail การตีบวก)
function flushAll() { flushUsage(); flushRefineDetail() }
if (typeof window !== 'undefined') {
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushAll()
  })
  window.addEventListener('pagehide', flushAll)
}
