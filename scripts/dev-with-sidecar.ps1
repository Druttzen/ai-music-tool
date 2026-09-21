<#
.SYNOPSIS
  Ensure the sidecar dev watcher is running (single instance), then run a dev command.
#>
param(
  [switch]$Inspect,
  [switch]$Tauri,
  [switch]$WatchOnly
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$sidecarDir = Join-Path $root "ai-sidecar"
$watcherPidFile = Join-Path $sidecarDir ".sidecar-watcher.pid"
$watcherScript = Join-Path $PSScriptRoot "sidecar-dev-watcher.ps1"

$watcherModeFile = Join-Path $sidecarDir ".sidecar-watcher.mode"
$desiredMode = if ($Tauri) { "studio" } else { "dev" }

function Stop-SidecarDevWatcherIfRunning {
  if (-not (Test-Path $watcherPidFile)) { return }
  $existing = (Get-Content $watcherPidFile -Raw).Trim()
  if ($existing -match '^\d+$') {
    $proc = Get-Process -Id ([int]$existing) -ErrorAction SilentlyContinue
    if ($proc) {
      Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
      Write-Host "Stopped sidecar dev watcher (PID $($proc.Id)) for mode switch"
    }
  }
  Remove-Item $watcherPidFile -Force -ErrorAction SilentlyContinue
}

function Start-SidecarDevWatcher {
  $needRestart = $false
  if (Test-Path $watcherPidFile) {
    $existing = (Get-Content $watcherPidFile -Raw).Trim()
    if ($existing -match '^\d+$') {
      $proc = Get-Process -Id ([int]$existing) -ErrorAction SilentlyContinue
      if ($proc) {
        $currentMode = ""
        if (Test-Path $watcherModeFile) {
          $currentMode = (Get-Content $watcherModeFile -Raw).Trim()
        }
        if ($currentMode -eq $desiredMode) {
          Write-Host "Sidecar dev watcher already running (PID $existing, mode=$currentMode)"
          return
        }
        $needRestart = $true
      }
    }
  }
  if ($needRestart) {
    Stop-SidecarDevWatcherIfRunning
  }

  $watcherArgs = @(
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", $watcherScript
  )
  if ($Tauri) {
    $watcherArgs += "-StudioOwnsSidecar"
  }

  $proc = Start-Process `
    -FilePath "powershell.exe" `
    -ArgumentList $watcherArgs `
    -WorkingDirectory $root `
    -WindowStyle Hidden `
    -PassThru

  if (-not $proc) {
    Write-Warning "Could not start sidecar dev watcher"
    return
  }

  $proc.Id | Out-File -FilePath $watcherPidFile -Encoding ascii -NoNewline
  Write-Host "Started sidecar dev watcher (PID $($proc.Id), mode=$desiredMode)"
}

Start-SidecarDevWatcher

if ($WatchOnly) { exit 0 }

Set-Location $root

if ($Tauri) {
  $env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"
  Set-Location (Join-Path $root "src-tauri")
  & cargo tauri dev
  exit $LASTEXITCODE
}

$env:NODE_OPTIONS = ""
if ($Inspect) {
  & npx next dev --inspect=9241
} else {
  & npx next dev
}
