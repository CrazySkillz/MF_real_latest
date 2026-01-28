param(
  [Parameter(Mandatory=$true)]
  [string]$CampaignId,

  [int]$Days = 14,

  [ValidateSet("landing_page_regression","cvr_drop","cpc_spike","engagement_decay","flat")]
  [string]$Scenario = "landing_page_regression",

  [int]$Seed = 1,

  [string]$BaseUrl = "http://localhost:5000",

  [switch]$Open
)

$uri = "$BaseUrl/api/campaigns/$CampaignId/linkedin/mock-seed"
$payload = @{
  days = $Days
  scenario = $Scenario
  seed = $Seed
} | ConvertTo-Json

Write-Host "Seeding LinkedIn mock dataset..."
Write-Host "POST $uri"
Write-Host "Body: $payload"

try {
  $resp = Invoke-RestMethod -Method Post -Uri $uri -ContentType "application/json" -Body $payload
} catch {
  Write-Host "Request failed:"
  throw
}

# If the route isn't deployed (or a proxy rewrites), Render may return the SPA HTML.
if ($resp -is [string] -and $resp.TrimStart().StartsWith("<!DOCTYPE html", [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Seed endpoint not found on this BaseUrl (received HTML). Deploy the /api/campaigns/:id/linkedin/mock-seed route, or use /api/campaigns/:id/linkedin-daily/mock for Insights-only."
}

if (-not $resp -or -not $resp.success) {
  $asJson = $null
  try { $asJson = ($resp | ConvertTo-Json -Depth 8) } catch { $asJson = [string]$resp }
  throw "Seed request did not succeed. Response: $asJson"
}

Write-Host ""
Write-Host "Success: $($resp.success)"
Write-Host "CampaignId: $($resp.campaignId)"
Write-Host "SessionId: $($resp.sessionId)"
Write-Host "Scenario: $($resp.scenario)"
Write-Host "Days: $($resp.days) ($($resp.startDate) -> $($resp.endDate))"
Write-Host "Analytics URL (open this): $BaseUrl$($resp.analyticsUrl)"

if ($Open) {
  Start-Process "$BaseUrl$($resp.analyticsUrl)"
}

