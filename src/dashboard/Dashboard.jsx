import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import Login from './Login'
import DashboardView from './DashboardView'

// Auth gate: ยังไม่ login → Login, login แล้ว → DashboardView
export default function Dashboard() {
  const [session, setSession] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setReady(true)
      return
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 px-4">
        <div className="max-w-md text-center text-slate-300">
          <h1 className="text-lg font-bold mb-2 text-slate-100">ยังไม่ได้ตั้งค่า Supabase</h1>
          <p className="text-sm text-slate-400">
            ตั้ง env <code className="text-indigo-400">VITE_SUPABASE_URL</code> และ{' '}
            <code className="text-indigo-400">VITE_SUPABASE_ANON_KEY</code> ใน <code>.env.local</code>{' '}
            (หรือใน Vercel) แล้ว build ใหม่
          </p>
        </div>
      </div>
    )
  }

  if (!ready) {
    return <div className="min-h-screen w-full bg-slate-950" />
  }

  if (!session) return <Login />

  return <DashboardView session={session} />
}
