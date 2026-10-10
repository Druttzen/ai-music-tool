param([string]$StudioDataDir = $env:STUDIO_DATA_DIR)
$ErrorActionPreference = 'Stop'
if (-not $StudioDataDir) { throw 'Set STUDIO_DATA_DIR to the Studio data folder first.' }
$runtime = Join-Path $StudioDataDir 'sidecar/runtime/python.exe'
if (-not (Test-Path -LiteralPath $runtime)) { throw 'Activate a plugin in Studio first to provision its internal Python runtime.' }
$env:STUDIO_DATA_DIR = $StudioDataDir
$env:PYTHONPATH = Join-Path $StudioDataDir 'sidecar/pkg'
& $runtime -m ai_sidecar.internal_plugins install acestep
if ($LASTEXITCODE -ne 0) { throw 'Internal ACE-Step plugin installation failed.' }
