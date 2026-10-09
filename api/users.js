// Vercel Serverless: ผู้ใช้ dashboard + role (ตาราง dashboard_users) — จัดการผ่าน dashboard แท็บ "ผู้ใช้"
//   GET ?me=1  → ผู้ใช้ที่ login: { email, role, perms } (role = null ถ้าไม่มีสิทธิ์) — ใช้ตัดสินใจแสดง/ซ่อน UI
//   GET        → สิทธิ์ 'users:manage' (owner): { users: [{ email, role, perms, locked, expiresAt, expired, accountStatus, lastSignInAt }] } locked = owner จาก env แก้ไม่ได้
//   GET ?audit=1&limit= → 'users:manage': { entries: [{ id, created_at, actor, action, target, detail }] } ประวัติการเปลี่ยนสิทธิ์ (ตาราง dashboard_audit_log)
//   POST       → 'users:manage': { action: 'upsert', email, role: 'owner'|'member', perms: ['items-all:view', ...], accountMode?, password?, expiresAt? } | { action: 'delete', email } | { action: 'sendReset', email }
//   upsert + accountMode = สร้างบัญชี login แล้วกำหนดสิทธิ์: 'confirmed' (+password; admin API ยืนยันอีเมลให้เลย ใช้ได้ทันที)
//     | 'email' (+password; signup ปกติ: Supabase ส่งอีเมลให้ผู้ใช้กดยืนยัน ลิงก์พาไป /create-password — ถ้าโปรเจกต์ปิด confirm email จะใช้ได้ทันที)
//     | 'invite' (ไม่ต้องมี password; Supabase ส่งอีเมลเชิญ ผู้ใช้กดลิงก์ไปหน้า /create-password ตั้งรหัสผ่านเอง)
//   ไม่ส่ง accountMode = กำหนดสิทธิ์ให้บัญชีที่มีอยู่แล้วอย่างเดียว
//   expiresAt = ISO วันหมดอายุของสิทธิ์ (ว่าง/null = ไม่หมดอายุ; ไม่ส่ง key = ไม่แตะค่าเดิม) | sendReset = ส่งลิงก์รีเซ็ตรหัสผ่านไปที่อีเมลนั้น (→ /create-password)
//   ทุก upsert/delete/sendReset บันทึกลง dashboard_audit_log
//   password ไม่ถูกเก็บ/ส่งกลับ/log ที่ไหนเลย (ส่งตรงไปยัง Supabase เท่านั้น)
//   perms ของ owner ไม่เก็บ (owner ได้ทุกสิทธิ์เสมอ); perms ของ member ผ่าน normalizePerms (edit/delete บังคับมี view)
// ข้อจำกัด: แก้/ลบอีเมลตัวเองไม่ได้ และแก้อีเมล owner จาก env ไม่ได้ (กันล็อกตัวเองออก)
// ENV: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, DASHBOARD_ALLOWED_EMAILS

import { getUser, getAccess, envOwnerEmails, normalizePerms, ALL_PERMS, ROLES, USERS_PERM } from './_lib/auth.js'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_EMAIL = 254
const ACCOUNT_MODES = ['confirmed', 'email', 'invite']
const MIN_PASSWORD = 8
const MAX_PASSWORD = 72 // bcrypt ตัดที่ 72 byte

function sbFetch(pathAndQuery, init) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  return fetch(`${process.env.SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(init && init.headers),
    },
  })
}

// URL หน้าตั้งรหัสผ่านที่ลิงก์ในอีเมล (เชิญ/ยืนยันอีเมล) พามา — ใช้ origin ของคำขอนี้ (ต้องอยู่ใน Redirect URLs ของ Supabase ไม่งั้น Supabase ใช้ Site URL แทน)
function createPasswordUrl(req) {
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '')
  if (!/^[\w.-]+(:\d+)?$/.test(host)) return ''
  const proto = req.headers['x-forwarded-proto'] || (host.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${host}/create-password`
}

// สร้างบัญชี Supabase Auth — คืน true | 'exists' (มีบัญชีแล้ว) | 'invalid_email' | 'rate' (ส่งอีเมลถี่เกิน) | 'smtp' (SMTP เริ่มต้นของ Supabase ส่งถึงอีเมลนี้ไม่ได้) | false (ล้มเหลวอื่น ๆ)
//   mode 'confirmed' = admin API (email_confirm: true) | 'email' = signup ปกติ (Supabase ส่งอีเมลยืนยัน) | 'invite' = admin invite (อีเมลเชิญ ไม่มีรหัสผ่าน)
async function createAuthUser({ email, password, mode, redirectTo }) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const adminHeaders = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' }
  let path, headers, payload
  if (mode === 'email') {
    path = `signup${redirectTo ? `?redirect_to=${encodeURIComponent(redirectTo)}` : ''}`
    headers = { apikey: process.env.SUPABASE_ANON_KEY || '', 'Content-Type': 'application/json' }
    payload = { email, password }
  } else if (mode === 'invite') {
    path = `invite${redirectTo ? `?redirect_to=${encodeURIComponent(redirectTo)}` : ''}`
    headers = adminHeaders
    payload = { email }
  } else {
    path = 'admin/users'
    headers = adminHeaders
    payload = { email, password, email_confirm: true }
  }
  const r = await fetch(`${process.env.SUPABASE_URL}/auth/v1/${path}`, { method: 'POST', headers, body: JSON.stringify(payload) })
  const out = await r.json().catch(() => ({}))
  if (r.ok) {
    // signup ของอีเมลที่มีบัญชีแล้วไม่ error (กันเดาอีเมล) แต่คืน user ที่ identities ว่าง
    const u = out.user || out
    return mode === 'email' && Array.isArray(u.identities) && u.identities.length === 0 ? 'exists' : true
  }
  const exists = out.error_code === 'email_exists' || out.error_code === 'user_already_exists' || (r.status === 422 && /already|registered|exists/i.test(out.msg || out.message || ''))
  if (exists) return 'exists'
  const code = out.error_code || ''
  if (code === 'email_address_invalid') return 'invalid_email'
  if (code === 'email_address_not_authorized') return 'smtp'
  if (r.status === 429 || code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit') return 'rate'
  return false
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string') { try { return JSON.parse(req.body) } catch { return {} } }
  return await new Promise((resolve) => {
    let d = ''
    req.on('data', (c) => (d += c))
    req.on('end', () => { try { resolve(JSON.parse(d || '{}')) } catch { resolve({}) } })
    req.on('error', () => resolve({}))
  })
}

// อ่านสถานะบัญชี login ทั้งหมดจาก Supabase Auth (admin API) → Map อีเมล → { lastSignInAt, confirmed } — ล้มเหลว = Map ว่าง (UI แสดง "-")
async function listAuthAccounts() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const map = new Map()
  try {
    for (let page = 1; page <= 10; page++) {
      const r = await fetch(`${process.env.SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=1000`, { headers: { apikey: key, Authorization: `Bearer ${key}` } })
      if (!r.ok) break
      const users = (await r.json()).users || []
      for (const u of users) {
        if (u.email) map.set(u.email.toLowerCase(), { lastSignInAt: u.last_sign_in_at || null, confirmed: !!(u.email_confirmed_at || u.confirmed_at) })
      }
      if (users.length < 1000) break
    }
  } catch { /* ใช้ Map เท่าที่อ่านได้ */ }
  return map
}

// ส่งลิงก์รีเซ็ตรหัสผ่าน (Supabase ส่งอีเมลเอง) — Supabase ตอบ 200 แม้ไม่มีบัญชี (กันเดาอีเมล) คืน true | 'rate' (ส่งถี่เกิน) | false
async function sendRecoveryEmail(email, redirectTo) {
  const r = await fetch(`${process.env.SUPABASE_URL}/auth/v1/recover${redirectTo ? `?redirect_to=${encodeURIComponent(redirectTo)}` : ''}`, {
    method: 'POST',
    headers: { apikey: process.env.SUPABASE_ANON_KEY || '', 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  if (r.ok) return true
  return r.status === 429 ? 'rate' : false
}

// บันทึกประวัติการเปลี่ยนสิทธิ์ — best effort (เขียนไม่ได้ก็ไม่ทำให้การกระทำหลักล้ม); ห้ามใส่รหัสผ่าน/ข้อมูลลับใน detail
async function writeAudit(actor, action, target, detail) {
  try {
    await sbFetch('dashboard_audit_log', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ actor, action, target, detail }) })
  } catch { /* ignore */ }
}

// วันหมดอายุจาก body: ไม่มี key = undefined (ไม่แตะค่าเดิม) | ว่าง/null = null (ไม่หมดอายุ) | วันที่ในอนาคต (ภายใน 10 ปี) = ISO | ผิดรูปแบบ/อดีต = 'invalid'
function parseExpiresAt(body) {
  if (!('expiresAt' in body)) return undefined
  if (body.expiresAt === null || body.expiresAt === '') return null
  const t = new Date(String(body.expiresAt)).getTime()
  const now = Date.now()
  if (!Number.isFinite(t) || t <= now || t > now + 10 * 365 * 24 * 3600 * 1000) return 'invalid'
  return new Date(t).toISOString()
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' })

  const user = await getUser(req)
  if (!user) return res.status(401).json({ error: 'unauthorized' })
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'supabase env not set' })
  }

  const { role, perms } = await getAccess(user)
  const url = new URL(req.url || '/', 'http://localhost')
  res.setHeader('cache-control', 'no-store')

  if (req.method === 'GET' && url.searchParams.get('me') === '1') {
    return res.status(200).json({ email: user.email || '', role, perms })
  }

  if (!perms.includes(USERS_PERM)) return res.status(403).json({ error: 'ไม่มีสิทธิ์เข้าถึง (เฉพาะเจ้าของเว็บ)' })
  const selfEmail = (user.email || '').toLowerCase()
  const lockedEmails = envOwnerEmails()

  if (req.method === 'GET' && url.searchParams.get('audit') === '1') {
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '50', 10) || 50, 1), 200)
    try {
      const r = await sbFetch(`dashboard_audit_log?select=id,created_at,actor,action,target,detail&order=created_at.desc,id.desc&limit=${limit}`)
      if (!r.ok) return res.status(502).json({ error: 'read failed' })
      return res.status(200).json({ entries: await r.json() })
    } catch {
      return res.status(502).json({ error: 'read failed' })
    }
  }

  if (req.method === 'GET') {
    try {
      const [r, accounts] = await Promise.all([
        sbFetch('dashboard_users?select=email,role,perms,expires_at,created_at&order=created_at.asc&limit=500'),
        listAuthAccounts(),
      ])
      if (!r.ok) return res.status(502).json({ error: 'read failed' })
      const rows = await r.json()
      // accountStatus: 'none' = ยังไม่มีบัญชี login | 'pending' = มีบัญชีแต่ยังไม่ยืนยันอีเมล/ยังไม่ตั้งรหัสผ่าน | 'active' = ยืนยันแล้ว; lastSignInAt = null = ยังไม่เคยเข้า
      const login = (email) => {
        const a = accounts.get(email)
        return { accountStatus: !a ? 'none' : a.confirmed ? 'active' : 'pending', lastSignInAt: a?.lastSignInAt || null }
      }
      const fromEnv = lockedEmails.map((email) => ({ email, role: 'owner', perms: ALL_PERMS, locked: true, expiresAt: null, ...login(email) }))
      const fromTable = rows
        .filter((x) => !lockedEmails.includes(x.email))
        .map((x) => ({
          email: x.email, role: x.role, perms: x.role === 'owner' ? ALL_PERMS : normalizePerms(x.perms), locked: false,
          expiresAt: x.expires_at || null, expired: !!(x.expires_at && new Date(x.expires_at).getTime() <= Date.now()), ...login(x.email),
        }))
      return res.status(200).json({ users: [...fromEnv, ...fromTable] })
    } catch {
      return res.status(502).json({ error: 'read failed' })
    }
  }

  const body = await readBody(req)
  const action = String(body.action || '')
  const email = String(body.email || '').trim().toLowerCase()
  if (!email || email.length > MAX_EMAIL || !EMAIL_PATTERN.test(email)) return res.status(400).json({ error: 'อีเมลไม่ถูกต้อง' })
  if (email === selfEmail) return res.status(400).json({ error: 'แก้ไขสิทธิ์ของตัวเองไม่ได้' })
  if (lockedEmails.includes(email)) return res.status(400).json({ error: 'อีเมลนี้เป็น owner ถาวร (ตั้งไว้ใน env) แก้ไม่ได้' })

  try {
    if (action === 'upsert') {
      const newRole = String(body.role || '')
      if (!ROLES.includes(newRole)) return res.status(400).json({ error: 'role ไม่ถูกต้อง' })
      const newPerms = newRole === 'owner' ? [] : normalizePerms(body.perms)
      const expiresAt = parseExpiresAt(body)
      if (expiresAt === 'invalid') return res.status(400).json({ error: 'วันหมดอายุต้องเป็นวันในอนาคต (ไม่เกิน 10 ปี)' })
      const accountMode = ACCOUNT_MODES.includes(body.accountMode) ? body.accountMode : null
      if (accountMode) {
        const password = typeof body.password === 'string' ? body.password : ''
        if (accountMode !== 'invite' && (password.length < MIN_PASSWORD || password.length > MAX_PASSWORD)) {
          return res.status(400).json({ error: `รหัสผ่านต้องยาว ${MIN_PASSWORD}-${MAX_PASSWORD} ตัวอักษร` })
        }
        const created = await createAuthUser({ email, password, mode: accountMode, redirectTo: createPasswordUrl(req) })
        if (created === 'exists') return res.status(409).json({ error: 'อีเมลนี้มีบัญชี login อยู่แล้ว — เลือก "เฉพาะสิทธิ์" เพื่อกำหนดสิทธิ์อย่างเดียว' })
        if (created === 'invalid_email') return res.status(400).json({ error: 'Supabase ไม่ยอมรับอีเมลนี้ (รูปแบบ/โดเมนไม่ถูกต้อง)' })
        if (created === 'rate') return res.status(429).json({ error: 'ส่งอีเมลถี่เกินไป รอสักครู่แล้วลองใหม่' })
        if (created === 'smtp') return res.status(502).json({ error: 'อีเมลนี้ไม่อยู่ในรายชื่อที่ Supabase ส่งให้ได้ (SMTP เริ่มต้นส่งได้เฉพาะสมาชิกทีม) — ตั้ง Custom SMTP ใน Supabase หรือใช้ "สร้างบัญชีเลย"' })
        if (!created) return res.status(502).json({ error: 'สร้างบัญชี/ส่งอีเมลไม่สำเร็จ' })
      }
      // expires_at ใส่เฉพาะเมื่อ client ส่งมา (undefined = ไม่แตะค่าเดิม) — upsert แบบ merge จึงไม่ล้างวันหมดอายุที่ตั้งไว้
      const r = await sbFetch('dashboard_users?on_conflict=email', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify({ email, role: newRole, perms: newPerms, ...(expiresAt !== undefined ? { expires_at: expiresAt } : {}), updated_at: new Date().toISOString() }),
      })
      if (!r.ok) {
        return res.status(502).json({ error: accountMode ? 'สร้างบัญชี/ส่งอีเมลแล้ว แต่บันทึกสิทธิ์ไม่สำเร็จ — เพิ่มอีกครั้งโดยเลือก "เฉพาะสิทธิ์"' : 'write failed' })
      }
      await writeAudit(selfEmail, 'upsert', email, { role: newRole, perms: newPerms, accountMode, ...(expiresAt !== undefined ? { expiresAt } : {}) })
      return res.status(200).json({ ok: true, email, role: newRole, perms: newPerms, accountMode })
    }
    if (action === 'delete') {
      const r = await sbFetch(`dashboard_users?email=eq.${encodeURIComponent(email)}`, { method: 'DELETE' })
      if (!r.ok) return res.status(502).json({ error: 'write failed' })
      await writeAudit(selfEmail, 'delete', email, {})
      return res.status(200).json({ ok: true, email })
    }
    if (action === 'sendReset') {
      const sent = await sendRecoveryEmail(email, createPasswordUrl(req))
      if (sent === 'rate') return res.status(429).json({ error: 'ส่งอีเมลถี่เกินไป รอสักครู่แล้วลองใหม่' })
      if (!sent) return res.status(502).json({ error: 'ส่งอีเมลรีเซ็ตรหัสผ่านไม่สำเร็จ' })
      await writeAudit(selfEmail, 'send_reset', email, {})
      return res.status(200).json({ ok: true, email })
    }
    return res.status(400).json({ error: 'invalid action' })
  } catch {
    return res.status(502).json({ error: 'write failed' })
  }
}
