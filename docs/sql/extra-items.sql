-- รายชื่อไอเทมเสริมสำหรับช่องค้นหาไอเทม (ของเซิร์ฟไทยที่ไม่อยู่ใน index ไฟล์) — จัดการผ่าน dashboard แท็บ "ไอเทม"
-- ผู้เล่นเห็นเฉพาะ status = 'approved' (api/extra-items.js GET สาธารณะ); 'denied' = ซ่อนไอเทมนี้แม้อยู่ใน index ไฟล์
-- รันใน Supabase SQL editor ครั้งเดียว (idempotent — รันซ้ำได้)

create table if not exists public.extra_items (
  id          bigint primary key,                       -- Item ID (divine-pride)
  label       text not null,                            -- ชื่อที่แสดงในช่องค้นหา เช่น 'Falling Star Shield [1]'
  armor_level smallint not null default 1 check (armor_level in (1, 2)),
  status      text not null check (status in ('approved', 'pending', 'denied')),
  source      text not null check (source in ('manual', 'auto')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists extra_items_status_idx on public.extra_items (status);

-- ล็อกตาราง: ไม่สร้าง policy => anon/authenticated เข้าไม่ถึง; เฉพาะ service_role (server) ที่ bypass RLS
alter table public.extra_items enable row level security;

-- โหมดอนุมัติไอเทมที่ Action หาเจอ: false = รออนุมัติเองใน dashboard (default), true = ผ่านอัตโนมัติ
insert into public.site_settings (key, value)
values ('item_auto_approve', 'false'::jsonb)
on conflict (key) do nothing;

-- seed: ไอเทมที่เติมไว้แล้วใน scripts/extra-items.json (ให้เห็น/ลบได้ใน dashboard — ไฟล์ยังเก็บเป็น fallback)
insert into public.extra_items (id, label, armor_level, status, source) 
select v.id, v.label, v.armor_level, 'approved', 'manual'
from (values
  (18886, 'Rainbow Long Octopus [1]', 1),
  (18911, 'Red Flower Hat [1]', 1),
  (20839, 'Light and Darkness Wing', 1),
  (22264, 'Nameless Swordsman''s Boots [1]', 1),
  (460081, 'Guardian''s Shield [1]', 1),
  (460100, 'Heavenly Oath [1]', 1),
  (460107, 'Giant Shield [1]', 1),
  (460116, 'Themis Libra-LT [1]', 2),
  (460121, 'Melody Rose Shield [1]', 1),
  (460122, 'Super Novice Shield [1]', 1),
  (460142, 'Punishment Chain Shield [1]', 1),
  (460143, 'Valkyrie Angel Guard [1]', 1),
  (460150, 'Sylvan Thorn Guard [1]', 1),
  (460166, 'Falling Star Shield [1]', 2),
  (460171, 'Soul Demon Shield [1]', 1),
  (460175, 'Robot Spark Shield [1]', 2),
  (460178, 'Ignis Flame Guard [1]', 1),
  (470275, 'Flame Whirlwind Shoes', 1),
  (480303, 'Transformation Towel', 1),
  (480369, 'Scarlet Hero Cape [1]', 1),
  (480370, 'Revolver Red Cape', 1),
  (480417, 'Bear Aimed Bag [1]', 1),
  (480465, 'Melody Wing [1]', 1),
  (480474, 'Howling Tiger Pajama', 1),
  (480604, 'Wings of Melody [1]', 2),
  (480650, 'Avenger Cloak of Naght Sieger-LT [1]', 2),
  (480651, 'Spirit Cloak of Naght Sieger-LT [1]', 2)
) as v(id, label, armor_level)
on conflict (id) do nothing;
