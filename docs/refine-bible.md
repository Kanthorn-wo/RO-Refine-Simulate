# Refine Bible — คัมภีร์ระบบตีบวก (Refinement System)

เอกสารอ้างอิงระบบตีบวกของ Ragnarok Online (Renewal / iRO) ใช้เป็น single source of truth
สำหรับ logic การคำนวณในโปรเจกต์นี้ (`src/constants/refineRates.js`, `handleRefine`, `simulate.js`)

**แหล่งข้อมูล:** [iROWiki — Refinement System](https://irowiki.org/wiki/Refinement_System)
(ดึงข้อมูล 2026-06-18, หน้าแก้ไขล่าสุด 16 กันยายน 2025)

> หมายเหตุ: ค่าทั้งหมดอ้างอิงเซิร์ฟเวอร์ iRO (Renewal) ซึ่งเป็นมาตรฐานที่เว็บนี้จำลอง
> เซิร์ฟเวอร์อื่นอาจมีอัตราต่างออกไป

---

## 1. ภาพรวม

- อุปกรณ์ตีบวกได้สูงสุด **+20** เริ่มจาก +0
- การตีบวกเกิน +10 ใช้ระบบแยก (ต้องเริ่มจากไอเทมที่ +10 ขึ้นไป)
- ของที่ตีบวกเกิน Safety Level มีโอกาส **ล้มเหลว** → ไอเทมแตก/ลดระดับ (รวมการ์ดและ enchant ที่ใส่ไว้)
- **อัปเกรดไม่ได้:** หมวกชั้นกลาง/ล่าง, accessory, costume, ของที่ไม่ใช่ equipment, ของที่ระบุว่าตีบวกไม่ได้

### ชนิดหิน (Ores)
| หิน | ผล |
|---|---|
| **Normal** (Phracon/Oridecon/Elunium ฯลฯ) | อัตราพื้นฐาน, ล้ม = แตก/ลดระดับตามชนิดไอเทม |
| **Enriched** (Kafra Shop) | เพิ่มอัตราสำเร็จ, ปกติล้ม = **แตก** (ยกเว้นช่วง Enriched Event = ลด 1 ระดับ) |
| **HD** (Kafra Shop) | อัตราเท่า normal แต่ล้ม = **ลด 1 ระดับ** (ไม่แตก) |

---

## 2. แร่ที่ใช้ + ค่าธรรมเนียม (ตามชนิดไอเทม)

| ไอเทม | แร่ (Normal) | ค่าธรรมเนียม |
|---|---|---|
| Weapon Lv. 1 | Phracon | 50z |
| Weapon Lv. 2 | Emveretarcon | 200z |
| Weapon Lv. 3 | Oridecon | 5,000z |
| Weapon Lv. 4 | Oridecon | 20,000z |
| Weapon Lv. 5 | Etherdeocon | 50,000z |
| Armor Lv. 1 | Elunium | 2,000z |
| Armor Lv. 2 | Ethernium | 30,000z |

> ใช้ Enriched/HD จาก Kafra Shop = ค่าธรรมเนียม 0z

### แร่ตีบวกเกิน +10
- **Armor Lv. 1:** 100,000z + 1 Carnium
- **Weapon Lv. 1–4:** 100,000z + 1 Bradium
- **HD Carnium / HD Bradium** ใช้แทนได้ → ล้ม = ลด 1 ระดับ (แทนลด 3 / แตก)

### แร่สำหรับ Weapon Lv. 5 / Armor Lv. 2 (ระบบ Ether)
| แร่ | ช่วง | ผลตอนล้ม |
|---|---|---|
| Etherdeocon / Ethernium | +0→+10 | ลด 3 ระดับ |
| Enriched Etherdeocon / Ethernium | +0→+10 | ลด 1 ระดับ |
| Ether Bradium / Ether Carnium | +10→+20 | **แตก** |
| HD Etherdeocon / HD Ethernium | +10→+15 | **แตก** |
| HD Ether Bradium / HD Ether Carnium | +15→+20 | **แตก** |

> ในเว็บนี้: ชื่อแร่ HD ของ W5/A2 แยก 2 ตอน (level 10–14 = HD Etherdeocon/Ethernium, ≥15 = HD Etel Bradium/Carnium)
> ตรงกับ `SPECIAL_ORE` (`low`/`high`/`top`) และ boundary ใน `getOreName`/`getStoneOre`

---

## 3. Safety Level (ตีถึงระดับนี้ไม่มีโอกาสล้ม)

| ไอเทม | Safety Level |
|---|---|
| Weapon Lv. 1 | +7 |
| Weapon Lv. 2 | +6 |
| Weapon Lv. 3 | +5 |
| Weapon Lv. 4 | +4 |
| Armor Lv. 1 / Shadow | +4 |
| Weapon Lv. 5 / Armor Lv. 2 | +3 |

---

## 4. กติกาผลล้มเหลว (Break / Degrade Rules)

ส่วนนี้คือหัวใจของ `handleRefine` และต้อง mirror ใน `simulate.js`

### ไอเทมทั่วไป (Weapon Lv.1–4, Armor Lv.1)
| หิน | ผลตอนล้ม |
|---|---|
| Normal **ที่ +10+** | ลด 3 ระดับ |
| Normal **ต่ำกว่า +10** | **แตก** (เกิน safety level) |
| Enriched | **แตก** (ยกเว้น Enriched Event = ลด 1) |
| HD (Oridecon/Elunium/Carnium/Bradium) | ลด 1 ระดับ (ไม่แตก) |

### Weapon Lv.5 / Armor Lv.2 (เคสพิเศษ — 2 ช่วง)
| ช่วง | หิน | ผลตอนล้ม |
|---|---|---|
| **+0→+9 (low)** | Etherdeocon/Ethernium ปกติ | ลด 3 ระดับ (clamp ที่ 0 ไม่หาย) |
| **+0→+9 (low)** | Enriched Ether | ลด 1 ระดับ |
| **+10+ (high)** | ทุกหิน (รวม HD) | **แตก** |

> โปรเจกต์นี้ implement ตามนี้เป๊ะ: low range หินธรรมดาล้ม = −3, Enriched = −1, clamp ที่ 0;
> high range ทุกหินล้ม = ไอเทมหาย (รวม HD ทุกตัว)

### Blacksmith Blessing (BSB)
- ใช้ได้ **+7→+8 ถึง +14→+15** (range +7~+14)
- ล้มแล้ว BSB จะ **ป้องกัน** (preserve upgrade level แทนแตก/ลดระดับ)
- **หัก BSB ทุกครั้งที่ตีในช่วง active — ตีติดก็เสีย** (กติกาเกมจริง)
- ใช้ได้กับทุกหิน แต่แนะนำคู่ Enriched เพราะอัตราสูงกว่า

---

## 5. ตารางอัตราสำเร็จ (Success Rate %)

> เลข index ในโค้ด: index 0 = +1→ผล... ในตารางนี้แสดงเป็น "ระดับปลายทาง"
> เช่น แถว +9→+10 = index 9 ในอาเรย์

### 5.1 หิน Normal — ไม่มี Event

| Upgrade | W.Lv1 | W.Lv2 | W.Lv3 | W.Lv4 | A.Lv1 | W.Lv5/A.Lv2 | Shadow |
|---|---|---|---|---|---|---|---|
| +3→+4 | 100 | 100 | 100 | 100 | 100 | 60 | 100 |
| +4→+5 | 100 | 100 | 100 | 60 | 60 | 60 | 60 |
| +5→+6 | 100 | 100 | 60 | 40 | 40 | 40 | 40 |
| +6→+7 | 100 | 60 | 50 | 40 | 40 | 40 | 40 |
| +7→+8 | 60 | 40 | 20 | 20 | 20 | 20 | 20 |
| +8→+9 | 40 | 20 | 20 | 20 | 20 | 20 | 20 |
| +9→+10 | 19 | 19 | 19 | 9 | 9 | 9 | 9 |
| +11~+14 | 18 | 18 | 18 | 8 | 8 | 8 | — |
| +15~+18 | 17 | 17 | 17 | 7 | 7 | 7 | — |
| +19~+20 | 15 | 15 | 15 | 5 | 5 | 5 | — |

> W.Lv5/A.Lv2 ตอนใช้ Ethernium/Etherdeocon ระหว่าง Refine Event ได้เรท: 80/80/60/60/40/40/18 (สูงกว่า) — ดู §5.3

### 5.2 หิน Enriched / HD — ไม่มี Event

| Upgrade | W.Lv1 | W.Lv2 | W.Lv3 | W.Lv4 | W.Lv5/A.Lv2 | A.Lv1/Shadow |
|---|---|---|---|---|---|---|
| +3→+4 | 100 | 100 | 100 | 100 | 90 | 100 |
| +4→+5 | 100 | 100 | 100 | 90 | 70 | 90 |
| +5→+6 | 100 | 100 | 90 | 70 | 60 | 70 |
| +6→+7 | 100 | 90 | 80 | 70 | 60 | 70 |
| +7→+8 | 90 | 70 | 40 | 40 | 40 | 40 |
| +8→+9 | 70 | 40 | 40 | 40 | 40 | 40 |
| +9→+10 | 30 | 30 | 30 | 20 | 20 | 20 |
| +10→+14 | 18 | 18 | 18 | 8 | 15 | — |
| +14→+15 | 18 | 18 | 18 | 7 | 10 | — |
| +15→+18 | 17 | 17 | 17 | 7 | 10 | — |
| +18→+20 | 15 | 15 | 15 | 5 | 7 | — |

> HD Oridecon/Elunium มีเรทเท่า Enriched (อ้างอิง iROWiki)

### 5.3 หิน Enriched — ระหว่าง Refine Rate Increase Event (+3→+10)

| Upgrade | W.Lv1 | W.Lv2 | W.Lv3 | W.Lv4 | W.Lv5/A.Lv2 | A.Lv1/Shadow |
|---|---|---|---|---|---|---|
| +3→+4 | 100 | 100 | 100 | 100 | 95 | 100 |
| +4→+5 | 100 | 100 | 100 | 95 | 85 | 95 |
| +5→+6 | 100 | 100 | 95 | 80 | 70 | 80 |
| +6→+7 | 100 | 95 | 90 | 80 | 65 | 80 |
| +7→+8 | 95 | 85 | 70 | 60 | 55 | 60 |
| +8→+9 | 85 | 60 | 60 | 50 | 45 | 50 |
| +9→+10 | 55 | 45 | 45 | 35 | 25 | 35 |

### 5.4 หิน HD Carnium/Bradium (HD Ethernium/Etherdeocon สำหรับ W5/A2) — ระหว่าง Event (+10+)

| Upgrade | W.Lv1 | W.Lv2 | W.Lv3 | W.Lv4 | W.Lv5/A.Lv2 | A.Lv1 |
|---|---|---|---|---|---|---|
| +10→+11 | 40 | 40 | 35 | 20 | 20 | 20 |
| +11→+12 | 40 | 40 | 35 | 20 | 20 | 20 |
| +12→+13 | 35 | 35 | 30 | 16 | 20 | 16 |
| +13→+14 | 35 | 35 | 30 | 16 | 20 | 16 |
| +14→+15 | 30 | 30 | 25 | 15 | 15 | 15 |
| +15→+16 | 30 | 30 | 25 | 15 | 15 | 15 |
| +16→+17 | 20 | 20 | 20 | 14 | 15 | 14 |
| +17→+18 | 20 | 20 | 20 | 14 | 15 | 14 |
| +18→+19 | 15 | 15 | 15 | 10 | 10 | 10 |
| +19→+20 | 15 | 15 | 15 | 10 | 10 | 10 |

> **สำคัญ:** ก่อน 7 ก.ย. 2023 (iRO) ตีที่ +10 ด้วยหินใดก็ได้ = 100% สำเร็จ — ปัจจุบันยกเลิกแล้ว
>
> **Note (Renewal):** Event เพิ่มอัตราเฉพาะ Enriched Oridecon/Elunium และ HD Carnium/Bradium เท่านั้น
> **หิน normal +1~+10 ไม่ได้รับผลจาก event** (ดังนั้น event/normal +1~+10 = ค่าเดียวกับ no-event)

---

## 6. Blacksmith Blessing — จำนวนที่ใช้ต่อระดับ

| Upgrade | Normal | Event (ลดราคา) |
|---|---|---|
| +7→+8 | 1 | 1 |
| +8→+9 | 2 | 2 |
| +9→+10 | 4 | 3 |
| +10→+11 | 7 | 4 |
| +11→+12 | 11 | 7 |
| +12→+13 | 16 | 11 |
| +13→+14 | 22 | 16 |
| +14→+15 | 44 (เฉพาะ BSB+15 Event) | — |

> ในโปรเจกต์: `BSB_REQUIRED_NORMAL` / `BSB_REQUIRED_EVENT` (`src/constants/refineConfig.js`)

---

## 7. การจับคู่กับโครงสร้างในโปรเจกต์

ตารางใน §5 map ตรงกับ `RATE_TABLES` ใน `src/constants/refineRates.js`:

| ตารางในเอกสาร | key ในโค้ด |
|---|---|
| §5.1 Normal ไม่มี event | `noevent.normal` |
| §5.2 Enriched/HD ไม่มี event | `noevent.cash` |
| §5.3 Enriched event (+1~+10) + §5.4 HD event (+11+) | `event.cash` |
| §5.1 +1~+10 (normal ไม่รับ event) + §5.4 HD event (+11+) | `event.normal` |

หมายเหตุการ implement:
- `weapon5` กับ `armor2` ใช้คอลัมน์ "W.Lv5/A.Lv2" เหมือนกัน
- `weapon4` กับ `armor1` ใช้คอลัมน์เดียวกัน (W.Lv4 / A.Lv1 เรทตรงกัน)
- `event.normal` ของ W5/A2 ที่ +3~+10 ใช้เรท Ethernium Event (80/80/60/60/40/40/18) ไม่ใช่เรท no-event
- `ENRICHED_RATE_BONUS = 10` ในโค้ดเป็น logic เสริมเก่า; ค่าจริงในตารางคือ rate ที่ระบุไว้ตรง ๆ แล้ว

---

## 8. โบนัสจากการตีบวก (อ้างอิง — ไม่ใช้ใน simulator)

### Weapon (ATK & MATK เพิ่มต่อระดับ)
| Lv. | ต่อ +1 | Over Upgrade (เกิน safety) | High Upgrade (+16→+20) |
|---|---|---|---|
| 1 | +2 | 0~3 | +16 ที่ +16, +1/ระดับ |
| 2 | +3 | 0~5 | +32 ที่ +16, +2/ระดับ |
| 3 | +5 | 0~8 | +32 ที่ +16, +2/ระดับ |
| 4 | +7 | 0~14 | +48 ที่ +16, +3/ระดับ |
| 5 | +8 ATK + 2 P.ATK/S.MATK | ไม่มี variance | (ขึ้นกับ Grade) |

> W.Lv5 + Grade เพิ่ม ATK ต่อระดับ: No Grade 8 / D 8.8 / C 10.4 / B 12 / A 16

### Armor
- **Lv.1:** Hard DEF += Floor[(3 + ระดับปัจจุบัน) ÷ 4]
- **Lv.2:** Hard DEF มากกว่า Lv.1 +20% และทุกระดับเพิ่ม RES/MRES +2

---

## 9. เมื่อแก้ logic ต้องอัปเดตที่ไหนบ้าง

แก้กติกา/อัตรา → ต้องแก้ให้ตรงกันทั้ง 3 จุด:
1. `src/constants/refineRates.js` — ตารางอัตรา (§5)
2. `src/components/Layout/index.jsx` → `handleRefine` — กติกาผลล้มเหลว (§4)
3. `src/utils/simulate.js` → `simulateRound` — ต้อง mirror `handleRefine` ทุกสาขา

เอกสารนี้คือ reference; ถ้าอัปเดต iROWiki มีค่าใหม่ ให้แก้ที่นี่ก่อนแล้วค่อย sync ลงโค้ด
