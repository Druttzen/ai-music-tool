<#
.SYNOPSIS
  Install optional vocal-ml stack (torch + scipy) for RVC/DiffSinger integrations.
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

Write-Host "Installing vocal + vocal-ml extras (torch + scipy) - this may take several minutes..."
Push-Location $root
& "$venv\Scripts\pip" install -e ".\ai-sidecar[vocal,vocal-ml]"
Pop-Location
Write-Host "Vocal ML stack installed."
Write-Host "Optional RVC python package: pip install rvc-python (or set AIMC_RVC_API_URL to an external RVC server)."
Write-Host "Configure models via AIMC_RVC_MODEL / AIMC_DIFFSINGER_CMD — see ai-sidecar/README.md"
Write-Host "Restart the sidecar: npm run sidecar"
