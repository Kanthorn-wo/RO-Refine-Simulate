-- ──────────────────────────────────────────────────────────────────────────
-- Fix: trim_usage_events() ไม่มี revoke execute เหมือน RPC อื่นในไฟล์เดียวกัน
--   (bump_counter/bump_daily/record_visit ถูก revoke จาก public/anon/authenticated
--   หมดแล้ว แต่ trigger function นี้ตกหล่น — Postgres grant EXECUTE ให้ PUBLIC โดย
--   default ตอนสร้าง function ทำให้ใครก็เรียก /rest/v1/rpc/trim_usage_events ได้ตรง ๆ)
--   ผลกระทบจริงต่ำ (RLS ไม่มี policy บน usage_events อยู่แล้ว DELETE ข้างในน่าจะโดนบล็อก
--   สำหรับ non-service_role อยู่แล้ว) แต่ปิดไว้เป็น defense-in-depth ให้ตรงกับ pattern เดิม
--
-- รันใน Supabase SQL editor ครั้งเดียว (idempotent — รันซ้ำได้)
-- ──────────────────────────────────────────────────────────────────────────

revoke execute on function public.trim_usage_events() from public, anon, authenticated;
grant  execute on function public.trim_usage_events() to service_role;
