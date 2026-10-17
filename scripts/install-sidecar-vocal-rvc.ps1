param([string]$StudioDataDir = $env:STUDIO_DATA_DIR)
$ErrorActionPreference = 'Stop'
if (-not $StudioDataDir) { throw 'Set STUDIO_DATA_DIR to the Studio data folder first.' }
$runtime = Join-Path $StudioDataDir 'sidecar/runtime/python.exe'
if (-not (Test-Path -LiteralPath $runtime)) { $runtime = Join-Path $StudioDataDir 'sidecar/.venv/Scripts/python.exe' }
if (-not (Test-Path -LiteralPath $runtime)) { throw 'Activate a plugin in Studio first to provision its internal Python runtime.' }
$env:STUDIO_DATA_DIR = $StudioDataDir
$source = Join-Path (Split-Path -Parent $PSScriptRoot) 'ai-sidecar'
$bootstrap = "import sys, runpy; sys.path.insert(0, sys.argv[1]); sys.argv = ['managed_tools', 'install', 'vocal-rvc']; runpy.run_module('ai_sidecar.managed_tools', run_name='__main__')"
& $runtime -c $bootstrap $source
if ($LASTEXITCODE -ne 0) { throw 'Managed vocal-rvc installation failed.' }
