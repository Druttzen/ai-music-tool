# Stops Next.js dev / npm run debug by killing processes bound to app and Node inspector ports.
# Windows PowerShell. Do not use $pid as a loop variable (reserved).

$ErrorActionPreference = "SilentlyContinue"
$ports = @(3000, 9229, 9230, 9241, 9242)
$seen = @{}

foreach ($port in $ports) {
  $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  foreach ($c in $conns) {
    $procId = $c.OwningProcess
    if ($procId -le 0) { continue }
    if ($seen.ContainsKey($procId)) { continue }
    $seen[$procId] = $true
    try {
      Stop-Process -Id $procId -Force
      Write-Host "Stopped PID $procId (port $port)"
    } catch {
      Write-Warning "Could not stop PID $procId : $_"
    }
  }
}

if ($seen.Count -eq 0) {
  Write-Host "No processes were listening on ports: $($ports -join ', ')"
}
