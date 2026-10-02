-- ──────────────────────────────────────────────────────────────────────────
-- ระยะ 2 (2026-10-02): ตัดการเก็บข้อมูลตีบวกซ้ำ — refine_log เป็นแหล่งเดียว ที่เหลือเป็น view
--
-- เดิม 1 การตีถูกเขียนสะสม 5 ที่ (refine_log, refine_item_stats, refine_breakdown, usage_daily, usage_counters)
-- แล้วต้องคอยเช็คให้ตรงกัน → เปลี่ยนเป็น view ที่คำนวณสดจาก refine_log (ชื่อ/คอลัมน์เดิม API ไม่ต้องแก้ฝั่งอ่าน)
--   - refine_item_stats  view  (item_type, item_id, attempts, success, fail)
--   - refine_breakdown   view  (scope, dim, key, count, success) — key รูปแบบเดิม ("10:success", "armor1|0|enriched")
--   - usage_counters     view  (refine_total / stone_total / bsb_total)
--   - usage_daily        view  = usage_daily_actions (visits*, auto, simulate — เก็บจริง) + refine/stone/bsb จาก refine_log
-- stone = 1 ต่อการตี 1 ครั้ง, bsb = sum(bsb_amount), วัน = วันที่ไทย (Asia/Bangkok)
--
-- ก่อนรันเทียบผล view กับตารางเดิมแล้ว ต่างกัน 0 แถวทุกตาราง
-- view ใช้ security_invoker + revoke anon/authenticated — อ่านได้เฉพาะ service_role (API) เหมือนตารางเดิม
-- ──────────────────────────────────────────────────────────────────────────

begin;

-- ── ตารางสะสมเดิม → ลบ ──
drop table public.refine_item_stats;
drop table public.refine_breakdown;
drop table public.usage_counters;

-- usage_daily เก็บเฉพาะ metric ที่ไม่มีแถวต้นทาง (visits/visits_new/visits_returning/auto/simulate)
alter table public.usage_daily rename to usage_daily_actions;
delete from public.usage_daily_actions where metric in ('refine', 'stone', 'bsb');

-- ── views ──
create view public.refine_item_stats with (security_invoker = true) as
select
  item_type,
  coalesce(item_id, 0) as item_id,
  count(*)::bigint as attempts,
  count(*) filter (where result = 'success')::bigint as success,
  count(*) filter (where result <> 'success')::bigint as fail
from public.refine_log
where item_type is not null
group by item_type, coalesce(item_id, 0);

create view public.refine_breakdown with (security_invoker = true) as
select
  'global'::text as scope, dim, key,
  count(*)::bigint as count,
  count(*) filter (where result = 'success')::bigint as success
from (
  select 'item_type' as dim, item_type as key, result from public.refine_log
  union all select 'stone', stone, result from public.refine_log
  union all select 'result', result, result from public.refine_log
  union all select 'bsb', case when bsb then 'yes' else 'no' end, result from public.refine_log
  union all select 'level', coalesce(level::text, '?'), result from public.refine_log
  -- joint level×result สำหรับกราฟ "ภาพรวมการตีบวก" 4 สี
  union all select 'level_result', coalesce(level::text, '?') || ':' || result, result from public.refine_log
  -- joint item_type|level|stone สำหรับ legend หินที่ใช้ + weapon/armor ต่อระดับ
  union all select 'stone_combo', coalesce(item_type, '') || '|' || coalesce(level::text, '?') || '|' || coalesce(stone, 'normal'), result from public.refine_log
) u
where key is not null
group by dim, key;

create view public.usage_counters with (security_invoker = true) as
select m.metric, m.count, t.updated_at
from (select count(*)::bigint as n, coalesce(sum(bsb_amount), 0)::bigint as bsb, max(created_at) as updated_at from public.refine_log) t
cross join lateral (values ('refine_total', t.n), ('stone_total', t.n), ('bsb_total', t.bsb)) m(metric, count);

create view public.usage_daily with (security_invoker = true) as
select day, metric, count from public.usage_daily_actions
union all
select (l.created_at at time zone 'Asia/Bangkok')::date as day, m.metric, sum(m.v)::bigint as count
from public.refine_log l
cross join lateral (values ('refine', 1), ('stone', 1), ('bsb', l.bsb_amount)) m(metric, v)
group by 1, 2
having sum(m.v) > 0;

revoke all on public.refine_item_stats, public.refine_breakdown, public.usage_counters, public.usage_daily from anon, authenticated;
grant select on public.refine_item_stats, public.refine_breakdown, public.usage_counters, public.usage_daily to service_role;

-- ── functions ──
-- ตัวนับรวมคำนวณจาก view แล้ว
drop function public.bump_counter(text, bigint);

-- เขียนเฉพาะ metric ที่เก็บจริง — refine/stone/bsb มาจาก refine_log (กัน API เก่าที่ยังส่งมา)
create or replace function public.bump_daily(p_day date, p_metric text, p_delta bigint)
returns void language sql as $$
  insert into public.usage_daily_actions (day, metric, count)
  select p_day, p_metric, p_delta
  where p_metric not in ('refine', 'stone', 'bsb')
  on conflict (day, metric) do update
    set count = public.usage_daily_actions.count + excluded.count;
$$;

-- บันทึกการตีบวก = insert refine_log ที่เดียว (bsb เป็น generated column จาก bsb_amount)
create or replace function public.record_refine_batch(p_vid text, p_rows jsonb)
returns void language plpgsql as $$
begin
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
end $$;

commit;
