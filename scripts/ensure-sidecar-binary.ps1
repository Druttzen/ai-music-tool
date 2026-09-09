<#
.SYNOPSIS
  Ensure the Tauri externalBin sidecar exists for the current host triple.
  Skips PyInstaller when the binary version stamp matches package.json.
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
$stamp = "$dest.version"
$pkgVersion = (Get-Content (Join-Path $root "package.json") -Raw | ConvertFrom-Json).version
$stampOk = (Test-Path $dest) -and (Test-Path $stamp) -and ((Get-Content $stamp -Raw).Trim() -eq $pkgVersion)
if ($stampOk) {
  Write-Host "Sidecar binary current: $name ($pkgVersion)"
  exit 0
}

if (Test-Path $dest) {
  Write-Host "Sidecar binary stale or unstamped: $name - rebuilding for $pkgVersion"
} else {
  Write-Host "Sidecar binary missing - building via PyInstaller..."
}
& (Join-Path $PSScriptRoot "build-sidecar-bundle.ps1")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Set-Content -Path $stamp -Value $pkgVersion -Encoding ascii
