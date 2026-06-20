-- Refine analytics (dashboard เท่านั้น) — เก็บรายละเอียดการตีบวกทุก attempt
-- รันใน Supabase SQL editor ครั้งเดียว
--
-- หลักการ: aggregate ทุก attempt (สถิติ/leaderboard ครบ) + เก็บ detail ล่าสุด 500 รายการ (ring buffer)
-- ทุกการเข้าถึงผ่าน serverless (service_role) เท่านั้น — RLS ล็อกทุกตาราง ไม่มี policy

-- ── 1) detail ring buffer (500 รายการล่าสุด) — ใช้ทำ list รายครั้ง ──
create table if not exists public.refine_log (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  vid        text,
  item_type  text,                       -- 'weapon1'..'weapon5' | 'armor1' | 'armor2'
  item_id    integer,                    -- divine-pride id (null = ไม่ได้ค้น item เฉพาะ)
  level      integer,                    -- ระดับก่อนตี (source level)
  stone      text,                       -- 'normal' | 'enriched' | 'hd'
  bsb        boolean not null default false,
  result     text                        -- 'success' | 'fail' | 'lost' | 'drop'
);
alter table public.refine_log enable row level security;
create index if not exists refine_log_created_idx on public.refine_log (created_at desc);

create or replace function public.trim_refine_log()
returns trigger language plpgsql as $$
begin
  delete from public.refine_log
  where id < (select min(id) from (select id from public.refine_log order by id desc limit 500) t);
  return null;
end $$;
drop trigger if exists trg_trim_refine_log on public.refine_log;
create trigger trg_trim_refine_log
  after insert on public.refine_log
  for each statement execute function public.trim_refine_log();

-- ── 2) leaderboard aggregate (ต่อ item) ──
create table if not exists public.refine_item_stats (
  item_type text   not null,
  item_id   integer not null default 0,  -- 0 = ไม่มี id เฉพาะ (ตีตาม type ที่ fix ไว้)
  attempts  bigint not null default 0,
  success   bigint not null default 0,
  fail      bigint not null default 0,   -- รวม fail/lost/drop
  primary key (item_type, item_id)
);
alter table public.refine_item_stats enable row level security;

-- ── 3) breakdown aggregate (stone/bsb/result/level/item_type) ──
create table if not exists public.refine_breakdown (
  dim   text   not null,                 -- 'stone'|'bsb'|'result'|'level'|'item_type'
  key   text   not null,
  count bigint not null default 0,
  primary key (dim, key)
);
alter table public.refine_breakdown enable row level security;

-- ── RPC: บันทึก batch แบบ atomic (set-based, ยิงครั้งเดียวต่อ flush) ──
create or replace function public.record_refine_batch(p_vid text, p_rows jsonb)
returns void language plpgsql as $$
begin
  -- detail log (insert ครั้งเดียว → trim trigger ทำงานรอบเดียว)
  insert into public.refine_log (vid, item_type, item_id, level, stone, bsb, result)
  select p_vid, e.item_type, e.item_id, e.level, e.stone, coalesce(e.bsb, false), e.result
  from jsonb_to_recordset(p_rows)
    as e(item_type text, item_id int, level int, stone text, bsb boolean, result text);

  -- leaderboard (group ก่อน upsert)
  insert into public.refine_item_stats (item_type, item_id, attempts, success, fail)
  select e.item_type, coalesce(e.item_id, 0), count(*),
         count(*) filter (where e.result = 'success'),
         count(*) filter (where e.result <> 'success')
  from jsonb_to_recordset(p_rows)
    as e(item_type text, item_id int, level int, stone text, bsb boolean, result text)
  where e.item_type is not null
  group by e.item_type, coalesce(e.item_id, 0)
  on conflict (item_type, item_id) do update set
    attempts = public.refine_item_stats.attempts + excluded.attempts,
    success  = public.refine_item_stats.success  + excluded.success,
    fail     = public.refine_item_stats.fail     + excluded.fail;

  -- breakdown (รวมทุก dim แล้ว upsert)
  insert into public.refine_breakdown (dim, key, count)
  select dim, key, count(*) from (
    select 'item_type' as dim, e.item_type as key
      from jsonb_to_recordset(p_rows) as e(item_type text, item_id int, level int, stone text, bsb boolean, result text)
    union all select 'stone',  e.stone
      from jsonb_to_recordset(p_rows) as e(item_type text, item_id int, level int, stone text, bsb boolean, result text)
    union all select 'result', e.result
      from jsonb_to_recordset(p_rows) as e(item_type text, item_id int, level int, stone text, bsb boolean, result text)
    union all select 'bsb', case when e.bsb then 'yes' else 'no' end
      from jsonb_to_recordset(p_rows) as e(item_type text, item_id int, level int, stone text, bsb boolean, result text)
    union all select 'level', e.level::text
      from jsonb_to_recordset(p_rows) as e(item_type text, item_id int, level int, stone text, bsb boolean, result text)
  ) u
  where u.key is not null
  group by dim, key
  on conflict (dim, key) do update set
    count = public.refine_breakdown.count + excluded.count;
end $$;

revoke execute on function public.record_refine_batch(text, jsonb) from public, anon, authenticated;
grant  execute on function public.record_refine_batch(text, jsonb) to service_role;
