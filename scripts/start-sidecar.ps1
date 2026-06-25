<#
.SYNOPSIS
  Start the Python AI sidecar (FastAPI + librosa) on http://127.0.0.1:8723.
  Default: detached background process (no terminal hold). Use -Foreground to attach.
#>
param(
  [switch]$Foreground,
  [int]$IdleExitSec = 300
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$sidecar = Join-Path $root "ai-sidecar"
$venv = Join-Path $sidecar ".venv"
$pidFile = Join-Path $sidecar ".sidecar.pid"
$logFile = Join-Path $sidecar ".sidecar.log"
$py = $null

foreach ($v in @("3.12", "3.11", "3.10")) {
  try {
    $out = & py "-$v" --version 2>&1
    if ($LASTEXITCODE -eq 0 -and "$out" -match "Python") { $py = $v; break }
  } catch {}
}

if (-not $py) {
  Write-Error "Need Python 3.10-3.12. Run: npm run bootstrap"
  exit 1
}

if (-not (Test-Path $venv)) {
  Write-Host "Creating venv (py -$py)..."
  & py "-$py" -m venv $venv
  & "$venv\Scripts\python" -m pip install --upgrade pip
  & "$venv\Scripts\pip" install -e $sidecar
}

$existing = Get-NetTCPConnection -LocalPort 8723 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($existing) {
  Write-Host "AI sidecar already running (PID $($existing.OwningProcess)) on http://127.0.0.1:8723"
  exit 0
}

$python = Join-Path $venv "Scripts\python.exe"
if ($IdleExitSec -le 0) {
  $env:SIDECAR_IDLE_EXIT_SEC = "0"
} else {
  $env:SIDECAR_IDLE_EXIT_SEC = "$IdleExitSec"
}
$uvicornArgs = @(
  "-m", "uvicorn", "ai_sidecar.main:app",
  "--host", "127.0.0.1",
  "--port", "8723",
  "--app-dir", $sidecar
)

if ($Foreground) {
  Write-Host "Starting AI sidecar (foreground) on http://127.0.0.1:8723 (py -$py, idle-exit ${IdleExitSec}s)"
  $ErrorActionPreference = "Continue"
  & $python @uvicornArgs
  exit $LASTEXITCODE
}

Write-Host "Starting AI sidecar (background) on http://127.0.0.1:8723 (py -$py, idle-exit ${IdleExitSec}s)"
$proc = Start-Process `
  -FilePath $python `
  -ArgumentList $uvicornArgs `
  -WorkingDirectory $sidecar `
  -RedirectStandardOutput $logFile `
  -RedirectStandardError "${logFile}.err" `
  -WindowStyle Hidden `
  -PassThru

if (-not $proc) {
  Write-Error "Failed to start AI sidecar"
  exit 1
}

$proc.Id | Out-File -FilePath $pidFile -Encoding ascii -NoNewline
Write-Host "AI sidecar PID $($proc.Id) (log: $logFile)"

# Wait for bind (uvicorn can take >1s on cold start).
$bound = $null
for ($i = 0; $i -lt 15; $i++) {
  if ($proc.HasExited) {
    Write-Error "AI sidecar exited immediately (code $($proc.ExitCode)). Check $logFile and ${logFile}.err"
    Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
    exit 1
  }
  $bound = Get-NetTCPConnection -LocalPort 8723 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($bound) { break }
  Start-Sleep -Milliseconds 200
}

if (-not $bound) {
  Write-Warning "Sidecar started but port 8723 not listening yet - check $logFile"
} else {
  Write-Host "Ready at http://127.0.0.1:8723"
}
