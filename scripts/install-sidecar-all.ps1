<#
.SYNOPSIS
  Install all optional sidecar extras (stems, classify, vision, vocal stacks, generate).
#>
$ErrorActionPreference = "Stop"
. "$PSScriptRoot\lib\sidecar-venv.ps1"
Install-SidecarExtra -RepoRoot (Split-Path -Parent $PSScriptRoot) -ExtraSpec "all" -Label "[all] extras (~multi-GB)"
Write-Host "Optional RVC models still need configuration — see ai-sidecar README."
