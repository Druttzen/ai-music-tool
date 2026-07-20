<#
.SYNOPSIS
  Install optional vocal-ml stack (torch + scipy) for RVC/DiffSinger integrations.
#>
$ErrorActionPreference = "Stop"
. "$PSScriptRoot\lib\sidecar-venv.ps1"
Install-SidecarExtra -RepoRoot (Split-Path -Parent $PSScriptRoot) -ExtraSpec "vocal,vocal-ml" -Label "vocal + vocal-ml extras (torch + scipy)"
Write-Host "For RVC: npm run sidecar:vocal-rvc (or set AIMC_RVC_API_URL)."
Write-Host "Configure models via AIMC_RVC_MODEL / AIMC_DIFFSINGER_* — see ai-sidecar/README.md"
