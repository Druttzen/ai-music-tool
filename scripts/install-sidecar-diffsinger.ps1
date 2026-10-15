param([string]$StudioDataDir = $env:STUDIO_DATA_DIR)
$ErrorActionPreference = 'Stop'
if (-not $StudioDataDir) { throw 'Set STUDIO_DATA_DIR to the Studio data folder first.' }
$runtime = Join-Path $StudioDataDir 'sidecar/runtime/python.exe'
if (-not (Test-Path -LiteralPath $runtime)) { $runtime = Join-Path $StudioDataDir 'sidecar/.venv/Scripts/python.exe' }
if (-not (Test-Path -LiteralPath $runtime)) { throw 'Activate a plugin in Studio first to provision its internal Python runtime.' }
$env:STUDIO_DATA_DIR = $StudioDataDir
& $runtime -m ai_sidecar.managed_tools install diffsinger
if ($LASTEXITCODE -ne 0) { throw 'Managed diffsinger installation failed.' }
