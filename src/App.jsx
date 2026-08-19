import { useState, useEffect } from 'react'
import Container from './components/Layout'
import PatchNotesModal from './components/PatchNotesModal'
import FloatingMenu from './components/FloatingMenu'
import CookieConsent, { hasCookieDecision } from './components/CookieConsent'
import { LangProvider } from './contexts/LangContext'
import { pingVisitOncePerDay } from './utils/usageStats'

function App() {
  const [patchOpenTrigger, setPatchOpenTrigger] = useState(0)
  // sync กับ CookieConsent เอง (lazy state เดียวกัน) กัน PatchNotesModal auto-open ทับ bar คุกกี้ตอนยังไม่ทันรู้ผล
  const [cookieVisible, setCookieVisible] = useState(() => !hasCookieDecision())

  // นับ "คนใช้วันนี้" ครั้งเดียวต่อเบราว์เซอร์ต่อวัน
  useEffect(() => { pingVisitOncePerDay() }, [])

  return (
    <LangProvider>
      <div className="relative min-h-screen w-full flex justify-center px-3 py-6 sm:px-6 sm:py-10">
        <Container />
        <FloatingMenu onOpenPatchNotes={() => setPatchOpenTrigger((n) => n + 1)} suppressed={cookieVisible} />
        <PatchNotesModal openTrigger={patchOpenTrigger} holdOpen={cookieVisible} />
        <CookieConsent onVisibilityChange={setCookieVisible} />
      </div>
    </LangProvider>
  )
}

export default App
