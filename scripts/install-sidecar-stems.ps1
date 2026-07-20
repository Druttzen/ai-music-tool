<#
.SYNOPSIS
  Install the optional Demucs stems extra into the sidecar venv.
#>
$ErrorActionPreference = "Stop"
. "$PSScriptRoot\lib\sidecar-venv.ps1"
Install-SidecarExtra -RepoRoot (Split-Path -Parent $PSScriptRoot) -ExtraSpec "stems" -Label "stems extra (torch + demucs)"
Write-Host "Check GET /health for stems_available: true"
