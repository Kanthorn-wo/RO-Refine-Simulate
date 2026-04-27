// สร้างไฟล์ข้อมูลที่อัพเดตทุกวัน
export const dailyData = {
  "lastUpdated": "2026-04-27T00:19:09.305Z",
  "dayOfYear": 117,
  "updateCount": 784,
  "randomTip": "💰 เคล็ดลับ: วางแผนการใช้ BSB ให้ดีก่อนตีบวกระดับสูง",
  "specialEvent": "🎉 วันนี้เป็นวันมงคล! อัตราสำเร็จอาจจะสูงขึ้น!",
  "version": "v1.0.27"
};

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
};