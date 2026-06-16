import { createClient } from '@supabase/supabase-js'

// Supabase client for dashboard auth. ค่ามาจาก env (.env.local / Vercel env)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

// ถ้ายังไม่ตั้ง env จะได้ client ที่ใช้ไม่ได้ — Dashboard จะเช็ค isSupabaseConfigured ก่อน
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null
