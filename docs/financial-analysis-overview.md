# Budget & Financial Analysis - Overview Tab

## How the Overview Tab Is Populated and Calculated

The Overview tab in the Budget & Financial Analysis section provides a high-level financial health assessment of a campaign. It aggregates data from **all connected platforms** and focuses on budget health, spend tracking, and cost efficiency.

**Source file:** `client/src/pages/financial-analysis.tsx`

---

## Data Sources

The Overview tab queries 5 APIs in parallel when the page loads:

| API Endpoint | Data Source | What It Provides |
|---|---|---|
| `/api/linkedin/metrics/{campaignId}` | LinkedIn Ads | spend, impressions, engagements, clicks, conversions, conversionValue, revenue, roas, roi |
| `/api/custom-integration/{campaignId}` | Custom Integration (PDF upload) | spend, impressions, clicks, conversions, leads, sessions, users, pageviews |
| `/api/meta/{campaignId}/analytics` | Meta Ads (Facebook/Instagram) | totalSpend, totalImpressions, totalClicks, totalConversions |
| `/api/campaigns/{campaignId}/ga4-metrics` | Google Analytics 4 | averageOrderValue (used as AOV fallback) |
| `/api/campaigns/{campaignId}/google-sheets-data` | Google Sheets | totalSpend, totalImpressions, totalEngagements, totalClicks, totalConversions |

A historical snapshot endpoint is also queried for trend indicators:
- `/api/campaigns/{campaignId}/snapshots?date={targetDate}` - returns the closest snapshot to the comparison date (1d, 7d, or 30d ago)

---

## Platform Metrics Aggregation

Each platform's raw metrics are extracted into a `platformMetrics` object:

```
platformMetrics = {
  linkedIn:           { spend, impressions, engagements, clicks, conversions }
  customIntegration:  { spend, impressions, engagements, clicks, conversions }
  sheets:             { spend, impressions, engagements, clicks, conversions }
  meta:               { spend, impressions, engagements: 0, clicks, conversions }
}
```

**Totals are summed across all platforms:**
- `totalSpend = LinkedIn + CI + Sheets + Meta`
- `totalImpressions = LinkedIn + CI + Sheets + Meta`
- `totalClicks = LinkedIn + CI + Sheets + Meta`
- `totalConversions = LinkedIn + CI + Sheets + Meta`

---

## Overview Tab Sections

### 1. Campaign Health Score (0-100)

A composite score from 4 equally-weighted sub-scores, each worth 0-25 points:

| Sub-Score | Excellent (25 pts) | Good (15 pts) | Warning (10 pts) | Critical (0 pts) |
|---|---|---|---|---|
| **Budget Utilization** | <= 80% spent | <= 95% | <= 100% | > 100% (over-budget) |
| **Pacing** | Within +/-15% of target | Within +/-30% | Within +/-50% | > 50% deviation |
| **ROI** | >= 100% | >= 50% | >= 0% | Negative ROI |
| **ROAS** | >= 3.0x | >= 1.5x | >= 1.0x | < 1.0x |

**Overall rating:**
- 80-100: Excellent
- 60-79: Good
- 40-59: Fair
- 0-39: Needs Attention

### 2. Key Financial Metrics Cards

| Card | Formula | Notes |
|---|---|---|
| **Total Spend** | Sum of spend across all platforms | Shows trend vs historical snapshot |
| **Conversions** | Sum of conversions across all platforms | Shows trend vs historical snapshot |

### 3. Budget Utilization

| Metric | Formula |
|---|---|
| Budget Used % | `(totalSpend / campaignBudget) * 100` |
| Remaining Budget | `campaignBudget - totalSpend` |

Requires the campaign to have a `budget` field set. Displays a progress bar capped at 100%.

### 4. Budget Pacing & Burn Rate

| Metric | Formula |
|---|---|
| Days Elapsed | Days from campaign `startDate` to today (minimum 1) |
| Daily Burn Rate | `totalSpend / daysElapsed` |
| Target Daily Spend | `campaignBudget / totalCampaignDays` |
| Pacing % | `(dailyBurnRate / targetDailySpend) * 100` |

**Pacing status:**
- **On Track:** 85-115% of target daily spend
- **Ahead (overspending):** > 115%
- **Behind (underspending):** < 85%

**Budget projection:** At the current burn rate, calculates when the budget will be exhausted and whether that's before or after the campaign end date.

**Over-budget guard:** If `totalSpend > campaignBudget`, shows "Budget exceeded by $X" instead of a negative days-remaining projection.

### 5. Cost Efficiency Metrics

| Metric | Formula | Meaning |
|---|---|---|
| **CPC** (Cost Per Click) | `totalSpend / totalClicks` | Cost to acquire one click |
| **CPA** (Cost Per Acquisition) | `totalSpend / totalConversions` | Cost to acquire one conversion |
| **CVR** (Conversion Rate) | `(totalConversions / totalClicks) * 100` | % of clicks that convert |

**View-through conversion handling:** When `totalConversions > totalClicks`, it indicates view-through conversions (users who saw an ad but didn't click, yet later converted). The CVR card notes this with a "* Exceeds 100% due to view-through conversions" message.

---

## Revenue & ROI Calculations (Used by Health Score Sub-Scores)

These values are computed for the Health Score's ROI and ROAS sub-scores, but are **not displayed as cards** on the Overview tab. The full breakdown is in the dedicated ROI & ROAS tab.

### Average Order Value (AOV) Priority

Revenue estimation requires an AOV. The system uses this priority:

1. **LinkedIn `conversionValue`** - Set during LinkedIn connection setup
2. **GA4 `averageOrderValue`** - From Google Analytics 4
3. **CI `averageOrderValue`** - From Custom Integration
4. **0** - No AOV available (triggers warning banner)

### Revenue Calculation

```
LinkedIn Revenue = backend revenue field (preferred) OR (LinkedIn conversions * LinkedIn conversionValue)
Meta Revenue     = Meta conversions * estimatedAOV
Other Revenue    = (CI conversions + Sheets conversions) * fallbackAOV
Total Revenue    = LinkedIn Revenue + Meta Revenue + Other Revenue
```

### ROI and ROAS

```
ROAS = totalRevenue / totalSpend
ROI  = ((totalRevenue - totalSpend) / totalSpend) * 100
```

**Special case:** When the campaign is LinkedIn-only (no Meta revenue, no other revenue, all spend is LinkedIn), the backend-computed ROI is preferred because it accounts for imported revenue-to-date.

---

## ROI & ROAS Tab

The dedicated ROI & ROAS tab provides the full return analysis. It is split into three sections:

### 1. Overall ROAS & ROI (Side-by-Side)

| Metric | Formula | Display |
|---|---|---|
| **ROAS** | `estimatedRevenue / totalSpend` | e.g. "2.45x" — for every $1 spent, $2.45 generated |
| **ROI** | `((estimatedRevenue - totalSpend) / totalSpend) * 100` | e.g. "145.00%" — net return percentage |

Each shows supporting detail: Total Ad Spend, Estimated Revenue, Net Profit, Investment.

### 2. Platform ROAS Performance

Per-platform ROAS breakdown with color-coded badges:

| Platform | Revenue Source | ROAS Formula |
|---|---|---|
| **LinkedIn Ads** | Backend `roas` field (preferred) OR `conversions * conversionValue / spend` | Real or estimated |
| **Meta Ads** | `conversions * estimatedAOV / spend` | Estimated via AOV |
| **Custom Integration** | `conversions * fallbackAOV / spend` | Estimated via AOV |

Badge colors: Green (>= 3.0x), Yellow (>= 1.5x), Red (< 1.5x). Each row shows spend, conversions, and revenue. Platforms only appear when they have spend > 0 (or conversions > 0 for CI).

### 3. Platform ROI Performance

Per-platform ROI breakdown:

| Platform | ROI Formula |
|---|---|
| **LinkedIn Ads** | `((linkedInRevenue - linkedInSpend) / linkedInSpend) * 100` |
| **Meta Ads** | `((metaRevenue - metaSpend) / metaSpend) * 100` |
| **Custom Integration** | `((ciRevenue - ciSpend) / ciSpend) * 100` |

Badge colors: Green (>= 100%), Yellow (>= 0%), Red (< 0%). Each row shows spend and net profit.

---

## Cost Analysis Tab

The Cost Analysis tab provides cost efficiency metrics (numbers only, no recommendations).

### 1. Cost Metrics

| Metric | Formula | Meaning |
|---|---|---|
| **CPC** (Cost Per Click) | `totalSpend / totalClicks` | Cost to acquire one click |
| **CPA** (Cost Per Acquisition) | `totalSpend / totalConversions` | Cost to acquire one conversion |
| **CPM** (Cost Per Thousand Impressions) | `(totalSpend / totalImpressions) * 1000` | Cost per 1,000 impressions |

**View-through conversion handling:** When `totalConversions > totalClicks`, CPA shows both a "click-through CPA" (`spend / min(conversions, clicks)`) and a "Total CPA (incl. view-through)" underneath.

### 2. Efficiency Indicators

| Metric | Formula | Visual |
|---|---|---|
| **CTR** (Click-through Rate) | `(totalClicks / totalImpressions) * 100` | Progress bar scaled to 15% max |
| **CVR** (Conversion Rate) | `(totalConversions / totalClicks) * 100` | Progress bar scaled to 20% max |

CVR also has view-through handling — shows click-through CVR as the main number and total CVR below.

---

## Budget Allocation Tab

The Budget Allocation tab provides the per-platform budget analysis and optimization recommendations.

### 1. Performance Tiers

Three cards grouping platforms by ROAS performance:

| Tier | Criteria | Shows |
|---|---|---|
| **High Performance** (green) | ROAS >= 3.0x | Total spend in tier, % of total spend |
| **Medium Performance** (yellow) | ROAS 1.0-3.0x | Total spend in tier, % of total spend |
| **Low Performance** (red) | ROAS < 1.0x | Total spend in tier, % of total spend |

### 2. Platform Budget Analysis

Per-platform breakdown showing: ROAS badge (color-coded), Spend, Conversions, Revenue, Budget Share % with progress bar. Only platforms with `spend > 0 || conversions > 0` are shown.

### 3. Budget Optimization Recommendations

Only shown when multiple platforms have active spend:
- Scale high-performing (ROAS >= 3x) platforms
- Optimize underperforming (ROAS < 1x) platforms
- Reallocate budget from low to high performers (when both exist)

---

## Insights Tab

The Insights tab is the executive summary — all recommendations in one place.

### 1. Quick Summary Cards

Three color-coded cards summarizing: Performance (ROAS/ROI), Cost Efficiency (CPA assessment), Budget Management (utilization %).

### 2. Platform Performance Insights

Highlights the top performer and bottom performer (by ROAS) with actionable recommendations.

### 3. Key Opportunities

Conditional recommendations based on: high ROAS (scale), low CVR (optimize landing pages), low CTR (improve creative), high budget utilization with positive ROAS (increase budget).

### 4. Cost Optimization Insights

Dynamically generated recommendations based on cost-metric thresholds (CTR, CVR, CPC, CPM, CPA). Moved here from Cost Analysis so the Cost Analysis tab focuses on numbers and the Insights tab consolidates all recommendations.

---

## Trend Indicators

Each metric card can show a green/red trend arrow comparing current values to a historical snapshot. The comparison period is configurable (1 day, 7 days, 30 days) and defaults to 7 days.

```
change % = ((current - previous) / previous) * 100
```

Changes smaller than 0.01% are hidden.

---

## Edge Cases Handled

| Edge Case | Behavior |
|---|---|
| No budget set | Budget utilization = 0%, pacing shows 100% |
| No start/end date | Uses today as start date, projects from burn rate |
| Over-budget | Shows "Budget exceeded by $X" warning, no days-remaining projection |
| No AOV configured | Yellow warning banner: "Conversion Value Not Configured" |
| No platform data | Cards show $0 / 0, no errors |
| Division by zero | All formulas guard with `> 0` checks, return 0 |
