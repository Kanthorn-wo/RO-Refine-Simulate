-- ──────────────────────────────────────────────────────────────────────────
-- สถิติการตัดสินใจเรื่องคุกกี้ต่อ visitor (ยอมรับ / ปฏิเสธ / ยังไม่ตอบ = null)
-- ใช้ตอบว่า "GA4 เห็นผู้เข้าชมกี่คน" — GA นับเฉพาะคนที่ยอมรับ (Consent Mode v2 ใน index.html)
--
-- เขียนผ่าน api/stats.js POST { consent, vid }: ตอนกดใน cookie bar + แนบไปกับ visit ping รายวัน
-- (คนที่ตอบไว้ก่อนวันรันไฟล์นี้ จะถูกบันทึกตอนกลับมาเข้าเว็บครั้งถัดไป)
--
-- รันใน Supabase SQL editor ครั้งเดียว (idempotent — รันซ้ำได้) แล้วรัน overview-stats.sql (ส่วน overview_stats) ใหม่
-- ──────────────────────────────────────────────────────────────────────────

alter table public.usage_visitors
  add column if not exists consent    text check (consent in ('accepted', 'rejected')),
  add column if not exists consent_at timestamptz;

-- อัปเดตเฉพาะ visitor ที่มีอยู่แล้ว (สร้างแถวผ่าน record_visit เท่านั้น) และเฉพาะตอนค่าเปลี่ยน
create or replace function public.set_visitor_consent(p_vid text, p_consent text)
returns void language sql as $$
  update public.usage_visitors
  set consent = p_consent, consent_at = now()
  where vid = p_vid
    and p_consent in ('accepted', 'rejected')
    and consent is distinct from p_consent;
$$;
revoke execute on function public.set_visitor_consent(text, text) from public, anon, authenticated;
grant  execute on function public.set_visitor_consent(text, text) to service_role;
