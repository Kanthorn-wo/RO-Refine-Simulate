import { useEffect, useState } from 'react'
import { useLang } from '../../contexts/LangContext'
import { fetchUsage } from '../../utils/usageStats'

// แถบ social proof ใต้ HeroBanner — ตัวเลขรวมการใช้งานเว็บ (anonymous)
// ซ่อนทั้งแถบถ้า flag show_stats = false (คุมจาก dashboard) หรือยังไม่มีข้อมูล
export default function UsageStats() {
  const { t, lang } = useLang()
  const [data, setData] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetchUsage().then((d) => { if (!cancelled) setData(d) })
    return () => { cancelled = true }
  }, [])

  if (!data || data.showStats === false) return null

  const fmt = (n) => Number(n || 0).toLocaleString(lang === 'en' ? 'en-US' : 'th-TH')

  const items = [
    { key: 'refine', label: t('usage_refine'), value: fmt(data.refine), icon: '⚒️' },
    { key: 'stone', label: t('usage_stone'), value: fmt(data.stone), icon: '💎' },
    { key: 'today', label: t('usage_today'), value: fmt(data.visitsToday), icon: '🔥' },
  ]

  return (
    <div className="mt-3 grid grid-cols-3 gap-2 sm:gap-3" aria-label={t('usage_stats_title')}>
      {items.map((it) => (
        <div
          key={it.key}
          className="flex flex-col items-center justify-center rounded-xl border border-line-soft bg-card px-2 py-2.5 text-center sm:py-3"
        >
          <span className="text-base leading-none sm:text-lg" aria-hidden="true">{it.icon}</span>
          <span className="mt-1 text-lg font-bold tabular-nums text-body sm:text-2xl">{it.value}</span>
          <span className="mt-0.5 text-[11px] leading-tight text-dim sm:text-xs">{it.label}</span>
        </div>
      ))}
    </div>
  )
}
