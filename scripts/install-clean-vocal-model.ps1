<# Download the verified FT2 Bleedless checkpoint into the app's offline cache. #>
$ErrorActionPreference = "Stop"
. "$PSScriptRoot\lib\sidecar-venv.ps1"
$ctx = Ensure-SidecarVenv -RepoRoot (Split-Path -Parent $PSScriptRoot)
& $ctx.Python -m ai_sidecar.stems_melband --download-clean-model
if ($LASTEXITCODE -ne 0) { throw "Clean vocal model setup failed" }
