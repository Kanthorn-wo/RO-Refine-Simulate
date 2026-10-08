import { useEffect, useState } from 'react'

// ชื่อไอเทมสำหรับหน้า dashboard — อ่านจากรายชื่อที่เรามีเอง (รายชื่อหลัก refinableItems.json + ไอเทมเสริมที่อนุมัติจาก /api/extra-items)
// ไม่เรียก Divine Pride เลย (กฎ 1 req/วินาที) โหลดครั้งเดียวต่อ session แล้วใช้ซ้ำ
// ไอเทมที่ไม่อยู่ในรายชื่อ = ไม่มีชื่อในผลลัพธ์ (ผู้เรียกแสดง fallback เอง)
let namesPromise = null
const loadNames = () => {
  if (!namesPromise) {
    namesPromise = (async () => {
      const names = new Map()
      const index = (await import('../constants/refinableItems.json')).default
      for (const [id, label] of index) names.set(id, label)
      try {
        const res = await fetch('/api/extra-items')
        if (res.ok) for (const [id, label] of (await res.json()).add || []) names.set(id, label)
      } catch { /* ไม่มีไอเทมเสริมก็ใช้รายชื่อหลักอย่างเดียว */ }
      return names
    })()
  }
  return namesPromise
}

// ids → { [id]: { name } } (เฉพาะ id ที่รู้ชื่อ)
export function useItemNames(ids) {
  const [names, setNames] = useState(null)
  useEffect(() => {
    let cancelled = false
    loadNames().then((m) => { if (!cancelled) setNames(m) })
    return () => { cancelled = true }
  }, [])
  const result = {}
  if (names) for (const id of ids) if (names.has(id)) result[id] = { name: names.get(id) }
  return result
}
