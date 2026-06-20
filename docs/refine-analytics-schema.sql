-- Refine analytics v2 — migration script (safe to re-run)
-- รันใน Supabase SQL editor ทีละครั้ง ลำดับสำคัญ: เพิ่มคอลัมน์ → PK → daily table → trim → RPC

-- ── 1) refine_log: เพิ่มคอลัมน์ใหม่ ──
create table if not exists public.refine_log (
  id           bigint generated always as identity primary key,
  created_at   timestamptz not null default now(),
  vid          text,
  item_type    text,
  item_id      integer,
  level        integer,
  stone        text,
  bsb          boolean not null default false,
  result       text
);
alter table public.refine_log enable row level security;
create index if not exists refine_log_created_idx on public.refine_log (created_at desc);

alter table public.refine_log
  add column if not exists item_name    text,
  add column if not exists refine_after integer,
  add column if not exists event_buff   boolean not null default false,
  add column if not exists bsb_amount   integer not null default 0,
  add column if not exists mode         text,
  add column if not exists roll_pct     numeric;

-- ── 2) leaderboard ──
create table if not exists public.refine_item_stats (
  item_type text    not null,
  item_id   integer not null default 0,
  attempts  bigint  not null default 0,
  success   bigint  not null default 0,
  fail      bigint  not null default 0,
  primary key (item_type, item_id)
);
alter table public.refine_item_stats enable row level security;

-- ── 3) breakdown: เพิ่ม scope + success แล้วเปลี่ยน PK ──
create table if not exists public.refine_breakdown (
  dim   text   not null,
  key   text   not null,
  count bigint not null default 0
);
alter table public.refine_breakdown enable row level security;

alter table public.refine_breakdown
  add column if not exists scope   text   not null default 'global',
  add column if not exists success bigint not null default 0;

-- เปลี่ยน primary key (dim,key) → (scope,dim,key) — ทำใน DO block กัน error ถ้า run ซ้ำ
do $$
begin
  alter table public.refine_breakdown drop constraint if exists refine_breakdown_pkey;
  if not exists (
    select 1 from pg_constraint
    where conname = 'refine_breakdown_scope_dim_key_key'
       or conname = 'refine_breakdown_pkey'
  ) then
    alter table public.refine_breakdown add primary key (scope, dim, key);
  end if;
exception when others then
  raise notice 'PK already set or conflict: %', sqlerrm;
end $$;

-- ── 4) refine_daily: trend รายวัน ──
create table if not exists public.refine_daily (
  day     text   not null,
  dim     text   not null,
  key     text   not null,
  count   bigint not null default 0,
  success bigint not null default 0,
  primary key (day, dim, key)
);
alter table public.refine_daily enable row level security;
create index if not exists refine_daily_day_idx on public.refine_daily (day desc);

-- ── 5) trim: ขยาย 500 → 2000 ──
create or replace function public.trim_refine_log()
returns trigger language plpgsql as $$
begin
  delete from public.refine_log
  where id < (select min(id) from (select id from public.refine_log order by id desc limit 2000) t);
  return null;
end $$;
drop trigger if exists trg_trim_refine_log on public.refine_log;
create trigger trg_trim_refine_log
  after insert on public.refine_log
  for each statement execute function public.trim_refine_log();

-- ── 6) RPC: record_refine_batch v2 ──
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
