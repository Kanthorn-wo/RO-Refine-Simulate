# Auto Deploy Script for Windows
# วางไฟล์นี้ในโฟลเดอร์โปรเจค

param(
    [string]$CommitMessage = "Auto update: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
)

Write-Host "🚀 Starting auto deploy process..." -ForegroundColor Green

# เช็คว่าอยู่ใน git repository หรือไม่
if (-not (Test-Path ".git")) {
    Write-Error "Not a git repository!"
    exit 1
}

# Build project
Write-Host "📦 Building project..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Error "Build failed!"
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
    Write-Host "✅ Successfully deployed to $currentBranch!" -ForegroundColor Green
} else {
    Write-Error "Push failed!"
    exit 1
}

Write-Host "🎉 Deploy completed!" -ForegroundColor Green
