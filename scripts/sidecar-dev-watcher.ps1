<#
.SYNOPSIS
  Background watcher: keeps the AI sidecar alive while dev tools run, stops it after they exit.
#>
param(
  [int]$PollSec = 15,
  [int]$StopAfterDevSec = 90
)

$ErrorActionPreference = "SilentlyContinue"
$root = Split-Path -Parent $PSScriptRoot
$sidecarDir = Join-Path $root "ai-sidecar"
$watcherPidFile = Join-Path $sidecarDir ".sidecar-watcher.pid"
$startSidecar = Join-Path $PSScriptRoot "start-sidecar.ps1"
$stopSidecar = Join-Path $PSScriptRoot "stop-sidecar.ps1"
$rootPattern = [regex]::Escape($root)
$stopTicks = [Math]::Max(1, [int][Math]::Ceiling($StopAfterDevSec / $PollSec))
$inactiveTicks = 0

function Test-DevToolActive {
  if (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1) {
    return $true
  }
  $procs = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object {
      $cmd = $_.CommandLine
      if (-not $cmd -or $cmd -notmatch $rootPattern) { return $false }
      return ($cmd -match 'next(\.js|\\)|next/dist|next dev') -or
        ($_.Name -eq 'electron.exe') -or
        ($cmd -match 'ai-music-studio|cargo tauri dev|tauri dev')
    }
  return [bool]($procs | Select-Object -First 1)
}

function Send-DevSessionPing {
  try {
    Invoke-RestMethod -Uri "http://127.0.0.1:8723/dev-session/ping" -Method POST -TimeoutSec 3 | Out-Null
    return $true
  } catch {
    return $false
  }
}

function Ensure-SidecarUp {
  $listening = Get-NetTCPConnection -LocalPort 8723 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($listening) { return $true }
  & powershell -NoProfile -ExecutionPolicy Bypass -File $startSidecar -IdleExitSec 300 | Out-Null
  Start-Sleep -Seconds 1
  return [bool](Get-NetTCPConnection -LocalPort 8723 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1)
}

Write-Host "Sidecar dev watcher started (poll ${PollSec}s, stop ${StopAfterDevSec}s after dev exits)"

while ($true) {
  if (Test-DevToolActive) {
    $inactiveTicks = 0
    if (Ensure-SidecarUp) {
      Send-DevSessionPing | Out-Null
    }
  } else {
    $inactiveTicks++
    if ($inactiveTicks -ge $stopTicks) {
      & powershell -NoProfile -ExecutionPolicy Bypass -File $stopSidecar | Out-Null
      $inactiveTicks = 0
    }
  }
  Start-Sleep -Seconds $PollSec
}
