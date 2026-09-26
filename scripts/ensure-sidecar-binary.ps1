<#
.SYNOPSIS
  Ensure the Tauri externalBin sidecar exists for the current host triple.
  Skips PyInstaller when the binary version/source stamp matches its inputs.
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
$expectedStamp = & node (Join-Path $root "scripts/sidecar-build-stamp.cjs")
if ($LASTEXITCODE -ne 0 -or -not $expectedStamp) { throw "Could not calculate sidecar build stamp" }
$stampOk = (Test-Path $dest) -and (Test-Path $stamp) -and ((Get-Content $stamp -Raw).Trim() -eq $expectedStamp.Trim())
if ($stampOk) {
  Write-Host "Sidecar binary current: $name ($expectedStamp)"
  exit 0
}

if (Test-Path $dest) {
  Write-Host "Sidecar binary stale or unstamped: $name - rebuilding for $expectedStamp"
} else {
  Write-Host "Sidecar binary missing - building via PyInstaller..."
}
& (Join-Path $PSScriptRoot "build-sidecar-bundle.ps1")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Set-Content -Path $stamp -Value $expectedStamp.Trim() -Encoding ascii
