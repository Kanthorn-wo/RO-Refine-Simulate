-- ──────────────────────────────────────────────────────────────────────────
-- Security fix: monitor_daily_uptime / monitor_lighthouse_trend leak data to anon key
--   ตาราง monitor_page_results/monitor_lighthouse_results มี RLS เปิดแต่ไม่มี policy
--   (ตั้งใจให้ service_role เท่านั้นที่อ่านได้) แต่ 2 view ที่สร้างไว้ครอบตารางนี้
--   ไม่มี security_invoker เลยรัน query ในสิทธิ์ "เจ้าของ view" แทนที่จะเป็นสิทธิ์ผู้เรียก
--   ทำให้ RLS ของตารางข้างใต้ถูกข้ามไปทั้งหมด — ยืนยันแล้วว่า anon key อ่านได้จริง
--   (curl ตรงด้วย anon key คืนข้อมูล uptime/lighthouse จริงกลับมา)
--
-- แก้ 2 ชั้น: (1) security_invoker=true ให้ view เคารพ RLS ของผู้เรียกจริง
--            (2) revoke/grant explicit เป็น defense-in-depth เผื่อ Postgres เก่ากว่า 15
--            (ไม่กระทบ api/monitor.js เพราะใช้ SUPABASE_SERVICE_ROLE_KEY ซึ่ง bypass RLS อยู่แล้วเสมอ)
--
-- รันใน Supabase SQL editor ครั้งเดียว (idempotent — รันซ้ำได้)
-- ──────────────────────────────────────────────────────────────────────────

alter view public.monitor_daily_uptime set (security_invoker = true);
alter view public.monitor_lighthouse_trend set (security_invoker = true);

revoke all on public.monitor_daily_uptime from public, anon, authenticated;
revoke all on public.monitor_lighthouse_trend from public, anon, authenticated;
grant select on public.monitor_daily_uptime to service_role;
grant select on public.monitor_lighthouse_trend to service_role;
