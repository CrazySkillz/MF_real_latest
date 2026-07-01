param(
  [Parameter(Mandatory = $true)]
  [string]$BaseUrl,

  [Parameter(Mandatory = $true)]
  [string]$CampaignId,

  [string]$PropertyId = "",

  [ValidateSet("7days", "30days", "90days")]
  [string]$DateRange = "30days",

  [string]$Cookie = $env:MF_AUTH_COOKIE,

  [string]$BearerToken = $env:MF_BEARER_TOKEN,

  [string]$OutputPath = "",

  [switch]$IncludeSchedulerRun
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

# GA4 Overview Current Commit 1 evidence capture.
# This script is validation-only. By default it performs GET requests against the
# same Overview endpoints a user/deployed page relies on and writes a JSON packet
# for human review. It does not change application code or source records.
#
# Authentication:
# - pass -Cookie "..." or set MF_AUTH_COOKIE for cookie-authenticated deployments
# - pass -BearerToken "..." or set MF_BEARER_TOKEN if the environment supports it
#
# Side-effect boundary:
# - default mode avoids POST routes and does not trigger schedulers
# - -IncludeSchedulerRun explicitly calls the campaign-scoped scheduler validation
#   trigger and can refresh persisted GA4 daily facts for that campaign
# - existing app GET endpoints may perform their normal provider read behavior
#   when run against a live deployed environment

function Normalize-BaseUrl([string]$Value) {
  $trimmed = ""
  if (-not [string]::IsNullOrWhiteSpace($Value)) { $trimmed = $Value.Trim() }
  if (-not $trimmed) { throw "BaseUrl is required." }
  return $trimmed.TrimEnd('/')
}

function Add-QueryParam([string]$Path, [string]$Name, [string]$Value) {
  if ([string]::IsNullOrWhiteSpace($Value)) { return $Path }
  $separator = "?"
  if ($Path.Contains('?')) { $separator = "&" }
  return "$Path$separator$([uri]::EscapeDataString($Name))=$([uri]::EscapeDataString($Value))"
}

function Invoke-ValidationRequest([string]$Method, [string]$Path) {
  $uri = "$script:NormalizedBaseUrl$Path"
  $headers = @{}
  if (-not [string]::IsNullOrWhiteSpace($Cookie)) { $headers["Cookie"] = $Cookie }
  if (-not [string]::IsNullOrWhiteSpace($BearerToken)) { $headers["Authorization"] = "Bearer $BearerToken" }

  try {
    $response = Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers -ContentType "application/json"
    return [ordered]@{
      success = $true
      method = $Method
      path = $Path
      response = $response
    }
  } catch {
    $errorMessage = $_.Exception.Message
    $statusCode = $null
    if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
      $statusCode = [int]$_.Exception.Response.StatusCode
    }
    return [ordered]@{
      success = $false
      method = $Method
      path = $Path
      statusCode = $statusCode
      error = $errorMessage
    }
  }
}

$script:NormalizedBaseUrl = Normalize-BaseUrl $BaseUrl
$campaignPath = "/api/campaigns/$([uri]::EscapeDataString($CampaignId))"

$overviewPaths = [ordered]@{
  campaign = $campaignPath
  ga4Daily = (Add-QueryParam "$campaignPath/ga4-daily?days=90" "propertyId" $PropertyId)
  ga4ToDate = (Add-QueryParam (Add-QueryParam "$campaignPath/ga4-to-date" "dateRange" $DateRange) "propertyId" $PropertyId)
  ga4Breakdown = (Add-QueryParam (Add-QueryParam "$campaignPath/ga4-breakdown" "dateRange" $DateRange) "propertyId" $PropertyId)
  ga4LandingPages = (Add-QueryParam (Add-QueryParam "$campaignPath/ga4-landing-pages" "dateRange" $DateRange) "propertyId" $PropertyId)
  ga4ConversionEvents = (Add-QueryParam (Add-QueryParam "$campaignPath/ga4-conversion-events" "dateRange" $DateRange) "propertyId" $PropertyId)
  ga4Diagnostics = (Add-QueryParam (Add-QueryParam "$campaignPath/ga4-diagnostics" "dateRange" $DateRange) "propertyId" $PropertyId)
  revenueToDate = "$campaignPath/revenue-to-date?platformContext=ga4"
  revenueBreakdown = "$campaignPath/revenue-breakdown?platformContext=ga4"
  revenueSources = "$campaignPath/revenue-sources?platformContext=ga4"
  spendToDate = "$campaignPath/spend-to-date"
  spendBreakdown = "$campaignPath/spend-breakdown"
  spendSources = "$campaignPath/spend-sources"
}

$results = [ordered]@{}
foreach ($entry in $overviewPaths.GetEnumerator()) {
  $results[$entry.Key] = Invoke-ValidationRequest "GET" $entry.Value
}

if ($IncludeSchedulerRun) {
  $results["ga4DailySchedulerRunNow"] = Invoke-ValidationRequest "POST" "$campaignPath/ga4-daily-scheduler/run-now"
}

$normalizedPropertyIdInput = $null
if (-not [string]::IsNullOrWhiteSpace($PropertyId)) { $normalizedPropertyIdInput = $PropertyId }

$packet = [ordered]@{
  certificationStatus = "validation_output_only"
  currentCommit = "GA4 Overview Current Commit 1"
  generatedAt = (Get-Date).ToUniversalTime().ToString("o")
  inputs = [ordered]@{
    baseUrl = $script:NormalizedBaseUrl
    campaignId = $CampaignId
    propertyId = $normalizedPropertyIdInput
    dateRange = $DateRange
    includedSchedulerRun = [bool]$IncludeSchedulerRun
  }
  rootCause = "Current Commit 1 was an evidence gap, not a confirmed Overview calculation bug: local tests covered the Overview model, but deployed/provider endpoint evidence had not been captured for the same value paths."
  sideEffectBoundary = [ordered]@{
    scriptDefault = "GET-only evidence capture; no scheduler trigger and no source/report/KPI/Benchmark writes initiated by this script."
    schedulerFlag = "-IncludeSchedulerRun explicitly calls the campaign-scoped scheduler validation POST route and may refresh persisted GA4 daily facts for this campaign."
    providerReads = "Live deployed GET endpoints may perform their existing provider-read behavior when the app handles the request."
  }
  reviewChecklist = @(
    "Confirm campaign/client/property/source scope in campaign, diagnostics, and GA4 endpoint responses.",
    "Confirm Summary source evidence from ga4Daily, ga4ToDate, and ga4Breakdown responses.",
    "Confirm financial evidence from ga4ToDate, ga4Daily, ga4Breakdown, revenueToDate, spendToDate, revenueBreakdown, and spendBreakdown.",
    "Confirm Campaign Breakdown row values are raw GA4 row values plus only exact campaign-matched imported revenue where applicable.",
    "Confirm Landing Pages and Conversion Events rows do not receive allocated imported revenue or unmatched fallback rows.",
    "If scheduler/server payload evidence is required, run deployed report validation separately or rerun this script with -IncludeSchedulerRun and record the explicit side effect."
  )
  endpoints = $overviewPaths
  results = $results
}

$json = $packet | ConvertTo-Json -Depth 80
if (-not [string]::IsNullOrWhiteSpace($OutputPath)) {
  $resolvedOutputPath = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputPath)
  $parent = Split-Path -Parent $resolvedOutputPath
  if ($parent -and -not (Test-Path -LiteralPath $parent)) {
    New-Item -ItemType Directory -Path $parent | Out-Null
  }
  [System.IO.File]::WriteAllText($resolvedOutputPath, $json + [Environment]::NewLine, [System.Text.UTF8Encoding]::new($false))
  Write-Host "Wrote GA4 Overview Current Commit 1 validation packet to $resolvedOutputPath"
} else {
  $json
}