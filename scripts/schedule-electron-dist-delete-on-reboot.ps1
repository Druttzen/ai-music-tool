# Schedules removal of locked electron-dist folders at next Windows reboot (requires elevation).
param(
  [switch]$Execute
)

$targets = @(
  "electron-dist",
  "electron-dist-fresh",
  "electron-dist-v071"
)

Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class WinMove {
  public const int MOVEFILE_DELAY_UNTIL_REBOOT = 4;
  [DllImport("kernel32.dll", SetLastError=true, CharSet=CharSet.Unicode)]
  public static extern bool MoveFileEx(string lpExistingFileName, string lpNewFileName, int dwFlags);
}
"@

$Root = Split-Path -Parent $PSScriptRoot
$scheduled = 0

foreach ($dir in $targets) {
  $fullDir = Join-Path $Root $dir
  if (-not (Test-Path $fullDir)) { continue }

  Get-ChildItem -LiteralPath $fullDir -Recurse -Force -ErrorAction SilentlyContinue |
    Sort-Object { $_.FullName.Length } -Descending |
    ForEach-Object {
      if ([WinMove]::MoveFileEx($_.FullName, $null, [WinMove]::MOVEFILE_DELAY_UNTIL_REBOOT)) {
        $script:scheduled++
      }
    }

  if ([WinMove]::MoveFileEx($fullDir, $null, [WinMove]::MOVEFILE_DELAY_UNTIL_REBOOT)) {
    $script:scheduled++
  }
}

if ($scheduled -gt 0) {
  Write-Host "Scheduled $scheduled path(s) for delete on next reboot."
  Write-Host "Folders: $($targets -join ', ')"
  exit 0
}

Write-Host "Nothing scheduled (missing folders or insufficient rights)."
exit 1
