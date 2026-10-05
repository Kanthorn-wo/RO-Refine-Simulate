import { useState, useEffect } from 'react'
import Container from './components/Layout'
import PatchNotesModal from './components/PatchNotesModal'
import FloatingMenu from './components/FloatingMenu'
import Tour from './components/Tour'
import CookieConsent, { hasCookieDecision } from './components/CookieConsent'
import { LangProvider } from './contexts/LangContext'
import { pingVisitOncePerDay } from './utils/usageStats'

function App() {
  const [patchOpenTrigger, setPatchOpenTrigger] = useState(0)
  const [tourOpenTrigger, setTourOpenTrigger] = useState(0)
  const [patchVisible, setPatchVisible] = useState(false)
  // ผู้ใช้ใหม่ = ยังไม่เคยตัดสินใจเรื่องคุกกี้ ณ ตอนเปิดเว็บ (ผู้ใช้เดิมไม่โดนทัวร์เด้งเอง แต่กด "วิธีใช้" ได้)
  const [isNewVisitor] = useState(() => !hasCookieDecision())
  // sync กับ CookieConsent เอง (lazy state เดียวกัน) กัน PatchNotesModal auto-open ทับ bar คุกกี้ตอนยังไม่ทันรู้ผล
  const [cookieVisible, setCookieVisible] = useState(() => !hasCookieDecision())

  // นับ "คนใช้วันนี้" ครั้งเดียวต่อเบราว์เซอร์ต่อวัน
  useEffect(() => { pingVisitOncePerDay() }, [])

  return (
    <LangProvider>
      <div className="relative min-h-screen w-full flex justify-center px-3 py-6 sm:px-6 sm:py-10">
        <Container />
        <FloatingMenu
          onOpenPatchNotes={() => setPatchOpenTrigger((n) => n + 1)}
          onOpenTour={() => setTourOpenTrigger((n) => n + 1)}
          suppressed={cookieVisible}
        />
        <Tour autoStart={isNewVisitor} blocked={cookieVisible || patchVisible} openTrigger={tourOpenTrigger} />
        <PatchNotesModal openTrigger={patchOpenTrigger} holdOpen={cookieVisible} onVisibilityChange={setPatchVisible} />
        <CookieConsent onVisibilityChange={setCookieVisible} />
      </div>
    </LangProvider>
  )
}

export default App
