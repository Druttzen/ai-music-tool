# Restart sidecar and run full Playwright e2e (Windows).
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

& "$PSScriptRoot\stop-sidecar.ps1" 2>$null
& "$PSScriptRoot\start-sidecar.ps1"

# Cold /health can take >2s when optional ML extras import torch stacks.
$ok = $false
for ($i = 0; $i -lt 60; $i++) {
  try {
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:8723/health" -UseBasicParsing -TimeoutSec 30
    if ($r.StatusCode -eq 200) { $ok = $true; break }
  } catch { }
  Start-Sleep -Milliseconds 500
}
if (-not $ok) { throw "Sidecar /health did not become ready" }

npm run test:e2e
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
