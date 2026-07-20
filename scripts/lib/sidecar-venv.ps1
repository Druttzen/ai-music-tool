<#
.SYNOPSIS
  Ensure ai-sidecar/.venv exists (Python 3.10–3.12).
#>
function Ensure-SidecarVenv {
  param(
    [Parameter(Mandatory = $true)]
    [string]$RepoRoot
  )
  $ErrorActionPreference = "Stop"
  $sidecar = Join-Path $RepoRoot "ai-sidecar"
  $venv = Join-Path $sidecar ".venv"
  $py = $null

  foreach ($v in @("3.12", "3.11", "3.10")) {
    try {
      $out = & py "-$v" --version 2>&1
      if ($LASTEXITCODE -eq 0 -and "$out" -match "Python") { $py = $v; break }
    } catch {}
  }

  if (-not $py) {
    Write-Error "Need Python 3.10-3.12. Run: npm run bootstrap"
    exit 1
  }

  if (-not (Test-Path $venv)) {
    Write-Host "Creating sidecar venv (py -$py)..."
    & py "-$py" -m venv $venv
    & "$venv\Scripts\python" -m pip install --upgrade pip
    & "$venv\Scripts\pip" install -e $sidecar
  }

  return @{
    Sidecar = $sidecar
    Venv = $venv
    Pip = (Join-Path $venv "Scripts\pip.exe")
  }
}

function Install-SidecarExtra {
  param(
    [Parameter(Mandatory = $true)][string]$RepoRoot,
    [Parameter(Mandatory = $true)][string]$ExtraSpec,
    [Parameter(Mandatory = $true)][string]$Label
  )
  $ctx = Ensure-SidecarVenv -RepoRoot $RepoRoot
  Write-Host "Installing $Label..."
  & $ctx.Pip install -e "$($ctx.Sidecar)[$ExtraSpec]"
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  Write-Host "Done. Restart the sidecar: npm run sidecar"
}
