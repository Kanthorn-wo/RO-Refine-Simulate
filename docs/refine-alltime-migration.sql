-- ──────────────────────────────────────────────────────────────────────────
-- Migration: เพิ่ม aggregate joint แบบ all-time ให้กราฟ "ภาพรวมการตีบวก" + legend หินที่ใช้
--   dim ใหม่ใน refine_breakdown:
--     - 'level_result'  key = "<level>:<result>"            → กราฟ 4 สี ต่อระดับ
--     - 'stone_combo'   key = "<item_type>|<level>|<stone>" → หินที่ใช้ + weapon/armor ต่อระดับ
--
-- วิธีรัน (Supabase SQL editor): รันทั้งไฟล์นี้ครั้งเดียว
--   ส่วนที่ 1 = อัปเดต RPC (idempotent, รันซ้ำได้)
--   ส่วนที่ 2 = backfill จาก refine_log ที่มีอยู่ (≤500) — **รันครั้งเดียวเท่านั้น** (รันซ้ำจะนับซ้ำ)
-- หมายเหตุ: ข้อมูลก่อน migration ที่หลุดออกจาก ring buffer ไปแล้ว backfill กลับไม่ได้
-- ──────────────────────────────────────────────────────────────────────────

-- ── ส่วนที่ 1: อัปเดต record_refine_batch (เพิ่ม 2 dim ใหม่ในบล็อก breakdown global) ──
create or replace function public.record_refine_batch(p_vid text, p_rows jsonb)
returns void language plpgsql as $$
declare
  v_day text := to_char(now() at time zone 'Asia/Bangkok', 'YYYY-MM-DD');
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

  -- daily trend
  insert into public.refine_daily (day, dim, key, count, success)
  select v_day, dim, key,
    count(*),
    count(*) filter (where result = 'success')
  from (
    select 'result' as dim, e.result as key, e.result
      from jsonb_to_recordset(p_rows) as e(result text)
    union all
    select 'stone', e.stone, e.result
      from jsonb_to_recordset(p_rows) as e(stone text, result text)
    union all
    select 'item_type', e.item_type, e.result
      from jsonb_to_recordset(p_rows) as e(item_type text, result text)
  ) u
  where u.key is not null
  group by dim, key
  on conflict (day, dim, key) do update set
    count   = public.refine_daily.count   + excluded.count,
    success = public.refine_daily.success + excluded.success;
end $$;

revoke execute on function public.record_refine_batch(text, jsonb) from public, anon, authenticated;
grant  execute on function public.record_refine_batch(text, jsonb) to service_role;

-- ── ส่วนที่ 2: backfill จาก refine_log ที่มีอยู่ (รันครั้งเดียว!) ──
-- seed สองdim ใหม่จากที่ค้างใน ring buffer เพื่อไม่ให้กราฟว่างหลัง migration
insert into public.refine_breakdown (scope, dim, key, count, success)
select 'global', 'level_result', level::text || ':' || result,
  count(*), count(*) filter (where result = 'success')
from public.refine_log
where level is not null and result is not null
group by level, result
on conflict (scope, dim, key) do update set
  count   = public.refine_breakdown.count   + excluded.count,
  success = public.refine_breakdown.success + excluded.success;

insert into public.refine_breakdown (scope, dim, key, count, success)
select 'global', 'stone_combo',
  coalesce(item_type, '') || '|' || level::text || '|' || coalesce(stone, 'normal'),
  count(*), count(*) filter (where result = 'success')
from public.refine_log
where level is not null
group by item_type, level, stone
on conflict (scope, dim, key) do update set
  count   = public.refine_breakdown.count   + excluded.count,
  success = public.refine_breakdown.success + excluded.success;
