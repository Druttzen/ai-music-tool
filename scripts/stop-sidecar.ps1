<#
.SYNOPSIS
  Stop the local AI sidecar (uvicorn on port 8723).
#>
$ErrorActionPreference = "SilentlyContinue"
$root = Split-Path -Parent $PSScriptRoot
$pidFile = Join-Path $root "ai-sidecar\.sidecar.pid"
$sidecarDir = [IO.Path]::GetFullPath((Join-Path $root "ai-sidecar"))
$expectedPython = Join-Path $sidecarDir ".venv\Scripts\python.exe"
$stopped = @{}

function Test-OwnedSidecar([int]$procId) {
  $info = Get-CimInstance Win32_Process -Filter "ProcessId=$procId" -ErrorAction SilentlyContinue
  if (-not $info -or -not $info.CommandLine) { return $false }
  $commandLine = [string]$info.CommandLine
  $pythonPattern = '^"?' + [regex]::Escape($expectedPython) + '"?(?:\s|$)'
  $appDirPattern = '(?:^|\s)--app-dir\s+"?' + [regex]::Escape($sidecarDir) + '"?(?:\s|$)'
  return ($commandLine -match $pythonPattern) -and
    ($commandLine -match '(?:^|\s)-m\s+uvicorn\s+ai_sidecar\.main:app(?:\s|$)') -and
    ($commandLine -match $appDirPattern)
}

function Stop-ProcId([int]$procId, [string]$reason) {
  if ($procId -le 0 -or $stopped.ContainsKey($procId)) { return }
  if (-not (Test-OwnedSidecar $procId)) {
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
