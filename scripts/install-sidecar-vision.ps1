<#
.SYNOPSIS
  Install the optional vision (caption/CLIP) extra into the sidecar venv.
#>
$ErrorActionPreference = "Stop"
. "$PSScriptRoot\lib\sidecar-venv.ps1"
Install-SidecarExtra -RepoRoot (Split-Path -Parent $PSScriptRoot) -ExtraSpec "vision" -Label "vision extra (torch + transformers + pillow)"
Write-Host "Check GET /health for vision_available: true"
