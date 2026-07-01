param(
  [Parameter(Mandatory = $true)]
  [string]$BaseUrl,

  [Parameter(Mandatory = $true)]
  [string]$CampaignId,

  [ValidateSet("snapshot", "before-add", "after-add", "before-edit", "after-edit", "before-refresh", "after-refresh", "before-delete", "after-delete")]
  [string]$Phase = "snapshot",

  [ValidateSet("all", "revenue", "spend", "pipeline")]
  [string]$SourceKind = "all",

  [string]$SourceFamily = "",

  [string]$PlatformContext = "ga4",

  [string]$PropertyId = "",

  [ValidateSet("7days", "30days", "90days")]
  [string]$DateRange = "30days",

  [string]$Cookie = $env:MF_AUTH_COOKIE,

  [string]$BearerToken = $env:MF_BEARER_TOKEN,

  [string]$CompareToPath = "",

  [string]$OutputPath = ""
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

# GA4 Overview Current Commit 2 source lifecycle evidence capture.
# This script is validation-only and GET-only. It does not create, edit,
# refresh, delete, recompute, or mutate any campaign/source/report/KPI rows.
# Run it before and after a manual/provider lifecycle action, then compare the
# snapshots to prove source identity, totals, and provenance behavior.

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

function Invoke-ValidationRequest([string]$Path) {
  $uri = "$script:NormalizedBaseUrl$Path"
  $headers = @{}
  if (-not [string]::IsNullOrWhiteSpace($Cookie)) { $headers["Cookie"] = $Cookie }
  if (-not [string]::IsNullOrWhiteSpace($BearerToken)) { $headers["Authorization"] = "Bearer $BearerToken" }

  try {
    $response = Invoke-RestMethod -Method GET -Uri $uri -Headers $headers -ContentType "application/json"
    return [ordered]@{ success = $true; method = "GET"; path = $Path; response = $response }
  } catch {
    $statusCode = $null
    if ($_.Exception.Response -and $_.Exception.Response.StatusCode) { $statusCode = [int]$_.Exception.Response.StatusCode }
    return [ordered]@{ success = $false; method = "GET"; path = $Path; statusCode = $statusCode; error = $_.Exception.Message }
  }
}

function Get-ResponseBody($Result) {
  if ($null -eq $Result) { return $null }
  if ($Result.Contains("response")) { return $Result["response"] }
  return $null
}

function Get-Number($Value) {
  if ($null -eq $Value) { return 0 }
  $text = [string]$Value
  if ([string]::IsNullOrWhiteSpace($text)) { return 0 }
  $number = 0.0
  if ([double]::TryParse($text, [System.Globalization.NumberStyles]::Any, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$number)) { return $number }
  return 0
}

function Round2($Value) {
  return [Math]::Round((Get-Number $Value), 2)
}

function Get-ArrayProperty($Object, [string]$PropertyName) {
  if ($null -eq $Object) { return @() }
  $prop = $Object.PSObject.Properties[$PropertyName]
  if ($null -eq $prop -or $null -eq $prop.Value) { return @() }
  if ($prop.Value -is [System.Array]) { return @($prop.Value) }
  return @($prop.Value)
}

function Get-PropertyValue($Object, [string]$PropertyName) {
  if ($null -eq $Object) { return $null }
  $prop = $Object.PSObject.Properties[$PropertyName]
  if ($null -eq $prop) { return $null }
  return $prop.Value
}

function Get-MappingKeySummary($Source) {
  $raw = Get-PropertyValue $Source "mappingConfig"
  if ([string]::IsNullOrWhiteSpace([string]$raw)) {
    return [ordered]@{ hasMappingConfig = $false; count = 0; sample = @(); truncated = $false }
  }

  try {
    $cfg = ConvertFrom-Json -InputObject ([string]$raw)
    $keys = @($cfg.PSObject.Properties.Name | Sort-Object)
    return [ordered]@{
      hasMappingConfig = $true
      count = $keys.Count
      sample = @($keys | Select-Object -First 20)
      truncated = $keys.Count -gt 20
    }
  } catch {
    return [ordered]@{ hasMappingConfig = $true; count = $null; sample = @("unparseable"); truncated = $true }
  }
}

function Summarize-Source($Source) {
  $mappingSummary = Get-MappingKeySummary $Source
  [ordered]@{
    id = [string](Get-PropertyValue $Source "id")
    sourceType = [string](Get-PropertyValue $Source "sourceType")
    displayName = [string](Get-PropertyValue $Source "displayName")
    platformContext = [string](Get-PropertyValue $Source "platformContext")
    isActive = Get-PropertyValue $Source "isActive"
    currency = [string](Get-PropertyValue $Source "currency")
    connectedAt = Get-PropertyValue $Source "connectedAt"
    createdAt = Get-PropertyValue $Source "createdAt"
    updatedAt = Get-PropertyValue $Source "updatedAt"
    lastTotalRevenue = Round2 (Get-PropertyValue $Source "lastTotalRevenue")
    hasMappingConfig = $mappingSummary.hasMappingConfig
    mappingKeyCount = $mappingSummary.count
    mappingKeySample = $mappingSummary.sample
    mappingKeysTruncated = $mappingSummary.truncated
  }
}

function Summarize-BreakdownRow($Row, [string]$AmountField) {
  [ordered]@{
    sourceId = [string](Get-PropertyValue $Row "sourceId")
    sourceType = [string](Get-PropertyValue $Row "sourceType")
    displayName = [string](Get-PropertyValue $Row "displayName")
    currency = [string](Get-PropertyValue $Row "currency")
    amount = Round2 (Get-PropertyValue $Row $AmountField)
  }
}

function Get-SourceIds($Items) {
  return @($Items | ForEach-Object { [string]$_.id } | Where-Object { $_ } | Sort-Object -Unique)
}

function Compare-Ids($PreviousIds, $CurrentIds) {
  $prev = @($PreviousIds)
  $curr = @($CurrentIds)
  [ordered]@{
    added = @($curr | Where-Object { $prev -notcontains $_ })
    removed = @($prev | Where-Object { $curr -notcontains $_ })
    persisted = @($curr | Where-Object { $prev -contains $_ })
  }
}

$script:NormalizedBaseUrl = Normalize-BaseUrl $BaseUrl
$campaignPath = "/api/campaigns/$([uri]::EscapeDataString($CampaignId))"
$normalizedPlatformContext = if ([string]::IsNullOrWhiteSpace($PlatformContext)) { "ga4" } else { $PlatformContext.Trim().ToLowerInvariant() }

$paths = [ordered]@{ campaign = $campaignPath }
if ($SourceKind -eq "all" -or $SourceKind -eq "revenue") {
  $paths["revenueToDate"] = "$campaignPath/revenue-to-date?platformContext=$([uri]::EscapeDataString($normalizedPlatformContext))"
  $paths["revenueBreakdown"] = "$campaignPath/revenue-breakdown?platformContext=$([uri]::EscapeDataString($normalizedPlatformContext))"
  $paths["revenueSources"] = "$campaignPath/revenue-sources?platformContext=$([uri]::EscapeDataString($normalizedPlatformContext))"
}
if ($SourceKind -eq "all" -or $SourceKind -eq "spend") {
  $paths["spendToDate"] = "$campaignPath/spend-to-date"
  $paths["spendBreakdown"] = "$campaignPath/spend-breakdown"
  $paths["spendSources"] = "$campaignPath/spend-sources"
}
if ($SourceKind -eq "all" -or $SourceKind -eq "pipeline") {
  $paths["hubspotPipelineProxy"] = "/api/hubspot/$([uri]::EscapeDataString($CampaignId))/pipeline-proxy"
  $paths["salesforcePipelineProxy"] = "/api/salesforce/$([uri]::EscapeDataString($CampaignId))/pipeline-proxy"
}
if (-not [string]::IsNullOrWhiteSpace($PropertyId)) {
  $paths["ga4ToDate"] = Add-QueryParam (Add-QueryParam "$campaignPath/ga4-to-date" "dateRange" $DateRange) "propertyId" $PropertyId
  $paths["ga4Breakdown"] = Add-QueryParam (Add-QueryParam "$campaignPath/ga4-breakdown" "dateRange" $DateRange) "propertyId" $PropertyId
}

$results = [ordered]@{}
foreach ($entry in $paths.GetEnumerator()) {
  $results[$entry.Key] = Invoke-ValidationRequest $entry.Value
}

$revenueSourcesBody = Get-ResponseBody $results["revenueSources"]
$revenueBreakdownBody = Get-ResponseBody $results["revenueBreakdown"]
$revenueToDateBody = Get-ResponseBody $results["revenueToDate"]
$spendSourcesBody = Get-ResponseBody $results["spendSources"]
$spendBreakdownBody = Get-ResponseBody $results["spendBreakdown"]
$spendToDateBody = Get-ResponseBody $results["spendToDate"]

$revenueSources = @(Get-ArrayProperty $revenueSourcesBody "sources" | ForEach-Object { Summarize-Source $_ })
$spendSources = @(Get-ArrayProperty $spendSourcesBody "sources" | ForEach-Object { Summarize-Source $_ })
$revenueBreakdown = @(Get-ArrayProperty $revenueBreakdownBody "sources" | ForEach-Object { Summarize-BreakdownRow $_ "revenue" })
$spendBreakdown = @(Get-ArrayProperty $spendBreakdownBody "sources" | ForEach-Object { Summarize-BreakdownRow $_ "spend" })

$revenueToDateTotal = Round2 (Get-PropertyValue $revenueToDateBody "totalRevenue")
$revenueBreakdownTotal = Round2 (Get-PropertyValue $revenueBreakdownBody "totalRevenue")
$spendToDateTotal = Round2 (Get-PropertyValue $spendToDateBody "totalSpend")
if ($spendToDateTotal -eq 0) { $spendToDateTotal = Round2 (Get-PropertyValue $spendToDateBody "spend") }
$spendBreakdownTotal = Round2 (Get-PropertyValue $spendBreakdownBody "totalSpend")

$summary = [ordered]@{
  revenue = [ordered]@{
    sourceCount = $revenueSources.Count
    sourceIds = Get-SourceIds $revenueSources
    totalToDate = $revenueToDateTotal
    breakdownTotal = $revenueBreakdownTotal
    reconciles = ([Math]::Abs($revenueToDateTotal - $revenueBreakdownTotal) -le 0.01)
    sources = $revenueSources
    breakdown = $revenueBreakdown
  }
  spend = [ordered]@{
    sourceCount = $spendSources.Count
    sourceIds = Get-SourceIds $spendSources
    totalToDate = $spendToDateTotal
    breakdownTotal = $spendBreakdownTotal
    reconciles = ([Math]::Abs($spendToDateTotal - $spendBreakdownTotal) -le 0.01)
    sources = $spendSources
    breakdown = $spendBreakdown
  }
}

$comparison = $null
if (-not [string]::IsNullOrWhiteSpace($CompareToPath)) {
  $previous = Get-Content -Path $CompareToPath -Raw | ConvertFrom-Json
  $comparison = [ordered]@{
    comparedTo = $CompareToPath
    revenue = [ordered]@{
      sourceIds = Compare-Ids $previous.summary.revenue.sourceIds $summary.revenue.sourceIds
      totalDelta = Round2 ($summary.revenue.totalToDate - (Get-Number $previous.summary.revenue.totalToDate))
      breakdownDelta = Round2 ($summary.revenue.breakdownTotal - (Get-Number $previous.summary.revenue.breakdownTotal))
    }
    spend = [ordered]@{
      sourceIds = Compare-Ids $previous.summary.spend.sourceIds $summary.spend.sourceIds
      totalDelta = Round2 ($summary.spend.totalToDate - (Get-Number $previous.summary.spend.totalToDate))
      breakdownDelta = Round2 ($summary.spend.breakdownTotal - (Get-Number $previous.summary.spend.breakdownTotal))
    }
  }
}

$packet = [ordered]@{
  certificationStatus = "validation_output_only"
  currentCommit = "GA4 Overview Current Commit 2"
  generatedAt = (Get-Date).ToUniversalTime().ToString("o")
  inputs = [ordered]@{
    baseUrl = $script:NormalizedBaseUrl
    campaignId = $CampaignId
    phase = $Phase
    sourceKind = $SourceKind
    sourceFamily = if ([string]::IsNullOrWhiteSpace($SourceFamily)) { $null } else { $SourceFamily }
    platformContext = $normalizedPlatformContext
    propertyId = if ([string]::IsNullOrWhiteSpace($PropertyId)) { $null } else { $PropertyId }
    dateRange = $DateRange
  }
  rootCause = "Current Commit 2 was an evidence gap, not a confirmed Overview source lifecycle bug: local code traces showed guarded source endpoints, but there was no repeatable before/after source-family snapshot for provider-backed add/edit/refresh/delete validation."
  sideEffectBoundary = "GET-only snapshot and optional comparison. This script does not perform add, edit, refresh, delete, scheduler, recompute, report, KPI, Benchmark, alert, or notification actions."
  reviewChecklist = @(
    "Run a baseline snapshot before the source-family action.",
    "Perform exactly one source-family lifecycle action through the deployed app/provider flow.",
    "Run an after snapshot with -CompareToPath pointing at the baseline output.",
    "Confirm only the intended source IDs and totals changed.",
    "Confirm revenue/spend breakdown totals reconcile to to-date totals and source modal counts.",
    "For refresh, confirm the intended source ID persisted instead of creating a duplicate active source.",
    "For delete, confirm the intended source ID was removed/deactivated and unrelated source IDs persisted."
  )
  endpoints = $paths
  endpointResults = $results
  summary = $summary
  comparison = $comparison
}

$json = $packet | ConvertTo-Json -Depth 80
if (-not [string]::IsNullOrWhiteSpace($OutputPath)) {
  $resolvedOutputPath = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputPath)
  $parent = Split-Path -Parent $resolvedOutputPath
  if ($parent -and -not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent | Out-Null }
  [System.IO.File]::WriteAllText($resolvedOutputPath, $json + [Environment]::NewLine, [System.Text.UTF8Encoding]::new($false))
  Write-Host "Wrote GA4 Overview Current Commit 2 source lifecycle snapshot to $resolvedOutputPath"
} else {
  $json
}