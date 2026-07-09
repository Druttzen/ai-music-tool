# Restart sidecar and run full Playwright e2e (Windows).
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

& "$PSScriptRoot\stop-sidecar.ps1" 2>$null
& "$PSScriptRoot\start-sidecar.ps1"

$ok = $false
for ($i = 0; $i -lt 40; $i++) {
  try {
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:8723/health" -UseBasicParsing -TimeoutSec 2
    if ($r.StatusCode -eq 200) { $ok = $true; break }
  } catch { }
  Start-Sleep -Milliseconds 500
}
if (-not $ok) { throw "Sidecar /health did not become ready" }

npm run test:e2e
