# Registers a one-shot SYSTEM startup task to delete stale electron-dist folders.
# Requires elevation. Safe to run while Cursor has the repo open.

$TaskName = "AI-Music-Creator-Cleanup-ElectronDist"
$Script = Join-Path (Split-Path -Parent $PSScriptRoot) "scripts\cleanup-locked-electron-dist.ps1"
$Ps = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$Action = New-ScheduledTaskAction -Execute $Ps -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$Script`""
$Trigger = New-ScheduledTaskTrigger -AtStartup
$Principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Principal $Principal -Settings $Settings -Force | Out-Null

Write-Host "Registered scheduled task: $TaskName"
Write-Host "On next reboot, SYSTEM will remove all electron-dist* folders under the repo if unlocked."
Write-Host "To remove the task after a successful cleanup: Unregister-ScheduledTask -TaskName '$TaskName' -Confirm:`$false"
