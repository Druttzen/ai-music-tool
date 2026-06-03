# Schedules removal of locked electron-dist folders at next Windows reboot (requires elevation).
param(
  [switch]$Execute
)

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

$dynamic = Get-ChildItem -LiteralPath $Root -Directory -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -like "electron-dist*" -and $_.Name -notlike "*.old" } |
  ForEach-Object { $_.Name }

$targets = @($targets + $dynamic | Select-Object -Unique)

Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class WinMove {
  public const int MOVEFILE_DELAY_UNTIL_REBOOT = 4;
  [DllImport("kernel32.dll", SetLastError=true, CharSet=CharSet.Unicode)]
  public static extern bool MoveFileEx(string lpExistingFileName, string lpNewFileName, int dwFlags);
}
"@

Write-Host "Stopping AI Music Creator before scheduling..."
taskkill /F /IM "AI Music Creator.exe" 2>$null | Out-Null
Start-Sleep -Seconds 2

$scheduled = 0
$scheduledDirs = @()

foreach ($dir in $targets) {
  $fullDir = Join-Path $Root $dir
  if (-not (Test-Path $fullDir)) { continue }

  $dirScheduled = $false
  Get-ChildItem -LiteralPath $fullDir -Recurse -Force -ErrorAction SilentlyContinue |
    Sort-Object { $_.FullName.Length } -Descending |
    ForEach-Object {
      if ([WinMove]::MoveFileEx($_.FullName, $null, [WinMove]::MOVEFILE_DELAY_UNTIL_REBOOT)) {
        $script:scheduled++
        $dirScheduled = $true
      }
    }

  if ([WinMove]::MoveFileEx($fullDir, $null, [WinMove]::MOVEFILE_DELAY_UNTIL_REBOOT)) {
    $script:scheduled++
    $dirScheduled = $true
  }

  if ($dirScheduled) { $scheduledDirs += $dir }
}

$logDir = Join-Path $Root "build"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
$logPath = Join-Path $logDir "electron-dist-cleanup.log"
$stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

if ($scheduled -gt 0) {
  "$stamp SCHEDULED REBOOT DELETE - $($scheduledDirs -join ', ') ($scheduled paths)" |
    Out-File -FilePath $logPath -Encoding utf8
  Write-Host "Scheduled $scheduled path(s) for delete on next reboot."
  Write-Host "Folders: $($scheduledDirs -join ', ')"
  exit 0
}

Write-Host "Nothing scheduled (missing folders or insufficient rights - run elevated)."
exit 1
