<# Run only on an isolated GitHub Windows runner, never on the user's installation. #>
$ErrorActionPreference = 'Stop'
if ($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_OS -ne 'Windows') {
  throw 'This installation smoke requires an isolated GitHub Windows runner.'
}
$root = Split-Path -Parent $PSScriptRoot
$version = (Get-Content (Join-Path $root 'package.json') -Raw | ConvertFrom-Json).version
$testRoot = Join-Path $env:RUNNER_TEMP 'studio-installed-upgrade-smoke'
$installRoot = Join-Path $testRoot 'registered-studio'
$otherRoot = Join-Path $testRoot 'blocked-second-copy'
$ownerKey = 'HKLM:\Software\com.djmad.aimusiccreator.studio'
if (Test-Path $ownerKey) { throw 'A Studio installation already exists on this runner; refusing to touch it.' }
New-Item -ItemType Directory -Path $testRoot -Force | Out-Null
$setup = Get-ChildItem (Join-Path $root 'src-tauri/target/release/bundle/nsis/*-setup.exe') | Select-Object -First 1
if (-not $setup) { throw 'New Windows installer missing.' }

function Run-Installer([string]$exe, [string[]]$options, [int]$expected) {
  $process = Start-Process -FilePath $exe -ArgumentList $options -WindowStyle Hidden -Wait -PassThru
  if ($process.ExitCode -ne $expected) { throw "Installer returned $($process.ExitCode), expected $expected." }
}

$launched = $null
try {
  & gh release download studio-v0.50.66 --repo Druttzen/ai-music-tool --pattern '*_x64-setup.exe*' --dir $testRoot --clobber
  if ($LASTEXITCODE -ne 0) { throw 'Could not obtain the signed baseline installer.' }
  $baseline = Get-ChildItem $testRoot -Filter '*_x64-setup.exe' | Select-Object -First 1
  & node -e 'const fs=require("node:fs"); const {verifySignedArtifact}=require("./scripts/verify-studio-release.cjs"); const file=process.argv[1]; const pubkey=require("./src-tauri/tauri.conf.json").plugins.updater.pubkey; verifySignedArtifact(fs.readFileSync(file),fs.readFileSync(file+".sig","utf8").trim(),pubkey);' $baseline.FullName
  if ($LASTEXITCODE -ne 0) { throw 'Baseline installer signature failed.' }
  Run-Installer $baseline.FullName @('/S', "/D=$installRoot") 0
  if ((Get-ItemProperty $ownerKey).InstallPath -ne $installRoot) { throw 'Baseline registration path differs.' }
  $retained = Join-Path $installRoot 'data/profile/updater-smoke-retain.txt'
  New-Item -ItemType Directory -Path (Split-Path $retained) -Force | Out-Null
  Set-Content -LiteralPath $retained -Value 'preserve-user-data'
  $activation = Join-Path $installRoot 'data/addons/canvas/plugin.json'
  New-Item -ItemType Directory -Path (Split-Path $activation) -Force | Out-Null
  Set-Content -LiteralPath $activation -Value '{"smoke":true}'
  Run-Installer $setup.FullName @('/S', "/D=$otherRoot") 1638
  Run-Installer $setup.FullName @('/S', '/UPDATE', "/D=$otherRoot") 1638
  if (Test-Path (Join-Path $otherRoot 'ai-music-studio.exe')) { throw 'A second installation was created.' }
  # Match Tauri's /UPDATE path: no /D, the installer restores only its owner path.
  Run-Installer $setup.FullName @('/S', '/UPDATE') 0
  $installedExe = Join-Path $installRoot 'ai-music-studio.exe'
  $installedVersion = (Get-Item $installedExe).VersionInfo.ProductVersion
  if ($installedVersion -ne $version -and $installedVersion -ne "$version.0") { throw "Unexpected installed version: $installedVersion" }
  if ((Get-ItemProperty $ownerKey).InstallPath -ne $installRoot) { throw 'Update changed the registered installation path.' }
  if ((Get-Content -LiteralPath $retained -Raw).Trim() -ne 'preserve-user-data') { throw 'Update lost user data.' }
  if ((Get-Content -LiteralPath $activation -Raw).Trim() -ne '{"smoke":true}') { throw 'Update disabled an internal plugin.' }
  Run-Installer $setup.FullName @('/S', '/UPDATE') 1638
  $launched = Start-Process -FilePath $installedExe -WindowStyle Hidden -PassThru
  Start-Sleep -Seconds 10
  $launched.Refresh()
  if ($launched.HasExited) { throw "Installed Studio failed to launch: $($launched.ExitCode)" }
  Write-Host "Installed Studio $version launched. Signed upgrade, path retention, data retention and duplicate guards passed."
} finally {
  if ($launched -and -not $launched.HasExited) {
    $null = $launched.CloseMainWindow()
    if (-not $launched.WaitForExit(10000)) { $launched.Kill(); $launched.WaitForExit() }
  }
  $uninstaller = Join-Path $installRoot 'uninstall.exe'
  if (Test-Path $uninstaller) { Run-Installer $uninstaller @('/S') 0 }
}
