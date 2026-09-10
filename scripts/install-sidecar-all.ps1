<#
.SYNOPSIS
  Install all optional sidecar extras (stems, classify, vision, vocal stacks, generate).
#>
$ErrorActionPreference = "Stop"
. "$PSScriptRoot\lib\sidecar-venv.ps1"
$root = Split-Path -Parent $PSScriptRoot
Install-SidecarExtra -RepoRoot $root -ExtraSpec "all" -Label "[all] extras (~multi-GB)"
# RVC is separate: rvc-python's faiss-cpu pin has no Python 3.12 wheel (see pyproject [all]).
Install-SidecarExtra -RepoRoot $root -ExtraSpec "vocal-rvc" -Label "vocal-rvc (fallback-safe)"
Write-Host "Optional RVC models still need configuration - see ai-sidecar README."
