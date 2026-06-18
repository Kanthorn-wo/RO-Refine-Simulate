import { createClient } from '@supabase/supabase-js';
import { log } from './logger.js';

// ใช้ service_role key (เขียนข้าม RLS ได้) — เก็บใน GitHub Secret เท่านั้น ห้าม commit
// ถ้าไม่มี env (เช่นรัน local เพื่อ smoke test) → คืน null แล้ว persist จะข้ามอย่างนุ่มนวล
let cached;

export function getSupabase() {
  if (cached !== undefined) return cached;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    log.warn('supabase: ไม่พบ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — ข้ามการบันทึกลง DB');
    cached = null;
    return cached;
  }

  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
