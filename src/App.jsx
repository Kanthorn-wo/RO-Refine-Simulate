import { useState } from 'react'
import Container from './components/Layout'
import PatchNotesModal from './components/PatchNotesModal'
import FloatingMenu from './components/FloatingMenu'
import { LangProvider } from './contexts/LangContext'

function App() {
  const [patchOpenTrigger, setPatchOpenTrigger] = useState(0)

  return (
    <LangProvider>
      <div className="min-h-screen w-full flex justify-center px-3 py-6 sm:px-6 sm:py-10">
        <Container />
        <FloatingMenu onOpenPatchNotes={() => setPatchOpenTrigger((n) => n + 1)} />
        <PatchNotesModal openTrigger={patchOpenTrigger} />
      </div>
    </LangProvider>
  )
}

export default App
