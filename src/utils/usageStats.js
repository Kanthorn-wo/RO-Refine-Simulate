// ตัวเลขการใช้งานรวม (social proof) — ส่งแบบ batch, anonymous, ไม่เก็บข้อมูลส่วนตัว
// นับ: ตีบวก (refine) / แร่ที่ใช้ (stone) / BSB ที่ใช้ (bsb) / คนใช้วันนี้ (visit)
// ยิงเป็น batch ตอนปิด/ซ่อนแท็บ หรือสะสมถึงเพดาน — ไม่ยิงทุกครั้งกัน request ท่วม

const ENDPOINT = '/api/stats'
const CAP = 200 // ตรงกับ cap ฝั่ง server — flush ก่อนเกิน

let pending = { refine: 0, stone: 0, bsb: 0 }
let flushTimer = null

function post(body) {
  try {
    const blob = new Blob([JSON.stringify(body)], { type: 'application/json' })
    if (navigator.sendBeacon && navigator.sendBeacon(ENDPOINT, blob)) return
  } catch { /* fall through ไป fetch */ }
  try {
    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
    })
  } catch { /* analytics ห้ามทำแอปพัง */ }
}

export function flushUsage() {
  const { refine, stone, bsb } = pending
  if (!refine && !stone && !bsb) return
  pending = { refine: 0, stone: 0, bsb: 0 }
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null }
  post({ refine, stone, bsb, vid: getVisitorId() })
}

function scheduleFlush() {
  if (flushTimer) return
  flushTimer = setTimeout(() => { flushTimer = null; flushUsage() }, 10000)
}

// เรียกทุกครั้งที่ตีบวก 1 ครั้ง (รวม auto) — stone = แร่ที่ใช้รอบนั้น (ปกติ 1), bsb = BSB ที่ใช้รอบนั้น
export function recordRefine({ stone = 1, bsb = 0 } = {}) {
  pending.refine += 1
  pending.stone += stone
  pending.bsb += bsb
  if (pending.refine >= CAP - 10 || pending.stone >= CAP - 10) flushUsage()
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

// นับ "คนใช้วันนี้" 1 ครั้ง/เบราว์เซอร์/วัน — dedup ฝั่ง client ด้วย localStorage + ส่ง vid ให้แยก new/returning
export function pingVisitOncePerDay() {
  try {
    const today = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10)
    const key = `ro_stats_visit_${today}`
    if (localStorage.getItem(key)) return
    localStorage.setItem(key, '1')
    post({ visit: true, vid: getVisitorId() })
  } catch { /* ignore */ }
}

// บันทึก action แบบครั้งเดียว (auto = เริ่มระบบ Auto, simulate = รันโหมดจำลอง)
export function recordAction(type) {
  if (type !== 'auto' && type !== 'simulate') return
  post({ event: type, vid: getVisitorId() })
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

// flush ค้างตอนปิด/ซ่อนแท็บ
if (typeof window !== 'undefined') {
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushUsage()
  })
  window.addEventListener('pagehide', flushUsage)
}
