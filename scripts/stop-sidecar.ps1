<#
.SYNOPSIS
  Stop the local AI sidecar (uvicorn on port 8723).
#>
$ErrorActionPreference = "SilentlyContinue"
$root = Split-Path -Parent $PSScriptRoot
$pidFile = Join-Path $root "ai-sidecar\.sidecar.pid"
$sidecarDir = [IO.Path]::GetFullPath((Join-Path $root "ai-sidecar"))
. (Join-Path $PSScriptRoot "lib\sidecar-process.ps1")
$stopped = @{}

function Stop-ProcId([int]$procId, [string]$reason) {
  if ($procId -le 0 -or $stopped.ContainsKey($procId)) { return }
  if (-not (Test-OwnedSidecarProcess -ProcessId $procId -SidecarDir $sidecarDir)) {
    Write-Warning "Kept PID $procId ($reason): it is not this workspace's sidecar."
    return
  }
  try {
    Stop-Process -Id $procId -Force -ErrorAction Stop
    $stopped[$procId] = $true
    Write-Host "Stopped PID $procId ($reason)"
  } catch {
    Write-Warning "Could not stop PID $procId : $_"
  }
}

if (Test-Path $pidFile) {
  $raw = (Get-Content $pidFile -Raw).Trim()
  if ($raw -match '^\d+$') {
    Stop-ProcId ([int]$raw) "sidecar pid file"
  }
  Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
}

foreach ($conn in Get-NetTCPConnection -LocalPort 8723 -State Listen -ErrorAction SilentlyContinue) {
  Stop-ProcId $conn.OwningProcess "port 8723"
}

if ($stopped.Count -eq 0) {
  Write-Host "No AI sidecar process on port 8723"
}
