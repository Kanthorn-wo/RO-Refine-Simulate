import { useState } from 'react'
import { supabase } from '../lib/supabase'

// หน้า login/สมัครสมาชิก ผ่าน Supabase email + password
export default function Login() {
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setInfo('')
    setLoading(true)
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setInfo('สมัครสำเร็จ — ถ้าเปิด email confirmation ใน Supabase ให้ยืนยันอีเมลก่อนเข้าใช้งาน')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        // เข้าสำเร็จ — onAuthStateChange ใน Dashboard จะ re-render เอง
      }
    } catch (err) {
      setError(err?.message || 'เกิดข้อผิดพลาด')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-slate-950 px-4">
      <div
        className="pointer-events-none fixed inset-0 opacity-70"
        style={{ background: 'radial-gradient(700px 380px at 30% 0%, rgba(99,102,241,0.20), transparent), radial-gradient(600px 360px at 90% 10%, rgba(16,185,129,0.10), transparent)' }}
      />
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-white/[0.04] p-7 shadow-2xl backdrop-blur-xl"
      >
        <div className="mb-6">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-indigo-500/20 text-indigo-300">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3v18h18" /><path d="M7 14l4-4 3 3 5-6" />
            </svg>
          </span>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-white">Analytics</h1>
          <p className="mt-1 text-sm text-slate-400">
            {mode === 'signin' ? 'เข้าสู่ระบบเพื่อดูสถิติการใช้งาน' : 'สมัครสมาชิกใหม่'}
          </p>
        </div>

        <label className="mb-1.5 block text-xs font-medium text-slate-400">อีเมล</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-4 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-slate-100 outline-none transition-colors focus:border-indigo-400/60 focus:bg-white/[0.06]"
          autoComplete="email"
        />

        <label className="mb-1.5 block text-xs font-medium text-slate-400">รหัสผ่าน</label>
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-5 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-slate-100 outline-none transition-colors focus:border-indigo-400/60 focus:bg-white/[0.06]"
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
        />

        {error && <p className="mb-3 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{error}</p>}
        {info && <p className="mb-3 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">{info}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-3 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all hover:brightness-110 disabled:opacity-50"
        >
          {loading ? 'กำลังดำเนินการ...' : mode === 'signin' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}
        </button>

        <button
          type="button"
          onClick={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin')
            setError('')
            setInfo('')
          }}
          className="mt-4 w-full text-xs text-slate-400 transition-colors hover:text-slate-200"
        >
          {mode === 'signin' ? 'ยังไม่มีบัญชี? สมัครสมาชิก' : 'มีบัญชีแล้ว? เข้าสู่ระบบ'}
        </button>
      </form>
    </div>
  )
}
