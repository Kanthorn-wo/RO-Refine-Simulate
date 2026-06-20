import { useState, useEffect } from 'react'

// นับจำนวนผู้ใช้ที่ออนไลน์ "ตอนนี้" ผ่าน Supabase Realtime Presence
// - track=true   → นับตัวเองด้วย (ฝั่งผู้เล่น)
// - track=false  → แค่ดูจำนวน ไม่นับตัวเอง (dashboard ไม่อยากนับ admin)
// - enabled=false → ไม่ต่อ websocket เลย (เช่น toggle ปิดอยู่) — ประหยัด connection
// lazy-import supabase กัน main bundle ฝั่งผู้เล่นบวม (โหลด chunk แยกหลัง render)
export function useOnlineCount({ track = true, enabled = true } = {}) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!enabled) { setCount(0); return }
    let channel = null
    let client = null
    let cancelled = false

    ;(async () => {
      const mod = await import('../lib/supabase')
      client = mod.supabase
      if (!client || cancelled) return

      const key =
        (typeof crypto !== 'undefined' && crypto.randomUUID && crypto.randomUUID()) ||
        `${Date.now()}-${Math.random().toString(36).slice(2)}`

      channel = client.channel('online', { config: { presence: { key } } })
      channel.on('presence', { event: 'sync' }, () => {
        if (!cancelled) setCount(Object.keys(channel.presenceState()).length)
      })
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED' && track) channel.track({ at: Date.now() })
      })
    })()

    return () => {
      cancelled = true
      if (client && channel) client.removeChannel(channel)
    }
  }, [track, enabled])

  return count
}
