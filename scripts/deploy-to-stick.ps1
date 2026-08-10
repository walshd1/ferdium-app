<#
.SYNOPSIS
  Deploys the built Ferdium app to a portable drive without the zip
  compress/extract round-trip, copying only changed files.

.DESCRIPTION
  Uses the electron-builder 'dir' target output (out\win-unpacked) and
  mirrors it onto the drive with robocopy. The FerdiumAppData folder and
  any Syncthing files on the drive are never touched, and the portable
  marker folder is created if missing.

.EXAMPLE
  pnpm build --win dir --x64
  .\scripts\deploy-to-stick.ps1 -Destination E:\Ferdium

.EXAMPLE
  .\scripts\deploy-to-stick.ps1 -Destination E:\Ferdium -Build
#>
param(
  [Parameter(Mandatory = $true)]
  [string]$Destination,

  # Run the 'dir' target build before deploying.
  [switch]$Build
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

if ($Build) {
  Push-Location $root
  try {
    pnpm build --win dir --x64
    if ($LASTEXITCODE -ne 0) { throw "Build failed with exit code $LASTEXITCODE" }
  }
  finally { Pop-Location }
}

$source = Join-Path $root 'out\win-unpacked'
if (-not (Test-Path (Join-Path $source 'Ferdium.exe'))) {
  throw "No build found at $source - run: pnpm build --win dir --x64 (or pass -Build)"
}

# Deploying under a running instance risks a corrupted install on the drive.
if (Get-Process Ferdium -ErrorAction SilentlyContinue) {
  throw 'Ferdium is running - close it before deploying.'
}

# Ensure the portable marker/data folder exists so the deployed app runs in
# portable mode from the first launch.
New-Item -ItemType Directory -Force -Path (Join-Path $Destination 'FerdiumAppData') | Out-Null

robocopy $source $Destination /MIR `
  /XD FerdiumAppData SyncthingConfig-win SyncthingConfig-mac SyncthingConfig-linux syncthing `
  /XF *.ps1 *.sh `
  /NJH /NDL
if ($LASTEXITCODE -ge 8) { throw "robocopy failed with exit code $LASTEXITCODE" }

Write-Host "Deployed to $Destination (data folder untouched)."
exit 0
