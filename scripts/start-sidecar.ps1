<#
.SYNOPSIS
  Start the Python AI sidecar (FastAPI + librosa) on http://127.0.0.1:8723.
  Creates a venv and installs deps on first run.
#>
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$sidecar = Join-Path $root "ai-sidecar"
$venv = Join-Path $sidecar ".venv"
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

Write-Host "Starting AI sidecar on http://127.0.0.1:8723 (py -$py)"
& "$venv\Scripts\uvicorn" ai_sidecar.main:app --host 127.0.0.1 --port 8723 --app-dir $sidecar
