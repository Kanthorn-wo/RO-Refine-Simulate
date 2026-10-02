-- ──────────────────────────────────────────────────────────────────────────
-- Schema cleanup + 3NF fixes (2026-10-02) — รันแล้วบน production
--
-- ระยะ 0 (cleanup):
--   - ลบตาราง backup *_bak_20261002 / *_bak2_20261002 (ไม่มี PK, ไม่ได้ใช้)
--   - ลบแถวขยะ usage_counters 'visits:2026-06-19' (ไม่มีโค้ดไหนเขียน/อ่าน)
--   - record_refine_batch เลิกเขียน refine_daily แล้วลบตาราง (ไม่มีหน้าไหนอ่าน)
-- ระยะ 1 (3NF — ค่าที่คำนวณได้ ให้ DB คำนวณเอง จะได้ขัดกันไม่ได้):
--   - refine_log.bsb        = generated (bsb_amount > 0)
--   - refine_item_stats.fail = generated (attempts - success)
--   record_refine_batch จึงไม่ insert/update 2 คอลัมน์นี้ และ breakdown dim 'bsb' ใช้ bsb_amount ให้ตรงกับ log
--
-- ทั้งไฟล์อยู่ใน transaction เดียว — ล้มกลางทางจะ rollback ทั้งหมด
-- ──────────────────────────────────────────────────────────────────────────

begin;

-- ── ระยะ 0 ──
drop table if exists
  public.usage_daily_bak_20261002, public.usage_counters_bak_20261002,
  public.refine_breakdown_bak_20261002, public.refine_item_stats_bak_20261002,
  public.usage_daily_bak2_20261002, public.usage_counters_bak2_20261002,
  public.refine_breakdown_bak2_20261002, public.refine_item_stats_bak2_20261002;

delete from public.usage_counters where metric = 'visits:2026-06-19';

-- ── ระยะ 1: generated columns ──
alter table public.refine_log drop column bsb;
alter table public.refine_log add column bsb boolean generated always as (bsb_amount > 0) stored;

alter table public.refine_item_stats drop column fail;
alter table public.refine_item_stats add column fail bigint generated always as (attempts - success) stored;

-- ── function: เขียน refine_log / item_stats / breakdown (ไม่มี refine_daily, ไม่แตะคอลัมน์ generated) ──
create or replace function public.record_refine_batch(p_vid text, p_rows jsonb)
returns void language plpgsql as $$
begin
  -- detail log (bsb คำนวณจาก bsb_amount อัตโนมัติ)
  insert into public.refine_log
    (vid, item_type, item_id, item_name, level, refine_after, stone, bsb_amount, result, event_buff, mode, roll_pct)
  select
    p_vid,
    e.item_type, e.item_id,
    nullif(trim(e.item_name), ''),
    e.level, e.refine_after,
    e.stone,
    coalesce(e.bsb_amount, 0),
    e.result,
    coalesce(e.event_buff, false),
    nullif(trim(e.mode), ''),
    e.roll_pct
  from jsonb_to_recordset(p_rows) as e(
    item_type text, item_id int, item_name text,
    level int, refine_after int,
    stone text, bsb_amount int,
    result text, event_buff boolean, mode text, roll_pct numeric
  );

  -- leaderboard (fail คำนวณจาก attempts - success อัตโนมัติ)
  insert into public.refine_item_stats (item_type, item_id, attempts, success)
  select
    e.item_type, coalesce(e.item_id, 0),
    count(*),
    count(*) filter (where e.result = 'success')
  from jsonb_to_recordset(p_rows) as e(item_type text, item_id int, result text)
  where e.item_type is not null
  group by e.item_type, coalesce(e.item_id, 0)
  on conflict (item_type, item_id) do update set
    attempts = public.refine_item_stats.attempts + excluded.attempts,
    success  = public.refine_item_stats.success  + excluded.success;

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
    -- ใช้ bsb_amount ให้ตรงกับ refine_log.bsb (generated)
    select 'bsb', case when coalesce(e.bsb_amount, 0) > 0 then 'yes' else 'no' end, e.result
      from jsonb_to_recordset(p_rows) as e(bsb_amount int, result text)
    union all
    select 'level', coalesce(e.level::text, '?'), e.result
      from jsonb_to_recordset(p_rows) as e(level int, result text)
    union all
    -- joint level×result (all-time) สำหรับกราฟ "ภาพรวมการตีบวก" 4 สี
    select 'level_result', coalesce(e.level::text, '?') || ':' || e.result, e.result
      from jsonb_to_recordset(p_rows) as e(level int, result text)
    union all
    -- joint item_type|level|stone (all-time) สำหรับ legend หินที่ใช้ + weapon/armor ต่อระดับ
    select 'stone_combo',
      coalesce(e.item_type, '') || '|' || coalesce(e.level::text, '?') || '|' || coalesce(e.stone, 'normal'),
      e.result
      from jsonb_to_recordset(p_rows) as e(item_type text, level int, stone text, result text)
  ) u
  where u.key is not null
  group by dim, key
  on conflict (scope, dim, key) do update set
    count   = public.refine_breakdown.count   + excluded.count,
    success = public.refine_breakdown.success + excluded.success;
end $$;

drop table if exists public.refine_daily;

commit;
