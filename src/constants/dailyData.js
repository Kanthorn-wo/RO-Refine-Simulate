// สร้างไฟล์ข้อมูลที่อัพเดตทุกวัน
export const dailyData = {
  "lastUpdated": "2025-08-08T01:02:21.925Z",
  "dayOfYear": 220,
  "updateCount": 448,
  "randomTip": "🎯 เคล็ดลับ: หินแครชมีอัตราสำเร็จสูงกว่าหินธรรมดา",
  "specialEvent": "🎉 วันนี้เป็นวันมงคล! อัตราสำเร็จอาจจะสูงขึ้น!",
  "version": "v1.0.8"
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