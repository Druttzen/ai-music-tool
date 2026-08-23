<#
.SYNOPSIS
  Ensure ai-sidecar/.venv exists (Python 3.10–3.12).
#>
function Invoke-SidecarPip {
  param(
    [Parameter(Mandatory = $true)][string]$Pip,
    [Parameter(Mandatory = $true)][string[]]$ArgumentList
  )
  # Native pip failures must not become terminating / parse errors under Stop.
  $eap = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  $nativePref = $null
  if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
    $nativePref = $PSNativeCommandUseErrorActionPreference
    $PSNativeCommandUseErrorActionPreference = $false
  }
  & $Pip @ArgumentList
  $code = $LASTEXITCODE
  $ErrorActionPreference = $eap
  if ($null -ne $nativePref) {
    $PSNativeCommandUseErrorActionPreference = $nativePref
  }
  return $code
}

function Ensure-SidecarVenv {
  param(
    [Parameter(Mandatory = $true)]
    [string]$RepoRoot
  )
  $local:ErrorActionPreference = "Stop"
  $root = $RepoRoot
  if ($root.StartsWith('\\?\')) { $root = $root.Substring(4) }
  $sidecar = Join-Path $root "ai-sidecar"
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
  # Format operator avoids `"path[$extra]"` which Windows PowerShell can parse as a type literal.
  $editable = '{0}[{1}]' -f $ctx.Sidecar, $ExtraSpec
  $code = Invoke-SidecarPip -Pip $ctx.Pip -ArgumentList @("install", "-e", $editable)
  if ($code -ne 0) {
    if ($ExtraSpec -eq "vocal-rvc") {
      Write-Host "rvc-python extra conflicted (omegaconf pin). Installing rvc-python --no-deps plus companion wheels..."
      $code = Invoke-SidecarPip -Pip $ctx.Pip -ArgumentList @("install", "rvc-python", "--no-deps")
      if ($code -ne 0) { exit $code }
      $code = Invoke-SidecarPip -Pip $ctx.Pip -ArgumentList @("install", "fairseq==0.12.2", "--no-deps")
      if ($code -ne 0) { exit $code }
      $code = Invoke-SidecarPip -Pip $ctx.Pip -ArgumentList @(
        "install", "faiss-cpu", "loguru", "ffmpeg-python", "praat-parselmouth>=0.4.2",
        "pyworld", "torchcrepe", "bitarray", "sacrebleu", "cython"
      )
      if ($code -ne 0) { exit $code }
    } else {
      exit $code
    }
  }
  # audiocraft pins torch==2.1.0 which conflicts with shared torch>=2.2 (stems/cover/vision).
  # Install companion deps via the [generate]/[all] extras, then audiocraft itself with --no-deps.
  if ($ExtraSpec -eq "generate" -or $ExtraSpec -eq "all") {
    Write-Host "Installing audiocraft (MusicGen) with --no-deps to keep torch>=2.2..."
    $code = Invoke-SidecarPip -Pip $ctx.Pip -ArgumentList @("install", "audiocraft>=1.3", "--no-deps")
    if ($code -ne 0) { exit $code }
  }
  Write-Host "Done. Restart the sidecar: npm run sidecar"
}
