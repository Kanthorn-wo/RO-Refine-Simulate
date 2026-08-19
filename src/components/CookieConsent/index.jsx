import { useState, useEffect } from 'react'
import { useLang } from '../../contexts/LangContext'

const STORAGE_KEY = 'ro_refine_cookie_consent'

// อัปเดต Google Consent Mode ตามการตัดสินใจของผู้ใช้
function applyConsent(granted) {
  try {
    if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
      window.gtag('consent', 'update', {
        analytics_storage: granted ? 'granted' : 'denied',
      })
    }
  } catch {
    /* ignore */
  }
}

// เช็คว่าผู้ใช้ตัดสินใจเรื่องคุกกี้ไปแล้วหรือยัง — export ให้ App.jsx ใช้ตั้งค่าเริ่มต้นแบบ sync
// (กัน PatchNotesModal auto-open ทับ bar นี้ตอนยังไม่ทันรู้ผลจาก effect)
// eslint-disable-next-line react-refresh/only-export-components
export const hasCookieDecision = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved === 'accepted' || saved === 'rejected'
  } catch {
    return false
  }
}

export default function CookieConsent({ onVisibilityChange }) {
  const { t } = useLang()
  const [visible, setVisible] = useState(() => !hasCookieDecision())
  const [showPolicy, setShowPolicy] = useState(false)

  // แจ้ง App ให้ซ่อน FloatingMenu ตอน bar โชว์ (กันทับกัน)
  useEffect(() => {
    onVisibilityChange?.(visible)
  }, [visible, onVisibilityChange])

  const decide = (accepted) => {
    try {
      localStorage.setItem(STORAGE_KEY, accepted ? 'accepted' : 'rejected')
    } catch {
      /* ignore */
    }
    applyConsent(accepted)
    setVisible(false)
  }

  if (!visible) return null

  const sections = t('cookie_sections')

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center p-3 sm:p-4">
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-line-soft bg-card/95 shadow-2xl shadow-black/40 backdrop-blur-xl">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-400/15 text-2xl">🍪</span>
            <div>
              <p className="text-sm font-semibold text-body">{t('cookie_title')}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-dim">{t('cookie_desc')}</p>
              <button
                type="button"
                onClick={() => setShowPolicy((v) => !v)}
                className="mt-1 text-xs font-medium text-indigo-400 underline-offset-2 hover:text-brand2 hover:underline"
              >
                {showPolicy ? t('cookie_hide') : t('cookie_read_more')}
              </button>
            </div>
          </div>

          <div className="flex shrink-0 gap-2 sm:ml-auto">
            <button
              type="button"
              onClick={() => decide(false)}
              className="flex-1 rounded-xl border border-line-soft bg-sunken px-4 py-2 text-sm font-medium text-body transition-colors hover:bg-line-soft sm:flex-none"
            >
              {t('cookie_reject')}
            </button>
            <button
              type="button"
              onClick={() => decide(true)}
              className="flex-1 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all hover:brightness-110 sm:flex-none"
            >
              {t('cookie_accept')}
            </button>
          </div>
        </div>

        {showPolicy && (
          <div className="max-h-64 overflow-y-auto border-t border-line-soft bg-sunken/60 px-5 py-4">
            <h2 className="mb-2 text-sm font-semibold text-body">{t('cookie_policy_title')}</h2>
            <div className="space-y-3">
              {sections.map(([h, p], i) => (
                <div key={i}>
                  <p className="text-xs font-semibold text-body">{h}</p>
                  <p className="mt-0.5 whitespace-pre-line text-xs leading-relaxed text-dim">{p}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
