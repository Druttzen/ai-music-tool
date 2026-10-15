function Test-OwnedSidecarProcess([int]$ProcessId, [string]$SidecarDir, [int]$Depth = 0) {
  if ($Depth -gt 4 -or $ProcessId -le 0) { return $false }
  $info = Get-CimInstance Win32_Process -Filter "ProcessId=$ProcessId" -ErrorAction SilentlyContinue
  if (-not $info -or -not $info.CommandLine) { return $false }
  $commandLine = [string]$info.CommandLine
  $appDirPattern = '(?:^|\s)--app-dir\s+"?' + [regex]::Escape($SidecarDir) + '"?(?:\s|$)'
  if ($commandLine -notmatch '(?:^|\s)-m\s+uvicorn\s+ai_sidecar\.main:app(?:\s|$)' -or
      $commandLine -notmatch $appDirPattern) { return $false }
  $expectedPython = Join-Path $SidecarDir '.venv\Scripts\python.exe'
  $pythonPattern = '^"?' + [regex]::Escape($expectedPython) + '"?(?:\s|$)'
  if ($commandLine -match $pythonPattern) { return $true }
  # Windows venv python.exe redirects to its base interpreter. Accept that child
  # only when its live parent chain proves this workspace launched the sidecar.
  return Test-OwnedSidecarProcess -ProcessId $info.ParentProcessId -SidecarDir $SidecarDir -Depth ($Depth + 1)
}
