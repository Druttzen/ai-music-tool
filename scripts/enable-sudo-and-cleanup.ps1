# Enables Windows sudo (one UAC) or uses existing sudo, then cleans electron-dist* folders.
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Test-SudoEnabled {
  try {
    $null = & sudo.cmd /c "exit 0" 2>$null
    return $LASTEXITCODE -eq 0
  } catch {
    return $false
  }
}

function Test-IsAdmin {
  return ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator
  )
}

if (-not (Test-SudoEnabled)) {
  if (-not (Test-IsAdmin)) {
    Write-Host "Elevating once to enable Windows sudo..." -ForegroundColor Cyan
    Start-Process powershell.exe -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
    exit 0
  }
  $key = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Sudo"
  if (-not (Test-Path $key)) { New-Item -Path $key -Force | Out-Null }
  New-ItemProperty -Path $key -Name "Enabled" -Value 3 -PropertyType DWord -Force | Out-Null
  Write-Host "Windows sudo enabled (inline mode)." -ForegroundColor Green
}

Write-Host "Running cleanup via sudo..." -ForegroundColor Cyan
& sudo.exe powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "cleanup-locked-electron-dist.ps1")
$cleanupExit = $LASTEXITCODE

if ($cleanupExit -ne 0) {
  Write-Host "Registering SYSTEM startup cleanup task..." -ForegroundColor Yellow
  & sudo.exe schtasks /Create /TN "AIMusicCreator-CleanupElectronDist" /TR "powershell.exe -NoProfile -ExecutionPolicy Bypass -File $Root\scripts\cleanup-locked-electron-dist.ps1" /SC ONSTART /RU SYSTEM /RL HIGHEST /F | Out-Null
  Write-Host "Reboot once (before opening Cursor) to finish deleting locked folders." -ForegroundColor Green
  exit 1
}

Write-Host "All stale electron-dist folders removed." -ForegroundColor Green
exit 0
