-- ════════════════════════════════════════════════════════════════
-- usage_events: เลิกตัดเหลือ 200 แถว → เก็บทุกแถว (ดูย้อนหลังได้หมด)
-- รันใน Supabase SQL Editor 1 ครั้ง (idempotent)
--
-- ก่อนหน้านี้ trigger trg_trim_usage_events ลบทุกแถวที่เก่ากว่า 200 แถวล่าสุดหลังทุก insert
-- ตอนนี้ dashboard โหลดทีละหน้าเอง (?events=200&before=<id>) และ modal รายคนกรอง ?vid= → ไม่ต้องตัดแล้ว
-- ขนาด: 1 แถว ~100–300 bytes (meta ของ Auto ใหญ่สุด ~20KB เมื่อมี steps 1,000 ครั้ง) — ไกลจาก quota ฟรี 500MB
-- ════════════════════════════════════════════════════════════════

drop trigger if exists trg_trim_usage_events on public.usage_events;
drop function if exists public.trim_usage_events();

-- modal กิจกรรมรายคนกรอง vid + เรียงล่าสุดก่อน
create index if not exists usage_events_vid_idx on public.usage_events (vid, created_at desc);
