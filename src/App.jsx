import { useState } from 'react'
import Container from './components/Layout'
import PatchNotesModal from './components/PatchNotesModal'
import FloatingMenu from './components/FloatingMenu'
import CookieConsent from './components/CookieConsent'
import { LangProvider } from './contexts/LangContext'

function App() {
  const [patchOpenTrigger, setPatchOpenTrigger] = useState(0)
  const [cookieVisible, setCookieVisible] = useState(false)

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
