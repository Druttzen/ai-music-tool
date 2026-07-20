<#
.SYNOPSIS
  Install the optional MusicGen generate extra into the sidecar venv.
#>
$ErrorActionPreference = "Stop"
. "$PSScriptRoot\lib\sidecar-venv.ps1"
Install-SidecarExtra -RepoRoot (Split-Path -Parent $PSScriptRoot) -ExtraSpec "generate" -Label "generate extra (torch + audiocraft)"
Write-Host "Check GET /health for generate_available: true"
