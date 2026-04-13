param(
  [string]$Destination = ""
)

$ErrorActionPreference = "Stop"

$workspace = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"

if ([string]::IsNullOrWhiteSpace($Destination)) {
  $Destination = Join-Path $workspace "partner-handoff-$timestamp"
}

$destinationPath = [System.IO.Path]::GetFullPath($Destination)

if (-not $destinationPath.StartsWith($workspace, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Destination must stay inside the workspace."
}

New-Item -ItemType Directory -Path $destinationPath -Force | Out-Null

$rootFiles = @(
  ".gitignore",
  ".env.example",
  "OLLAMA_SETUP.md",
  "package.json",
  "package-lock.json",
  "PARTNER_HANDOFF.md"
)

foreach ($file in $rootFiles) {
  $source = Join-Path $workspace $file
  if (Test-Path $source) {
    Copy-Item -LiteralPath $source -Destination (Join-Path $destinationPath $file) -Force
  }
}

$rootDirs = @("convex", "scripts", "web")
foreach ($dir in $rootDirs) {
  $source = Join-Path $workspace $dir
  if (Test-Path $source) {
    Copy-Item -LiteralPath $source -Destination (Join-Path $destinationPath $dir) -Recurse -Force
  }
}

$pathsToRemove = @(
  ".env",
  ".env.local",
  "fo",
  "node_modules",
  "web\\.env.local",
  "web\\.next",
  "web\\node_modules",
  "web\\.next-start.out.log",
  "web\\.next-start.err.log"
)

foreach ($relative in $pathsToRemove) {
  $target = Join-Path $destinationPath $relative
  if (Test-Path $target) {
    Remove-Item -LiteralPath $target -Recurse -Force
  }
}

Get-ChildItem -Path $destinationPath -Recurse -File -Filter *.log | Remove-Item -Force

Write-Output "Created sanitized partner package at:"
Write-Output $destinationPath
