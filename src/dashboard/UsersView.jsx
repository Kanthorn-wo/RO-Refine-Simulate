import { useCallback, useEffect, useMemo, useState } from 'react'
import { btnNeutral, btnOk, btnWarn, inputCls } from './items/consts'
import { EmptyNote, Panel, Skeleton } from './items/ui'
import { ACTIONS, ACTION_LABEL, ALL_PERMS, PAGES, PRESETS, can, setAllPerm, setPagePerm, togglePerm } from './permissions'

// แท็บ "ผู้ใช้" (เฉพาะ owner): เพิ่ม/แก้สิทธิ์/ลบ ผู้ใช้ dashboard ผ่าน /api/users (ตาราง dashboard_users)
// สิทธิ์ = checkbox รายหน้า (ดู/แก้ไข/ลบ) — owner ได้ทุกอย่างเสมอ; ผู้ใช้ต้องมีบัญชีใน Supabase Auth ก่อน

const MIN_PASSWORD = 8
const PASSWORD_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789' // ตัดตัวที่อ่านสับสน (I l 1 O 0)

// สุ่มรหัสผ่าน 12 ตัวด้วย crypto (ไม่ใช่ Math.random)
function generatePassword() {
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => PASSWORD_CHARS[b % PASSWORD_CHARS.length]).join('')
}

const ACCOUNT_MODES = [
  { id: 'none', label: 'เฉพาะสิทธิ์', desc: 'ผู้ใช้มีบัญชี login อยู่แล้ว (สมัครเอง/สร้างใน Supabase)' },
  { id: 'confirmed', label: 'สร้างบัญชีเลย', desc: 'ตั้งรหัสผ่านให้ ใช้ login ได้ทันที' },
  { id: 'email', label: 'ให้ไปยืนยันในอีเมล', desc: 'ตั้งรหัสผ่านให้ + ส่งอีเมลยืนยัน ผู้ใช้กดลิงก์แล้วไปหน้าตั้งรหัสผ่านเอง (ถ้าโปรเจกต์ปิด confirm email จะใช้ได้ทันที)' },
  { id: 'invite', label: 'เชิญทางอีเมล', desc: 'ไม่ต้องตั้งรหัสผ่าน ผู้ใช้กดลิงก์ในอีเมลแล้วตั้งรหัสผ่านเอง' },
]

const sameSet = (a, b) => a.length === b.length && a.every((p) => b.includes(p))

// checkbox ที่รองรับสถานะ "เลือกบางส่วน" (indeterminate) — ใช้กับช่อง "ทั้งหน้า"
function TriCheckbox({ checked, partial, onChange, disabled, label }) {
  return (
    <input
      type="checkbox"
      ref={(el) => { if (el) el.indeterminate = partial && !checked }}
      className="h-3.5 w-3.5 accent-indigo-500 disabled:opacity-40"
      checked={checked}
      disabled={disabled}
      onChange={onChange}
      aria-label={label}
    />
  )
}

// ตาราง checkbox: กลุ่ม = หน้า (แถวหัวมีช่อง "ทั้งหน้า" ต่อ action), แถว = section, คอลัมน์ = ดู/แก้ไข/ลบ (ช่องที่ section นั้นไม่มี action นี้ = "-")
function PermMatrix({ perms, onChange, disabled }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[20rem] text-xs">
        <thead>
          <tr className="text-left text-[11px] text-slate-500">
            <th className="py-1 pr-3 font-medium">หน้า / ส่วน</th>
            {ACTIONS.map((a) => <th key={a} className="w-16 py-1 text-center font-medium">{ACTION_LABEL[a]}</th>)}
          </tr>
          {/* แถว "เปิดทั้งหมด": ช่องซ้ายสุด = ทุกสิทธิ์ทุกหน้า, ช่องใต้คอลัมน์ = action นั้นทุกหน้า */}
          <tr className="border-t border-white/10 bg-indigo-500/[0.08] text-slate-100">
            <th className="py-1.5 pl-2 pr-3 text-left text-xs font-semibold">
              <label className="flex cursor-pointer items-center gap-2">
                <TriCheckbox checked={perms.length >= ALL_PERMS.length} partial={perms.length > 0} disabled={disabled}
                  onChange={() => onChange(setAllPerm(perms, null, perms.length < ALL_PERMS.length))} label="เปิดทั้งหมด" />
                เปิดทั้งหมด
              </label>
            </th>
            {ACTIONS.map((a) => {
              const keys = ALL_PERMS.filter((k) => k.endsWith(`:${a}`))
              const n = keys.filter((k) => perms.includes(k)).length
              return (
                <th key={a} className="py-1.5 text-center">
                  <TriCheckbox checked={n === keys.length} partial={n > 0} disabled={disabled}
                    onChange={() => onChange(setAllPerm(perms, a, n !== keys.length))} label={`เปิดทั้งหมด — ${ACTION_LABEL[a]}`} />
                </th>
              )
            })}
          </tr>
        </thead>
        {PAGES.map((page) => (
          <tbody key={page.id}>
            <tr className="border-t border-white/10 bg-white/[0.03]">
              <td className="py-1.5 pl-2 pr-3 font-medium text-slate-200">{page.label}</td>
              {ACTIONS.map((a) => {
                const secs = page.sections.filter((s) => s.actions.includes(a))
                if (secs.length === 0) return <td key={a} className="py-1.5 text-center"><span className="text-slate-700">-</span></td>
                const n = secs.filter((s) => can(perms, s.id, a)).length
                return (
                  <td key={a} className="py-1.5 text-center">
                    <TriCheckbox checked={n === secs.length} partial={n > 0} disabled={disabled}
                      onChange={() => onChange(setPagePerm(perms, page.id, a, n !== secs.length))}
                      label={`${page.label} ทั้งหน้า — ${ACTION_LABEL[a]}`} />
                  </td>
                )
              })}
            </tr>
            {page.sections.map((sec) => (
              <tr key={sec.id} className="border-t border-white/5">
                <td className="py-1 pl-6 pr-3 text-slate-400">{sec.label}</td>
                {ACTIONS.map((a) => (
                  <td key={a} className="py-1 text-center">
                    {sec.actions.includes(a) ? (
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 accent-indigo-500 disabled:opacity-40"
                        checked={can(perms, sec.id, a)}
                        disabled={disabled}
                        onChange={() => onChange(togglePerm(perms, sec.id, a))}
                        aria-label={`${page.label} / ${sec.label} — ${ACTION_LABEL[a]}`}
                      />
                    ) : <span className="text-slate-700">-</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  )
}

function PresetButtons({ onPick, disabled }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] text-slate-500">เติมให้:</span>
      {PRESETS.map((p) => <button key={p.id} className={btnNeutral} disabled={disabled} onClick={() => onPick(p.perms)}>{p.label}</button>)}
      <button className={btnNeutral} disabled={disabled} onClick={() => onPick([])}>ล้าง</button>
    </div>
  )
}

const roleBadge = (role) => (
  <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${role === 'owner' ? 'bg-indigo-500/15 text-indigo-300' : 'bg-white/5 text-slate-300'}`}>
    {role === 'owner' ? 'Owner' : 'Member'}
  </span>
)

const dateFmt = (iso) => new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
const dateTimeFmt = (iso) => new Date(iso).toLocaleString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })
// <input type="date"> ใช้ 'YYYY-MM-DD' (เวลาท้องถิ่น); สิทธิ์หมดอายุสิ้นวันนั้น (23:59:59 เวลาท้องถิ่น) ส่งเป็น ISO
const toDateInput = (iso) => (iso ? new Date(new Date(iso).getTime() - new Date(iso).getTimezoneOffset() * 60000).toISOString().slice(0, 10) : '')
const endOfDayIso = (dateStr) => new Date(`${dateStr}T23:59:59`).toISOString()
const todayInput = () => toDateInput(new Date().toISOString())

const badgeCls = 'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium'

// สถานะการเข้าใช้: ยังไม่มีบัญชี / รอยืนยัน(อีเมล/ตั้งรหัสผ่าน) / ยังไม่เคยเข้า / เข้าล่าสุด
function LoginStatus({ user }) {
  if (user.accountStatus === 'none') return <span className={`${badgeCls} bg-amber-500/15 text-amber-300`} title="ยังไม่มีบัญชีใน Supabase Auth — ต้องสมัครหรือสร้างบัญชีก่อนถึงจะ login ได้">ยังไม่มีบัญชี login</span>
  if (user.accountStatus === 'pending') return <span className={`${badgeCls} bg-amber-500/15 text-amber-300`} title="มีบัญชีแล้วแต่ยังไม่ได้กดลิงก์ยืนยันอีเมล/ตั้งรหัสผ่าน">รอยืนยันอีเมล</span>
  if (!user.lastSignInAt) return <span className={`${badgeCls} bg-white/5 text-slate-400`}>ยังไม่เคยเข้า</span>
  return <span className="shrink-0 text-[11px] text-slate-500">เข้าล่าสุด {dateTimeFmt(user.lastSignInAt)}</span>
}

// แถวผู้ใช้ 1 คน: เปิดดู/แก้ checkbox + วันหมดอายุ แล้วกด "บันทึก" (draft เก็บในแถว — ยังไม่ยิง API จนกดบันทึก)
function UserRow({ user, isSelf, busy, onSave, onDelete, onSendReset }) {
  const [open, setOpen] = useState(false)
  const [draftRole, setDraftRole] = useState(user.role)
  const [draftPerms, setDraftPerms] = useState(user.perms)
  const [draftExpires, setDraftExpires] = useState(toDateInput(user.expiresAt)) // '' = ไม่หมดอายุ
  const [confirmDelete, setConfirmDelete] = useState(false)

  const readOnly = user.locked || isSelf
  const isOwner = draftRole === 'owner'
  const expiresChanged = draftExpires !== toDateInput(user.expiresAt)
  const dirty = draftRole !== user.role || (!isOwner && !sameSet(draftPerms, user.perms)) || expiresChanged
  const summary = user.role === 'owner' ? 'ทุกสิทธิ์ + จัดการผู้ใช้' : `${user.perms.length}/${ALL_PERMS.length} สิทธิ์`

  return (
    <li className="py-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="min-w-0 flex-1 truncate text-sm text-slate-200">{user.email}</span>
        {isSelf && <span className="shrink-0 text-[10px] text-slate-500">คุณ</span>}
        {user.locked && <span className="shrink-0 text-[10px] text-slate-500">ล็อก (env)</span>}
        {roleBadge(user.role)}
        <span className="shrink-0 text-[11px] text-slate-500">{summary}</span>
        {user.expired && <span className={`${badgeCls} bg-rose-500/15 text-rose-300`}>หมดอายุแล้ว</span>}
        {user.expiresAt && !user.expired && <span className={`${badgeCls} bg-sky-500/15 text-sky-300`}>หมดอายุ {dateFmt(user.expiresAt)}</span>}
        <LoginStatus user={user} />
        <button className={btnNeutral} onClick={() => setOpen((v) => !v)}>{open ? 'ซ่อนสิทธิ์' : 'ดูสิทธิ์'}</button>
      </div>

      {open && (
        <div className="mt-3 space-y-3 rounded-xl border border-white/5 bg-white/[0.02] p-3">
          {readOnly && <p className="text-[11px] text-slate-500">{user.locked ? 'Owner ถาวรจาก env แก้ไม่ได้' : 'แก้สิทธิ์ของตัวเองไม่ได้'}</p>}
          {!readOnly && (
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input type="checkbox" className="h-3.5 w-3.5 accent-indigo-500" checked={isOwner} onChange={(e) => setDraftRole(e.target.checked ? 'owner' : 'member')} />
              Owner (ทำได้ทุกอย่างรวมจัดการผู้ใช้)
            </label>
          )}
          {!readOnly && (
            <label className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
              สิทธิ์หมดอายุวันที่
              <input type="date" value={draftExpires} min={todayInput()} onChange={(e) => setDraftExpires(e.target.value)} disabled={busy} className={`${inputCls} px-2 py-1 text-xs [color-scheme:dark]`} />
              {draftExpires && <button type="button" className={btnNeutral} onClick={() => setDraftExpires('')}>ไม่หมดอายุ</button>}
              <span className="text-slate-500">{draftExpires ? 'หมดสิทธิ์สิ้นวันนั้น' : 'ว่าง = ไม่หมดอายุ'}</span>
            </label>
          )}
          <PermMatrix perms={isOwner ? ALL_PERMS : draftPerms} onChange={setDraftPerms} disabled={readOnly || isOwner || busy} />
          {!readOnly && (
            <div className="flex flex-wrap items-center gap-2">
              {!isOwner && <PresetButtons onPick={setDraftPerms} disabled={busy} />}
              <span className="ml-auto flex flex-wrap items-center gap-2">
                <button className={btnNeutral} disabled={busy || user.accountStatus === 'none'} onClick={() => onSendReset(user)}
                  title={user.accountStatus === 'none' ? 'ยังไม่มีบัญชี login' : 'ส่งอีเมลลิงก์ตั้งรหัสผ่านใหม่ให้ผู้ใช้นี้'}>ส่งลิงก์รีเซ็ตรหัสผ่าน</button>
                {confirmDelete ? (<>
                  <button className={btnWarn} disabled={busy} onClick={() => onDelete(user)}>ยืนยันลบผู้ใช้</button>
                  <button className={btnNeutral} onClick={() => setConfirmDelete(false)}>ยกเลิก</button>
                </>) : (
                  <button className={btnNeutral} disabled={busy} onClick={() => setConfirmDelete(true)}>ลบผู้ใช้</button>
                )}
                <button className={btnOk} disabled={busy || !dirty}
                  onClick={() => onSave(user, { role: draftRole, perms: draftPerms, ...(expiresChanged ? { expiresAt: draftExpires ? endOfDayIso(draftExpires) : null } : {}) })}>บันทึก</button>
              </span>
            </div>
          )}
        </div>
      )}
    </li>
  )
}

const AUDIT_ACTION = { upsert: 'ตั้งสิทธิ์', delete: 'ลบผู้ใช้', send_reset: 'ส่งลิงก์รีเซ็ตรหัสผ่าน' }
const ACCOUNT_MODE_LABEL = { confirmed: 'สร้างบัญชีเลย', email: 'ยืนยันอีเมล', invite: 'เชิญทางอีเมล' }

// สรุปรายละเอียดของ 1 รายการประวัติเป็นข้อความสั้น (ไม่แสดงรายการสิทธิ์ทั้งหมด — แค่จำนวน)
function auditSummary(e) {
  const d = e.detail || {}
  if (e.action !== 'upsert') return ''
  const parts = [d.role === 'owner' ? 'Owner' : `Member ${(d.perms || []).length} สิทธิ์`]
  if (d.accountMode) parts.push(ACCOUNT_MODE_LABEL[d.accountMode] || d.accountMode)
  if ('expiresAt' in d) parts.push(d.expiresAt ? `หมดอายุ ${dateFmt(d.expiresAt)}` : 'ไม่หมดอายุ')
  return parts.join(' · ')
}

export default function UsersView({ session, selfEmail, scrollTo }) {
  const [users, setUsers] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busyEmail, setBusyEmail] = useState(null) // อีเมลที่กำลังบันทึก / 'add' = กำลังเพิ่ม
  const [newEmail, setNewEmail] = useState('')
  const [newPerms, setNewPerms] = useState(PRESETS[0].perms)
  const [newPassword, setNewPassword] = useState('') // ใช้เฉพาะโหมด confirmed/email
  const [showPassword, setShowPassword] = useState(false)
  const [newExpires, setNewExpires] = useState('') // วันหมดอายุของสิทธิ์ที่เพิ่ม ('' = ไม่หมดอายุ)
  const [audit, setAudit] = useState(null) // ประวัติการเปลี่ยนสิทธิ์ (null = ยังโหลดไม่เสร็จ)
  const [accountMode, setAccountMode] = useState('none') // 'none' = เฉพาะสิทธิ์ | 'confirmed' = สร้างเลย | 'email' = ยืนยันอีเมล | 'invite' = เชิญให้ตั้งรหัสผ่านเอง

  const token = session?.access_token
  const headers = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token])

  useEffect(() => {
    if (!scrollTo?.id) return
    document.getElementById(scrollTo.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [scrollTo])

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await fetch('/api/users', { headers })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || `โหลดรายชื่อไม่สำเร็จ (${res.status})`)
      setUsers(body.users)
    } catch (err) {
      setError(err.message)
    }
  }, [headers])
  const loadAudit = useCallback(async () => {
    try {
      const res = await fetch('/api/users?audit=1&limit=50', { headers })
      const body = await res.json().catch(() => ({}))
      setAudit(res.ok ? body.entries : [])
    } catch {
      setAudit([])
    }
  }, [headers])
  useEffect(() => { load(); loadAudit() }, [load, loadAudit])

  // เรียก POST /api/users แล้วโหลดรายชื่อใหม่ — คืน true เมื่อสำเร็จ; error/notice แสดงที่ banner บนสุด
  const callApi = async (busyKey, payload, doneMsg) => {
    setBusyEmail(busyKey); setError(''); setNotice('')
    try {
      const res = await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(payload) })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || `บันทึกไม่สำเร็จ (${res.status})`)
      setNotice(doneMsg)
      await Promise.all([load(), loadAudit()])
      return true
    } catch (err) {
      setError(err.message)
      return false
    } finally {
      setBusyEmail(null)
    }
  }

  const addUser = async () => {
    const email = newEmail.trim().toLowerCase()
    if (!email) return
    const needsPassword = accountMode === 'confirmed' || accountMode === 'email'
    if (needsPassword && newPassword.length < MIN_PASSWORD) { setError(`รหัสผ่านต้องยาวอย่างน้อย ${MIN_PASSWORD} ตัวอักษร`); return }
    const doneMsg = {
      none: `เพิ่มสิทธิ์ให้ ${email} แล้ว`,
      confirmed: `สร้างบัญชี ${email} พร้อมกำหนดสิทธิ์แล้ว ใช้ได้ทันที — แจ้งรหัสผ่านให้ผู้ใช้เอง (ระบบไม่เก็บและแสดงซ้ำไม่ได้)`,
      email: `สร้างบัญชี ${email} แล้ว — ระบบส่งอีเมลยืนยันให้ผู้ใช้ กดลิงก์แล้วจะไปหน้าตั้งรหัสผ่าน (แจ้งรหัสผ่านเริ่มต้นให้ผู้ใช้เอง)`,
      invite: `ส่งอีเมลเชิญไปที่ ${email} แล้ว — ผู้ใช้กดลิงก์เพื่อตั้งรหัสผ่านเอง`,
    }[accountMode]
    const payload = { action: 'upsert', email, role: 'member', perms: newPerms, ...(accountMode !== 'none' ? { accountMode } : {}), ...(needsPassword ? { password: newPassword } : {}), ...(newExpires ? { expiresAt: endOfDayIso(newExpires) } : {}) }
    if (await callApi('add', payload, doneMsg)) { setNewEmail(''); setNewPassword(''); setShowPassword(false); setAccountMode('none'); setNewExpires('') }
  }
  const saveUser = (u, change) => callApi(u.email, { action: 'upsert', email: u.email, ...change }, `บันทึกสิทธิ์ ${u.email} แล้ว`)
  const sendReset = (u) => callApi(u.email, { action: 'sendReset', email: u.email }, `ส่งลิงก์รีเซ็ตรหัสผ่านไปที่ ${u.email} แล้ว`)
  const deleteUser = (u) => callApi(u.email, { action: 'delete', email: u.email }, `ลบ ${u.email} แล้ว`)

  return (
    <div className="space-y-6">
      {(error || notice) && (
        <div className={`rounded-xl border px-4 py-2.5 text-sm ${error ? 'border-rose-900/50 bg-rose-950/40 text-rose-300' : 'border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-300'}`}>
          {error || notice}
        </div>
      )}

      <Panel id="users-add" title="เพิ่มผู้ใช้" hint="เลือกวิธีให้ผู้ใช้ได้บัญชี login แล้วติ๊กสิทธิ์ — มีผลทันทีที่ผู้ใช้โหลดหน้าใหม่">
        <div className="space-y-3">
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="email@example.com"
            autoComplete="off"
            className={`${inputCls} w-full px-3 py-1.5 text-xs sm:w-64`}
          />
          <div className="space-y-1.5 text-xs text-slate-300">
            {ACCOUNT_MODES.map((o) => (
              <label key={o.id} className="flex cursor-pointer items-start gap-2">
                <input type="radio" name="account-mode" className="mt-0.5 accent-indigo-500" checked={accountMode === o.id} onChange={() => setAccountMode(o.id)} />
                <span><span className="font-medium">{o.label}</span> <span className="text-slate-500">— {o.desc}</span></span>
              </label>
            ))}
          </div>
          {(accountMode === 'confirmed' || accountMode === 'email') && (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addUser() }}
                placeholder={`รหัสผ่าน (อย่างน้อย ${MIN_PASSWORD} ตัว)`}
                autoComplete="new-password"
                className={`${inputCls} w-full px-3 py-1.5 text-xs sm:w-64`}
              />
              <button type="button" className={btnNeutral} onClick={() => { setNewPassword(generatePassword()); setShowPassword(true) }}>สุ่มรหัสผ่าน</button>
              <button type="button" className={btnNeutral} onClick={() => setShowPassword((v) => !v)}>{showPassword ? 'ซ่อน' : 'แสดง'}</button>
            </div>
          )}
          <label className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
            สิทธิ์หมดอายุวันที่ <span className="text-slate-500">(เว้นว่าง = ไม่หมดอายุ)</span>
            <input type="date" value={newExpires} min={todayInput()} onChange={(e) => setNewExpires(e.target.value)} disabled={busyEmail === 'add'} className={`${inputCls} px-2 py-1 text-xs [color-scheme:dark]`} />
          </label>
          <PermMatrix perms={newPerms} onChange={setNewPerms} disabled={busyEmail === 'add'} />
          <div className="flex flex-wrap items-center gap-2">
            <PresetButtons onPick={setNewPerms} disabled={busyEmail === 'add'} />
            <button className={`${btnOk} ml-auto`} disabled={busyEmail === 'add' || !newEmail.trim() || newPerms.length === 0} onClick={addUser}>{accountMode === 'none' ? 'เพิ่มสิทธิ์' : accountMode === 'invite' ? 'ส่งอีเมลเชิญ + เพิ่มสิทธิ์' : 'สร้างบัญชี + เพิ่มสิทธิ์'}</button>
          </div>
        </div>
      </Panel>

      <Panel id="users-list" title={`ผู้ใช้ทั้งหมด${users ? ` (${users.length})` : ''}`} hint="กด “ดูสิทธิ์” เพื่อดู/แก้ checkbox แล้วกดบันทึก — Owner จาก env และตัวคุณเองแก้ไม่ได้">
        {!users ? (error ? null : <Skeleton h="h-24" />) : users.length === 0 ? <EmptyNote>ยังไม่มีผู้ใช้</EmptyNote> : (
          <ul className="divide-y divide-white/5">
            {users.map((u) => (
              // key รวม role+perms: โหลดรายชื่อใหม่หลังบันทึกแล้ว draft ในแถวรีเซ็ตตามค่าที่บันทึกจริง
              <UserRow key={`${u.email}|${u.role}|${u.perms.join(',')}|${u.expiresAt || ''}`} user={u} isSelf={u.email === selfEmail} busy={busyEmail === u.email} onSave={saveUser} onDelete={deleteUser} onSendReset={sendReset} />
            ))}
          </ul>
        )}
      </Panel>

      <Panel id="users-audit" title="ประวัติการเปลี่ยนแปลง" hint="ใครตั้ง/ลบสิทธิ์หรือส่งลิงก์รีเซ็ตรหัสผ่านให้ใคร (50 รายการล่าสุด — ไม่เก็บรหัสผ่าน)">
        {!audit ? <Skeleton h="h-24" /> : audit.length === 0 ? <EmptyNote>ยังไม่มีประวัติ</EmptyNote> : (
          <ul className="divide-y divide-white/5">
            {audit.map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2 text-xs">
                <span className="w-32 shrink-0 text-slate-500">{dateTimeFmt(e.created_at)}</span>
                <span className="min-w-0 flex-1 text-slate-300">
                  <span className="text-slate-400">{e.actor}</span> · {AUDIT_ACTION[e.action] || e.action} · <span className="font-medium text-slate-200">{e.target}</span>
                  {auditSummary(e) && <span className="text-slate-500"> — {auditSummary(e)}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}
