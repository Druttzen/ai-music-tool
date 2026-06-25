<#
.SYNOPSIS
  Build a PyInstaller one-file AI sidecar and copy it into src-tauri/binaries/
  with the Tauri externalBin target-triple suffix.
#>
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$sidecar = Join-Path $root "ai-sidecar"
$binDir = Join-Path $root "src-tauri/binaries"
$venv = Join-Path $sidecar ".venv"

$tripleLine = (rustc -vV | Select-String "host:").ToString()
if (-not $tripleLine) { throw "rustc host triple not found - install Rust (npm run bootstrap)" }
$triple = $tripleLine.Split(":")[1].Trim()
$baseName = "ai-sidecar-$triple"
$outName = if ($triple -match "windows") { "$baseName.exe" } else { $baseName }

# Python venv
$py = $null
foreach ($v in @("3.12", "3.11", "3.10")) {
  try {
    $out = & py "-$v" --version 2>&1
    if ($LASTEXITCODE -eq 0 -and "$out" -match "Python") { $py = $v; break }
  } catch {}
}
if (-not $py) { throw "Need Python 3.10-3.12 for sidecar bundle build" }

if (-not (Test-Path $venv)) {
  Write-Host "Creating sidecar venv (py -$py)..."
  & py "-$py" -m venv $venv
  & "$venv\Scripts\pip" install --upgrade pip
  & "$venv\Scripts\pip" install -e $sidecar
}

Write-Host "Installing PyInstaller..."
$prevEap = $ErrorActionPreference
$ErrorActionPreference = "Continue"
& "$venv\Scripts\pip" install pyinstaller pyinstaller-hooks-contrib 2>&1 | Out-Null
$ErrorActionPreference = $prevEap
if ($LASTEXITCODE -ne 0) { throw "pip install pyinstaller failed" }

$dist = Join-Path $sidecar "dist"
$build = Join-Path $sidecar "build"
if (Test-Path $dist) { Remove-Item -Recurse -Force $dist }
if (Test-Path $build) { Remove-Item -Recurse -Force $build }

Write-Host "Building $outName (this may take several minutes)..."
Push-Location $sidecar
try {
  & "$venv\Scripts\pyinstaller" --noconfirm --onefile --clean `
    --name $baseName `
    --collect-all uvicorn `
    --collect-all fastapi `
    --collect-all starlette `
    --collect-all librosa `
    --collect-all soundfile `
    --hidden-import ai_sidecar.main `
    run_sidecar.py
  if ($LASTEXITCODE -ne 0) { throw "PyInstaller failed" }
} finally {
  Pop-Location
}

$built = Join-Path $dist $outName
if (-not (Test-Path $built)) {
  throw "Expected output not found: $built"
}

New-Item -ItemType Directory -Force -Path $binDir | Out-Null
Copy-Item -Force $built (Join-Path $binDir $outName)
Write-Host "Copied to src-tauri/binaries/$outName"
Write-Host "Sidecar bundle ready for Tauri packaging."
