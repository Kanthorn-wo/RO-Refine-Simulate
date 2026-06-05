import { useState } from 'react'
import Container from './components/Layout'
import PatchNotesModal from './components/PatchNotesModal'
import FloatingMenu from './components/FloatingMenu'

function App() {
  // เพิ่มค่าเพื่อสั่งเปิด PatchNotesModal เองจากปุ่มในเมนูลอย
  const [patchOpenTrigger, setPatchOpenTrigger] = useState(0)

  return (
    <div className="min-h-screen w-full flex justify-center px-3 py-6 sm:px-6 sm:py-10">
      <Container />
      <FloatingMenu onOpenPatchNotes={() => setPatchOpenTrigger((n) => n + 1)} />
      <PatchNotesModal openTrigger={patchOpenTrigger} />
    </div>
  )
}

export default App
