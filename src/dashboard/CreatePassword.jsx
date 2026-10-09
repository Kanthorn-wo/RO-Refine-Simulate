import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

// หน้า /create-password: ปลายทางของลิงก์ "เชิญทางอีเมล" (Supabase invite) — ผู้ใช้ตั้งรหัสผ่านของตัวเอง
// supabase-js อ่าน token จาก hash ของ URL แล้วสร้าง session ให้เอง (detectSessionInUrl) → ตั้งรหัสผ่านด้วย updateUser แล้วเข้า /dashboard ต่อได้เลย
const MIN_PASSWORD = 8
const SESSION_WAIT_MS = 4000 // รอ session จากลิงก์ — เกินนี้ถือว่าลิงก์ไม่ถูกต้อง/หมดอายุ
const inputCls = 'mb-4 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-slate-100 outline-none transition-colors focus:border-indigo-400/60 focus:bg-white/[0.06]'

// ข้อความ error จาก hash ของลิงก์ที่หมดอายุ (#error_description=...) — ไม่มี = ''
function linkErrorFromHash() {
  try {
    return new URLSearchParams(window.location.hash.replace(/^#/, '')).get('error_description') || ''
  } catch {
    return ''
  }
}

export default function CreatePassword() {
  const [phase, setPhase] = useState('checking') // 'checking' | 'ready' | 'invalid' | 'done'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isSupabaseConfigured) { setPhase('invalid'); return }
    if (linkErrorFromHash()) { setPhase('invalid'); return }
    let cancelled = false
    const accept = (session) => {
      if (cancelled || !session) return
      setEmail(session.user?.email || '')
      setPhase((p) => (p === 'checking' ? 'ready' : p))
    }
    supabase.auth.getSession().then(({ data }) => accept(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => accept(session))
    const timer = setTimeout(() => setPhase((p) => (p === 'checking' ? 'invalid' : p)), SESSION_WAIT_MS)
    return () => { cancelled = true; clearTimeout(timer); sub.subscription.unsubscribe() }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (password.length < MIN_PASSWORD) { setError(`รหัสผ่านต้องยาวอย่างน้อย ${MIN_PASSWORD} ตัวอักษร`); return }
    if (password !== confirm) { setError('รหัสผ่านสองช่องไม่ตรงกัน'); return }
    setSaving(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (updateError) { setError(updateError.message || 'ตั้งรหัสผ่านไม่สำเร็จ'); return }
    setPhase('done')
    setTimeout(() => { window.location.assign('/dashboard') }, 1500)
  }

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-slate-950 px-4">
      <div
        className="pointer-events-none fixed inset-0 opacity-70"
        style={{ background: 'radial-gradient(700px 380px at 30% 0%, rgba(99,102,241,0.20), transparent), radial-gradient(600px 360px at 90% 10%, rgba(16,185,129,0.10), transparent)' }}
      />
      <div className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-white/[0.04] p-7 shadow-2xl backdrop-blur-xl">
        <h1 className="text-2xl font-bold tracking-tight text-white">ตั้งรหัสผ่าน</h1>

        {phase === 'checking' && <p className="mt-3 text-sm text-slate-400">กำลังตรวจสอบลิงก์...</p>}

        {phase === 'invalid' && (
          <>
            <p className="mt-3 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-300">ลิงก์ไม่ถูกต้องหรือหมดอายุแล้ว — ขอให้เจ้าของเว็บส่งอีเมลเชิญใหม่</p>
            <a href="/dashboard" className="mt-4 block text-center text-xs text-slate-400 transition-colors hover:text-slate-200">ไปหน้าเข้าสู่ระบบ</a>
          </>
        )}

        {phase === 'ready' && (
          <form onSubmit={handleSubmit} className="mt-1">
            <p className="mb-5 text-sm text-slate-400">สร้างรหัสผ่านสำหรับ <span className="text-slate-200">{email}</span></p>

            <label className="mb-1.5 block text-xs font-medium text-slate-400">รหัสผ่านใหม่</label>
            <input type="password" required minLength={MIN_PASSWORD} value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} autoComplete="new-password" />

            <label className="mb-1.5 block text-xs font-medium text-slate-400">ยืนยันรหัสผ่าน</label>
            <input type="password" required minLength={MIN_PASSWORD} value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputCls} autoComplete="new-password" />

            {error && <p className="mb-3 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{error}</p>}

            <button type="submit" disabled={saving}
              className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-3 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all hover:brightness-110 disabled:opacity-50">
              {saving ? 'กำลังบันทึก...' : 'ตั้งรหัสผ่านและเข้าสู่ระบบ'}
            </button>
          </form>
        )}

        {phase === 'done' && <p className="mt-3 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">ตั้งรหัสผ่านเรียบร้อย กำลังพาเข้า dashboard...</p>}
      </div>
    </div>
  )
}
