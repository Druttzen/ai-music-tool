<#
.SYNOPSIS
  Build the Windows Tauri installer, allowing unsigned local builds.

Release CI supplies TAURI_SIGNING_PRIVATE_KEY and keeps updater artifacts
enabled. Local builds do not need a private key, so disable only the updater
artifact step when no signing key is available.
#>
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

& (Join-Path $PSScriptRoot "ensure-sidecar-binary.ps1")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Set-Location (Join-Path $root "src-tauri")
if ([string]::IsNullOrWhiteSpace($env:TAURI_SIGNING_PRIVATE_KEY)) {
  Write-Host "TAURI_SIGNING_PRIVATE_KEY is not set; building unsigned local installers."
  $localConfig = Join-Path $env:TEMP "ai-music-tool-tauri-local-$PID.json"
  try {
    '{"bundle":{"createUpdaterArtifacts":false}}' | Set-Content -Path $localConfig -Encoding utf8
    cargo tauri build --config $localConfig
  } finally {
    if (Test-Path $localConfig) {
      Remove-Item -Force $localConfig
    }
  }
} else {
  cargo tauri build
}
exit $LASTEXITCODE
