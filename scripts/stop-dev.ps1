# Stops Next.js dev / npm run debug by killing processes on app and inspector ports.
# Windows PowerShell. Do not use $pid as a loop variable (reserved).

$ErrorActionPreference = "SilentlyContinue"
$ports = @(3000, 9229, 9230, 9241, 9242, 8723)
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

$root = (Split-Path -Parent $PSScriptRoot) -replace '\\', '/'
Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
  Where-Object {
    $cmd = $_.CommandLine
    $cmd -and (
      $cmd -match 'next(\.js|\\)|next/dist' -or
      $cmd -match [regex]::Escape($root)
    )
  } |
  ForEach-Object {
    $procId = $_.ProcessId
    if ($procId -le 0 -or $seen.ContainsKey($procId)) { return }
    $seen[$procId] = $true
    try {
      Stop-Process -Id $procId -Force
      Write-Host "Stopped Node PID $procId (next dev)"
    } catch {
      Write-Warning "Could not stop Node PID $procId : $_"
    }
  }

if ($seen.Count -eq 0) {
  Write-Host "No processes were listening on ports: $($ports -join ', ')"
}

$pidFile = Join-Path (Split-Path -Parent $PSScriptRoot) "ai-sidecar\.sidecar.pid"
Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
