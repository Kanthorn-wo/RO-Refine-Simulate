// กรอง src/constants/refinableItems.json ให้เหลือเฉพาะไอเทมที่มีบนเซิร์ฟไทย (thROG) ตาม divine-pride
// ใช้: node --env-file=.env.local scripts/filter-item-index.mjs [limit]
// - เรียก divine-pride ผ่าน api/_lib/divinePride.js เท่านั้น: คิว ≤ 1 req/วินาที ข้ามทุกผู้เรียก (ใช้ SUPABASE_* ใน env เป็นคิวกลาง), ไม่ขนาน,
//   โดน rate limit → หยุดยิงแล้วรอตาม Retry-After (ลองใหม่จำกัดจำนวนครั้ง เกินแล้วสคริปต์หยุดและเก็บความคืบหน้าไว้)
// - เก็บผลใน scripts/.item-availability-cache.json (หยุดแล้วรันซ้ำได้ ต่อจากเดิม)
// - ไอเทมใน scripts/extra-items.json คงไว้เสมอ
// - ไอเทมที่ isAvailableOnServer = false หรือไม่มีข้อมูล จะถูกตัดออกจาก index
// - ให้รัน build-item-index.mjs ก่อนทุกครั้ง (กรองจากรายการเต็ม) แล้วค่อยรันสคริปต์นี้
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dpItem, dpWithBackoff, DivinePrideLimitError } from '../api/_lib/divinePride.js'

const INDEX_URL = new URL('../src/constants/refinableItems.json', import.meta.url)
const CACHE_URL = new URL('./.item-availability-cache.json', import.meta.url)
const SERVER = 'thROG'

const items = JSON.parse(readFileSync(INDEX_URL, 'utf8'))
// ไอเทมใน extra-items.json ข้ามการตรวจ (ข้อมูล divine-pride ของไอเทมเซิร์ฟไทยบางชิ้นไม่ครบ ทำให้ isAvailableOnServer เป็น false ทั้งที่มีจริง)
const extraIds = new Set(JSON.parse(readFileSync(new URL('./extra-items.json', import.meta.url), 'utf8')).map(([id]) => id))
const cache = existsSync(CACHE_URL) ? JSON.parse(readFileSync(CACHE_URL, 'utf8')) : {}
const limit = Number(process.argv[2]) || Infinity
const saveCache = () => writeFileSync(CACHE_URL, JSON.stringify(cache))

async function checkAvailable(id) {
  const { data } = await dpWithBackoff(() => dpItem(id, { server: SERVER, maxWaitMs: 120000 }), {
    onWait: (sec, attempt) => console.log(`โดน rate limit — รอ ${sec} วินาที แล้วลองใหม่ (ครั้งที่ ${attempt})`),
  })
  return data?.isAvailableOnServer === true
}

let done = 0
const startedAt = Date.now()
const total = items.length
try {
  for (const [id] of items) {
    if (cache[id] !== undefined || extraIds.has(id)) continue
    if (done >= limit) break
    cache[id] = await checkAvailable(id)
    done++
    const checkedCount = Object.keys(cache).length
    if (done % 10 === 0) {
      saveCache()
      const etaMin = Math.round(((total - checkedCount) * ((Date.now() - startedAt) / done)) / 60000)
      const missing = Object.values(cache).filter((v) => !v).length
      console.log(`${checkedCount}/${total} (${((checkedCount * 100) / total).toFixed(1)}%) — ไม่มีบน ${SERVER}: ${missing} — เหลือประมาณ ${etaMin} นาที`)
    }
  }
} catch (err) {
  saveCache()
  if (err instanceof DivinePrideLimitError) {
    console.error(`หยุด: ยังโดน rate limit หลังรอแล้ว (${err.message}) — เก็บความคืบหน้าไว้ ${Object.keys(cache).length}/${total} รันซ้ำภายหลังเพื่อทำต่อ`)
    process.exit(2)
  }
  throw err
}
saveCache()

const checked = items.filter(([id]) => cache[id] !== undefined || extraIds.has(id))
console.log(`ตรวจแล้ว ${checked.length}/${items.length} — มีบน ${SERVER}: ${checked.filter(([id]) => cache[id] || extraIds.has(id)).length}`)
if (checked.length === items.length) {
  const kept = items.filter(([id]) => cache[id] || extraIds.has(id))
  writeFileSync(INDEX_URL, JSON.stringify(kept))
  console.log(`เขียน index ใหม่ ${kept.length} รายการ`)
} else {
  console.log('ยังตรวจไม่ครบ — ยังไม่เขียน index (รันซ้ำเพื่อทำต่อ)')
}
