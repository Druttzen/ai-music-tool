# Pre-tag release gate: sync versions, full check, optional e2e + dist.
param(
  [switch]$E2e,
  [switch]$Dist
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "ship-preflight: sync product version" -ForegroundColor Cyan
npm run sync:version

Write-Host "ship-preflight: check:full (unit + lint + build + sidecar pytest)" -ForegroundColor Cyan
if ($E2e) {
  node scripts/run-check-full.cjs --e2e
} else {
  node scripts/run-check-full.cjs
}

if ($Dist) {
  Write-Host "ship-preflight: npm run dist" -ForegroundColor Cyan
  npm run dist
}

Write-Host "ship-preflight: OK — ready to commit, tag, and release" -ForegroundColor Green
