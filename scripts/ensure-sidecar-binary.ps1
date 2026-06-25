<#
.SYNOPSIS
  Ensure the Tauri externalBin sidecar exists for the current host triple.
  Skips PyInstaller when the binary is already present.
#>
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$binDir = Join-Path $root "src-tauri/binaries"

$tripleLine = (rustc -vV | Select-String "host:").ToString()
if (-not $tripleLine) { throw "rustc host triple not found" }
$triple = $tripleLine.Split(":")[1].Trim()
$name = "ai-sidecar-$triple.exe"
if (-not ($triple -match "windows")) { $name = "ai-sidecar-$triple" }

$dest = Join-Path $binDir $name
if (Test-Path $dest) {
  Write-Host "Sidecar binary present: $name"
  exit 0
}

Write-Host "Sidecar binary missing - building via PyInstaller..."
& (Join-Path $PSScriptRoot "build-sidecar-bundle.ps1")
