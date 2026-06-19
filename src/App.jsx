import { useState, useEffect } from 'react'
import Container from './components/Layout'
import PatchNotesModal from './components/PatchNotesModal'
import FloatingMenu from './components/FloatingMenu'
import CookieConsent from './components/CookieConsent'
import { LangProvider } from './contexts/LangContext'
import { pingVisitOncePerDay } from './utils/usageStats'

function App() {
  const [patchOpenTrigger, setPatchOpenTrigger] = useState(0)
  const [cookieVisible, setCookieVisible] = useState(false)

  // นับ "คนใช้วันนี้" ครั้งเดียวต่อเบราว์เซอร์ต่อวัน
  useEffect(() => { pingVisitOncePerDay() }, [])

  return (
    <LangProvider>
      <div className="relative min-h-screen w-full flex justify-center px-3 py-6 sm:px-6 sm:py-10">
        <Container />
        <FloatingMenu onOpenPatchNotes={() => setPatchOpenTrigger((n) => n + 1)} suppressed={cookieVisible} />
        <PatchNotesModal openTrigger={patchOpenTrigger} />
        <CookieConsent onVisibilityChange={setCookieVisible} />
      </div>
    </LangProvider>
  )
}

export default App
