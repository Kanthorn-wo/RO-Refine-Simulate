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

const TEXT = {
  th: {
    title: 'เว็บไซต์นี้ใช้คุกกี้',
    desc: 'เราใช้คุกกี้ที่จำเป็นเพื่อให้เว็บทำงาน และคุกกี้วิเคราะห์เพื่อเก็บสถิติการใช้งานแบบไม่ระบุตัวตน เพื่อปรับปรุงเว็บให้ดีขึ้น',
    accept: 'ยอมรับทั้งหมด',
    reject: 'ปฏิเสธ',
    readMore: 'นโยบายคุกกี้',
    hide: 'ซ่อน',
    policyTitle: 'นโยบายคุกกี้ (Cookie Policy)',
    sections: [
      ['คุกกี้คืออะไร', 'คุกกี้คือไฟล์ข้อมูลขนาดเล็กที่เก็บไว้ในเบราว์เซอร์ของคุณ เพื่อให้เว็บไซต์จดจำการตั้งค่าและวิเคราะห์การใช้งาน'],
      ['ประเภทคุกกี้ที่เราใช้', 'คุกกี้ที่จำเป็น (Necessary): จดจำการตั้งค่าพื้นฐาน เช่น ภาษา และการปิดหน้าต่างแจ้งเตือน — ทำงานเสมอ ปิดไม่ได้\nคุกกี้วิเคราะห์ (Analytics): Google Analytics (GA4) เก็บสถิติการเข้าชมแบบไม่ระบุตัวตน เช่น จำนวนผู้เข้าชม หน้าที่นิยม และแหล่งที่มา — ทำงานเมื่อคุณกดยอมรับเท่านั้น'],
      ['เราไม่ทำสิ่งเหล่านี้', 'ไม่ใช้คุกกี้เพื่อโฆษณา ไม่ขายหรือแลกเปลี่ยนข้อมูลส่วนบุคคลกับบุคคลที่สาม'],
      ['การจัดการคุกกี้', 'คุณเลือกยอมรับหรือปฏิเสธคุกกี้วิเคราะห์ได้ และเปลี่ยนใจภายหลังได้โดยล้างคุกกี้/ข้อมูลเว็บไซต์ในเบราว์เซอร์ แล้วเลือกใหม่'],
    ],
  },
  en: {
    title: 'This site uses cookies',
    desc: 'We use necessary cookies to make the site work and analytics cookies to collect anonymous usage statistics that help us improve the site.',
    accept: 'Accept all',
    reject: 'Reject',
    readMore: 'Cookie Policy',
    hide: 'Hide',
    policyTitle: 'Cookie Policy',
    sections: [
      ['What are cookies', 'Cookies are small data files stored in your browser so the site can remember your settings and analyze usage.'],
      ['Types we use', 'Necessary cookies: remember basic settings such as language and dismissed notices — always on, cannot be disabled.\nAnalytics cookies: Google Analytics (GA4) collects anonymous visit statistics such as visitor counts, popular pages and traffic sources — active only after you accept.'],
      ['What we do NOT do', 'We do not use cookies for advertising, and we never sell or share your personal data with third parties.'],
      ['Managing cookies', 'You can accept or reject analytics cookies, and change your mind later by clearing the site cookies/data in your browser and choosing again.'],
    ],
  },
}

export default function CookieConsent({ onVisibilityChange }) {
  const { lang } = useLang()
  const t = TEXT[lang] || TEXT.th
  const [visible, setVisible] = useState(false)
  const [showPolicy, setShowPolicy] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved !== 'accepted' && saved !== 'rejected') setVisible(true)
    } catch {
      setVisible(true)
    }
  }, [])

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

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center p-3 sm:p-4">
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-white/10 bg-slate-900/90 shadow-2xl shadow-black/40 backdrop-blur-xl">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-400/15 text-2xl">🍪</span>
            <div>
              <p className="text-sm font-semibold text-slate-100">{t.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{t.desc}</p>
              <button
                type="button"
                onClick={() => setShowPolicy((v) => !v)}
                className="mt-1 text-xs font-medium text-indigo-400 underline-offset-2 hover:text-indigo-300 hover:underline"
              >
                {showPolicy ? t.hide : t.readMore}
              </button>
            </div>
          </div>

          <div className="flex shrink-0 gap-2 sm:ml-auto">
            <button
              type="button"
              onClick={() => decide(false)}
              className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-white/10 sm:flex-none"
            >
              {t.reject}
            </button>
            <button
              type="button"
              onClick={() => decide(true)}
              className="flex-1 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all hover:brightness-110 sm:flex-none"
            >
              {t.accept}
            </button>
          </div>
        </div>

        {showPolicy && (
          <div className="max-h-64 overflow-y-auto border-t border-white/10 bg-black/20 px-5 py-4">
            <h2 className="mb-2 text-sm font-semibold text-slate-100">{t.policyTitle}</h2>
            <div className="space-y-3">
              {t.sections.map(([h, p], i) => (
                <div key={i}>
                  <p className="text-xs font-semibold text-slate-300">{h}</p>
                  <p className="mt-0.5 whitespace-pre-line text-xs leading-relaxed text-slate-400">{p}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
