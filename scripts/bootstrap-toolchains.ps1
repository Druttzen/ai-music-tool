<#
.SYNOPSIS
  Installs the Path B native toolchains (Rust + Tauri CLI) and verifies a
  compatible Python for the AI sidecar. Idempotent: skips anything already present.

.PARAMETER WithBuildTools
  Also install Visual Studio 2022 C++ Build Tools (required to LINK Rust/Tauri on
  Windows). Large (multi-GB) download; off by default.

.PARAMETER InstallPython
  Install Python 3.12 via winget even if a compatible Python (3.10-3.12) exists.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts/bootstrap-toolchains.ps1
  powershell -ExecutionPolicy Bypass -File scripts/bootstrap-toolchains.ps1 -WithBuildTools
#>
[CmdletBinding()]
param(
  [switch]$WithBuildTools,
  [switch]$InstallPython
)

$ErrorActionPreference = "Stop"

function Write-Step($msg) { Write-Host "`n=== $msg ===" -ForegroundColor Cyan }
function Have-Command($name) { return [bool](Get-Command $name -ErrorAction SilentlyContinue) }

function Invoke-Winget($id) {
  winget install --id $id -e --silent `
    --accept-source-agreements --accept-package-agreements `
    --disable-interactivity
}

# --- Rust -------------------------------------------------------------------
Write-Step "Rust toolchain"
$cargoBin = Join-Path $env:USERPROFILE ".cargo\bin"
if (-not (Have-Command "cargo")) {
  if (Have-Command "winget") {
    Write-Host "Installing Rust via winget (Rustlang.Rustup)..."
    Invoke-Winget "Rustlang.Rustup"
  } elseif (Have-Command "choco") {
    Write-Host "Installing Rust via choco (rustup.install)..."
    choco install rustup.install -y
  } else {
    Write-Host "Downloading rustup-init.exe..."
    $tmp = Join-Path $env:TEMP "rustup-init.exe"
    Invoke-WebRequest -Uri "https://win.rustup.rs/x86_64" -OutFile $tmp
    & $tmp -y --default-toolchain stable
  }
  # Make cargo available in THIS session (installer only updates future shells).
  if (Test-Path $cargoBin) { $env:Path = "$cargoBin;$env:Path" }
} else {
  Write-Host "cargo already installed: $((cargo --version) 2>$null)"
}

if (Have-Command "rustup") { rustup default stable | Out-Null }

# --- MSVC linker (needed to build Rust/Tauri on Windows) --------------------
Write-Step "C++ build tools (MSVC linker)"
$hasLinker = (Have-Command "link") -or (Test-Path "${env:ProgramFiles(x86)}\Microsoft Visual Studio\2022") -or (Test-Path "$env:ProgramFiles\Microsoft Visual Studio\2022")
if (-not $hasLinker) {
  if ($WithBuildTools -and (Have-Command "winget")) {
    Write-Host "Installing VS 2022 Build Tools with C++ workload (large)..."
    winget install --id Microsoft.VisualStudio.2022.BuildTools -e --silent `
      --accept-source-agreements --accept-package-agreements --disable-interactivity `
      --override "--quiet --wait --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
  } else {
    Write-Warning "No MSVC linker found. Rust/Tauri builds will FAIL until you install C++ build tools."
    Write-Warning "Re-run with -WithBuildTools, or install 'Desktop development with C++' from Visual Studio Installer."
  }
} else {
  Write-Host "MSVC toolchain detected."
}

# --- Tauri CLI --------------------------------------------------------------
Write-Step "Tauri CLI"
if (Have-Command "cargo") {
  if (-not (Have-Command "cargo-tauri")) {
    Write-Host "Installing tauri-cli (v2)..."
    cargo install tauri-cli --version "^2.0" --locked
  } else {
    Write-Host "tauri-cli already installed."
  }
} else {
  Write-Warning "cargo not on PATH yet; open a new shell and re-run to install tauri-cli."
}

# --- Python for the AI sidecar ---------------------------------------------
Write-Step "Python (AI sidecar: needs 3.10-3.12)"
$compatible = $null
if (Have-Command "py") {
  foreach ($v in @("3.12", "3.11", "3.10")) {
    try {
      $out = & py "-$v" --version 2>&1
      if ($LASTEXITCODE -eq 0 -and "$out" -match "Python") { $compatible = $v; break }
    } catch {
      # py launcher errors when a specific version is absent; keep probing.
    }
  }
}
if ($compatible -and -not $InstallPython) {
  Write-Host "Compatible Python found: $compatible (py -$compatible)"
} else {
  if (Have-Command "winget") {
    Write-Host "Installing Python 3.12 via winget..."
    Invoke-Winget "Python.Python.3.12"
  } else {
    Write-Warning "No winget; install Python 3.10-3.12 manually from python.org."
  }
}

Write-Step "Summary"
if (Have-Command "cargo") { $cargoLine = (cargo --version) } else { $cargoLine = "MISSING (open new shell)" }
if (Have-Command "cargo-tauri") { $tauriLine = (cargo tauri --version) } else { $tauriLine = "MISSING" }
if ($compatible) { $pyLine = "py -$compatible" } else { $pyLine = "check 'py -0p'" }
Write-Host "cargo:       $cargoLine"
Write-Host "cargo-tauri: $tauriLine"
Write-Host "python:      $pyLine"
Write-Host "`nDone. If cargo was just installed, open a NEW terminal so PATH picks it up." -ForegroundColor Green
