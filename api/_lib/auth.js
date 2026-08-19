// ตรวจสอบสิทธิ์ owner (Supabase auth token + email allowlist) — ใช้ร่วมกันทุก endpoint ที่ต้อง owner-only
// (ก่อนหน้านี้ก็อปสองฟังก์ชันนี้แยกไว้ในแต่ละไฟล์ api/*.js — ยังไม่เคย drift แต่รวมไว้ที่เดียวกันตัวเดียวชัวร์กว่า)
// ชื่อไฟล์ขึ้นต้น _ กัน Vercel เอาไปทำเป็น route (เฉพาะ api/*.js ระดับบนสุดถึงจะกลายเป็น endpoint)
export async function getUser(req) {
  const auth = req.headers.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token || !process.env.SUPABASE_URL) return null
  try {
    const r = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: process.env.SUPABASE_ANON_KEY || '' },
    })
    if (!r.ok) return null
    return await r.json()
  } catch {
    return null
  }
}

// เฉพาะอีเมลเจ้าของใน DASHBOARD_ALLOWED_EMAILS เท่านั้น — ไม่ตั้ง env = ปฏิเสธทุกคน (fail closed)
export function isOwner(user) {
  const allow = (process.env.DASHBOARD_ALLOWED_EMAILS || '')
    .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
  const email = ((user && user.email) || '').toLowerCase()
  return allow.length > 0 && !!email && allow.includes(email)
}
