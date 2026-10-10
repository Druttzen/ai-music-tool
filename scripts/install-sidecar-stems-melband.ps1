<#
.SYNOPSIS
  Install Mel-Band RoFormer stem backend into the sidecar venv.
#>
$ErrorActionPreference = "Stop"
. "$PSScriptRoot\lib\sidecar-venv.ps1"
Install-SidecarExtra -RepoRoot (Split-Path -Parent $PSScriptRoot) -ExtraSpec "stems-melband" -Label "stems-melband extra (melband-roformer-infer)"
& "$PSScriptRoot\install-clean-vocal-model.ps1"
Write-Host "Check GET /health for stems-melband capability / stems_melband_available: true"
Write-Host "Clean vocals model cached. Use model_name=melband-clean on POST /separate."
