import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { dpGet, dpWithBackoff, DivinePrideLimitError, MIN_INTERVAL_MS, _resetForTests } from './divinePride.js'

const json = (body, init = {}) => new Response(JSON.stringify(body), { status: 200, ...init })
const isDp = (url) => String(url).includes('divine-pride.net')
const isRpc = (url, name) => String(url).includes(`/rpc/${name}`)

let calls
beforeEach(() => {
  vi.useFakeTimers()
  _resetForTests()
  calls = []
  process.env.DIVINE_PRIDE_API_KEY = 'test-key'
  delete process.env.SUPABASE_URL
  delete process.env.SUPABASE_SERVICE_ROLE_KEY
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const stubFetch = (handler) => vi.stubGlobal('fetch', vi.fn(async (url, init) => { calls.push({ url: String(url), at: Date.now() }); return handler(url, init) }))

describe('dpGet — จำกัด 1 request/วินาที (ในโปรเซส)', () => {
  it('คำขอที่ยิงพร้อมกันถูกต่อคิว ห่างกัน ≥ MIN_INTERVAL_MS และไม่ขนาน', async () => {
    stubFetch(() => json({ id: 1 }))
    const all = Promise.all([dpGet('Item/1'), dpGet('Item/2'), dpGet('Item/3')])
    await vi.advanceTimersByTimeAsync(MIN_INTERVAL_MS * 3)
    await all
    const times = calls.filter((c) => isDp(c.url)).map((c) => c.at)
    expect(times).toHaveLength(3)
    expect(times[1] - times[0]).toBeGreaterThanOrEqual(MIN_INTERVAL_MS)
    expect(times[2] - times[1]).toBeGreaterThanOrEqual(MIN_INTERVAL_MS)
  })

  it('คิวยาวเกิน maxWaitMs → ปฏิเสธ (busy) แทนการรอนาน', async () => {
    stubFetch(() => json({ id: 1 }))
    const first = dpGet('Item/1')
    const second = dpGet('Item/2', { maxWaitMs: 100 })
    await expect(second).rejects.toBeInstanceOf(DivinePrideLimitError)
    await vi.advanceTimersByTimeAsync(MIN_INTERVAL_MS)
    await first
  })
})

describe('dpGet — โดน rate limit ต้องหยุด', () => {
  it('HTTP 429 + Retry-After → throw และคำขอถัดไปล้มเร็วโดยไม่ยิง', async () => {
    stubFetch(() => new Response('{}', { status: 429, headers: { 'retry-after': '120' } }))
    await expect(dpGet('Item/1')).rejects.toMatchObject({ name: 'DivinePrideLimitError', retryAfter: 120 })
    const dpCallsAfterFirst = calls.filter((c) => isDp(c.url)).length
    await expect(dpGet('Item/2')).rejects.toBeInstanceOf(DivinePrideLimitError)
    expect(calls.filter((c) => isDp(c.url)).length).toBe(dpCallsAfterFirst) // ไม่ยิงเพิ่ม
  })

  it('status 200 แต่ body บอก Rate limit exceeded ก็นับเป็นโดนจำกัด (ค่าเริ่มต้นรอ 60 วิ)', async () => {
    stubFetch(() => json({ status: 'error', reason: 'Rate limit exceeded' }))
    await expect(dpGet('Item/1')).rejects.toMatchObject({ retryAfter: 60 })
  })

  it('Retry-After สั้นเกินไปถูกยกเป็นอย่างน้อย 30 วินาที', async () => {
    stubFetch(() => new Response('{}', { status: 429, headers: { 'retry-after': '2' } }))
    await expect(dpGet('Item/1')).rejects.toMatchObject({ retryAfter: 30 })
  })

  it('ข้อผิดพลาดอื่น (เช่น 404) ไม่ใช่ rate limit → คืน data null และไม่บล็อก', async () => {
    stubFetch(() => new Response('{}', { status: 404 }))
    const res = await dpGet('Item/1')
    expect(res.status).toBe(404)
    await vi.advanceTimersByTimeAsync(MIN_INTERVAL_MS)
    stubFetch(() => json({ id: 2 }))
    await expect(dpGet('Item/2')).resolves.toMatchObject({ status: 200 })
  })
})

describe('dpGet — คิวกลาง dp_gate', () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
  })

  it('รอตาม wait_ms ที่คิวกลางสั่งก่อนยิง', async () => {
    stubFetch((url) => (isRpc(url, 'dp_claim_slot') ? json({ wait_ms: 3000 }) : json({ id: 1 })))
    const p = dpGet('Item/1')
    await vi.advanceTimersByTimeAsync(2900)
    expect(calls.some((c) => isDp(c.url))).toBe(false) // ยังไม่ถึงคิว
    await vi.advanceTimersByTimeAsync(200)
    await p
    expect(calls.some((c) => isDp(c.url))).toBe(true)
  })

  it('คิวกลางบอกว่าถูกบล็อก → ไม่ยิง Divine Pride เลย', async () => {
    stubFetch((url) => (isRpc(url, 'dp_claim_slot') ? json({ blocked_ms: 45000 }) : json({ id: 1 })))
    await expect(dpGet('Item/1')).rejects.toMatchObject({ retryAfter: 45 })
    expect(calls.some((c) => isDp(c.url))).toBe(false)
  })

  it('โดน 429 → แจ้ง dp_report_limit ให้ทุกผู้เรียกหยุดด้วย', async () => {
    stubFetch((url) => {
      if (isRpc(url, 'dp_claim_slot')) return json({ wait_ms: 0 })
      if (isRpc(url, 'dp_report_limit')) return new Response('', { status: 204 })
      return new Response('{}', { status: 429, headers: { 'retry-after': '90' } })
    })
    await expect(dpGet('Item/1')).rejects.toMatchObject({ retryAfter: 90 })
    expect(calls.some((c) => isRpc(c.url, 'dp_report_limit'))).toBe(true)
  })

  it('คิวกลางล่ม → ถอยไปคิวในโปรเซส ยังยิงได้', async () => {
    stubFetch((url) => (isRpc(url, 'dp_claim_slot') ? new Response('', { status: 500 }) : json({ id: 1 })))
    await expect(dpGet('Item/1')).resolves.toMatchObject({ status: 200 })
  })
})

describe('dpWithBackoff', () => {
  it('โดนจำกัด → รอ Retry-After (+5 วิ) แล้วลองใหม่ ไม่เกิน maxAttempts', async () => {
    let attempts = 0
    const fn = vi.fn(async () => { attempts++; if (attempts < 3) throw new DivinePrideLimitError(60); return 'ok' })
    const p = dpWithBackoff(fn, { maxAttempts: 3 })
    await vi.advanceTimersByTimeAsync(65000 * 2)
    await expect(p).resolves.toBe('ok')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('ครบจำนวนครั้งแล้วยังโดน → โยน error (ไม่วนไม่จบ)', async () => {
    const fn = vi.fn(async () => { throw new DivinePrideLimitError(60) })
    const p = dpWithBackoff(fn, { maxAttempts: 2 })
    const assertion = expect(p).rejects.toBeInstanceOf(DivinePrideLimitError)
    await vi.advanceTimersByTimeAsync(65000)
    await assertion
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('error อื่นไม่ลองซ้ำ', async () => {
    const fn = vi.fn(async () => { throw new Error('boom') })
    await expect(dpWithBackoff(fn)).rejects.toThrow('boom')
    expect(fn).toHaveBeenCalledTimes(1)
  })
})
