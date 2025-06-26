import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// สร้างข้อมูลใหม่สำหรับวันนี้
const generateDailyData = () => {
  const now = new Date();
  const tips = [
    "💡 เคล็ดลับ: ใช้ BSB ตั้งแต่ +7 ขึ้นไปเพื่อป้องกันการลดระดับ",
    "🎯 เคล็ดลับ: หินแครชมีอัตราสำเร็จสูงกว่าหินธรรมดา",
    "⚔️ เคล็ดลับ: Weapon Lv.1 มีอัตราสำเร็จสูงสุดถึง +10",
    "🛡️ เคล็ดลับ: Armor Lv.1 เสี่ยงน้อยที่สุดในการตีบวก",
    "💰 เคล็ดลับ: วางแผนการใช้ BSB ให้ดีก่อนตีบวกระดับสูง",
    "🔥 เคล็ดลับ: ตีบวกช่วงเช้าๆ อาจจะโชคดีกว่า!",
    "✨ เคล็ดลับ: อย่าลืมเซฟข้อมูลก่อนตีบวกระดับสูง"
  ];

  return {
    lastUpdated: now.toISOString(),
    dayOfYear: Math.floor((now - new Date(now.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24)),
    updateCount: Math.floor(Math.random() * 1000) + 1,
    randomTip: tips[Math.floor(Math.random() * tips.length)],
    specialEvent: Math.random() > 0.8 ? "🎉 วันนี้เป็นวันมงคล! อัตราสำเร็จอาจจะสูงขึ้น!" : null,
    version: `v1.0.${now.getDate()}`
  };
};

// อัพเดตไฟล์ dailyData.js
const updateDailyDataFile = () => {
  const dailyData = generateDailyData();

  const content = `// สร้างไฟล์ข้อมูลที่อัพเดตทุกวัน
export const dailyData = ${JSON.stringify(dailyData, null, 2)};

// ฟังก์ชันสร้างข้อมูลสถิติแบบสุ่ม
export const generateDailyStats = () => {
  const today = new Date();
  return {
    totalRefines: Math.floor(Math.random() * 50000) + 10000,
    successRate: (Math.random() * 20 + 70).toFixed(1) + "%",
    mostPopularItem: ["Armor Lv.1", "Weapon Lv.1", "Weapon Lv.3"][Math.floor(Math.random() * 3)],
    luckyHour: Math.floor(Math.random() * 24) + ":00",
    dailyBonus: Math.random() > 0.5 ? "🍀 โบนัสโชค +5%" : "💎 โบนัส BSB +10%"
  };
};`;

  const filePath = path.join(__dirname, '..', 'src', 'constants', 'dailyData.js');
  fs.writeFileSync(filePath, content, 'utf8');

  console.log('✅ Daily data updated successfully!');
  console.log(`📅 Updated on: ${dailyData.lastUpdated}`);
  console.log(`💡 Today's tip: ${dailyData.randomTip}`);
  if (dailyData.specialEvent) {
    console.log(`🎉 Special event: ${dailyData.specialEvent}`);
  }
};

// รัน script
updateDailyDataFile();
