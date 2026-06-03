# Single inspector port for Next.js dev (avoids duplicate 9241/9242 warnings).
$ErrorActionPreference = "Continue"
$env:NODE_OPTIONS = ""
Set-Location (Split-Path -Parent $PSScriptRoot)
& npx next dev --inspect=9241
