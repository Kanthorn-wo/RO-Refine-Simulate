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

- **ตารางอัตราสำเร็จที่ใช้จริง** คือ `REFINE_RATES_TABLE_NORMAL` และ `REFINE_RATES_TABLE_CASH` ที่ประกาศใน `index.jsx` แยกตามประเภทไอเท็ม (`armor1`, `armor2`, `weapon1`–`weapon5`) **ไม่ใช่** `REFINE_RATES_NORMAL`/`REFINE_RATES_CASH` ใน `src/constants/refineConfig.js` (ค่าใน `refineConfig.js` import เข้ามาแต่ปัจจุบันไม่ได้ใช้ในการคำนวณ) ถ้าจะแก้สูตรอัตราต้องแก้ที่ตารางใน `index.jsx`
- **BSB (Black Smith Blessing)** ใช้ได้เฉพาะระดับ +7 ถึง +13 (เช็คผ่าน `stack.length`) จำนวนที่ต้องใช้แต่ละระดับมาจาก `BSB_REQUIRED` ใน `src/constants/refineConfig.js` ผลของ BSB ขึ้นกับชนิดหิน: หินแครชกัน "ลดระดับ", หินธรรมดากัน "ไอเทมหาย"
- **กติกาผลล้มเหลว** อยู่ใน `handleRefine`:
  - `weapon5` และ `armor2` เป็นเคสพิเศษ: หินแครชล้มเหลว = −1 ระดับ, หินธรรมดาล้มเหลว = −3 ระดับ (clamp ที่ 0); ระดับ 0 ที่ใช้หินธรรมดาแล้วล้ม = ไอเทมหาย
  - ประเภทอื่น: หินแครช = −1 ระดับ, หินธรรมดา = ไอเทมหายทันที
- **Sprite animation** ใช้ระบบ frame-by-frame ผ่าน `<img>` หลายตัวซ้อนแล้วโชว์เฉพาะ index ที่ active โหมดมี 4 สถานะ (`wait`, `process`, `success`, `fail`) แต่ละสถานะมี `useEffect` คุม interval ของตัวเอง รูปวางที่ `public/images/{waiting|processing|success|fail}/*.bmp` ตั้งชื่อตามแพตเทิร์นใน `getFrameSrc` (สังเกตว่า `processing` ใช้ prefix สองแบบสลับที่ index 9: `bg_refininga_process_` ก่อนหน้านั้น, `bg_refining_process_` ตั้งแต่ index 9) ห้ามแก้ชื่อไฟล์โดยไม่อัปเดต `getFrameSrc` ให้ตรงกัน
- **เสียง** import จาก `assets/sounds/*` (ใช้ alias `assets` ที่ตั้งใน `vite.config.js` ชี้ไป `src/assets`) เล่นเป็น `new Audio(...)` ต่อกันด้วย `onended`

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

- การคำนวณอัตราสำเร็จและกติกาแพ้/ชนะกระจุกอยู่ใน `handleRefine` เดียว แก้ตรงไหนต้องไล่ flow ของ `useCash`, `useBSB`, `itemType`, `stack.length` ให้ครบทุกสาขา
- `useEffect` ของแต่ละโหมด animation depend เฉพาะ `mode` (และบางตัวก็ `isFail`/`isSuccessLoop`) ถ้าเพิ่ม state ที่ต้อง reset ตอนเปลี่ยนโหมดให้ระวัง interval ตกค้าง
- เลข `bsbCount = 30000` เป็นค่าเริ่มต้น hardcode ใน state ถ้าผู้ใช้ขอเปลี่ยนต้องบอกจุดนี้
