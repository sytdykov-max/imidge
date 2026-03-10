param(
  [int]$IntervalSeconds = 12,
  [int]$StartCooldownSeconds = 25
)

$root = Split-Path -Parent $PSScriptRoot
$medusaPath = Join-Path $root "apps/medusa"
$logDir = Join-Path $root "logs"
$logPath = Join-Path $logDir "medusa-watchdog.log"

if (-not (Test-Path $logDir)) {
  New-Item -ItemType Directory -Path $logDir | Out-Null
}

function Write-Log {
  param([string]$Message)

  $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Message"
  Write-Host $line
  Add-Content -Path $logPath -Value $line
}

function Test-Port {
  param([int]$Port)

  $client = New-Object Net.Sockets.TcpClient
  try {
    $async = $client.BeginConnect("127.0.0.1", $Port, $null, $null)
    $ok = $async.AsyncWaitHandle.WaitOne(500)
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

function Test-MedusaHealth {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -TimeoutSec 6 http://localhost:9000/health
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

$lastStartAt = (Get-Date).AddYears(-1)
$failsInRow = 0

Write-Log "Watchdog started. interval=${IntervalSeconds}s cooldown=${StartCooldownSeconds}s"

while ($true) {
  $portOpen = Test-Port -Port 9000
  $healthy = $false

  if ($portOpen) {
    $healthy = Test-MedusaHealth
  }

  if ($healthy) {
    if ($failsInRow -gt 0) {
      Write-Log "Health recovered (200)."
    }
    $failsInRow = 0
    Start-Sleep -Seconds $IntervalSeconds
    continue
  }

  $failsInRow += 1
  Write-Log "Health check failed (attempt $failsInRow). portOpen=$portOpen"

  if ($failsInRow -lt 2) {
    Start-Sleep -Seconds $IntervalSeconds
    continue
  }

  $secondsSinceLastStart = [int]((Get-Date) - $lastStartAt).TotalSeconds
  if ($secondsSinceLastStart -lt $StartCooldownSeconds) {
    Write-Log "Cooldown active (${secondsSinceLastStart}s/${StartCooldownSeconds}s), skip restart."
    Start-Sleep -Seconds $IntervalSeconds
    continue
  }

  Write-Log "Restarting Medusa backend..."
  Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    "Set-Location '$medusaPath'; npm run dev"
  ) | Out-Null

  $lastStartAt = Get-Date
  $failsInRow = 0

  Start-Sleep -Seconds ([Math]::Max(6, $IntervalSeconds))
}
