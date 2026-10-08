import { useEffect, useState } from 'react'

// สวิตช์เปิด/ปิดช่องค้นหาไอเทมหน้าเว็บ (site_settings.item_search_enabled ตั้งจาก dashboard) แบบ realtime
// - ผู้เล่น: useItemSearchFlag() → null (ยังไม่รู้) | true | false — โหลดตอนเข้าหน้า, ฟัง Supabase Realtime broadcast ของ dashboard
//   (ปิดแล้วหายทันที), และ refetch สำรองทุก 60 วิ + ตอนกลับมาที่แท็บ (กัน websocket หลุด)
// - dashboard: notifyItemSearchChanged() ส่ง broadcast หลังบันทึกค่า
// broadcast เป็นแค่ "สัญญาณให้ไปอ่านค่าใหม่" — ค่าจริงอ่านจาก /api/extra-items?flag=1 (no-store) เสมอ ปลอมสัญญาณได้อย่างมากก็แค่ทำให้ refetch (มี throttle)
const CHANNEL = 'site-flags'
const EVENT = 'item-search-changed'
const POLL_MS = 60000
const MIN_REFETCH_GAP_MS = 2000

export function useItemSearchFlag() {
  const [enabled, setEnabled] = useState(null)

  useEffect(() => {
    let cancelled = false
    let client = null
    let channel = null
    let lastFetch = 0

    const refresh = async () => {
      if (Date.now() - lastFetch < MIN_REFETCH_GAP_MS) return
      lastFetch = Date.now()
      try {
        const res = await fetch('/api/extra-items?flag=1', { cache: 'no-store' })
        const data = res.ok ? await res.json() : null
        if (!cancelled && data) setEnabled(data.searchEnabled === true)
      } catch {
        if (!cancelled) setEnabled((prev) => (prev === null ? false : prev)) // อ่านไม่ได้ครั้งแรก = ปิด, เคยรู้ค่าแล้วคงค่าเดิม
      }
    }
    const onVisible = () => { if (document.visibilityState === 'visible') refresh() }

    refresh()
    const timer = setInterval(() => { if (document.visibilityState === 'visible') refresh() }, POLL_MS)
    document.addEventListener('visibilitychange', onVisible)

    // lazy-import supabase กัน main bundle บวม; ไม่มี env/ต่อไม่ได้ = ใช้ polling อย่างเดียว
    import('../lib/supabase').then((mod) => {
      client = mod.supabase
      if (!client || cancelled) return
      channel = client.channel(CHANNEL).on('broadcast', { event: EVENT }, () => { lastFetch = 0; refresh() }).subscribe()
    }).catch(() => {})

    return () => {
      cancelled = true
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      if (client && channel) client.removeChannel(channel)
    }
  }, [])

  return enabled
}

// dashboard: แจ้งผู้เล่นที่เปิดหน้าอยู่ให้ไปอ่านค่าสวิตช์ใหม่ (ล้มเหลวก็ไม่เป็นไร — ผู้เล่นมี polling สำรอง)
export async function notifyItemSearchChanged() {
  try {
    const { supabase } = await import('../lib/supabase')
    if (!supabase) return
    const channel = supabase.channel(CHANNEL)
    await new Promise((resolve) => {
      const timeout = setTimeout(resolve, 4000)
      channel.subscribe((status) => { if (status === 'SUBSCRIBED') { clearTimeout(timeout); resolve() } })
    })
    await channel.send({ type: 'broadcast', event: EVENT, payload: {} })
    supabase.removeChannel(channel)
  } catch { /* ไม่ทำให้การบันทึกล้ม */ }
}
