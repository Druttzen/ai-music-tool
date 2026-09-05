<#
.SYNOPSIS
  Upgrade sidecar venv torch/torchaudio to a CUDA build when an NVIDIA GPU is present.
#>
$ErrorActionPreference = "Stop"
. "$PSScriptRoot\lib\sidecar-venv.ps1"
$root = Split-Path -Parent $PSScriptRoot
$ctx = Ensure-SidecarVenv -RepoRoot $root
Ensure-SidecarCudaTorch -Pip $ctx.Pip -Python (Join-Path $ctx.Venv "Scripts\python.exe") -Force
Write-Host "Restart the sidecar: npm run sidecar"
Write-Host "Check GET /health device_info.backend === cuda"
