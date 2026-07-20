<#
.SYNOPSIS
  Install the optional cover-ref (FLUX img2img) extra into the sidecar venv.
#>
$ErrorActionPreference = "Stop"
. "$PSScriptRoot\lib\sidecar-venv.ps1"
Install-SidecarExtra -RepoRoot (Split-Path -Parent $PSScriptRoot) -ExtraSpec "cover-ref" -Label "cover-ref extra (torch + diffusers + FLUX img2img)"
Write-Host "Check GET /health for cover_ref_available: true"
Write-Host "First /cover-ref call downloads FLUX.1-schnell weights from Hugging Face."
