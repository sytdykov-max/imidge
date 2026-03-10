param(
  [switch]$DryRun = $false
)

$ErrorActionPreference = "SilentlyContinue"

function Stop-ProcessSafe {
  param(
    [int]$ProcessId,
    [string]$Reason
  )

  if ($ProcessId -le 0) {
    return
  }

  $proc = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
  if (-not $proc) {
    return
  }

  if ($DryRun) {
    Write-Host "[DryRun] Would stop PID $ProcessId ($($proc.ProcessName)) [$Reason]"
    return
  }

  Stop-Process -Id $ProcessId -Force
  Write-Host "Stopped PID $ProcessId ($($proc.ProcessName)) [$Reason]"
}

Write-Host "Stopping Imidge dev environment..." -ForegroundColor Yellow

$targetPorts = @(3002, 9000)
$portOwners = Get-NetTCPConnection -State Listen | Where-Object { $targetPorts -contains $_.LocalPort } | Select-Object -ExpandProperty OwningProcess -Unique

foreach ($pid in $portOwners) {
  Stop-ProcessSafe -ProcessId $pid -Reason "listening port"
}

$psWithScripts = Get-CimInstance Win32_Process |
  Where-Object {
    $_.Name -match "powershell(.exe)?$" -and
    $_.CommandLine -and
    ($_.CommandLine -match "start-dev.ps1" -or $_.CommandLine -match "medusa-watchdog.ps1")
  }

foreach ($proc in $psWithScripts) {
  Stop-ProcessSafe -ProcessId $proc.ProcessId -Reason "dev/watchdog script"
}

if ($DryRun) {
  Write-Host "Dry run complete. No processes were stopped." -ForegroundColor Cyan
} else {
  Write-Host "Imidge dev environment stopped." -ForegroundColor Green
}
