# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

จำลองระบบตีบวก (refine) ของ Ragnarok Online เป็นหน้าเดียวด้วย React 19 + Vite (plugin `@vitejs/plugin-react-swc`) ไม่มี TypeScript ไม่มี test runner ติดตั้งอยู่ การ deploy ใช้ GitHub Actions ดัน static build ไปที่ GitHub Pages

## Commands

- `npm run dev` — Vite dev server
- `npm run build` — build production bundle ไปที่ `dist/`
- `npm run preview` — preview build
- `npm run lint` — ESLint ตามคอนฟิกใน `eslint.config.js` (flat config, rule `no-unused-vars` ignore ตัวที่ขึ้นต้นด้วยตัวพิมพ์ใหญ่หรือ `_`)
- `npm run update-data` — รัน `scripts/update-daily-data.js` เพื่อ regenerate ไฟล์ `src/constants/dailyData.js` (ใช้ใน workflow ประจำวัน — รันเองเฉพาะตอนต้องการ refresh ข้อมูลตัวอย่าง)

คำเตือนเกี่ยวกับ script auto-commit ใน `package.json`:
- `deploy`, `quick-commit`, `auto-deploy`, `watch-and-deploy`, `start-auto`, `watch-changes` ทุกตัว **commit + push อัตโนมัติ** ห้ามรันให้ผู้ใช้โดยไม่ขออนุญาตก่อน

## Architecture

### Entry และ shell
- `index.html` → `src/main.jsx` mount `<App />` (ไม่ใช้ `StrictMode` ห่อ children เพิ่ม)
- `src/App.jsx` render เฉพาะ `<Container />` จาก `src/components/Layout/index.jsx` — ตรรกะทั้งหมดของแอปอยู่ที่ Container เดียว

### `src/components/Layout/index.jsx` (ไฟล์หลัก)
รวมทุกอย่างไว้ใน component เดียว ทั้ง state, ตารางอัตราสำเร็จ, sprite animation, sound effect และ UI ของตาราง/ปุ่ม/log จุดสำคัญที่ต้องเข้าใจก่อนแก้:

#### ตารางอัตราสำเร็จ
- ตารางที่ใช้จริงคือ `REFINE_RATES_TABLE_NORMAL` และ `REFINE_RATES_TABLE_CASH` ที่ประกาศใน `index.jsx` แยกตามประเภทไอเท็ม (`armor1`, `armor2`, `weapon1`–`weapon5`) **ไม่ใช่** ค่าใน `src/constants/refineConfig.js` (import เข้ามาแต่ไม่ได้ใช้ในการคำนวณจริง) ถ้าจะแก้สูตรอัตราต้องแก้ที่ตารางใน `index.jsx`

#### กติกาผลล้มเหลว (อยู่ใน `handleRefine`)
- **`weapon5` และ `armor2`** เป็นเคสพิเศษ แยกเป็น 2 ช่วง:
  - Low range (+0~+9): หินธรรมดาล้ม = −3 ระดับ, Enriched ล้ม = −1 ระดับ — clamp ที่ 0 ไม่หาย, HD ไม่มีในช่วงนี้
  - High range (+10+): ทุกหินล้มเหลว = ไอเทมหาย (รวม HD Etel ด้วย)
- **ประเภทอื่น (armor1, weapon1–4):** HD ล้ม = −1 ระดับ, หินธรรมดา/Enriched ล้ม = ไอเทมหายทันที
- BSB ป้องกันผลล้มเหลว (ทั้ง item หายและลดระดับ) ถ้าเปิด toggle และอยู่ในช่วง +7→+14 (`stack.length >= 7 && stack.length <= 14`)

#### BSB (Black Smith Blessing)
- ใช้ได้ที่ `stack.length` 7–14 (ตีจาก +7→+8 ถึง +14→+15) เช็คผ่าน `bsbInRange`
- จำนวน BSB ต่อระดับมาจาก `BSB_REQUIRED_NORMAL` / `BSB_REQUIRED_EVENT` ใน `src/constants/refineConfig.js` เลือกตาม `isEventRate`
- เมื่อมี BSB: log บอกว่าป้องกัน "ลดระดับ" (HD) หรือ "ไอเทมหาย" (หินธรรมดา/Enriched) แล้วแต่ชนิดหิน

#### ระบบ Auto ตีบวก
Auto มี state หลักดังนี้ — แก้ไขอะไรใน auto ต้องอ่านทั้งกลุ่มนี้:

| state | ความหมาย |
|---|---|
| `autoRefine` | เปิด/ปิดโหมด auto (toggle) |
| `autoStart` | ระดับเริ่มต้น auto — **แยกจาก global start level** |
| `autoTarget` | เป้าหมายระดับที่ auto จะตีถึง (> autoStart เสมอ) |
| `autoRunning` | กำลังตี auto อยู่จริง |
| `autoStoneRules` | แผนชนิดหินแต่ละช่วง `[{ id, from, stone }]` |
| `autoUseBSB` | เปิด/ปิด BSB อัตโนมัติ |
| `autoBSBStart` | ระดับเริ่มใส่ BSB (7 ถึง min(14, autoTarget-1)) |
| `autoBSBEnd` | ระดับเลิกใส่ BSB exclusive (สูงสุด min(15, autoTarget)) |

BSB section ซ่อนทั้งหมดเมื่อ `autoTarget < 8` เพราะ BSB ใช้ได้ตั้งแต่ +7→+8 auto ต้องตีถึงอย่างน้อย +8 จึงจะมีประโยชน์

**Stone rules semantics ที่สำคัญมาก:** `from` ในแต่ละ rule คือ **destination level** ไม่ใช่ source — เพราะ auto loop เรียก `getPlannedStone(autoStoneRules, stack.length + 1)` (ส่ง stack.length+1 เข้าไป) ดังนั้น rule ที่ `from: 6` จะมีผลตอน item อยู่ที่ +5 กำลังตีไป +6 ถ้าจะแก้ stone rules ต้องเข้าใจ offset นี้

**`stopOnLoss` ใน stone rules:** แต่ละ rule มี `stopOnLoss: boolean` — toggle "หยุด Auto ถ้าเสี่ยงหาย" แสดงเฉพาะเมื่อช่วงนั้นมีระดับที่ล้มแล้ว item หายจริง (`toggleHasMeaning`) โดยตรวจ 3 เงื่อนไขพร้อมกัน: (1) stone ชนิดนั้น+ช่วงนั้นสามารถ item หายได้, (2) rate < 100% (ไม่งั้นล้มไม่ได้อยู่แล้ว), (3) BSB ไม่คุ้มกันตลอดทุกระดับในช่วง

**Auto loop (useEffect):** ทำงานเมื่อ `autoRunning && !isPlaying && mode !== 'process'` โดยลำดับ:
1. เช็ค stop condition (ถึง target, item หาย)
2. ปรับชนิดหินตามแผน (`getPlannedStone` → `getEffectiveStone`) — ถ้าต้องเปลี่ยน `useCash`/`useEnriched` จะ return รอ re-render ก่อน
3. ปรับ BSB toggle ตาม `autoBSBStart`/`autoBSBEnd` — ถ้าต้องเปลี่ยนก็ return รอ re-render เช่นกัน
4. เช็ค `applicableRule.stopOnLoss` — ถ้าหินถัดไปเสี่ยง item หาย, BSB ไม่คุ้มกัน **และ rate < 100%**: หยุด
5. `setTimeout(handleRefine, 450)` เพื่อตีรอบถัดไป

**เมื่อ `autoRefine = true`:** global "เริ่มที่ระดับตีบวก" จะ dim + disabled, stone type panel dim + pointer-events-none, BSB toggle manual disabled ถ้า `autoUseBSB = true`, ปุ่ม manual refine disabled

**Handler ที่เกี่ยวข้อง:**
- `handleAutoStartChange(level)` — เปลี่ยน autoStart และ sync stack ทันที
- `handleStartAuto()` — reset stack ไปที่ autoStart แล้วเริ่ม autoRunning
- `handleStopAuto()` — หยุด autoRunning และ reset BSB ที่ auto เปิดไว้
- `handleBackToWait()` — กด "กลับไป" หลัง fail: ถ้า autoRefine เปิดอยู่จะ reset stack ไปที่ autoStart แทน 0
- `handleClearSession()` — ล้าง log, oreUsed, bsbUsedTotal

#### Sprite animation
ใช้ระบบ frame-by-frame ผ่าน `<img>` หลายตัวซ้อนแล้วโชว์เฉพาะ index ที่ active โหมดมี 4 สถานะ (`wait`, `process`, `success`, `fail`) แต่ละสถานะมี `useEffect` คุม interval ของตัวเอง รูปวางที่ `public/images/{waiting|processing|success|fail}/*.bmp` ตั้งชื่อตามแพตเทิร์นใน `getFrameSrc` (สังเกตว่า `processing` ใช้ prefix สองแบบสลับที่ index 9: `bg_refininga_process_` ก่อนหน้านั้น, `bg_refining_process_` ตั้งแต่ index 9) ห้ามแก้ชื่อไฟล์โดยไม่อัปเดต `getFrameSrc` ให้ตรงกัน

#### เสียง
import จาก `assets/sounds/*` (ใช้ alias `assets` ที่ตั้งใน `vite.config.js` ชี้ไป `src/assets`) เล่นเป็น `new Audio(...)` ต่อกันด้วย `onended`

### โมดูลย่อย
- `src/components/DateTimeDisplay/index.jsx` — นาฬิกาเรียลไทม์ inline-styled
- `src/components/DailyInfoPanel/index.jsx` — แผงข้อมูลประจำวัน อ่าน `dailyData` (static) + `generateDailyStats` (random ทุก 5 นาที) จาก `src/constants/dailyData.js`

### Path alias
ใน Vite ตั้ง alias `assets` → `src/assets` (ใช้ในการ import รูป/เสียง) ส่วน frame ของ sprite ใช้ public path `/images/...` ตรง ๆ ไม่ผ่าน alias

### ข้อมูลที่ regenerate อัตโนมัติ
- `src/constants/dailyData.js` ถูก overwrite โดย `scripts/update-daily-data.js` (และ workflow `.github/workflows/auto-deploy.yml` ที่รันทุกวัน 00:00 UTC) ห้ามใส่ logic หรือ comment ที่ต้องคงไว้ในไฟล์นี้ — มันจะถูกเขียนทับ ถ้าจะเพิ่มฟิลด์ใหม่ต้องแก้ที่ template string ใน `update-daily-data.js` ด้วย
- `src/config-updates.js` เป็นไฟล์ append-only comment ที่ workflow บางตัวเขียนเข้าไป ไม่มีโค้ดทำงาน

### CI / deploy
`.github/workflows/auto-deploy.yml` รัน `npm run update-data` → `npm run build` → commit ไฟล์ที่เปลี่ยน → deploy `dist/` ไป `gh-pages` ผ่าน `peaceiris/actions-gh-pages@v3` มี workflow อีก 2 ตัว (`daily-update-alt.yml`, `random-contributions.yml`) สำหรับงาน schedule อื่น

## เรื่องที่ควรระวังเวลาแก้

- การคำนวณอัตราสำเร็จและกติกาแพ้/ชนะกระจุกอยู่ใน `handleRefine` เดียว แก้ตรงไหนต้องไล่ flow ของ `useCash`, `useEnriched`, `useBSB`, `itemType`, `stack.length` ให้ครบทุกสาขา
- `useEffect` ของแต่ละโหมด animation depend เฉพาะ `mode` (และบางตัวก็ `isFail`/`isSuccessLoop`) ถ้าเพิ่ม state ที่ต้อง reset ตอนเปลี่ยนโหมดให้ระวัง interval ตกค้าง
- auto loop `useEffect` มี dependency array ยาว — ถ้าเพิ่ม state ที่ auto loop ต้องอ่านต้องใส่ใน deps ด้วย (มี `// eslint-disable-next-line react-hooks/exhaustive-deps` เพราะ handleRefine เป็น closure)
- `autoStoneRules[0].from` ล็อคไว้ (user แก้ไม่ได้) และ derive จาก `autoStart` ผ่าน `useEffect([autoStart])` — ห้ามแก้ค่านี้โดยตรงใน handler อื่น
- เมื่อ `autoRefine` เปิดและ `autoStart` เปลี่ยน → stack จะ sync ทันทีผ่าน `handleAutoStartChange` ซึ่งทำงานเป็น event handler ไม่ใช่ useEffect (ทำให้ไม่มี stale closure)
- `getPlannedStone` รับ `stack.length + 1` เสมอ (destination level) — อย่าส่ง `stack.length` เพราะจะ offset ผิด
- Log/stats (`log`, `oreUsed`, `bsbUsedTotal`) สะสมข้าม session จนกว่าจะกด "ล้าง Session" (`handleClearSession`) — ตั้งใจให้เป็น global session counter
