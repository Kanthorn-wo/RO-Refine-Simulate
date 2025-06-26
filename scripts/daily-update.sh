#!/bin/bash
# Daily Auto Update Script

# สร้างไฟล์ข้อมูลประจำวันใหม่
node -e "
const fs = require('fs');
const dailyData = {
  lastUpdated: new Date().toISOString(),
  dayOfYear: Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24)),
  updateCount: Math.floor(Math.random() * 1000) + 1,
  randomTip: [
    '💡 เคล็ดลับ: ใช้ BSB ตั้งแต่ +7 ขึ้นไปเพื่อป้องกันการลดระดับ',
    '🎯 เคล็ดลับ: หินแครชมีอัตราสำเร็จสูงกว่าหินธรรมดา',
    '⚔️ เคล็ดลับ: Weapon Lv.1 มีอัตราสำเร็จสูงสุดถึง +10',
    '🛡️ เคล็ดลับ: Armor Lv.1 เสี่ยงน้อยที่สุดในการตีบวก',
    '💰 เคล็ดลับ: วางแผนการใช้ BSB ให้ดีก่อนตีบวกระดับสูง',
    '🔥 เคล็ดลับ: ตีบวกช่วงเช้าๆ อาจจะโชคดีกว่า!',
    '✨ เคล็ดลับ: อย่าลืมเซฟข้อมูลก่อนตีบวกระดับสูง'
  ][Math.floor(Math.random() * 7)],
  specialEvent: Math.random() > 0.8 ? '🎉 วันนี้เป็นวันมงคล! อัตราสำเร็จอาจจะสูงขึ้น!' : null,
  version: 'v1.0.' + new Date().getDate()
};

const content = \`// สร้างไฟล์ข้อมูลที่อัพเดตทุกวัน
export const dailyData = \${JSON.stringify(dailyData, null, 2)};

// ฟังก์ชันสร้างข้อมูลสถิติแบบสุ่ม
export const generateDailyStats = () => {
  const today = new Date();
  return {
    totalRefines: Math.floor(Math.random() * 50000) + 10000,
    successRate: (Math.random() * 20 + 70).toFixed(1) + '%',
    mostPopularItem: ['Armor Lv.1', 'Weapon Lv.1', 'Weapon Lv.3'][Math.floor(Math.random() * 3)],
    luckyHour: Math.floor(Math.random() * 24) + ':00',
    dailyBonus: Math.random() > 0.5 ? '🍀 โบนัสโชค +5%' : '💎 โบนัส BSB +10%'
  };
};\`;

fs.writeFileSync('src/constants/dailyData.js', content);
console.log('✅ Daily data updated successfully!');
"

echo "🔄 Starting daily auto update..."

# Build the project
echo "📦 Building project..."
npm run build

# Add all changes
echo "📝 Adding changes to git..."
git add .

# Create commit message with current date
COMMIT_MSG="🤖 Daily auto update - $(date '+%Y-%m-%d %H:%M:%S')"

# Check if there are changes to commit
if git diff --staged --quiet; then
    echo "✅ No changes to commit"
    exit 0
fi

# Commit changes
echo "💾 Committing changes..."
git commit -m "$COMMIT_MSG"

# Push to remote
echo "⬆️ Pushing to remote..."
git push

if [ $? -eq 0 ]; then
    echo "✅ Daily update completed successfully!"
else
    echo "❌ Push failed!"
    exit 1
fi

echo "🎉 Auto update process completed!"
