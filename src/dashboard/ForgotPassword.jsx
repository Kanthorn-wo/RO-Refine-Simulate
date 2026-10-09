import { useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

// หน้า /forgot-password: กรอกอีเมล → Supabase ส่งลิงก์รีเซ็ตรหัสผ่านให้ → ลิงก์พาไป /create-password เพื่อตั้งรหัสผ่านใหม่
// ข้อความหลังส่งเป็นกลาง (ไม่บอกว่าอีเมลนั้นมีบัญชีหรือไม่) กันคนนอกไล่เดาอีเมลในระบบ
const inputCls = 'mb-4 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-slate-100 outline-none transition-colors focus:border-indigo-400/60 focus:bg-white/[0.06]'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!isSupabaseConfigured) { setError('ยังไม่ได้ตั้งค่า Supabase'); return }
    setLoading(true)
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/create-password`,
    })
    setLoading(false)
    // error ที่บอกผู้ใช้ได้มีแค่ส่งถี่เกินไป/ระบบอีเมลมีปัญหา — ส่วน "ไม่มีอีเมลนี้" Supabase ไม่ error อยู่แล้ว
    if (resetError) { setError(resetError.status === 429 ? 'ขอถี่เกินไป รอสักครู่แล้วลองใหม่' : 'ส่งอีเมลไม่สำเร็จ ลองใหม่อีกครั้ง'); return }
    setSent(true)
  }

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-slate-950 px-4">
      <div
        className="pointer-events-none fixed inset-0 opacity-70"
        style={{ background: 'radial-gradient(700px 380px at 30% 0%, rgba(99,102,241,0.20), transparent), radial-gradient(600px 360px at 90% 10%, rgba(16,185,129,0.10), transparent)' }}
      />
      <div className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-white/[0.04] p-7 shadow-2xl backdrop-blur-xl">
        <h1 className="text-2xl font-bold tracking-tight text-white">ลืมรหัสผ่าน</h1>

        {sent ? (
          <p className="mt-3 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
            ถ้าอีเมลนี้มีบัญชีอยู่ ระบบส่งลิงก์ตั้งรหัสผ่านใหม่ไปให้แล้ว — เปิดอีเมลแล้วกดลิงก์ (ตรวจโฟลเดอร์สแปมด้วย)
          </p>
        ) : (
          <form onSubmit={handleSubmit}>
            <p className="mb-5 mt-1 text-sm text-slate-400">กรอกอีเมลที่ใช้เข้าสู่ระบบ ระบบจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ให้</p>

            <label className="mb-1.5 block text-xs font-medium text-slate-400">อีเมล</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} autoComplete="email" />

            {error && <p className="mb-3 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{error}</p>}

            <button type="submit" disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-3 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all hover:brightness-110 disabled:opacity-50">
              {loading ? 'กำลังส่ง...' : 'ส่งลิงก์ตั้งรหัสผ่านใหม่'}
            </button>
          </form>
        )}

        <a href="/dashboard" className="mt-4 block text-center text-xs text-slate-400 transition-colors hover:text-slate-200">กลับไปหน้าเข้าสู่ระบบ</a>
      </div>
    </div>
  )
}
