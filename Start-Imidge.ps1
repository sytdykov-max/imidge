param(
  [switch]$NoExit = $true
)

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectRoot

Write-Host "Starting Imidge dev environment (backend + storefront + watchdog)..." -ForegroundColor Cyan

if ($NoExit) {
  powershell -NoExit -ExecutionPolicy Bypass -Command "Set-Location '$projectRoot'; npm run dev:resilient"
} else {
  npm run dev:resilient
}
