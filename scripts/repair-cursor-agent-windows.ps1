# Repair Cursor Agents Window on Windows (missing extension "out" folders).
# Run after Cursor updates if agents timeout or show "did not respond in time".
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/repair-cursor-agent-windows.ps1

$base = Join-Path $env:LOCALAPPDATA "Programs\cursor\resources\app\extensions"
if (-not (Test-Path $base)) {
    Write-Error "Cursor extensions folder not found: $base"
    exit 1
}

$fixed = 0
Get-ChildItem $base -Directory | ForEach-Object {
    $dist = Join-Path $_.FullName "dist"
    $out = Join-Path $_.FullName "out"
    if ((Test-Path $dist) -and -not (Test-Path $out)) {
        Push-Location $_.FullName
        cmd /c "mklink /J out dist" | Out-Null
        Pop-Location
        Write-Host "Linked out -> dist: $($_.Name)"
        $fixed++
    }
}

Write-Host "Done. Fixed $fixed extension(s). Fully quit and restart Cursor before using Agents Window."
