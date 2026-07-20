<#
.SYNOPSIS
  Install the optional RVC vocal-rvc extra into the sidecar venv.
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
  Write-Host "Creating sidecar venv (py -$py)..."
  & py "-$py" -m venv $venv
  & "$venv\Scripts\python" -m pip install --upgrade pip
  & "$venv\Scripts\pip" install -e $sidecar
}

Write-Host "Installing vocal-ml + vocal-rvc extras (torch + rvc-python)..."
& "$venv\Scripts\pip" install -e "${sidecar}[vocal-ml]"
& "$venv\Scripts\pip" install -e "${sidecar}[vocal-rvc]"
Write-Host "Done. Place RVC models per ai-sidecar README; restart: npm run sidecar"
Write-Host "Check GET /health for vocal_rvc_available when models are configured."
