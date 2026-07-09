# Pre-tag release gate: sync versions, full check, optional e2e + dist.
param(
  [switch]$E2e,
  [switch]$E2eSubset,
  [switch]$Dist,
  [switch]$TagOnly
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "ship-preflight: sync product version" -ForegroundColor Cyan
npm run sync:version

Write-Host "ship-preflight: check:full (unit + lint + build + sidecar pytest)" -ForegroundColor Cyan
if ($E2e) {
  node scripts/run-check-full.cjs --e2e
} elseif ($E2eSubset) {
  node scripts/run-check-full.cjs --e2e-subset
} else {
  node scripts/run-check-full.cjs
}

if ($Dist) {
  Write-Host "ship-preflight: npm run dist" -ForegroundColor Cyan
  npm run dist
}

if ($TagOnly) {
  Write-Host "ship-preflight: tag-only — push tag and let release.yml publish installer (no local dist)" -ForegroundColor Cyan
  node scripts/ship-tag-release.cjs
  exit 0
}

Write-Host "ship-preflight: OK — ready to commit, tag, and release" -ForegroundColor Green
Write-Host "  CI release (recommended): npm run ship:tag  OR  npm run ship:preflight -TagOnly" -ForegroundColor DarkGray
Write-Host "  Local installer: npm run ship:preflight -Dist then gh release create ..." -ForegroundColor DarkGray
