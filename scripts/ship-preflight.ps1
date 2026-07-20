# Pre-tag release gate: sync versions, full check, optional e2e / Tauri / Electron dist.
param(
  [switch]$E2e,
  [switch]$E2eSubset,
  [switch]$Tauri,
  [switch]$Smoke,
  [switch]$Dist,
  [switch]$TagOnly
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "ship-preflight: sync product version" -ForegroundColor Cyan
npm run sync:version
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "ship-preflight: check:full (unit + lint + build + sidecar pytest)" -ForegroundColor Cyan
if ($E2e) {
  node scripts/run-check-full.cjs --e2e
} elseif ($E2eSubset) {
  node scripts/run-check-full.cjs --e2e-subset
} else {
  node scripts/run-check-full.cjs
}
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if ($Smoke) {
  Write-Host "ship-preflight: test:smoke" -ForegroundColor Cyan
  npm run test:smoke
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

if ($Tauri) {
  Write-Host "ship-preflight: tauri:build (local installer)" -ForegroundColor Cyan
  npm run tauri:build
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  Write-Host "ship-preflight: installers under src-tauri/target/release/bundle/" -ForegroundColor DarkGray
}

if ($Dist) {
  Write-Host "ship-preflight: npm run dist (legacy Electron)" -ForegroundColor Cyan
  npm run dist
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

if ($TagOnly) {
  Write-Host "ship-preflight: tag-only — push studio-v* (pass --electron to ship-tag-release for Electron)" -ForegroundColor Cyan
  node scripts/ship-tag-release.cjs
  exit $LASTEXITCODE
}

Write-Host "ship-preflight: OK — ready to commit, tag, and release" -ForegroundColor Green
Write-Host "  Checklist: npm run ship:ready -- --print   (or docs/publish.md)" -ForegroundColor DarkGray
Write-Host "  CI release: npm run ship:tag" -ForegroundColor DarkGray
Write-Host "  Stronger local: npm run ship:ready -- --full" -ForegroundColor DarkGray
