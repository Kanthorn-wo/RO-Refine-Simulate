-- ──────────────────────────────────────────────────────────────────────────
-- หน้า "ภาพรวม" ใน dashboard — สรุปว่าผู้เข้าชมทั้งหมดทำอะไรบ้าง (GET /api/stats?overview=1)
--
-- 1) usage_visitors: เพิ่มตัวนับรายคน รันจำลอง / รัน Auto (เริ่มนับตั้งแต่รันไฟล์นี้ — ย้อนหลังไม่มี)
-- 2) bump_visitor_action: api/stats.js POST เรียกทุกครั้งที่มี action simulate/auto พร้อม vid
-- 3) index refine_log(vid) — overview group by vid
-- 4) overview_stats(): คำนวณทุกอย่างฝั่ง DB คืน jsonb ก้อนเดียว
--    นับเฉพาะ vid ที่อยู่ใน usage_visitors (ไม่มี bot / vid null) ให้ตัวหาร "ผู้เข้าชม" ตรงกับตัวตั้ง
--
-- รันใน Supabase SQL editor ครั้งเดียว (idempotent — รันซ้ำได้)
-- ──────────────────────────────────────────────────────────────────────────

-- ── 1) ตัวนับรายคน ──
alter table public.usage_visitors
  add column if not exists sim_runs      integer     not null default 0,
  add column if not exists auto_runs     integer     not null default 0,
  -- แถวเดิมได้เวลาที่รันไฟล์นี้ = วันเริ่มนับ (หน้า overview โชว์เป็นหมายเหตุ)
  add column if not exists actions_since timestamptz not null default now();

-- ── 2) +1 ตัวนับรายคน (เฉพาะ visitor ที่มีอยู่แล้ว — สร้างแถวผ่าน record_visit เท่านั้น) ──
create or replace function public.bump_visitor_action(p_vid text, p_action text)
returns void language sql as $$
  update public.usage_visitors set
    sim_runs  = sim_runs  + case when p_action = 'simulate' then 1 else 0 end,
    auto_runs = auto_runs + case when p_action = 'auto'     then 1 else 0 end
  where vid = p_vid;
$$;
revoke execute on function public.bump_visitor_action(text, text) from public, anon, authenticated;
grant  execute on function public.bump_visitor_action(text, text) to service_role;

-- ── 3) index ──
create index if not exists refine_log_vid_idx on public.refine_log (vid);

-- ── 4) สรุปภาพรวม ──
create or replace function public.overview_stats()
returns jsonb language sql stable as $$
  with v as (
    select vid, visit_days, last_seen, sim_runs, auto_runs from public.usage_visitors
  ),
  -- วันแรกที่ refine_log มีแถวผูกกับ vid (เวลาไทย) — ตัวหารของสถิติรายคนต้องเป็นคนที่เข้าเว็บช่วงเดียวกัน
  log_start as (
    select (min(created_at) at time zone 'Asia/Bangkok')::date as d0 from public.refine_log where vid is not null
  ),
  -- การตีทุกครั้งที่มีบันทึกรายครั้ง (รวม vid null) — ใช้กับผลการตีแยกกลุ่ม ให้ตรงกับประวัติในหน้า Usage
  rl_all as (
    select l.item_type, coalesce(l.stone, 'normal') as stone, l.bsb, l.result, coalesce(l.mode, 'manual') as mode
    from public.refine_log l
  ),
  -- การตีที่ผูกกับผู้เข้าชมจริง (ตัด bot / vid null) — ใช้กับสถิติรายคน
  rl as (
    select l.vid, l.item_type, coalesce(l.stone, 'normal') as stone, l.bsb, l.result,
           coalesce(l.mode, 'manual') as mode, l.refine_after
    from public.refine_log l
    join v on v.vid = l.vid
  ),
  per_vid as (
    select vid,
      bool_or(mode = 'auto')       as used_auto,
      bool_or(bsb)                 as used_bsb,
      bool_or(stone = 'hd')        as used_hd,
      bool_or(stone = 'enriched')  as used_enriched,
      bool_or(result = 'lost')     as had_lost,
      max(coalesce(refine_after, 0)) as max_level
    from rl group by vid
  ),
  -- ผลการตี แยกกลุ่มในคิวรีเดียว: ทั้งหมด / หิน / BSB / ตีเอง-Auto / ประเภทไอเทม
  outcome as (
    select
      case
        when grouping(stone) = 0     then 'stone:' || stone
        when grouping(bsb) = 0       then 'bsb:' || case when bsb then 'yes' else 'no' end
        when grouping(mode) = 0      then 'mode:' || mode
        when grouping(item_type) = 0 then 'item:' || item_type
        else 'all'
      end as grp,
      count(*) filter (where result = 'success') as success,
      count(*) filter (where result = 'fail')    as fail,
      count(*) filter (where result = 'drop')    as dropped, -- "drop" เป็นคำสงวน
      count(*) filter (where result = 'lost')    as lost
    from rl_all
    group by grouping sets ((), (stone), (bsb), (mode), (item_type))
  )
  select jsonb_build_object(
    'visitors', (select jsonb_build_object(
      'total',     count(*),
      'returning', count(*) filter (where visit_days >= 2),
      'days_1',    count(*) filter (where visit_days = 1),
      'days_2_3',  count(*) filter (where visit_days between 2 and 3),
      'days_4_7',  count(*) filter (where visit_days between 4 and 7),
      'days_8p',   count(*) filter (where visit_days >= 8),
      -- ตัวหารของสถิติรายคน: คนที่เข้าเว็บตั้งแต่วันแรกของ refine_log
      'active_since_log', count(*) filter (where last_seen >= (select d0 from log_start))
    ) from v),
    'adoption', (select jsonb_build_object(
      'refined',       count(*),
      'used_auto',     count(*) filter (where used_auto),
      'used_bsb',      count(*) filter (where used_bsb),
      'used_hd',       count(*) filter (where used_hd),
      'used_enriched', count(*) filter (where used_enriched),
      'had_lost',      count(*) filter (where had_lost)
    ) from per_vid) || (select jsonb_build_object(
      'ran_sim',  count(*) filter (where sim_runs > 0),
      'ran_auto', count(*) filter (where auto_runs > 0)
    ) from v),
    'max_level', (select jsonb_build_object(
      'l0_4',   count(*) filter (where max_level <= 4),
      'l5_9',   count(*) filter (where max_level between 5 and 9),
      'l10_14', count(*) filter (where max_level between 10 and 14),
      'l15_20', count(*) filter (where max_level >= 15)
    ) from per_vid),
    'outcome', (select coalesce(jsonb_object_agg(grp, jsonb_build_object(
      'success', success, 'fail', fail, 'drop', dropped, 'lost', lost)), '{}'::jsonb) from outcome),
    -- ผลการตีรวมจาก refine_breakdown — แหล่งเดียวกับ KPI หน้า Usage > ตีบวก (อัตราตีติดต้องตรงกันทั้งเว็บ)
    'breakdown', (select coalesce(jsonb_object_agg(key, count), '{}'::jsonb)
                  from public.refine_breakdown where scope = 'global' and dim = 'result'),
    'totals', jsonb_build_object(
      'refine',   (select coalesce(sum(count), 0) from public.usage_counters where metric = 'refine_total'),
      'stone',    (select coalesce(sum(count), 0) from public.usage_counters where metric = 'stone_total'),
      'bsb',      (select coalesce(sum(count), 0) from public.usage_counters where metric = 'bsb_total'),
      'auto',     (select coalesce(sum(count), 0) from public.usage_daily where metric = 'auto'),
      'simulate', (select coalesce(sum(count), 0) from public.usage_daily where metric = 'simulate'),
      'logged',   (select count(*) from rl_all)
    ),
    'since', jsonb_build_object(
      'visitors',   (select min(first_seen) from public.usage_visitors),
      'refine_log', (select min(created_at) from public.refine_log where vid is not null),
      'actions',    (select min(actions_since) from public.usage_visitors)
    )
  );
$$;
revoke execute on function public.overview_stats() from public, anon, authenticated;
grant  execute on function public.overview_stats() to service_role;
