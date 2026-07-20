<#
.SYNOPSIS
  Install the optional RVC vocal-rvc extra into the sidecar venv.
#>
$ErrorActionPreference = "Stop"
. "$PSScriptRoot\lib\sidecar-venv.ps1"
$root = Split-Path -Parent $PSScriptRoot
Install-SidecarExtra -RepoRoot $root -ExtraSpec "vocal-ml" -Label "vocal-ml extra (torch)"
Install-SidecarExtra -RepoRoot $root -ExtraSpec "vocal-rvc" -Label "vocal-rvc extra (rvc-python)"
Write-Host "Place RVC models per ai-sidecar README; check GET /health for vocal_rvc_available."
