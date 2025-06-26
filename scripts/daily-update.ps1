# Daily Auto Update Script for Windows
param(
    [string]$CommitMessage = "🤖 Daily auto update - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
)

Write-Host "🔄 Starting daily auto update..." -ForegroundColor Green

# Generate new daily data
Write-Host "📊 Generating new daily data..." -ForegroundColor Yellow

$dailyDataPath = "src\constants\dailyData.js"
$randomTips = @(
    "💡 เคล็ดลับ: ใช้ BSB ตั้งแต่ +7 ขึ้นไปเพื่อป้องกันการลดระดับ",
    "🎯 เคล็ดลับ: หินแครชมีอัตราสำเร็จสูงกว่าหินธรรมดา", 
    "⚔️ เคล็ดลับ: Weapon Lv.1 มีอัตราสำเร็จสูงสุดถึง +10",
    "🛡️ เคล็ดลับ: Armor Lv.1 เสี่ยงน้อยที่สุดในการตีบวก",
    "💰 เคล็ดลับ: วางแผนการใช้ BSB ให้ดีก่อนตีบวกระดับสูง",
    "🔥 เคล็ดลับ: ตีบวกช่วงเช้าๆ อาจจะโชคดีกว่า!",
    "✨ เคล็ดลับ: อย่าลืมเซฟข้อมูลก่อนตีบวกระดับสูง"
)

$now = Get-Date
$dayOfYear = $now.DayOfYear
$updateCount = Get-Random -Minimum 1 -Maximum 1000
$randomTip = $randomTips | Get-Random
$specialEvent = if ((Get-Random -Minimum 0 -Maximum 100) -gt 80) { "🎉 วันนี้เป็นวันมงคล! อัตราสำเร็จอาจจะสูงขึ้น!" } else { "null" }
$version = "v1.0.$($now.Day)"

$dailyDataContent = @"
// สร้างไฟล์ข้อมูลที่อัพเดตทุกวัน
export const dailyData = {
  lastUpdated: "$($now.ToString('yyyy-MM-ddTHH:mm:ss.fffZ'))",
  dayOfYear: $dayOfYear,
  updateCount: $updateCount,
  randomTip: "$randomTip",
  specialEvent: $specialEvent,
  version: "$version"
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
"@

$dailyDataContent | Out-File -FilePath $dailyDataPath -Encoding UTF8
Write-Host "✅ Daily data updated!" -ForegroundColor Green

# Build project
Write-Host "📦 Building project..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Error "Build failed!"
    exit 1
}

# Check if we're in a git repository
if (-not (Test-Path ".git")) {
    Write-Error "Not a git repository!"
    exit 1
}

# Add all changes
Write-Host "📝 Adding changes..." -ForegroundColor Yellow
git add .

# Check if there are changes to commit
$changes = git status --porcelain
if (-not $changes) {
    Write-Host "✅ No changes to commit" -ForegroundColor Green
    exit 0
}

# Commit changes
Write-Host "💾 Committing changes..." -ForegroundColor Yellow
git commit -m $CommitMessage

if ($LASTEXITCODE -ne 0) {
    Write-Error "Commit failed!"
    exit 1
}

# Push to remote
Write-Host "⬆️ Pushing to remote..." -ForegroundColor Yellow
$currentBranch = git rev-parse --abbrev-ref HEAD
git push origin $currentBranch

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Successfully pushed to $currentBranch!" -ForegroundColor Green
} else {
    Write-Error "Push failed!"
    exit 1
}

Write-Host "🎉 Daily auto update completed!" -ForegroundColor Green
