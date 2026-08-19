-- ──────────────────────────────────────────────────────────────────────────
-- Migration: ยกเลิก limit ของ refine_log (เดิม trg_trim_refine_log ตัดเหลือ 2000 แถวล่าสุด
--   รวมทุกคน — ทำให้ log เก่ากว่านั้นหลุดหายไปเรื่อย ๆ) ตอนนี้เก็บทุกแถวไว้ตลอดไป ไม่มี limit แล้ว
-- รันใน Supabase SQL editor ครั้งเดียว (idempotent — รันซ้ำได้ ถ้าไม่มี trigger/function อยู่แล้วก็แค่ไม่ทำอะไร)
-- ──────────────────────────────────────────────────────────────────────────

drop trigger if exists trg_trim_refine_log on public.refine_log;
drop function if exists public.trim_refine_log();

-- หมายเหตุ:
-- - refine_breakdown/refine_item_stats/refine_daily (ตัวสรุป all-time) ไม่เคยมี limit อยู่แล้ว ไม่กระทบ
-- - refine_log จะโตขึ้นเรื่อย ๆ ไม่มีเพดาน — ตอนนี้ (~7,700+ แถว) ไม่มีปัญหา แต่ระยะยาวถ้าโตถึงหลักแสน/ล้านแถว
--   endpoint api/refine.js ใช้ Prefer: count=exact (นับ exact ทุกครั้ง) อาจช้าลงได้ ค่อยพิจารณาตัดใหม่ตอนนั้น
