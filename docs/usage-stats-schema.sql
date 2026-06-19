-- Usage stats (social proof) + site settings (feature flags)
-- รันใน Supabase SQL editor ครั้งเดียว
--
-- หลักการ: ไม่เก็บข้อมูลส่วนตัว — เก็บแค่ "ตัวเลขรวม" (aggregate)
-- ทุกการเข้าถึงผ่าน serverless (service_role) เท่านั้น
-- RLS เปิดแบบไม่มี policy => anon key (ที่ expose ใน client) อ่าน/เขียน table ไม่ได้
-- ส่วน bump_counter ถูก revoke จาก anon/authenticated กันคนเรียก RPC ตรง ๆ ข้าม cap ของ server

-- ── ตารางตัวนับรวมสะสม (all-time — โชว์เลขใหญ่หน้าเว็บ อ่านเร็ว) ──
create table if not exists public.usage_counters (
  metric     text primary key,        -- 'refine_total' | 'stone_total' | 'bsb_total'
  count      bigint not null default 0,
  updated_at timestamptz not null default now()
);

-- ── ตารางรายวัน (ดูย้อนหลัง/แนวโน้มได้) ─────────────────────────
create table if not exists public.usage_daily (
  day    date   not null,
  metric text   not null,             -- 'refine' | 'stone' | 'bsb' | 'visits'
  count  bigint not null default 0,
  primary key (day, metric)
);

-- ── ตารางตั้งค่าเว็บ (feature flags) ────────────────────────────
create table if not exists public.site_settings (
  key        text primary key,        -- เช่น 'show_stats'
  value      jsonb not null,          -- เช่น true / false
  updated_at timestamptz not null default now()
);

-- ── RLS: ล็อกทั้งสองตาราง (service_role bypass อยู่แล้ว) ─────────
alter table public.usage_counters enable row level security;
alter table public.usage_daily    enable row level security;
alter table public.site_settings  enable row level security;
-- ไม่สร้าง policy ใด ๆ => anon/authenticated เข้าไม่ถึง; เฉพาะ service_role (server) ที่ bypass RLS

-- ── ฟังก์ชันเพิ่มยอดแบบ atomic (upsert + บวกเพิ่ม) ──────────────
create or replace function public.bump_counter(p_metric text, p_delta bigint)
returns void
language sql
as $$
  insert into public.usage_counters (metric, count, updated_at)
  values (p_metric, p_delta, now())
  on conflict (metric) do update
    set count = public.usage_counters.count + excluded.count,
        updated_at = now();
$$;

-- กันคนเอา anon key ยิง rpc/bump_counter ตรง ๆ ข้าม cap ของ server
revoke execute on function public.bump_counter(text, bigint) from public, anon, authenticated;
grant  execute on function public.bump_counter(text, bigint) to service_role;

-- ── ฟังก์ชันเพิ่มยอดรายวัน (upsert ต่อ day+metric) ──────────────
create or replace function public.bump_daily(p_day date, p_metric text, p_delta bigint)
returns void
language sql
as $$
  insert into public.usage_daily (day, metric, count)
  values (p_day, p_metric, p_delta)
  on conflict (day, metric) do update
    set count = public.usage_daily.count + excluded.count;
$$;

revoke execute on function public.bump_daily(date, text, bigint) from public, anon, authenticated;
grant  execute on function public.bump_daily(date, text, bigint) to service_role;

-- ── ตาราง activity feed (เก็บ 200 รายการล่าสุด ring buffer) ─────
create table if not exists public.usage_events (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  type       text not null,             -- 'refine' | 'visit'
  count      integer not null default 1
);
alter table public.usage_events enable row level security;
create index if not exists usage_events_created_idx on public.usage_events (created_at desc);

-- ตัดให้เหลือแค่ 200 แถวล่าสุดอัตโนมัติทุกครั้งที่ insert (กัน DB บวม)
create or replace function public.trim_usage_events()
returns trigger language plpgsql as $$
begin
  delete from public.usage_events
  where id < (select min(id) from (select id from public.usage_events order by id desc limit 200) t);
  return null;
end $$;

drop trigger if exists trg_trim_usage_events on public.usage_events;
create trigger trg_trim_usage_events
  after insert on public.usage_events
  for each statement execute function public.trim_usage_events();

-- ── ตาราง visitor (ID สุ่ม anonymous — นับ unique / new vs returning) ──
-- vid = UUID สุ่มฝั่ง client (ไม่ผูกตัวตน) เก็บเพื่อแยกคนใหม่/คนกลับมาซ้ำข้ามวัน
create table if not exists public.usage_visitors (
  vid        text primary key,
  first_seen date not null,
  last_seen  date not null,
  visit_days integer not null default 1
);
alter table public.usage_visitors enable row level security;

-- บันทึก visit 1 ครั้ง/วัน: upsert visitor + เพิ่มตัวนับ visits / visits_new / visits_returning ของวันนั้น
create or replace function public.record_visit(p_vid text, p_day date)
returns void language plpgsql as $$
declare
  v_first date;
  v_last  date;
  v_status text;
begin
  select first_seen, last_seen into v_first, v_last
  from public.usage_visitors where vid = p_vid;

  if v_first is null then
    insert into public.usage_visitors (vid, first_seen, last_seen, visit_days)
    values (p_vid, p_day, p_day, 1)
    on conflict (vid) do nothing;
    v_status := 'new';
  elsif v_last < p_day then
    update public.usage_visitors
      set last_seen = p_day, visit_days = visit_days + 1
      where vid = p_vid;
    v_status := 'returning';
  else
    v_status := 'dup'; -- เข้าแล้ววันนี้ ไม่นับซ้ำ
  end if;

  if v_status <> 'dup' then
    perform public.bump_daily(p_day, 'visits', 1);
    perform public.bump_daily(p_day, case when v_status = 'new' then 'visits_new' else 'visits_returning' end, 1);
  end if;
end $$;

revoke execute on function public.record_visit(text, date) from public, anon, authenticated;
grant  execute on function public.record_visit(text, date) to service_role;

-- ── ค่าเริ่มต้น: เปิดแสดง section สถิติบนหน้าเว็บ ────────────────
insert into public.site_settings (key, value)
values ('show_stats', 'true'::jsonb)
on conflict (key) do nothing;
