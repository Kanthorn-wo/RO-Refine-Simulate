// กรอง src/constants/refinableItems.json ให้เหลือเฉพาะไอเทมที่มีบนเซิร์ฟไทย (thROG) ตาม divine-pride
// ใช้: node --env-file=.env.local scripts/filter-item-index.mjs [limit]
// - ยิง ~1 ครั้ง/วินาที (โดน rate limit จะรอ 1, 2, 3… นาทีแล้วลองใหม่), เก็บผลใน scripts/.item-availability-cache.json (หยุดแล้วรันซ้ำได้ ต่อจากเดิม)
// - ไอเทมใน scripts/extra-items.json คงไว้เสมอ
// - ไอเทมที่ isAvailableOnServer = false หรือไม่มีข้อมูล จะถูกตัดออกจาก index
// - ให้รัน build-item-index.mjs ก่อนทุกครั้ง (กรองจากรายการเต็ม) แล้วค่อยรันสคริปต์นี้
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const INDEX_URL = new URL('../src/constants/refinableItems.json', import.meta.url)
const CACHE_URL = new URL('./.item-availability-cache.json', import.meta.url)
const SERVER = 'thROG'
const DELAY_MS = 1200
const key = process.env.DIVINE_PRIDE_API_KEY
if (!key) throw new Error('DIVINE_PRIDE_API_KEY ยังไม่ได้ตั้ง (ใช้ node --env-file=.env.local)')

const items = JSON.parse(readFileSync(INDEX_URL, 'utf8'))
// ไอเทมใน extra-items.json ข้ามการตรวจ (ข้อมูล divine-pride ของไอเทมเซิร์ฟไทยบางชิ้นไม่ครบ ทำให้ isAvailableOnServer เป็น false ทั้งที่มีจริง)
const extraIds = new Set(JSON.parse(readFileSync(new URL('./extra-items.json', import.meta.url), 'utf8')).map(([id]) => id))
const cache = existsSync(CACHE_URL) ? JSON.parse(readFileSync(CACHE_URL, 'utf8')) : {}
const limit = Number(process.argv[2]) || Infinity
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function checkAvailable(id) {
  for (let attempt = 0; attempt < 12; attempt++) {
    const res = await fetch(`https://www.divine-pride.net/api/database/Item/${id}?apiKey=${key}`, {
      headers: { 'Accept-Language': 'en', 'x-server': SERVER },
    })
    const data = await res.json().catch(() => null)
    // rate limit ตอบมาในเนื้อหา (ไม่ใช่แค่ status) → รอแล้วลองใหม่
    if (res.status === 429 || data?.reason === 'Rate limit exceeded') { await sleep(60000 * (attempt + 1)); continue }
    if (!data || data.status === 'error') throw new Error(`id ${id}: ${JSON.stringify(data)}`)
    return data.isAvailableOnServer === true
  }
  throw new Error(`id ${id}: rate limit ไม่หายหลังลองหลายรอบ`)
}

let done = 0
const startedAt = Date.now()
const total = items.length
for (const [id] of items) {
  if (cache[id] !== undefined || extraIds.has(id)) continue
  if (done >= limit) break
  cache[id] = await checkAvailable(id)
  done++
  const checkedCount = Object.keys(cache).length
  if (done % 10 === 0) {
    writeFileSync(CACHE_URL, JSON.stringify(cache))
    const perItemMs = (Date.now() - startedAt) / done
    const etaMin = Math.round(((total - checkedCount) * perItemMs) / 60000)
    const missing = Object.values(cache).filter(v => !v).length
    console.log(`${checkedCount}/${total} (${((checkedCount * 100) / total).toFixed(1)}%) — ไม่มีบน ${SERVER}: ${missing} — เหลือประมาณ ${etaMin} นาที`)
  }
  await sleep(DELAY_MS)
}
writeFileSync(CACHE_URL, JSON.stringify(cache))

const checked = items.filter(([id]) => cache[id] !== undefined || extraIds.has(id))
console.log(`ตรวจแล้ว ${checked.length}/${items.length} — มีบน ${SERVER}: ${checked.filter(([id]) => cache[id]).length}`)
if (checked.length === items.length) {
  const kept = items.filter(([id]) => cache[id] || extraIds.has(id))
  writeFileSync(INDEX_URL, JSON.stringify(kept))
  console.log(`เขียน index ใหม่ ${kept.length} รายการ`)
} else {
  console.log('ยังตรวจไม่ครบ — ยังไม่เขียน index (รันซ้ำเพื่อทำต่อ)')
}
