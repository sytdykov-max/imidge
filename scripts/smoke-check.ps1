param(
  [string]$BackendUrl = "http://127.0.0.1:9000/health",
  [string]$StorefrontUrl = "http://127.0.0.1:3002"
)

$ErrorActionPreference = "Stop"

$checks = @(
  @{ Name = "backend_health"; Url = $BackendUrl },
  @{ Name = "home"; Url = "$StorefrontUrl/" },
  @{ Name = "catalog"; Url = "$StorefrontUrl/catalog" },
  @{ Name = "catalog_page_2"; Url = "$StorefrontUrl/catalog?page=2" },
  @{ Name = "catalog_query_bmw"; Url = "$StorefrontUrl/catalog?q=bmw" },
  @{ Name = "search"; Url = "$StorefrontUrl/search" },
  @{ Name = "product_sample"; Url = "$StorefrontUrl/product/shorts" },
  @{ Name = "cart"; Url = "$StorefrontUrl/cart" },
  @{ Name = "checkout"; Url = "$StorefrontUrl/checkout" },
  @{ Name = "blog"; Url = "$StorefrontUrl/blog" },
  @{ Name = "account"; Url = "$StorefrontUrl/account" }
)

$results = @()
$failed = $false

foreach ($check in $checks) {
  $name = $check.Name
  $url = $check.Url
  try {
    $response = Invoke-WebRequest -UseBasicParsing -TimeoutSec 12 $url
    $status = [int]$response.StatusCode
    if ($status -ne 200) {
      $failed = $true
    }
    $results += "${name}: ${status} - ${url}"
  } catch {
    $failed = $true
    if ($_.Exception.Response) {
      $status = [int]$_.Exception.Response.StatusCode.value__
      $results += "${name}: ${status} - ${url}"
    } else {
      $results += "${name}: ERROR - ${url} - $($_.Exception.Message)"
    }
  }
}

$timestamp = Get-Date -Format "yyyy-MM-ddTHH:mm:ss"
$header = "Smoke check @ $timestamp"
$outLines = @($header) + $results

$logDir = Join-Path $PSScriptRoot "../logs"
if (!(Test-Path $logDir)) {
  New-Item -ItemType Directory -Path $logDir | Out-Null
}

$logFile = Join-Path $logDir "smoke_status.txt"
$outLines | Set-Content -Encoding UTF8 $logFile
$outLines | ForEach-Object { Write-Output $_ }

if ($failed) {
  exit 1
}

exit 0
