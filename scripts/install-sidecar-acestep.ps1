<#
.SYNOPSIS
  Configure + start the external ACE-Step API (not a pip extra).

  Writes AIMC_ACESTEP_API_URL into .env.vocal and launches acestep-api when found.
#>
$ErrorActionPreference = "Stop"

function Resolve-AceStepHome {
  foreach ($candidate in @(
      $env:AIMC_ACESTEP_HOME,
      $env:ACESTEP_HOME,
      "F:\ACE-Step-1.5",
      (Join-Path (Split-Path -Parent $PSScriptRoot) "..\ACE-Step-1.5"),
      (Join-Path (Split-Path -Parent $PSScriptRoot) "ACE-Step-1.5")
    )) {
    if (-not $candidate) { continue }
    $full = [System.IO.Path]::GetFullPath($candidate.Trim())
    if (Test-Path (Join-Path $full "pyproject.toml")) { return $full }
    if (Test-Path (Join-Path $full "start_api_server.bat")) { return $full }
  }
  return $null
}

function Write-AceStepEnvFile {
  param([Parameter(Mandatory = $true)][string]$EnvPath, [string]$ApiUrl)
  $dir = Split-Path -Parent $EnvPath
  if (-not (Test-Path $dir)) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
  }
  $lines = @()
  if (Test-Path $EnvPath) {
    $lines = Get-Content -LiteralPath $EnvPath
  }
  $kept = @()
  foreach ($line in $lines) {
    if ($line -match '^\s*AIMC_ACESTEP_API_URL\s*=') { continue }
    $kept += $line
  }
  $kept += "AIMC_ACESTEP_API_URL=$ApiUrl"
  $utf8NoBom = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText($EnvPath, (($kept -join "`n") + "`n"), $utf8NoBom)
}

function Test-AceStepApi {
  param([string]$BaseUrl, [int]$TimeoutSec = 2)
  try {
    $null = Invoke-WebRequest -Uri "$BaseUrl/docs" -TimeoutSec $TimeoutSec -UseBasicParsing
    return $true
  } catch {
    try {
      $null = Invoke-WebRequest -Uri "$BaseUrl/openapi.json" -TimeoutSec $TimeoutSec -UseBasicParsing
      return $true
    } catch {
      return $false
    }
  }
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$apiUrl = if ($env:AIMC_ACESTEP_API_URL -and $env:AIMC_ACESTEP_API_URL.Trim()) {
  $env:AIMC_ACESTEP_API_URL.Trim().TrimEnd("/")
} else {
  "http://127.0.0.1:8001"
}
$port = 8001
if ($apiUrl -match ':(\d+)\s*$') { $port = [int]$Matches[1] }

$aceHome = Resolve-AceStepHome

# Always write env for checkout + Studio user pkg (when present).
$envTargets = @(
  (Join-Path $repoRoot "ai-sidecar\.env.vocal")
)
if ($env:STUDIO_DATA_DIR -and $env:STUDIO_DATA_DIR.Trim()) {
  $envTargets += (Join-Path $env:STUDIO_DATA_DIR.Trim() "sidecar\pkg\.env.vocal")
  $envTargets += (Join-Path $env:STUDIO_DATA_DIR.Trim() "sidecar\.env.vocal")
}
$studioPkgEnv = "B:\AI Music Creator Studio\data\sidecar\pkg\.env.vocal"
if (Test-Path (Split-Path -Parent $studioPkgEnv)) {
  $envTargets += $studioPkgEnv
  $envTargets += "B:\AI Music Creator Studio\data\sidecar\.env.vocal"
}
$envTargets = $envTargets | Select-Object -Unique
foreach ($path in $envTargets) {
  Write-AceStepEnvFile -EnvPath $path -ApiUrl $apiUrl
  Write-Host "Wrote $path"
}

if (Test-AceStepApi -BaseUrl $apiUrl) {
  Write-Host "ACE-Step API already reachable at $apiUrl"
  Write-Host "Restart Studio / sidecar so /health picks up AIMC_ACESTEP_API_URL."
  exit 0
}

if (-not $aceHome) {
  Write-Host "ACE-Step checkout not found."
  Write-Host "Clone/install ACE-Step 1.5, or set AIMC_ACESTEP_HOME, then re-run:"
  Write-Host "  npm run sidecar:acestep"
  Write-Host "Docs: docs/acestep.md"
  exit 1
}

Write-Host "Starting ACE-Step API from $aceHome ..."
$logDir = Join-Path $aceHome "gradio_outputs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$outLog = Join-Path $logDir "aimc-acestep-api.out.log"
$errLog = Join-Path $logDir "aimc-acestep-api.err.log"

$uv = Get-Command uv -ErrorAction SilentlyContinue
$venvPy = Join-Path $aceHome ".venv\Scripts\python.exe"
$started = $false

if ($uv) {
  $args = @(
    "run", "--directory", $aceHome, "--no-sync",
    "acestep-api", "--host", "127.0.0.1", "--port", "$port"
  )
  # Skip interactive update prompts from the .bat launcher; uv entrypoint is non-interactive.
  $p = Start-Process -FilePath $uv.Source -ArgumentList $args -WorkingDirectory $aceHome `
    -WindowStyle Hidden -PassThru -RedirectStandardOutput $outLog -RedirectStandardError $errLog
  Write-Host "Spawned uv acestep-api pid=$($p.Id)"
  $started = $true
} elseif (Test-Path $venvPy) {
  $args = @(
    "-m", "uvicorn", "acestep.api_server:app",
    "--host", "127.0.0.1", "--port", "$port", "--workers", "1"
  )
  $p = Start-Process -FilePath $venvPy -ArgumentList $args -WorkingDirectory $aceHome `
    -WindowStyle Hidden -PassThru -RedirectStandardOutput $outLog -RedirectStandardError $errLog
  Write-Host "Spawned venv uvicorn pid=$($p.Id)"
  $started = $true
} else {
  Write-Host "Need uv or $venvPy to start ACE-Step."
  Write-Host "In $aceHome run: uv sync   then: npm run sidecar:acestep"
  exit 1
}

if (-not $started) { exit 1 }

$ok = $false
for ($i = 0; $i -lt 90; $i++) {
  Start-Sleep -Seconds 2
  if (Test-AceStepApi -BaseUrl $apiUrl -TimeoutSec 2) {
    $ok = $true
    break
  }
}

if (-not $ok) {
  Write-Host "ACE-Step API did not become ready at $apiUrl"
  if (Test-Path $errLog) {
    Write-Host "--- stderr tail ---"
    Get-Content -LiteralPath $errLog -Tail 30
  }
  exit 1
}

Write-Host "ACE-Step API ready at $apiUrl"
Write-Host "Restart Studio / sidecar so /health shows acestep_available=true."
exit 0
