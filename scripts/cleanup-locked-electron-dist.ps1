# Removes stale electron-dist packaging folders when app.asar is not locked.
# Run from an elevated PowerShell OUTSIDE Cursor if this repo is open in the IDE:
#   Set-Location F:\ai-music-tool
#   .\scripts\cleanup-locked-electron-dist.ps1

$ErrorActionPreference = "Continue"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$targets = @(
  "electron-dist",
  "electron-dist-fresh",
  "electron-dist-v071",
  "electron-dist.old",
  "electron-dist-fresh.old",
  "electron-dist-v071.old"
)

Write-Host "Stopping AI Music Creator..."
taskkill /F /IM "AI Music Creator.exe" 2>$null | Out-Null
Start-Sleep -Seconds 2

$remaining = @()
foreach ($dir in $targets) {
  if (-not (Test-Path $dir)) { continue }
  try {
    Remove-Item -LiteralPath $dir -Recurse -Force -ErrorAction Stop
    Write-Host "Removed $dir"
  } catch {
    Write-Host "Could not remove ${dir}: $($_.Exception.Message)"
    $remaining += $dir
  }
}

$logDir = Join-Path $Root "build"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
$logPath = Join-Path $logDir "electron-dist-cleanup.log"
$stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

if ($remaining.Count -eq 0) {
  "$stamp OK — removed stale electron-dist folders." | Out-File -FilePath $logPath -Encoding utf8
  Write-Host "All stale electron-dist folders removed."
  exit 0
}

Write-Host ""
Write-Host "Still locked (usually Cursor, Explorer, or Search indexing this repo):"
$remaining | ForEach-Object { Write-Host "  - $_" }
Write-Host ""
Write-Host "Close Cursor and any Explorer window under F:\ai-music-tool, then run this script again."
Write-Host "Or reboot and run it once before opening the project."
"$stamp FAILED — still locked: $($remaining -join ', ')" | Out-File -FilePath $logPath -Encoding utf8
exit 1
