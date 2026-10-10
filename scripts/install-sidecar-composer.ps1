param([string]$DataDir = $env:STUDIO_DATA_DIR)
$ErrorActionPreference = 'Stop'
if ($env:AIMC_COMPOSER_HOME) { $composerDir = $env:AIMC_COMPOSER_HOME }
elseif ($DataDir) { $composerDir = Join-Path $DataDir 'sidecar\cache\local-composer' }
elseif ($env:HF_HOME) { $composerDir = Join-Path (Split-Path -Parent $env:HF_HOME) 'local-composer' }
else { $composerDir = Join-Path $env:USERPROFILE '.cache\ai-music\local-composer' }
$composerDir = [IO.Path]::GetFullPath($composerDir)
New-Item -ItemType Directory -Force -Path $composerDir | Out-Null
function Get-VerifiedAsset([string]$Url, [string]$Name, [string]$Sha) {
  $target = Join-Path $composerDir $Name
  if ((Test-Path -LiteralPath $target) -and (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant() -eq $Sha) { return $target }
  $partial = $target + '.download'
  & curl.exe --fail --location --retry 3 --output $partial $Url
  if ($LASTEXITCODE -ne 0) { throw "Download failed: $Name" }
  if ((Get-FileHash -LiteralPath $partial -Algorithm SHA256).Hash.ToLowerInvariant() -ne $Sha) { throw "Checksum mismatch: $Name" }
  Move-Item -LiteralPath $partial -Destination $target -Force
  return $target
}
$null = Get-VerifiedAsset 'https://huggingface.co/Qwen/Qwen3-4B-GGUF/resolve/main/Qwen3-4B-Q4_K_M.gguf' 'Qwen3-4B-Q4_K_M.gguf' '7485fe6f11af29433bc51cab58009521f205840f5b4ae3a32fa7f92e8534fdf5'
$baseUrl = 'https://github.com/ggml-org/llama.cpp/releases/download/b11541'
$runtimeDir = Join-Path $composerDir 'runtime'
New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
$binaryZip = Get-VerifiedAsset "$baseUrl/llama-b11541-bin-win-cuda-12.4-x64.zip" 'llama-b11541-bin-win-cuda-12.4-x64.zip' 'c5ccdd22e6b11c013efd6a931f93c3707e6fa5ab2f90df5c7d1838785540ece3'
Expand-Archive -LiteralPath $binaryZip -DestinationPath $runtimeDir -Force
$cudaZip = Get-VerifiedAsset "$baseUrl/cudart-llama-bin-win-cuda-12.4-x64.zip" 'cudart-llama-bin-win-cuda-12.4-x64.zip' '8c79a9b226de4b3cacfd1f83d24f962d0773be79f1e7b75c6af4ded7e32ae1d6'
Expand-Archive -LiteralPath $cudaZip -DestinationPath $runtimeDir -Force
Write-Host "Local composer installed: $composerDir"
Write-Host 'Generation uses cached weights offline. GPU layers can be selected with AIMC_COMPOSER_GPU_LAYERS (0 for CPU).'
