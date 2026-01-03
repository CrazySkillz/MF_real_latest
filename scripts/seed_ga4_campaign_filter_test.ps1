$ErrorActionPreference = "Stop"

#
# Seed script for testing MetricMind GA4 campaign filtering.
#
# What it does:
# 1) Creates TWO MetricMind campaigns: "brand_awareness" and "launch_campaign"
# 2) Sets each campaign's ga4CampaignFilter to match its name
# 3) Sends GA4 Measurement Protocol events for BOTH campaigns so the GA4 property contains multiple campaigns
#
# Then you can:
# - Connect each MetricMind campaign to the SAME GA4 property ("yesop")
# - Verify GA4 Metrics page only shows data for the campaign filter value
#
# Notes:
# - GA4 does NOT have explicit "campaign objects" — campaign values are derived from attribution (UTMs / GA4 acquisition).
# - GA4 reporting can lag ingestion by ~15–60+ minutes.
# - Measurement Protocol backdating is limited; this sends events in the last ~24h.
#

# ====== CONFIG ======
$metricMindBaseUrl = "http://localhost:5000"   # change if needed, e.g. https://<your-render-app>.onrender.com
$measurementId = "G-YZM9WTVS29"                # GA4 Measurement ID (G-...)
$apiSecret = "z1I3MNU6Q0iHHqgu4uF3EQ"          # GA4 Measurement Protocol API secret

$brandCampaignName = "brand_awareness"
$launchCampaignName = "launch_campaign"

# How much data to send
$brandSessions = 40
$launchSessions = 12
$purchaseRatePct = 25   # % of sessions that will include a purchase

# Safety: default to DRY RUN so we never keep inflating GA4 revenue/events by accident.
# To actually send events, run with:
#   powershell -ExecutionPolicy Bypass -File .\scripts\seed_ga4_campaign_filter_test.ps1 -SendEvents
param(
  [switch]$SendEvents
)

# ====== HELPERS ======
function Invoke-Json($method, $url, $body) {
  $json = $null
  if ($null -ne $body) { $json = ($body | ConvertTo-Json -Depth 20) }
  return Invoke-RestMethod -Method $method -Uri $url -ContentType "application/json" -Body $json
}

function Send-GA4($body, $userAgent) {
  if (-not $SendEvents) { return }
  $uri = "https://www.google-analytics.com/mp/collect?measurement_id=$measurementId&api_secret=$apiSecret"
  $headers = @{}
  if ($userAgent) { $headers["User-Agent"] = $userAgent }
  Invoke-RestMethod -Method Post -Uri $uri -Headers $headers -ContentType "application/json" -Body ($body | ConvertTo-Json -Depth 20) | Out-Null
}

function New-ClientId { "555.$(Get-Random -Minimum 1000000000 -Maximum 1999999999)" }
function New-SessionId { Get-Random -Minimum 1735800000 -Maximum 1735899999 }

$uaDesktopChrome = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
$uaMobileSafari  = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1"
$uaAndroidChrome = "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"

function Seed-Campaign($name) {
  Write-Host "Creating MetricMind campaign: $name"
  $created = Invoke-Json "POST" "$metricMindBaseUrl/api/campaigns" @{
    name = $name
    status = "active"
    currency = "USD"
  }
  if (-not $created.id) { throw "Failed to create campaign $name" }

  # Save GA4 campaign filter so MetricMind will query GA4 scoped to this campaign
  Write-Host "Setting ga4CampaignFilter for $name => $name"
  Invoke-Json "PATCH" "$metricMindBaseUrl/api/campaigns/$($created.id)" @{ ga4CampaignFilter = $name } | Out-Null

  return $created
}

function Send-CampaignTraffic($utmCampaign, $sessionCount) {
  Write-Host "Sending GA4 events for utm_campaign=$utmCampaign (sessions=$sessionCount)"

  $nowMs = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  $maxBackMs = 24 * 60 * 60 * 1000

  for ($i = 1; $i -le $sessionCount; $i++) {
    if (($i % 20) -eq 0) { Write-Host "  sent $i / $sessionCount" }

    $cid = New-ClientId
    $sid = New-SessionId
    $ua = @($uaDesktopChrome,$uaMobileSafari,$uaAndroidChrome) | Get-Random

    $offsetMs = Get-Random -Minimum 0 -Maximum $maxBackMs
    $baseTsMicros = [int64](($nowMs - $offsetMs) * 1000)

    $events = New-Object System.Collections.Generic.List[object]
    $landingUrl = "https://example.com/?utm_source=google&utm_medium=cpc&utm_campaign=$utmCampaign"
    $events.Add(@{
      name="page_view";
      params=@{
        ga_session_id=$sid;
        ga_session_number=1;
        engagement_time_msec=(Get-Random -Minimum 50 -Maximum 400);
        # Most reliable way for GA4 to populate campaignName is UTMs on page_location
        page_location=$landingUrl;
        page_title=("Landing " + $utmCampaign);
        # Redundant UTM params (kept for robustness)
        utm_source="google";
        utm_medium="cpc";
        utm_campaign=$utmCampaign;
        timestamp_micros=$baseTsMicros
      }
    })

    # optional scroll
    if ((Get-Random -Minimum 1 -Maximum 101) -le 40) {
      $events.Add(@{
        name="scroll";
        params=@{
          ga_session_id=$sid;
          engagement_time_msec=(Get-Random -Minimum 50 -Maximum 400);
          timestamp_micros=($baseTsMicros + 700000)
        }
      })
    }

    # purchase for some sessions
    if ((Get-Random -Minimum 1 -Maximum 101) -le $purchaseRatePct) {
      $value = [Math]::Round((Get-Random -Minimum 20 -Maximum 500) + (Get-Random), 2)
      $tx = "T-$utmCampaign-$(Get-Random -Minimum 100000 -Maximum 999999)"
      $events.Add(@{
        name="purchase";
        params=@{
          ga_session_id=$sid;
          engagement_time_msec=(Get-Random -Minimum 150 -Maximum 1200);
          currency="USD";
          value=$value;
          transaction_id=$tx;
          page_location=$landingUrl;
          utm_source="google";
          utm_medium="cpc";
          utm_campaign=$utmCampaign;
          items=@(@{ item_id="SKU-1"; item_name="Test Item"; price=$value; quantity=1 });
          timestamp_micros=($baseTsMicros + 2500000)
        }
      })
    }

    Send-GA4 @{ client_id=$cid; events=$events } $ua
  }
}

# ====== RUN ======
Write-Host "== Seeding MetricMind campaigns =="
$brand = Seed-Campaign $brandCampaignName
$launch = Seed-Campaign $launchCampaignName

Write-Host ""
Write-Host "Created campaigns:"
Write-Host ("- brand_awareness id: " + $brand.id)
Write-Host ("- launch_campaign id: " + $launch.id)

Write-Host ""
Write-Host "== Sending GA4 traffic for BOTH campaigns (so GA4 property contains multiple campaigns) =="
if (-not $SendEvents) {
  Write-Host "DRY RUN: Not sending GA4 events (use -SendEvents to enable)."
} else {
  Send-CampaignTraffic $brandCampaignName $brandSessions
  Send-CampaignTraffic $launchCampaignName $launchSessions
}

Write-Host ""
Write-Host "Next steps in MetricMind:"
Write-Host "1) Connect BOTH campaigns to the SAME GA4 property (yesop / propertyId=498536418) via the UI."
Write-Host "2) Ensure the GA4 campaign filter is set (it was pre-set to the campaign name by this script)."
Write-Host "3) Wait ~15-60 minutes, then open each campaigns GA4 Metrics page and verify:"
Write-Host "   - brand_awareness shows only brand_awareness data"
Write-Host "   - launch_campaign shows only launch_campaign data"
Write-Host ""

