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

function Start-SidecarDevWatcher {
  if (Test-Path $watcherPidFile) {
    $existing = (Get-Content $watcherPidFile -Raw).Trim()
    if ($existing -match '^\d+$') {
      $proc = Get-Process -Id ([int]$existing) -ErrorAction SilentlyContinue
      if ($proc) {
        Write-Host "Sidecar dev watcher already running (PID $existing)"
        return
      }
    }
  }

  $proc = Start-Process `
    -FilePath "powershell.exe" `
    -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $watcherScript) `
    -WorkingDirectory $root `
    -WindowStyle Hidden `
    -PassThru

  if (-not $proc) {
    Write-Warning "Could not start sidecar dev watcher"
    return
  }

  $proc.Id | Out-File -FilePath $watcherPidFile -Encoding ascii -NoNewline
  Write-Host "Started sidecar dev watcher (PID $($proc.Id))"
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
