<#
.SYNOPSIS
  Build a PyInstaller one-file AI sidecar and copy it into src-tauri/binaries/
  with the Tauri externalBin target-triple suffix.
#>
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$sidecar = Join-Path $root "ai-sidecar"
$binDir = Join-Path $root "src-tauri/binaries"
# Developer extras must never leak into the frozen base sidecar.
$venv = Join-Path $sidecar ".build-venv"
Remove-Item Env:PYTHONPATH -ErrorAction SilentlyContinue
Remove-Item Env:PYTHONHOME -ErrorAction SilentlyContinue
Remove-Item Env:PYTHONUSERBASE -ErrorAction SilentlyContinue
$env:PYTHONNOUSERSITE = '1'

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
  & "$venv\Scripts\python" -m pip install --upgrade pip
  if ($LASTEXITCODE -ne 0) { throw "Build environment pip upgrade failed" }
}

Write-Host "Installing PyInstaller..."
$prevEap = $ErrorActionPreference
$ErrorActionPreference = "Continue"
& "$venv\Scripts\python" -m pip install -e $sidecar pyinstaller pyinstaller-hooks-contrib 2>&1 | Out-Null
$ErrorActionPreference = $prevEap
if ($LASTEXITCODE -ne 0) { throw "pip install pyinstaller failed" }

$dist = Join-Path $sidecar "dist"
$build = Join-Path $sidecar "build"
foreach ($outputDir in @($dist, $build)) {
  $resolvedOutput = [System.IO.Path]::GetFullPath($outputDir)
  $resolvedSidecar = [System.IO.Path]::GetFullPath($sidecar) + [System.IO.Path]::DirectorySeparatorChar
  if (-not $resolvedOutput.StartsWith($resolvedSidecar, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Build output must remain inside the sidecar workspace"
  }
  if (Test-Path -LiteralPath $resolvedOutput) { Remove-Item -LiteralPath $resolvedOutput -Recurse -Force }
}

Write-Host "Building $outName (this may take several minutes)..."
# Never freeze a user install PYTHONPATH (B:\...\data\sidecar\pkg) or optional torch extras.
Remove-Item Env:PYTHONPATH -ErrorAction SilentlyContinue
Push-Location $sidecar
try {
  & "$venv\Scripts\pyinstaller" --noconfirm --onefile --clean `
    --name $baseName `
    --collect-all uvicorn `
    --collect-all fastapi `
    --collect-all starlette `
    --collect-all librosa `
    --collect-all soundfile `
    --collect-all av `
    --hidden-import ai_sidecar.main `
    --exclude-module torch `
    --exclude-module torchvision `
    --exclude-module torio `
    --exclude-module demucs `
    --exclude-module rvc_python `
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
