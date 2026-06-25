<#
.SYNOPSIS
  Stop the background sidecar dev watcher process.
#>
$ErrorActionPreference = "SilentlyContinue"
$root = Split-Path -Parent $PSScriptRoot
$watcherPidFile = Join-Path $root "ai-sidecar\.sidecar-watcher.pid"

if (-not (Test-Path $watcherPidFile)) {
  Write-Host "No sidecar dev watcher pid file"
  exit 0
}

$raw = (Get-Content $watcherPidFile -Raw).Trim()
Remove-Item $watcherPidFile -Force -ErrorAction SilentlyContinue

if ($raw -match '^\d+$') {
  $procId = [int]$raw
  try {
    Stop-Process -Id $procId -Force
    Write-Host "Stopped sidecar dev watcher PID $procId"
  } catch {
    Write-Host "Sidecar dev watcher PID $procId was not running"
  }
}
