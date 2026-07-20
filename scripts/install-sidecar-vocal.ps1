<#
.SYNOPSIS
  Install optional vocal DSP extra (scipy) for guide conversion and lyrics synthesis.
#>
$ErrorActionPreference = "Stop"
. "$PSScriptRoot\lib\sidecar-venv.ps1"
Install-SidecarExtra -RepoRoot (Split-Path -Parent $PSScriptRoot) -ExtraSpec "vocal" -Label "vocal extra (scipy)"
Write-Host "Check GET /health for vocal_ml_available: true (scipy DSP flag)"
