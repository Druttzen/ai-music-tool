<#
.SYNOPSIS
  Install the optional cover (FLUX text→image) extra into the sidecar venv.
#>
$ErrorActionPreference = "Stop"
. "$PSScriptRoot\lib\sidecar-venv.ps1"
Install-SidecarExtra -RepoRoot (Split-Path -Parent $PSScriptRoot) -ExtraSpec "cover" -Label "cover extra (torch + diffusers + FLUX.1-schnell)"
Write-Host "Check GET /health for cover_available: true"
Write-Host "First /cover call downloads FLUX.1-schnell weights from Hugging Face."
