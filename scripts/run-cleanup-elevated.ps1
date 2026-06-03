# Self-elevates, then runs cleanup + schedules reboot delete for anything still locked.
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator
)

if (-not $isAdmin) {
  $arg = "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
  Start-Process powershell.exe -Verb RunAs -ArgumentList $arg
  exit $LASTEXITCODE
}

$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "=== Elevated electron-dist cleanup ===" -ForegroundColor Cyan
& (Join-Path $PSScriptRoot "cleanup-locked-electron-dist.ps1")
$cleanupExit = $LASTEXITCODE

if ($cleanupExit -ne 0) {
  Write-Host ""
  Write-Host "Some folders still locked — scheduling delete on next reboot..." -ForegroundColor Yellow
  & (Join-Path $PSScriptRoot "schedule-electron-dist-delete-on-reboot.ps1")
  $scheduleExit = $LASTEXITCODE
  if ($scheduleExit -eq 0) {
    Write-Host "Reboot once (before opening Cursor) to finish cleanup." -ForegroundColor Green
  } else {
    Write-Host "Reboot scheduling failed." -ForegroundColor Red
    exit 1
  }
} else {
  Write-Host "All stale electron-dist folders removed." -ForegroundColor Green
}

exit 0
