import { useEffect, useRef, useState } from 'react'
import { useLang } from '../../contexts/LangContext'
import { fetchUsage } from '../../utils/usageStats'
import { useOnlineCount } from '../../utils/useOnlineCount'

// เลขวิ่งจาก 0 → target ด้วย requestAnimationFrame (easeOutCubic)
// - animate=false (การ์ด live เช่นออนไลน์) → ตั้งค่าตรง ๆ ไม่วิ่ง
// - เคารพ prefers-reduced-motion
function useCountUp(target, { duration = 1300, animate = true } = {}) {
  const [val, setVal] = useState(0)
  const rafRef = useRef(0)

  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!animate || reduce || !target) { setVal(target || 0); return }

    let start = null
    const ease = (p) => 1 - Math.pow(1 - p, 3)
    const step = (ts) => {
      if (start === null) start = ts
      const p = Math.min((ts - start) / duration, 1)
      setVal(Math.round(target * ease(p)))
      if (p < 1) rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafRef.current)
  }, [target, duration, animate])

  return val
}

function StatCard({ icon, value, label, accent, live = false, loading = false }) {
  const { lang } = useLang()
  const display = useCountUp(value, { animate: !live })
  const fmt = Number(display || 0).toLocaleString(lang === 'en' ? 'en-US' : 'th-TH')

  return (
    <div className="group rounded-2xl border border-line-soft bg-card p-3 text-center transition-all duration-200 hover:-translate-y-0.5 hover:border-line hover:shadow-lg hover:shadow-black/20 sm:p-4">
      <span
        className="mx-auto mb-1.5 grid h-9 w-9 place-items-center rounded-xl bg-sunken text-lg transition-transform duration-200 group-hover:scale-110 sm:h-10 sm:w-10 sm:text-xl"
        aria-hidden="true"
      >
        {icon}
      </span>
      <div className={`flex h-7 items-center justify-center text-lg font-extrabold leading-none tabular-nums sm:text-2xl ${accent}`}>
        {loading ? (
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-label="loading">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
            <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        ) : (
          fmt
        )}
      </div>
      <div className="mt-1 text-[11px] leading-tight text-dim sm:text-xs">{label}</div>
    </div>
  )
}

// จุดเขียว pulse แทนไอคอนการ์ดออนไลน์ (สื่อว่า live)
const LiveDot = (
  <span className="relative flex h-3 w-3">
    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
    <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
  </span>
)

// กล่องสถิติใต้ HeroBanner — ตัวเลขรวมการใช้งาน + คนออนไลน์ realtime (anonymous)
// - การ์ดสถิติ (ตี/แร่/วันนี้) คุมด้วย flag show_stats
// - การ์ดออนไลน์ คุมด้วย flag show_online (Supabase Presence)
const COLS = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-2 sm:grid-cols-4' }

export default function UsageStats() {
  const { t } = useLang()
  const [data, setData] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetchUsage().then((d) => { if (!cancelled) setData(d) })
    return () => { cancelled = true }
  }, [])

  const showOnline = !!(data && data.showOnline !== false)
  const online = useOnlineCount({ track: true, enabled: showOnline })

  if (!data) return null

  const showStats = data.showStats !== false
  const items = []
  if (showStats) {
    items.push(
      { key: 'refine', label: t('usage_refine'), value: data.refine, icon: '⚒️', accent: 'text-brand2' },
      { key: 'stone', label: t('usage_stone'), value: data.stone, icon: '💎', accent: 'text-info' },
      { key: 'today', label: t('usage_today'), value: data.visitsToday, icon: '🔥', accent: 'text-success' },
    )
  }
  if (showOnline) {
    // track:true จะนับตัวเองเสมอเมื่อต่อสำเร็จ → online>0 = พร้อม, ===0 = ยังโหลด (โชว์ spinner)
    // เลขสีกลาง (text-body) ให้จุดเขียว pulse เป็นตัวเด่นแทน — ตัดความซ้ำสีเขียวกับการ์ดวันนี้
    items.push({ key: 'online', label: t('online_now'), value: online, icon: LiveDot, accent: 'text-body', live: true, loading: online === 0 })
  }
  if (!items.length) return null

  return (
    <div className={`grid ${COLS[items.length] || 'grid-cols-3'} gap-2 sm:gap-3`} aria-label={t('usage_stats_title')}>
      {items.map((it) => (
        <StatCard key={it.key} icon={it.icon} value={it.value} label={it.label} accent={it.accent} live={it.live} loading={it.loading} />
      ))}
    </div>
  )
}
