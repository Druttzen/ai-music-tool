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
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    & "$venv\Scripts\python" -m pip install --upgrade pip
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    & "$venv\Scripts\pip" install -e $sidecar
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  }

  return @{
    Sidecar = $sidecar
    Venv = $venv
    Pip = (Join-Path $venv "Scripts\pip.exe")
  }
}

function Test-NvidiaGpuPresent {
  try {
    $null = & nvidia-smi -L 2>$null
    return ($LASTEXITCODE -eq 0)
  } catch {
    return $false
  }
}

function Test-SidecarTorchCuda {
  param([Parameter(Mandatory = $true)][string]$Python)
  try {
    $pyCode = 'import torch; print("1" if torch.cuda.is_available() else "0")'
    $out = & $Python -c $pyCode 2>$null
    return ("$out".Trim() -eq "1")
  } catch {
    return $false
  }
}

function Ensure-SidecarCudaTorch {
  param(
    [Parameter(Mandatory = $true)][string]$Pip,
    [Parameter(Mandatory = $true)][string]$Python,
    [switch]$Force
  )
  if ($env:AIMC_FORCE_CPU -eq "1") {
    Write-Host "AIMC_FORCE_CPU=1 - skipping CUDA torch upgrade"
    return
  }
  if (-not (Test-NvidiaGpuPresent)) {
    Write-Host "No NVIDIA GPU detected - keeping CPU torch"
    return
  }
  if (-not $Force -and (Test-SidecarTorchCuda -Python $Python)) {
    Write-Host "torch.cuda already available - skipping CUDA torch upgrade"
    return
  }
  # cu126: broad driver support (incl. Ada). Override with AIMC_TORCH_CUDA_INDEX (e.g. cu130).
  $index = if ($env:AIMC_TORCH_CUDA_INDEX) {
    $env:AIMC_TORCH_CUDA_INDEX.Trim()
  } else {
    "https://download.pytorch.org/whl/cu126"
  }
  Write-Host "Installing CUDA torch/torchaudio from $index ..."
  # Prefer CUDA wheels via extra-index so other deps still resolve from PyPI.
  $code = Invoke-SidecarPip -Pip $Pip -ArgumentList @(
    "install", "--upgrade", "torch", "torchaudio", "--extra-index-url", $index
  )
  if ($code -ne 0) { exit $code }
  if (Test-SidecarTorchCuda -Python $Python) {
    Write-Host "CUDA torch OK"
  } else {
    Write-Host "WARNING: CUDA wheels installed but torch.cuda still unavailable - check NVIDIA driver"
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
  # PyPI defaults to CPU wheels on Windows; upgrade to CUDA when NVIDIA is present.
  $torchExtras = @(
    "stems", "stems-melband", "generate", "classify", "vision", "cover", "cover-ref",
    "vocal-ml", "vocal-rvc", "all"
  )
  $needsCuda = $false
  foreach ($part in ($ExtraSpec -split ",")) {
    if ($torchExtras -contains $part.Trim()) { $needsCuda = $true; break }
  }
  if ($needsCuda) {
    Ensure-SidecarCudaTorch -Pip $ctx.Pip -Python (Join-Path $ctx.Venv "Scripts\python.exe")
  }
  Write-Host "Done. Restart the sidecar: npm run sidecar"
}
