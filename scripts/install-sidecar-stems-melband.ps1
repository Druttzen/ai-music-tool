<#
.SYNOPSIS
  Install Mel-Band RoFormer stem backend into the sidecar venv.
#>
$ErrorActionPreference = "Stop"
. "$PSScriptRoot\lib\sidecar-venv.ps1"
Install-SidecarExtra -RepoRoot (Split-Path -Parent $PSScriptRoot) -ExtraSpec "stems-melband" -Label "stems-melband extra (melband-roformer-infer)"
Write-Host "Check GET /health for stems-melband capability / stems_melband_available: true"
Write-Host "Use model_name=melband on POST /separate, or AIMC_STEMS_BACKEND=melband"
