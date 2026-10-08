// ทางเดียวที่โค้ดทั้งโปรเจกต์ใช้เรียก Divine Pride API (api/*, scripts/*, GitHub Action) — ห้าม fetch divine-pride.net/api ตรงที่อื่น
// กติกาของ Divine Pride (ประกาศ 17 มิ.ย. 2026): สูงสุด 1 request/วินาที, ห้ามขนาน, โดน rate limit ต้องหยุดยิงตามที่ API บอก ไม่ลองซ้ำถี่ ๆ
//
// วิธีรักษากติกา:
//   1. ต่อคิวข้ามทุกผู้เรียก (ทุก instance/โปรเซส/Action) ด้วยตารางแถวเดียว dp_gate ผ่าน RPC dp_claim_slot (docs/sql/dp-gate.sql)
//      ช่องยิงห่างกัน ≥ MIN_INTERVAL_MS; ไม่มี SUPABASE_* env หรือ RPC ล่ม → ต่อคิวในโปรเซสตัวเอง (อย่างน้อยไม่ขนานใน instance เดียว)
//   2. โดน rate limit (HTTP 429 หรือ body reason) → บันทึกบล็อกลง dp_gate (dp_report_limit) + จำในโปรเซส → ทุกคำขอถัดไปล้มเร็ว (ไม่ยิง) จนครบเวลา Retry-After
//   3. ไม่ retry เอง — ผู้เรียกตัดสินใจ (api/* ตอบ 429 ให้ผู้เล่น, สคริปต์ใช้ dpWithBackoff รอตาม Retry-After จำนวนครั้งจำกัด)
// ENV: DIVINE_PRIDE_API_KEY, (ทางเลือก) SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY สำหรับคิวกลาง

export const MIN_INTERVAL_MS = 1100        // เผื่อ jitter จากกติกา 1 req/s
const DEFAULT_BLOCK_SECONDS = 60           // Retry-After ไม่มี → ถือว่าต้องรอเท่านี้
const MAX_BLOCK_SECONDS = 3600
const REQUEST_TIMEOUT_MS = 10000

export class DivinePrideLimitError extends Error {
  constructor(retryAfterSec, reason = 'rate-limit') {
    super(`divine-pride rate limit (${reason}), retry after ${retryAfterSec}s`)
    this.name = 'DivinePrideLimitError'
    this.retryAfter = retryAfterSec
  }
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// สถานะในโปรเซส (ทำงานเมื่อไม่มีคิวกลาง และเป็นด่านสำรองเสมอ)
let localNextAt = 0
let localBlockedUntil = 0

export function _resetForTests() {
  localNextAt = 0
  localBlockedUntil = 0
}

const gateConfigured = () => !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)

async function gateRpc(name, args) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(5000),
  })
  if (!res.ok) throw new Error(`gate ${name} ${res.status}`)
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

// ขอช่องยิงจากคิวกลาง — คืน { wait_ms } | { blocked_ms } หรือ null ถ้าคิวกลางใช้ไม่ได้
async function claimGateSlot() {
  if (!gateConfigured()) return null
  try {
    return await gateRpc('dp_claim_slot', { p_interval_ms: MIN_INTERVAL_MS })
  } catch {
    return null
  }
}

async function reportLimit(seconds) {
  localBlockedUntil = Math.max(localBlockedUntil, Date.now() + seconds * 1000)
  if (!gateConfigured()) return
  try { await gateRpc('dp_report_limit', { p_seconds: seconds }) } catch { /* บล็อกในโปรเซสแล้ว พอ */ }
}

// Retry-After เป็นวินาที หรือวันที่แบบ HTTP-date; ไม่มี/อ่านไม่ได้ = ค่าเริ่มต้น
function parseRetryAfter(header) {
  if (!header) return DEFAULT_BLOCK_SECONDS
  const asNumber = Number(header)
  const seconds = Number.isFinite(asNumber) ? asNumber : Math.ceil((Date.parse(header) - Date.now()) / 1000)
  if (!Number.isFinite(seconds) || seconds <= 0) return DEFAULT_BLOCK_SECONDS
  return Math.min(Math.max(Math.ceil(seconds), 30), MAX_BLOCK_SECONDS)
}

const isLimitBody = (data) => !!data && typeof data.reason === 'string' && /rate limit/i.test(data.reason)

// GET https://www.divine-pride.net/api/database/<path> → { status, data } (data = null ถ้าไม่ใช่ JSON/ไม่มีข้อมูล)
// throw DivinePrideLimitError เมื่อโดน (หรือยังถูกบล็อกจากการโดน) rate limit — ไม่ยิงซ้ำให้
// maxWaitMs = รอคิวได้นานสุดเท่าไร (เว็บจริงใช้ค่าต่ำ กันผู้เล่นรอนาน; สคริปต์ยาว ๆ ตั้งสูงได้)
export async function dpGet(path, { server = 'thROG', lang = 'en', maxWaitMs = 8000 } = {}) {
  const apiKey = process.env.DIVINE_PRIDE_API_KEY
  if (!apiKey) throw new Error('DIVINE_PRIDE_API_KEY ยังไม่ได้ตั้ง')

  // ด่าน 1: ยังถูกบล็อกอยู่ (จากโปรเซสนี้) → ล้มเร็ว
  if (localBlockedUntil > Date.now()) throw new DivinePrideLimitError(Math.ceil((localBlockedUntil - Date.now()) / 1000), 'blocked')

  // ด่าน 2: คิวกลางข้ามทุกผู้เรียก
  const gate = await claimGateSlot()
  if (gate && gate.blocked_ms > 0) {
    localBlockedUntil = Date.now() + gate.blocked_ms
    throw new DivinePrideLimitError(Math.ceil(gate.blocked_ms / 1000), 'blocked')
  }
  // ด่าน 3: คิวในโปรเซส (ด่านสำรอง + กันขนานใน instance เดียว)
  const now = Date.now()
  const localSlot = Math.max(now, localNextAt)
  localNextAt = localSlot + MIN_INTERVAL_MS
  const waitMs = Math.max((gate && gate.wait_ms) || 0, localSlot - now)
  if (waitMs > maxWaitMs) throw new DivinePrideLimitError(Math.ceil(waitMs / 1000), 'busy')
  if (waitMs > 0) await sleep(waitMs)

  const sep = path.includes('?') ? '&' : '?'
  const res = await fetch(`https://www.divine-pride.net/api/database/${path}${sep}apiKey=${apiKey}`, {
    headers: { 'Accept-Language': lang, 'x-server': server },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  const data = await res.json().catch(() => null)
  if (res.status === 429 || isLimitBody(data)) {
    const seconds = parseRetryAfter(res.headers.get('retry-after'))
    await reportLimit(seconds)
    throw new DivinePrideLimitError(seconds)
  }
  return { status: res.status, data: data && data.status !== 'error' ? data : null }
}

export const dpItem = (id, options) => dpGet(`Item/${id}`, options)

// สำหรับสคริปต์ที่รันนาน: โดน rate limit → รอตาม Retry-After แล้วลองใหม่ (จำนวนครั้งจำกัด) เกินแล้วโยน error ให้สคริปต์หยุด
export async function dpWithBackoff(fn, { maxAttempts = 3, onWait } = {}) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (!(err instanceof DivinePrideLimitError) || attempt >= maxAttempts) throw err
      const waitSec = err.retryAfter + 5
      if (onWait) onWait(waitSec, attempt)
      await sleep(waitSec * 1000)
      localBlockedUntil = 0 // ครบเวลารอแล้ว ลองใหม่ (ถ้ายังโดนอยู่ dp_gate/429 จะบล็อกซ้ำเอง)
    }
  }
}
