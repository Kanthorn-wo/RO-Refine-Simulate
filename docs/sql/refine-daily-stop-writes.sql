-- ──────────────────────────────────────────────────────────────────────────
-- Cleanup: หยุดเขียน/query ตาราง refine_daily — ไม่มี frontend ไหนอ่าน data.daily เลย
--   (เช็คแล้ว: RefineAnalytics.jsx / UserActivityModal.jsx ไม่ได้ใช้ field นี้)
--   ตอนนี้ยังเขียนทุก batch ตีบวก + query ทุกครั้งที่เปิด dashboard โดยเปล่าประโยชน์
--   ไฟล์นี้ re-apply record_refine_batch ตัดส่วน insert เข้า refine_daily ออก
--   (ตาราง refine_daily เองยังไม่ลบ ข้อมูลเก่ายังอยู่ เผื่ออยากเอากลับมาใช้ทีหลัง)
--
-- รันใน Supabase SQL editor ครั้งเดียว (idempotent — รันซ้ำได้ create or replace)
-- ──────────────────────────────────────────────────────────────────────────

create or replace function public.record_refine_batch(p_vid text, p_rows jsonb)
returns void language plpgsql as $$
begin
  -- detail log
  insert into public.refine_log
    (vid, item_type, item_id, item_name, level, refine_after, stone, bsb, bsb_amount, result, event_buff, mode, roll_pct)
  select
    p_vid,
    e.item_type, e.item_id,
    nullif(trim(e.item_name), ''),
    e.level, e.refine_after,
    e.stone,
    coalesce(e.bsb, false),
    coalesce(e.bsb_amount, 0),
    e.result,
    coalesce(e.event_buff, false),
    nullif(trim(e.mode), ''),
    e.roll_pct
  from jsonb_to_recordset(p_rows) as e(
    item_type text, item_id int, item_name text,
    level int, refine_after int,
    stone text, bsb boolean, bsb_amount int,
    result text, event_buff boolean, mode text, roll_pct numeric
  );

  -- leaderboard
  insert into public.refine_item_stats (item_type, item_id, attempts, success, fail)
  select
    e.item_type, coalesce(e.item_id, 0),
    count(*),
    count(*) filter (where e.result = 'success'),
    count(*) filter (where e.result <> 'success')
  from jsonb_to_recordset(p_rows) as e(item_type text, item_id int, result text)
  where e.item_type is not null
  group by e.item_type, coalesce(e.item_id, 0)
  on conflict (item_type, item_id) do update set
    attempts = public.refine_item_stats.attempts + excluded.attempts,
    success  = public.refine_item_stats.success  + excluded.success,
    fail     = public.refine_item_stats.fail     + excluded.fail;

  -- breakdown global
  insert into public.refine_breakdown (scope, dim, key, count, success)
  select 'global', dim, key,
    count(*),
    count(*) filter (where result = 'success')
  from (
    select 'item_type' as dim, e.item_type as key, e.result
      from jsonb_to_recordset(p_rows) as e(item_type text, result text)
    union all
    select 'stone', e.stone, e.result
      from jsonb_to_recordset(p_rows) as e(stone text, result text)
    union all
    select 'result', e.result, e.result
      from jsonb_to_recordset(p_rows) as e(result text)
    union all
    select 'bsb', case when e.bsb then 'yes' else 'no' end, e.result
      from jsonb_to_recordset(p_rows) as e(bsb boolean, result text)
    union all
    select 'level', e.level::text, e.result
      from jsonb_to_recordset(p_rows) as e(level int, result text)
    union all
    -- joint level×result (all-time) สำหรับกราฟ "ภาพรวมการตีบวก" 4 สี
    select 'level_result', e.level::text || ':' || e.result, e.result
      from jsonb_to_recordset(p_rows) as e(level int, result text)
    union all
    -- joint item_type|level|stone (all-time) สำหรับ legend หินที่ใช้ + weapon/armor ต่อระดับ
    select 'stone_combo',
      coalesce(e.item_type, '') || '|' || e.level::text || '|' || coalesce(e.stone, 'normal'),
      e.result
      from jsonb_to_recordset(p_rows) as e(item_type text, level int, stone text, result text)
  ) u
  where u.key is not null
  group by dim, key
  on conflict (scope, dim, key) do update set
    count   = public.refine_breakdown.count   + excluded.count,
    success = public.refine_breakdown.success + excluded.success;

  -- (เคยมี insert เข้า refine_daily ตรงนี้ — ตัดออกแล้ว ไม่มี frontend ไหนอ่าน data.daily
  --  เลย เขียน/query ทุก batch/ทุกครั้งที่เปิด dashboard ไปเปล่า ๆ ตารางยังอยู่ ข้อมูลเก่าไม่ได้ลบ)
end $$;

revoke execute on function public.record_refine_batch(text, jsonb) from public, anon, authenticated;
grant  execute on function public.record_refine_batch(text, jsonb) to service_role;
