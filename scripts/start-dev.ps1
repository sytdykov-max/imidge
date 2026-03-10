param(
  [switch]$DryRun,
  [switch]$Watchdog
)

$root = Split-Path -Parent $PSScriptRoot
$medusaPath = Join-Path $root "apps/medusa"
$storefrontPath = Join-Path $root "apps/storefront"

function Test-Port {
  param([int]$Port)

  $client = New-Object Net.Sockets.TcpClient
  try {
    $async = $client.BeginConnect("127.0.0.1", $Port, $null, $null)
    $ok = $async.AsyncWaitHandle.WaitOne(400)

    if (-not $ok) {
      return $false
    }

    $client.EndConnect($async)
    return $true
  } catch {
    return $false
  } finally {
    $client.Close()
  }
}

function Start-ServiceShell {
  param(
    [string]$Name,
    [string]$Path,
    [string]$Command,
    [int]$Port
  )

  if (Test-Port -Port $Port) {
    Write-Host "[$Name] already running on port $Port"
    return
  }

  Write-Host "[$Name] starting on port $Port..."

  if ($DryRun) {
    return
  }

  Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    "Set-Location '$Path'; $Command"
  ) | Out-Null
}

function Start-Watchdog {
  param([string]$RootPath)

  $watchdogScript = Join-Path $RootPath "scripts/medusa-watchdog.ps1"
  if (-not (Test-Path $watchdogScript)) {
    Write-Host "[Watchdog] script not found: $watchdogScript"
    return
  }

  $existing = Get-CimInstance Win32_Process |
    Where-Object {
      $_.Name -match "powershell" -and
      $_.CommandLine -and
      $_.CommandLine -like "*medusa-watchdog.ps1*"
    }

  if ($existing) {
    Write-Host "[Watchdog] already running"
    return
  }

  Write-Host "[Watchdog] starting..."

  if ($DryRun) {
    return
  }

  Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    "`"$watchdogScript`""
  ) | Out-Null
}

Start-ServiceShell -Name "Medusa" -Path $medusaPath -Command "npm run dev" -Port 9000
Start-ServiceShell -Name "Storefront" -Path $storefrontPath -Command "npm run dev" -Port 3002

if ($Watchdog) {
  Start-Watchdog -RootPath $root
}

Write-Host "Done. Storefront: http://127.0.0.1:3002 | API: http://127.0.0.1:9000/health"
