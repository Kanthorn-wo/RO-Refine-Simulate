import { useEffect, useRef } from 'react'
import { useLang } from '../../contexts/LangContext'
import { trackEvent } from '../../utils/analytics'

const STORAGE_KEY = 'ro_refine_tour_done'
const AUTO_START_DELAY_MS = 900

// ขั้นตอนทัวร์: selector ของจุดที่ไฮไลต์ + key ข้อความใน i18n (tour_<key>_title / tour_<key>_desc)
const STEPS = [
  { key: 'item', selector: '#item-type', side: 'bottom' },
  { key: 'event', selector: '[data-tour="event-toggle"]', side: 'right' },
  { key: 'stone', selector: '[data-tour="stone-slots"]', side: 'bottom' },
  { key: 'refine', selector: '[data-tour="refine-box"]', side: 'left' },
  { key: 'auto', selector: '[data-tour="auto"]', side: 'right' },
  { key: 'sim', selector: '[data-tour="simulator"]', side: 'top' },
]

const readDone = () => { try { return localStorage.getItem(STORAGE_KEY) === '1' } catch { return false } }
const writeDone = () => { try { localStorage.setItem(STORAGE_KEY, '1') } catch { /* ignore */ } }
// จำค่าไม่ได้ (โหมดส่วนตัว/บล็อก storage) = ห้ามเปิดเอง ไม่งั้นจะขึ้นทุกครั้งที่เข้าเว็บ
const canRemember = () => {
  try {
    localStorage.setItem(`${STORAGE_KEY}_probe`, '1')
    localStorage.removeItem(`${STORAGE_KEY}_probe`)
    return true
  } catch { return false }
}

// ทัวร์แนะนำการใช้งาน (driver.js โหลดแบบ lazy เฉพาะตอนเริ่ม)
// - autoStart: เปิดเองครั้งเดียวสำหรับผู้ใช้ใหม่ เมื่อไม่ถูกบล็อกโดย cookie bar / patch notes
// - openTrigger: counter จากปุ่ม "วิธีใช้" (FloatingMenu) สั่งเปิดซ้ำได้เสมอ
export default function Tour({ autoStart, blocked, openTrigger }) {
  const { t } = useLang()
  const activeRef = useRef(null)
  const tRef = useRef(t)
  tRef.current = t

  const start = async (source) => {
    if (activeRef.current) return
    const steps = STEPS.filter((s) => document.querySelector(s.selector))
    if (!steps.length) return
    const [{ driver }] = await Promise.all([
      import('driver.js'),
      import('driver.js/dist/driver.css'),
      import('./tour.css'),
    ])
    const tr = (k) => tRef.current(k)
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    trackEvent('tour_start', { source })

    const tour = driver({
      showProgress: true,
      progressText: '{{current}} / {{total}}',
      nextBtnText: tr('tour_next'),
      prevBtnText: tr('tour_prev'),
      doneBtnText: tr('tour_done'),
      popoverClass: 'ro-tour',
      overlayColor: '#000',
      overlayOpacity: 0.72,
      stagePadding: 8,
      stageRadius: 14,
      animate: !reduceMotion,
      smoothScroll: !reduceMotion,
      allowClose: true,
      disableActiveInteraction: true,
      steps: steps.map((s) => ({
        element: s.selector,
        popover: { title: tr(`tour_${s.key}_title`), description: tr(`tour_${s.key}_desc`), side: s.side, align: 'center' },
      })),
      // Reveal ของ section ด้านล่างค่อย ๆ เลื่อนขึ้นหลัง scroll ถึง → คำนวณตำแหน่งไฮไลต์ซ้ำเมื่อ animation จบ
      onHighlighted: () => { setTimeout(() => activeRef.current?.refresh(), 800) },
      onDestroyed: () => {
        const index = tour.getActiveIndex()
        const finished = index === undefined || index >= steps.length - 1
        trackEvent(finished ? 'tour_complete' : 'tour_skip', { step: (index ?? steps.length - 1) + 1 })
        writeDone()
        activeRef.current = null
      },
    })
    activeRef.current = tour
    tour.drive()
  }

  // เปิดเองครั้งเดียวสำหรับผู้ใช้ใหม่ — รอจน cookie bar / patch notes ปิดก่อน
  useEffect(() => {
    if (!autoStart || blocked || readDone() || !canRemember()) return
    const id = setTimeout(() => {
      // บันทึกว่าเปิดแล้วตั้งแต่ตอนเริ่ม — รีเฟรช/ปิดแท็บกลางทางก็ไม่เด้งซ้ำ (ดูซ้ำได้จากปุ่ม "วิธีใช้")
      writeDone()
      start('auto')
    }, AUTO_START_DELAY_MS)
    return () => clearTimeout(id)
  }, [autoStart, blocked])

  useEffect(() => {
    if (openTrigger > 0) start('menu')
  }, [openTrigger])

  // ปิดทัวร์เมื่อ component ถูกถอด (เช่น เปลี่ยนหน้า)
  useEffect(() => () => { activeRef.current?.destroy() }, [])

  return null
}
