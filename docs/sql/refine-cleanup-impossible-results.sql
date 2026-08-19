-- ──────────────────────────────────────────────────────────────────────────
-- Cleanup: ลบผลลัพธ์ที่เป็นไปไม่ได้ตามกติกาปัจจุบัน ค้างอยู่ใน refine_breakdown (dim='level_result')
--   ที่มา: ข้อมูลเก่าก่อนแก้ตาราง rate ให้ตรง iROWiki (commit fb4506a / f022452, ~2026-06-19)
--   ตอนนั้น rate ที่ระดับต่ำยังไม่ใช่ 100% เลยมี fail/drop/lost เกิดขึ้นได้จริงตอนนั้น
--   พอแก้ตาราง rate แล้ว ค่าพวกนี้ผิดกติกาปัจจุบัน (เกิดซ้ำไม่ได้อีกแล้ว) แต่ยังค้างใน
--   all-time aggregate (refine_breakdown ไม่มีวันหลุดคิวเหมือน refine_log)
--
-- เกณฑ์ที่ใช้ (ตรวจสอบทีละ key เจาะจง ไม่ใช้ range กว้าง กันโดนของจริงอย่าง 3:drop/4:drop/4:lost):
--   - level 0,1,2: rate 100% เสมอทุกไอเทม/ทุกหิน — ผลอื่นนอกจาก success เป็นไปไม่ได้
--   - level 3: weapon5/armor2 (ไอเทมเดียวที่ rate<100% ที่ระดับนี้) ต่ำกว่า +10 ล้มแล้ว "ลดระดับ" เท่านั้น
--              ไม่มีทางเป็น fail (BSB ใช้ได้แค่ระดับ 7-14) หรือ lost (ต้อง >= 10)
--   - level 4,5,6: fail (=BSB protect) เกิดได้เฉพาะระดับ 7-14 เท่านั้น
--
-- วิธีรัน (Supabase SQL editor):
--   1) รันส่วนที่ 1 (SELECT) ก่อน เทียบตัวเลขกับที่ระบุด้านล่าง
--   2) ถ้าตรงกัน ค่อยรันส่วนที่ 2 (DELETE)
-- ──────────────────────────────────────────────────────────────────────────

-- ── ส่วนที่ 1: ดูก่อนลบ (ควรได้ 13 แถว รวม count ยอดเล็ก ๆ 1-3 ต่อแถว) ──
select dim, key, count, success
from public.refine_breakdown
where dim = 'level_result'
  and key in (
    '0:drop', '0:fail', '0:lost',
    '1:drop', '1:fail',
    '2:drop', '2:fail', '2:lost',
    '3:fail', '3:lost',
    '4:fail',
    '5:fail',
    '6:fail'
  )
order by key;

-- ── ส่วนที่ 2: ลบจริง ──
delete from public.refine_breakdown
where dim = 'level_result'
  and key in (
    '0:drop', '0:fail', '0:lost',
    '1:drop', '1:fail',
    '2:drop', '2:fail', '2:lost',
    '3:fail', '3:lost',
    '4:fail',
    '5:fail',
    '6:fail'
  );

-- หมายเหตุ: ไม่แตะ dim='level'/'stone_combo' — 2 dim นี้ไม่ได้ถูกใช้คำนวณกราฟ "ภาพรวมการตีบวก"
--           (ดู api/refine.js — levelResult อ่านจาก level_result + stone_combo เฉพาะ field weapon/armor เท่านั้น
--           ไม่อ่าน success/fail/drop/lost จาก stone_combo) contamination ที่เหลือมีผลแค่ legend หินที่ใช้
--           ซึ่งยอดรวมหลักพัน จึงมองไม่เห็นผลกระทบจริง ไม่จำเป็นต้องแก้เพิ่ม
