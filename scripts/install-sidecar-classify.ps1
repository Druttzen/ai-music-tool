<#
.SYNOPSIS
  Install the optional genre classify extra into the sidecar venv.
#>
$ErrorActionPreference = "Stop"
. "$PSScriptRoot\lib\sidecar-venv.ps1"
Install-SidecarExtra -RepoRoot (Split-Path -Parent $PSScriptRoot) -ExtraSpec "classify" -Label "classify extra (torch + transformers)"
Write-Host "Check GET /health for genre_available: true"
