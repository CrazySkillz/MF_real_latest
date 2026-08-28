# Budget & Financial Analysis - Current Single-Page Contract

Last reconciled with the current implementation on 2026-08-28.

## Current Visible Contract

`client/src/pages/financial-analysis.tsx` renders one executive financial view. The old
`Overview`, `ROI & ROAS`, `Cost Analysis`, `Budget Allocation`, and `Insights` tabs are
not visible. Their renderer remains behind a constant-false rollback guard and is not
the product contract.

The visible sections, in order, are:

1. `Financial Position`
2. `Budget & Pacing`
3. `Paid Media Efficiency`, only when at least one compatible paid-media metric exists
4. `Allocation & Sources`
5. `Executive Action`

### Authoritative Inputs And Synchronization

- `/api/campaigns/{campaignId}/outcome-totals?dateRange=90days` supplies
  `performanceSummary.totals`, `performanceSummary.sources`, the cumulative
  `currentValueWindow`, unavailable reasons, and `financialInputs` provenance.
- `/api/campaigns/{campaignId}` supplies `budget`, `currency`, `pacingStartDate`, and
  `pacingEndDate`.
- The visible values refetch every 30 seconds while the page is visible and on window
  focus. This is bounded polling, not real-time push.
- Refetch keeps the last compatible aggregate visible while loading. A failed or
  missing aggregate does not fall back to stale page-local financial totals.
- Revenue, spend, conversions, ROI, ROAS, CPA, CPC, CPM, CTR, and CVR are read from
  the shared aggregate. Budget metadata never filters or changes those source totals.
- In the GA4-first path, Users, Sessions, traffic Conversions, and CVR retain the fixed
  initial-import-to-latest-completed-day traffic window. Budget Conversion Efficiency
  reuses that same aggregate CVR input. Native GA4 Revenue and the conversion input used
  by CPA separately retain GA4 Overview's ordered campaign-to-date financial-source
  contract.
- Financial Position, Budget & Pacing, and Executive Action reuse the same aggregate
  Spend, Revenue, ROI, and ROAS metric objects. Paid Media Efficiency uses only the
  compatible aggregate CPC/CPM/CTR inputs, Conversion Efficiency uses aggregate GA4
  traffic CVR, and Sources Used renders the matching `financialInputs` provenance rows.

The accepted current-value window is `performance_summary_aggregate_v3` with mode
`initial_import_to_latest_completed_day`, a valid start/end date, a matching
`dataThroughDate`, and a reporting timezone. It is cumulative from the fixed initial
import boundary through the latest completed reporting day.

### Financial Position

- `Total Spend`, `Total Revenue`, `ROAS`, `ROI`, and `CPA` render from
  `performanceSummary.totals` only when marked available.
- `ROAS` renders with two decimals in both the live Financial Position card and the
  shared one-off/snapshot/scheduled Budget PDF body.
- `Profit = Total Revenue - Total Spend`; it is unavailable unless both inputs are
  compatible and available.
- `CVR` appears as the compact `Conversion Efficiency` subsection only when available.
  It shows the aggregate GA4 conversion-rate value and the connected main source label
  without repeating the underlying Conversions and Sessions in the card.
- Missing inputs render `Unavailable`; they are never displayed as zero.

### Budget & Pacing

- Campaign Budget is the shared campaign `budget` field.
- Budget period dates are the dedicated campaign `pacingStartDate` and
  `pacingEndDate` fields. They are separate from financial source dates and campaign
  revenue windows.
- `Remaining Budget = Campaign Budget - Total Spend`.
- `Budget Used % = Total Spend / Campaign Budget * 100`.
- `Daily Burn Rate = Total Spend / inclusive elapsed budget-period days`.
- `Target Daily Spend = Campaign Budget / inclusive total budget-period days`.
- `Pacing % = Daily Burn Rate / Target Daily Spend * 100`.
- `On Track` is 85%-115%, `Under` is below 85%, and `Over` is above 115%.
- A period that has not started has zero elapsed days and does not receive a pacing
  judgment. A completed period stops elapsed days at `pacingEndDate`.
- The inline editor writes only `budget`, `pacingStartDate`, and `pacingEndDate` through
  the existing campaign update route. Budget accepts numeric input and displays two
  decimals after blur.

### Efficiency And Provenance

- `Paid Media Efficiency` shows only available CPC, CPM, and CTR cards. The complete
  section is omitted when none are available; unavailable placeholder cards are not
  rendered.
- `Allocation & Sources` contains one full-width `Sources Used` card. Revenue and spend
  rows come from `outcomeTotals.financialInputs`, not from guessed platform allocation.
- Revenue and spend amounts use fixed-width, tabular-number columns so currency signs
  align within each list.
- CSV and Google Sheets spend inputs are valid spend-source provenance. They may support
  a source-mix action when their positive amounts reconcile to authoritative Total Spend,
  but they do not become standalone main Connected Platforms.

### Executive Action Rules

The three cards are fixed decision categories, not a ranked or prioritized list:

- Return: uses the displayed compatible ROAS and ROI; unavailable inputs fail closed,
  values below break-even warn, and otherwise the card reports positive return.
- Budget: uses actual pacing progress. Over-budget takes precedence; otherwise missing
  dates, a future period, below-target pace, above-target pace, and on-track pace produce
  distinct actions. Low total-budget utilization alone is not treated as proof of
  underdelivery.
- Source mix: when positive financial spend-input rows reconcile to authoritative Total
  Spend within one cent, the action names the largest spend source and its share. A
  mismatch withholds guidance. If no detailed spend inputs exist, the action falls back
  to comparable spend-capable main-source rules and requires two compatible source
  returns before suggesting a reallocation review.

### Historical Values

The current visible single-page view does not render trend indicators. Retained
comparison plumbing accepts only an exact-date `financial_daily_snapshot_v1` whose
currency, reporting date, cumulative start boundary, data-through date, reporting
timezone, and aggregate version are compatible. It must never substitute today's
cumulative value for a requested historical date.

## Superseded Multi-Tab Implementation Ledger

The material below documents the earlier multi-tab implementation and migration work.
It is retained because the source file still contains a constant-false rollback
renderer, but it does not describe the current visible UI or current product contract.

## How the Overview Tab Is Populated and Calculated

The Overview tab in the Budget & Financial Analysis section provides a high-level financial health assessment of a campaign. It aggregates data from **all connected platforms** and focuses on budget health, spend tracking, and cost efficiency.

**Source file:** `client/src/pages/financial-analysis.tsx`

---

## Data Sources

The current production path is the shared campaign aggregate:

| API Endpoint | Data Source | What It Provides |
|---|---|---|
| `/api/campaigns/{campaignId}/outcome-totals?dateRange=90days` | Campaign aggregate contract | `performanceSummary.totals`, connected source capabilities, source breakdowns, unavailable reasons, and financial input provenance |
| `/api/campaigns/{campaignId}` | Campaign record | budget, start date, end date |

The page may still load legacy platform endpoints for older fallback paths, but completed production tabs should use the aggregate contract when `performanceSummary` is present.

Financial source-of-truth rule: platform-level connected-source revenue and spend records feed the Budget & Financial aggregate. Budget & Financial Analysis must not write, override, filter, or reinterpret platform revenue/spend totals. Budget Pacing inputs only update campaign metadata used for pacing formulas.

Tab navigation follows the same content-width tab format as Campaign DeepDive Performance Summary. It must not use full-page equal-width grid tabs.

A historical snapshot endpoint is also queried for trend indicators:
- `/api/campaigns/{campaignId}/snapshots/comparison?type={comparisonType}` - returns current and previous metric snapshots.

The page refetches the aggregate and comparison snapshots every 30 seconds while visible and also refetches on window focus, so source refreshes become visible without requiring users to leave the page.

Connected Platforms are the source of truth. The Budget & Financial tabs consume the generic campaign aggregate built from those connected sources; they do not calculate platform-level truth independently. New main Connected Platforms should feed `performanceSummary.sources` and `performanceSummary.totals` with campaign-scoped metrics, capabilities, unavailable reasons, and snapshot inputs as part of the integration. Child revenue/spend inputs imported inside a parent platform remain provenance rows, not separate main Connected Platforms.

---

## Aggregate Metrics

Current completed tabs read financial values from `performanceSummary.totals` through metric wrappers:

- `spend`
- `revenue`
- `conversions`
- `cpc`
- `cpa`
- `cpm`
- `ctr`
- `cvr`
- `roi`
- `roas`

Each metric is available only when the aggregate contract marks it available and supplies a numeric value. Unavailable metrics show `Unavailable` plus the aggregate unavailable reason instead of misleading zeroes.

Connected child revenue/spend inputs, such as GA4-context HubSpot, Shopify, CSV, or Google Sheets imports, can feed totals through their parent connected platform. They are not displayed as separate main Connected Platforms.

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

Budget Utilization requires both available spend and a configured campaign budget. Pacing requires available spend, a configured campaign budget, a valid campaign start date, and a valid campaign end date. If any required input is missing, the related sub-scores are unavailable and contribute 0 points instead of being treated as 0% utilization or 100% on-track pacing.

Campaign ROI and Campaign ROAS in this health card are campaign-level aggregate health inputs read from `performanceSummary.totals.roi` and `performanceSummary.totals.roas`. They use the same formulas as platform ROI/ROAS, but their scope is the campaign aggregate across eligible connected-source financial inputs. GA4 platform ROI/ROAS is the GA4 platform-specific financial view for that campaign's GA4 scope and GA4 financial child inputs. When GA4 is the only connected financial source, the values should align; when additional connected financial sources exist, the campaign aggregate can differ from the GA4 platform view.

ROI and ROAS require available aggregate revenue and spend. If either metric is unavailable, the sub-score is unavailable and contributes 0 points instead of being labeled critical.

If every Campaign Health input is unavailable, the overall header shows `Unavailable` / `No score` instead of a red `Needs Attention` rating. This keeps missing data separate from actual poor campaign performance.

If only some health inputs are available, the displayed header score is normalized across the available inputs and shows how many of the four inputs were used. This prevents missing inputs from being treated as failed performance.

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

Overview financial cards must use `performanceSummary.totals` from `/api/campaigns/:id/outcome-totals?dateRange=90days` when live aggregate data has been requested. If that aggregate response fails or returns without `performanceSummary`, the page must keep prior aggregate data during refetch or show the metric as unavailable. It must not fall back to legacy local platform totals because those can display stale values, such as an old spend total.

Campaign budget pacing dates must not filter aggregate imported revenue or spend. Total Revenue and Total Spend in Budget & Financial Overview come from the full active platform/source provenance in the aggregate contract; the campaign start/end dates entered in Budget Pacing & Burn Rate are used only for pacing calculations.

### 4. Budget Pacing & Burn Rate

| Metric | Formula |
|---|---|
| Days Elapsed | Inclusive days from campaign `startDate` to today for active campaigns; if today is after the campaign `endDate`, elapsed days stop at the campaign `endDate` |
| Daily Burn Rate | `totalSpend / daysElapsed` |
| Target Daily Spend | `campaignBudget / inclusive total campaign days` |
| Pacing % | `(dailyBurnRate / targetDailySpend) * 100` |

Daily Burn Rate requires available spend and a valid campaign start date. Target Daily Spend requires campaign budget, a valid campaign start date, and a valid campaign end date. Pacing Status requires available spend, campaign budget, a valid campaign start date, and a valid campaign end date. Without an end date, the card still shows current daily burn and projected budget exhaustion when spend/budget/start date are available, but target daily spend and pacing are unavailable.

If the campaign has only one elapsed pacing day, Daily Burn Rate will equal Total Spend because the formula is `total spend / 1 elapsed day`. The card shows the elapsed-day count under Daily Burn Rate so this is visible to users.

When budget, start date, or end date are missing or invalid, the Budget Pacing & Burn Rate card shows inline campaign metadata inputs. When those values are already present, the card exposes an edit action. Saving those inputs updates the existing campaign `budget`, `startDate`, and `endDate` fields through `PATCH /api/campaigns/:id`, then the card recalculates Daily Burn Rate, Target Daily Spend, and Pacing Status from the saved campaign metadata and aggregate spend. Users can cancel edit mode with the `x` control, which restores the draft fields from the saved campaign values without calling the API. Users can also delete the pacing inputs, which clears those same campaign metadata fields and returns dependent pacing values to `Unavailable`. The card does not ask users to enter Daily Burn Rate, Target Daily Spend, or Pacing Status directly.

The Campaign Budget input only accepts numeric input, auto-formats with thousands separators as values are typed, such as `150,000.00`, and saves the numeric value without commas.

The card keeps its inputs synchronized from both upstream paths. Campaign budget/start/end metadata refetches while the page is visible and on window focus, and aggregate spend refetches from `/api/campaigns/:id/outcome-totals` on the same cadence. Saving or deleting pacing metadata immediately updates the campaign cache from the returned campaign row and invalidates the aggregate totals query so the next calculation uses current budget, dates, and spend.

Budget Pacing & Burn Rate inputs write only to the existing campaign metadata fields: `budget`, `startDate`, and `endDate`. Because Campaign Management displays the same campaign `budget` field, saving or deleting the Budget Pacing budget also updates the Budget value shown on the Campaign Management campaign card and edit form after the campaign query refreshes.

Within Budget & Financial Analysis, those fields impact the Overview tab only:
- Campaign Health Score: budget utilization and pacing sub-scores.
- Budget Utilization: budget used percentage and remaining budget.
- Budget Pacing & Burn Rate: daily burn rate, target daily spend, pacing status, budget-exhaustion projection, and over-budget warning.
- Financial Performance Insights: Budget Management and budget-underutilized opportunity copy through `overviewBudgetUtilization`.

These inputs do not change aggregate spend, revenue, conversions, ROI, ROAS, CPC, CPA, CPM, CTR, CVR, source breakdowns, Budget Allocation source rows, or historical snapshot values. Aggregate financial values remain sourced from `/api/campaigns/:id/outcome-totals`; campaign start/end dates must not filter revenue or spend provenance. GA4 platform `Total Revenue`, `Revenue Breakdown`, `Total Spend`, and `Spend Breakdown` are source-backed values and must also ignore Budget Pacing start/end dates.

The visible row helper text is:
- Daily Burn Rate: `Requires campaign spend and start date`
- Target Daily Spend: `Requires campaign budget, start date, and end date`
- Pacing Status: `Requires campaign spend, budget, start date, and end date`

Daily Burn Rate can be tested with a controlled GA4/mock-live campaign after spend is present in the aggregate: confirm `/api/campaigns/{campaignId}/outcome-totals?dateRange=90days` returns the expected `performanceSummary.totals.spend.value`, confirm the campaign start date, then verify the UI value equals `spend / inclusive elapsed campaign days`. For an active campaign, elapsed days stop at the current date. For a completed campaign, elapsed days stop at the campaign end date. A mock-live GA4 setup is useful for end-to-end source refresh validation, but the burn-rate formula itself depends on aggregate spend and campaign start date, not on users entering a burn-rate value.

Latest validation for this logic is covered by commit `7878a2df Validate budget pacing date inputs`: `npm run check`, `npm test -- server/campaign-financial-analysis-regression.test.ts`, and targeted `git diff --check` passed.

Render validation passed after the Commit 7 refresh/history deploy: Overview and Budget & Financial Analysis values remained in sync with the aggregate contract.

**Pacing status:**
- **On Track:** 85-115% of target daily spend
- **Ahead (overspending):** > 115%
- **Behind (underspending):** < 85%

In Campaign Health Score, the displayed Pacing Status percentage is `daily burn rate / target daily spend * 100`. A very low value, such as `3.2%`, is critical because the campaign is spending far below the expected daily pace and is more than 50% away from target.

**Budget projection:** At the current burn rate, calculates when the budget will be exhausted and whether that's before or after the campaign end date.

**Over-budget guard:** If a positive campaign budget exists and `totalSpend > campaignBudget`, shows "Budget exceeded by $X" instead of a negative days-remaining projection. If the campaign budget has been deleted or is missing, the warning is hidden because there is no budget threshold to exceed.

### 5. Cost Efficiency Metrics

| Metric | Formula | Meaning |
|---|---|---|
| **CPC** (Cost Per Click) | `totalSpend / totalClicks` | Cost to acquire one click |
| **CPA** (Cost Per Acquisition) | `totalSpend / totalConversions` | Cost to acquire one conversion |
| **CVR** (Conversion Rate) | `(totalConversions / totalClicks) * 100` | % of clicks that convert |

**View-through conversion handling:** When `totalConversions > totalClicks`, it indicates view-through conversions (users who saw an ad but didn't click, yet later converted). The CVR card notes this with a "* Exceeds 100% due to view-through conversions" message.

---

## Revenue & ROI Calculations

Revenue, spend, ROI, and ROAS are read from the aggregate contract when available.

Aggregate formulas:

```
ROAS = totalRevenue / totalSpend
ROI  = ((totalRevenue - totalSpend) / totalSpend) * 100
```

If revenue or spend is unavailable, ROI and ROAS are unavailable. The UI should not estimate missing revenue from AOV in completed production tabs when the aggregate contract provides an unavailable state.

---

## ROI & ROAS Tab

The dedicated ROI & ROAS tab provides the full return analysis. It is split into three sections:

### 1. Overall ROAS & ROI (Side-by-Side)

| Metric | Formula | Display |
|---|---|---|
| **ROAS** | `estimatedRevenue / totalSpend` | e.g. "2.45x" — for every $1 spent, $2.45 generated |
| **ROI** | `((estimatedRevenue - totalSpend) / totalSpend) * 100` | e.g. "145.00%" — net return percentage |

Each shows supporting detail: Total Ad Spend, Estimated Revenue, Net Profit, Investment.

### 2. Source ROAS Performance

Source ROAS rows come from aggregate connected main sources and aggregate financial totals. A single connected source may use aggregate totals so GA4 child revenue/spend inputs are reflected through the parent source.

Badge colors: Green (>= 3.0x), Yellow (>= 1.5x), Red (< 1.5x). Rows show spend, conversions, and revenue when the source has compatible financial data.

### 3. Source ROI Performance

Source ROI rows use the same aggregate source breakdown and display net profit as `revenue - spend`.

Badge colors: Green (>= 100%), Yellow (>= 0%), Red (< 0%). Each row shows spend and net profit when source ROI is available.

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

The Budget Allocation tab provides allocation data for spend-capable main connected sources only.

Imported spend labels inside GA4, such as Google Sheets or LinkedIn spend imports, can feed total spend, ROI, ROAS, and Budget Utilization through the GA4/campaign financial path. They are not connected ad platforms and should not appear as standalone allocation sources.

### 1. Performance Tiers

Three cards grouping spend-capable connected sources by ROAS performance:

| Tier | Criteria | Shows |
|---|---|---|
| **High Performance** (green) | ROAS >= 3.0x | Total spend in tier, % of total spend |
| **Medium Performance** (yellow) | ROAS 1.0-3.0x | Total spend in tier, % of total spend |
| **Low Performance** (red) | ROAS < 1.0x | Total spend in tier, % of total spend |

### 2. Source Budget Analysis

Per-source breakdown showing: ROAS badge, Spend, Conversions, Revenue, and Budget Share % with progress bar.

Budget reallocation guidance appears only when more than one spend-capable connected source exists.

---

## Insights Tab

Current implementation: the Insights tab uses aggregate metrics and spend-capable connected source breakdowns from the shared campaign aggregate contract.

Authoritative rules:

- Performance Summary uses aggregate ROAS and ROI. Unavailable is neutral; ROAS below 1.0x or ROI below 0% is warning; otherwise success.
- Cost Efficiency uses aggregate CPA. Unavailable is neutral; CPA below $25 is success; otherwise warning.
- Budget Management uses aggregate spend versus campaign budget. Underutilized or over-budget states are warnings; normal usage is neutral.
- Source Performance Insights use spend-capable connected source breakdowns. With one source, the row is labeled `Source Performance`; with multiple sources, the best-relative row is labeled `Strongest Source`.
- Source rows are styled as success only when ROAS is at least 3.0x. Sources below 1.0x ROAS are treated as underperforming.
- Budget Underutilized appears only when spend is below 50% of budget and ROAS is strong.
- Budget Capacity appears only when spend is 85-100% of budget and ROAS is strong.
- GA4-only campaigns with no connected spend-capable ad platform show that paid-media optimization insights require a connected ad platform.
- Budget reallocation recommendations appear only when multiple spend-capable connected sources exist.
- Cost Optimization Insights are generated only from available aggregate CTR, CVR, CPC, CPM, and CPA metrics.

### 1. Quick Summary Cards

Three color-coded cards summarizing Performance Summary, Cost Efficiency, and Budget Management using the authoritative rules above.

### 2. Source Performance Insights

Highlights source performance using spend-capable connected source breakdowns and value-based labels.

### 3. Key Opportunities

Conditional recommendations based on aggregate metric availability and thresholds.

### 4. Budget Optimization Recommendations

Only shown when multiple spend-capable connected sources have active spend:
- Scale high-performing (ROAS >= 3x) sources only if budget and source capacity allow
- Optimize underperforming (ROAS < 1x) sources before adding spend
- Reallocate budget from low to high performers only when both exist

### 5. Cost Optimization Insights

Dynamically generated recommendations based on available aggregate cost-metric thresholds (CTR, CVR, CPC, CPM, CPA).

---

## Trend Indicators

Each metric card can show a green/red trend arrow comparing current aggregate values to a compatible historical aggregate snapshot. The comparison period is configurable (1 day, 7 days, 30 days) and defaults to 7 days.

```
change % = ((current - previous) / previous) * 100
```

Changes smaller than 0.01% are hidden.

Trend indicators use `metrics.performanceSummary` from snapshots only when the snapshot aggregate version matches the current `performanceSummary.version`. Legacy or incompatible snapshots are ignored rather than mixed with the current aggregate model.

---

## Edge Cases Handled

| Edge Case | Behavior |
|---|---|
| No budget set | Campaign Health budget and pacing sub-scores show `Unavailable` and contribute 0 points |
| No campaign start date | Daily Burn Rate, pacing sub-score, Target Daily Spend, and Pacing Status show `Unavailable` |
| No campaign end date | Pacing sub-score, Target Daily Spend, and Pacing Status show `Unavailable` |
| End date before start date | Pacing sub-score, Target Daily Spend, and Pacing Status show `Unavailable` |
| Over-budget | Shows "Budget exceeded by $X" only when a positive campaign budget exists; no days-remaining projection |
| Missing aggregate metric | Shows `Unavailable` plus the aggregate unavailable reason |
| No available health inputs | Campaign Health header shows `Unavailable` / `No score` |
| Partial health inputs | Header score is normalized across available inputs and shows the input count |
| No spend-capable connected ad platform | Allocation and paid-media optimization guidance are withheld |
| GA4 child spend/revenue inputs only | Inputs feed financial totals through GA4 but do not appear as standalone allocation sources |
| Division by zero | All formulas guard with `> 0` checks, return 0 |
