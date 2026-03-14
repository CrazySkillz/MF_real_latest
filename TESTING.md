# MimoSaaS Testing Manual

> Complete guide to running, writing, and understanding tests in MimoSaaS.

---

## Quick Start

```bash
# Run all tests once
npm run test

# Run a specific test file
npx vitest run server/metric-math.test.ts

# Watch mode (re-runs on file changes)
npx vitest watch

# Watch with browser UI
npx vitest --ui

# Run with debug output (shows test vector tables)
PRINT_TEST_VECTORS=1 npm run test

# Run with coverage report
npx vitest run --coverage
```

---

## Test Infrastructure

| Setting | Value |
|---------|-------|
| **Framework** | Vitest 4.x |
| **Config file** | `vitest.config.ts` |
| **Test pattern** | `server/**/*.test.ts` |
| **Environment** | Node.js (not browser/jsdom) |
| **Globals** | `describe`, `it`, `expect` available without import |
| **Runner** | `npm run test` → `vitest run --config vitest.config.ts` |

### Important Notes
- Tests only run from the `server/` directory (configured in `vitest.config.ts`)
- Client-side tests would need a separate config with `jsdom` environment
- No CI/CD test step exists yet — tests are developer-run only
- No `.env.test` file — tests use the same `.env` as development (unit tests don't need DB)

---

## Existing Test Files

### 1. `server/metric-math.test.ts` (6 tests)
Tests shared metric computation functions from `shared/metric-math.ts`.

| Test | What it verifies |
|------|-----------------|
| Conversion rate % | `(conversions / sessions) * 100`, zero sessions → 0 |
| ROAS % | `(revenue / spend) * 100`, zero spend → 0 |
| ROI % | `((revenue - spend) / spend) * 100`, zero spend → 0 |
| CPA | `spend / conversions`, zero conversions → 0 |
| Progress (higher-is-better) | 50% ratio → behind, 90% → on_track, clamping to 0–100 |
| Progress (lower-is-better) | CPA target 100, current 120 → 83.3% ratio → needs_attention |

### 2. `server/kpi-math.test.ts` (5 tests)
Tests KPI-specific calculations from `shared/kpi-math.ts`.

| Test | What it verifies |
|------|-----------------|
| Delta % | current 110, target 100 → +10%; null when target=0 |
| Attainment % (higher-is-better) | current 110, target 100 → 110% (uncapped) |
| Attainment % (lower-is-better) | current £0.96, target £1.00 → 104.17% |
| Band classification | +6% → "above", +5% → "near" (boundary), -20% lower-is-better → "below" |
| Fill % capping | attainment 110% → fill 100% |

### 3. `server/linkedin-metrics-math.test.ts` (2 tests)
Tests LinkedIn ad platform metric derivations from `shared/linkedin-metrics-math.ts`.

| Test | What it verifies |
|------|-----------------|
| Golden fixture | CTR, CPC, CPM, CVR, CPA, CPL, ER against known input data |
| Divide-by-zero | All 7 metrics return 0 when denominator is 0 |

### 4. `server/ga4-filter.test.ts` (3 tests)
Tests GA4 campaign dimension filter expression building.

| Test | What it verifies |
|------|-----------------|
| Empty/null filter | Returns undefined |
| Single campaign | Returns EXACT match filter expression |
| Multiple campaigns | Returns OR-group filter expression |

### 5. `server/linkedin-insights-engine.test.ts` (4 tests)
Tests week-over-week anomaly detection for LinkedIn insights.

| Test | What it verifies |
|------|-----------------|
| Not enough history | Returns empty signals when < 14 days |
| Landing page regression | CVR drop ≥20% detected |
| CPC spike | CPC increase ≥20% detected |
| Engagement decay | ER drop ≥20% detected |

### 6. `server/utils/googleSheetsSelection.test.ts` (7 tests)
Tests Google Sheets integration utilities.

### 7. `server/utils/salesforceCurrency.test.ts` (4 tests)
Tests Salesforce currency detection fallback chain.

---

## How to Write New Tests

### Step 1: Create the file
Place test files in `server/` directory with `.test.ts` extension:
```
server/your-feature.test.ts
```

### Step 2: Write the test
```typescript
import { describe, it, expect } from "vitest";
import { yourFunction } from "../shared/your-module";

describe("yourFunction", () => {
  it("computes correct result for standard input", () => {
    expect(yourFunction(100, 50)).toBeCloseTo(200, 2);
  });

  it("handles zero denominator", () => {
    expect(yourFunction(100, 0)).toBe(0);
  });

  it("handles NaN/Infinity input", () => {
    expect(yourFunction(NaN, 100)).toBe(0);
    expect(yourFunction(Infinity, 100)).toBe(0);
  });
});
```

### Step 3: Run it
```bash
npx vitest run server/your-feature.test.ts
```

### Common Assertion Patterns

```typescript
// Floating point comparison (use for any math with division)
expect(result).toBeCloseTo(expected, 2);  // 2 decimal places

// Exact equality
expect(result).toBe(42);

// Object/array comparison
expect(result).toEqual({ status: "on_track", pct: 95.5 });

// Boolean
expect(isLowerIsBetter).toBe(true);

// Array length
expect(items).toHaveLength(3);

// Null/undefined
expect(result).toBeNull();
expect(result).toBeUndefined();

// Truthy/falsy
expect(result).toBeTruthy();
```

### Template: Math Function Tests
```typescript
import { describe, it, expect } from "vitest";
import { computeMyMetric } from "../shared/metric-math";

describe("computeMyMetric", () => {
  // Standard cases
  it("computes correctly for standard inputs", () => {
    expect(computeMyMetric(1000, 50)).toBeCloseTo(expectedValue, 2);
  });

  // Edge cases
  it("returns 0 when denominator is zero", () => {
    expect(computeMyMetric(1000, 0)).toBe(0);
  });

  it("handles non-finite inputs", () => {
    expect(computeMyMetric(NaN, 100)).toBe(0);
    expect(computeMyMetric(100, NaN)).toBe(0);
    expect(computeMyMetric(Infinity, 100)).toBe(0);
  });

  it("handles negative inputs", () => {
    expect(computeMyMetric(-100, 50)).toBeCloseTo(expectedNegative, 2);
  });

  // Golden fixture (known real-world data)
  it("matches golden fixture from production data", () => {
    // Use actual campaign data as fixture
    const fixture = { impressions: 12901, clicks: 6623, spend: 17900.15 };
    expect(computeMyMetric(fixture.clicks, fixture.impressions))
      .toBeCloseTo(51.34, 2);
  });
});
```

### Template: Mocking External Calls
```typescript
import { describe, it, expect, vi } from "vitest";

describe("myServiceFunction", () => {
  it("handles API response correctly", async () => {
    // Mock fetch
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [1, 2, 3] }),
    });
    global.fetch = mockFetch;

    const result = await myServiceFunction("campaign-123");
    expect(result).toEqual({ total: 3 });
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it("handles API errors gracefully", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));
    const result = await myServiceFunction("campaign-123");
    expect(result).toBeNull();
  });
});
```

---

## Test Categories to Build

### Layer 1: Unit Tests (Shared Math) — Mostly Done
These test pure functions with no side effects. Fast, deterministic, no mocking needed.

**What exists:** `metric-math.test.ts`, `kpi-math.test.ts`, `linkedin-metrics-math.test.ts`

**What to add:**
```
server/normalize-rate.test.ts          — normalizeRateToPercent edge cases
server/ga4-kpi-computation.test.ts     — computeKpiValue (all 10 metric types)
server/benchmark-variance.test.ts      — computeBenchmarkVariance, computeBenchmarkRating
server/rolling-average.test.ts         — computeRollingAverage, computeTrendDirection
```

### Layer 2: API Contract Tests (Backend Endpoints)
Test that routes return correct shapes and handle auth/errors. Requires mocking `storage` and `ga4Service`.

**What to add:**
```
server/ga4-endpoints.test.ts
├── GET /ga4-daily — correct date range, missing connection handling
├── GET /ga4-to-date — uses yesterday, returns deduplicated users
├── GET /ga4-breakdown — 90-day window, filters (not set)
├── Auth — all endpoints require ensureCampaignAccess
└── Error responses — correct status codes and shapes
```

### Layer 3: Integration Tests (Data Pipeline)
Test full data flow through storage layer. Requires test database or mock storage.

**What to add:**
```
server/ga4-pipeline.test.ts
├── Daily refresh → ga4_daily_metrics rows
├── KPI job → kpiProgress with rolling averages
├── Benchmark job → benchmarkHistory variance
├── Spend mutation → recalcCampaignSpend
└── Revenue enrichment → revenue_records
```

### Layer 4: Client Component Tests
Requires separate vitest config with `jsdom` environment.

**Config needed in `vitest.config.ts`:**
```typescript
export default defineConfig({
  test: {
    include: ["server/**/*.test.ts", "client/src/**/*.test.{ts,tsx}"],
    environment: "node",  // Override per-file with /* @vitest-environment jsdom */
    globals: true,
  },
});
```

---

## GA4 Accuracy Validation Checklist

Use this when verifying GA4 data accuracy against the real Google Analytics console.

### Overview Tab
| MimoSaaS Metric | GA4 Console Location | Expected Match? |
|---|---|---|
| Sessions (Summary) | Reports > Acquisition > Sessions (campaign lifetime) | Exact |
| Users (Summary) | Reports > User Attributes > Users (campaign lifetime) | Exact (uses deduplicated ga4-to-date) |
| Conversions | Reports > Engagement > Conversions (filtered by campaign) | Exact |
| Revenue | Reports > Monetization > Purchase Revenue | Exact |
| Engagement Rate | Reports > Engagement > Engagement Rate | Close (client uses cumulative weighted avg) |

### Ad Comparison Tab
| MimoSaaS Metric | GA4 Console Location | Expected Match? |
|---|---|---|
| Campaign sessions | Reports > Acquisition > Traffic Acquisition (90 days) | Exact per campaign |
| Campaign conversions | Same report, conversions column | Exact |
| Campaign users | Same report, users column | Approximate (non-additive across dimensions) |
| Total across campaigns | Sum of above | Sessions/Conversions: exact. Users: overcounted |

### Financial Metrics
| MimoSaaS Metric | Source of Truth | Verification |
|---|---|---|
| Total Spend | `spend-breakdown` endpoint (sums spend_records) | Should match sum of all spend sources |
| Total Revenue | GA4 native revenue (ga4-to-date) | Match GA4 Monetization report |
| ROAS | `revenue / spend * 100` | Manual calculation matches |
| ROI | `(revenue - spend) / spend * 100` | Manual calculation matches |
| CPA | `spend / conversions` | Manual calculation matches |

### Date Range Awareness
| Tab/Section | Date Range | Notes |
|---|---|---|
| Overview Summary | Campaign lifetime (start → yesterday) | Largest numbers |
| Ad Comparison | 90 days (hardcoded) | May be lower than Overview for old campaigns |
| Daily chart | Last N days (default 30) | Configurable via dropdown |
| Latest Day Revenue | Yesterday (ga4ReportDate) | Excludes partial today |
| Latest Day Spend | Today OR yesterday | Manual/CSV dated today |

---

## Mock Refresh for Testing

MimoSaaS has a built-in mock data injection endpoint for testing without a real GA4 property:

```bash
# Inject deterministic daily data for a campaign
curl -X POST https://your-app.onrender.com/api/campaigns/{CAMPAIGN_ID}/ga4/mock-refresh \
  -H "Authorization: Bearer {CLERK_TOKEN}" \
  -H "Content-Type: application/json"
```

### Campaign Profiles (Deterministic Values)
| Profile | Users | Sessions | Pageviews | Conversions | Revenue | Spend |
|---------|-------|----------|-----------|-------------|---------|-------|
| yesop-brand | 500 | 750 | 2,250 | 38 | $2,850 | $950 |
| yesop-prospecting | 300 | 420 | 1,260 | 18 | $1,350 | $680 |

Run this daily to build up time-series data for Insights and Trend Analysis tabs.

### Trigger KPI/Benchmark Jobs Manually
```bash
curl -X POST https://your-app.onrender.com/api/campaigns/{CAMPAIGN_ID}/ga4/run-insights-jobs \
  -H "Authorization: Bearer {CLERK_TOKEN}"
```

---

## Debugging Tests

### Debug Output
Set `PRINT_TEST_VECTORS=1` to see detailed computation tables:
```bash
PRINT_TEST_VECTORS=1 npx vitest run server/kpi-math.test.ts
```

### Vitest Debug Mode
```bash
# Run with Node inspector for breakpoint debugging
node --inspect-brk ./node_modules/.bin/vitest run server/metric-math.test.ts
```
Then open `chrome://inspect` in Chrome to attach the debugger.

### VS Code Integration
Add to `.vscode/launch.json`:
```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Vitest",
  "program": "${workspaceFolder}/node_modules/.bin/vitest",
  "args": ["run", "${relativeFile}"],
  "console": "integratedTerminal"
}
```

---

## Key Formulas Reference

These are the core formulas tested and used throughout MimoSaaS:

| Metric | Formula | Module |
|--------|---------|--------|
| Conversion Rate % | `(conversions / sessions) * 100` | `metric-math.ts` |
| ROAS % | `(revenue / spend) * 100` | `metric-math.ts` |
| ROI % | `((revenue - spend) / spend) * 100` | `metric-math.ts` |
| CPA | `spend / conversions` | `metric-math.ts` |
| Normalize Rate | `v <= 1 ? v * 100 : v` | `metric-math.ts` |
| KPI Delta % | `((current - target) / target) * 100` | `kpi-math.ts` |
| KPI Attainment % | Higher: `(current / target) * 100`; Lower: `(target / current) * 100` | `kpi-math.ts` |
| KPI Band | `delta > 5%` → above, `±5%` → near, `< -5%` → below | `kpi-math.ts` |
| Benchmark Progress | `ratio >= 0.9` → on_track, `>= 0.7` → needs_attention, `< 0.7` → behind | `metric-math.ts` |
| CTR % | `(clicks / impressions) * 100` | `linkedin-metrics-math.ts` |
| CPC | `spend / clicks` | `linkedin-metrics-math.ts` |
| CPM | `(spend / impressions) * 1000` | `linkedin-metrics-math.ts` |

### Lower-Is-Better Metrics
CPC, CPM, CPA, CPL, Spend — detected by `isLowerIsBetterKpi()` in `kpi-math.ts`.
Progress ratios are inverted: `target / current` instead of `current / target`.

### ROAS Format Difference
- **GA4**: ROAS as percentage (300 = 3x ROAS)
- **LinkedIn**: ROAS as ratio (3.0 = 3x ROAS)
- These are separate KPI systems on separate pages — no cross-platform display

---

## GA4 End-to-End Validation Guide

Step-by-step guide to validate every value in every GA4 tab. Use this after connecting a real GA4 property or after seeding with mock data.

### Prerequisites

1. Create a campaign and connect a GA4 account/property
2. Set GA4 campaign filter(s) (e.g., UTM campaign names)
3. Import metrics (click "Run Refresh" to simulate a daily update)
4. Add a spend source (manual or CSV — e.g., $950)
5. Optionally add revenue source (if GA4 doesn't have native revenue)
6. Create at least 2 KPIs and 2 Benchmarks using templates
7. Run `POST /api/campaigns/:id/ga4/run-insights-jobs` to populate KPI/Benchmark history

### Mock Data Reference (Yesop Profiles)

If using the mock system, each "Run Refresh" injects one daily data point with these exact values:

| Profile | Users | Sessions | Pageviews | Conversions | Revenue | Spend |
|---------|-------|----------|-----------|-------------|---------|-------|
| yesop-brand | 500 | 750 | 2,250 | 38 | $2,850 | $950 |
| yesop-prospecting | 300 | 420 | 1,260 | 18 | $1,350 | $680 |
| yesop-retargeting | 175 | 260 | 780 | 22 | $1,650 | $410 |
| yesop-email | 125 | 180 | 540 | 12 | $900 | $150 |
| yesop-social | 250 | 375 | 1,125 | 15 | $1,125 | $750 |

**Pre-computed expected values** (verify these in the UI):

| Profile | CR% | ROAS% | ROI% | CPA |
|---------|-----|-------|------|-----|
| yesop-brand | 5.07 | 300.00 | 200.00 | $25.00 |
| yesop-prospecting | 4.29 | 198.53 | 98.53 | $37.78 |
| yesop-retargeting | 8.46 | 402.44 | 302.44 | $18.64 |
| yesop-email | 6.67 | 600.00 | 500.00 | $12.50 |
| yesop-social | 4.00 | 150.00 | 50.00 | $50.00 |

---

### Tab 1: Overview

#### Summary Cards (ga4-to-date endpoint, campaign lifetime)

| Card | How to verify | Formula |
|------|--------------|---------|
| Total Sessions | Compare against GA4 Console > Acquisition > Sessions | Direct from API |
| Total Users | Compare against GA4 Console > User Attributes | Must use deduplicated count (NOT sum of daily) |
| Total Conversions | GA4 Console > Engagement > Conversions | Direct from API |
| Total Revenue | GA4 Console > Monetization > Purchase Revenue | GA4 native only (not CRM) |
| Engagement Rate | GA4 Console > Engagement > Engagement Rate | `engagedSessions / sessions * 100` |

**Validation steps:**
1. Open GA4 Console for the same property
2. Set date range to campaign start date through yesterday
3. Apply the same campaign filter (UTM campaign name)
4. Compare each Summary card value — should be exact match (or very close for ER)

#### Financial Cards

| Card | How to verify | Formula |
|------|--------------|---------|
| Total Spend | Should equal sum of all spend sources | `SUM(spend_records)` via spend-breakdown |
| Total Revenue | GA4 native OR imported (not both) | GA4 takes precedence if available |
| ROAS | `Total Revenue / Total Spend` displayed as Xx | `(revenue / spend)` ratio |
| ROI | `(Revenue - Spend) / Spend` as percentage | `((revenue - spend) / spend) * 100` |
| CPA | `Total Spend / Total Conversions` | `spend / conversions` |
| Latest Day Revenue | Yesterday's GA4 revenue only | Uses `ga4ReportDate` (skips today) |
| Latest Day Spend | Today's or yesterday's spend record | Checks both dates, prefers whichever has data |

**Validation steps:**
1. Check Total Spend = sum of all micro-copy source amounts below the card
2. Check ROAS manually: divide Revenue by Spend. If Revenue=$2850, Spend=$950 → 3.00x
3. Check ROI: (2850-950)/950 = 200.00%
4. Check CPA: 950/38 = $25.00

#### Campaign Breakdown (ga4-breakdown, 90-day window)

| Column | Additive? | Notes |
|--------|-----------|-------|
| Sessions | Yes | Sum across campaigns is correct |
| Conversions | Yes | Sum is correct |
| Revenue | Yes | Sum is correct |
| Users | **No** | Non-additive across dimensions — will be overcounted |
| CR% | Weighted | Must be `totalConversions / totalSessions * 100` NOT average of per-campaign CRs |

**Validation steps:**
1. Note this uses a 90-day window — totals will be lower than Summary for campaigns older than 90 days
2. `(not set)` rows are filtered out — sum may be lower than Summary
3. Users column should show a tooltip warning about non-additivity

#### Landing Pages (ga4-landing-pages, campaign lifetime)

- Top 50 landing pages by sessions
- Users column has non-additivity tooltip
- Date range = campaign lifetime (startDate → yesterday)

#### Conversion Events (ga4-conversion-events, campaign lifetime)

- Top 25 events by conversion count
- Date range = campaign lifetime

---

### Tab 2: KPIs

#### For EACH KPI, verify:

| Element | Expected | How to check |
|---------|----------|-------------|
| Current Value | Matches Overview data | See lookup table below |
| Target Value | What you entered | Direct comparison |
| Attainment % | `(current / target) * 100` | Manual calculation |
| Progress Bar Fill | Capped at 100% | Visual check |
| Progress Bar Color | Green ≥100%, Amber ≥90%, Red <90% | Visual check |
| Delta Text | "X% above/below target" | Should NOT say "on track"/"behind" — only delta |
| Alert Icon (yellow) | Shows when `alertsEnabled = true` | Hover tooltip: "Alerts enabled" |
| Alert Icon (red pulse) | Shows when threshold breached | Compare current value vs alertThreshold |

#### KPI Live Value Lookup

For each KPI template, the "Current Value" comes from:

| KPI Template | Current Value Source | Example (yesop-brand) |
|-------------|---------------------|----------------------|
| Revenue | `financialRevenue` (ga4-to-date or imported) | $2,850.00 |
| ROAS | `computeRoasPercent(revenue, spend)` | 300.00% |
| ROI | `computeRoiPercent(revenue, spend)` | 200.00% |
| CPA | `computeCpa(spend, conversions)` | $25.00 |
| Total Conversions | `breakdownTotals.conversions` | 38 |
| Total Sessions | `breakdownTotals.sessions` | 750 |
| Total Users | `breakdownTotals.users` (deduplicated) | 500 |
| Conversion Rate | `computeConversionRatePercent(conv, sessions)` | 5.07% |
| Engagement Rate | `normalizeRateToPercent(engagementRate)` | 62.00% |

#### KPI Progress Scenarios to Test

| Scenario | Setup | Expected |
|----------|-------|----------|
| **Exceeding target** | ROAS target=250, current=300 | Attainment=120%, bar=green, fill=100% (capped) |
| **On track** | Sessions target=720, current=750 | Attainment=104.2%, bar=green |
| **Near target** | Revenue target=2900, current=2850 | Delta=-1.7% (within ±5%), band="near", bar=amber |
| **Below target** | Conversions target=50, current=38 | Attainment=76%, bar=red |
| **Far below** | Revenue target=5000, current=2850 | Attainment=57%, bar=red, severity=high in Insights |
| **Lower-is-better (good)** | CPA target=30, current=25 | Attainment=120% (target/current), bar=green |
| **Lower-is-better (bad)** | CPA target=20, current=25 | Attainment=80% (target/current), bar=red |
| **Blocked KPI** | ROAS KPI but no spend source | Shows "Blocked" badge, excluded from scoring |

#### Summary Cards (top of KPIs section)

| Card | Formula |
|------|---------|
| Total KPIs | Count of all KPIs |
| Above Target | Count where `effectiveDelta > +5%` |
| On Track | Count where `effectiveDelta` is within ±5% |
| Below Track | Count where `effectiveDelta < -5%` |
| Avg. Progress | Mean of all `attainmentPct` values (exclude blocked) |

---

### Tab 3: Benchmarks

#### For EACH Benchmark, verify:

| Element | Expected | How to check |
|---------|----------|-------------|
| Current Value | Same data sources as KPIs (see lookup table above) | Compare with KPI of same metric |
| Benchmark Value | What you entered | Direct comparison |
| Progress % | `(current / benchmark) * 100` | Manual calculation |
| Status Badge | on_track / needs_attention / behind | Based on ratio thresholds |
| Progress Bar Color | Green (on_track), Yellow (needs_attention), Red (behind) | Visual |

#### Benchmark Status Thresholds

| Ratio | Status | Color |
|-------|--------|-------|
| ≥ 0.90 | on_track | Green |
| ≥ 0.70 and < 0.90 | needs_attention | Yellow/Amber |
| < 0.70 | behind | Red |

**For lower-is-better (CPA):** ratio is inverted: `benchmark / current` (not current / benchmark)

#### Benchmark Scenarios to Test

| Scenario | Setup | Expected |
|----------|-------|----------|
| **On track** | Sessions: current=750, benchmark=800 | Ratio=0.94 → on_track (green) |
| **Needs attention** | Revenue: current=2850, benchmark=3500 | Ratio=0.81 → needs_attention (yellow) |
| **Behind** | Revenue: current=2850, benchmark=5000 | Ratio=0.57 → behind (red) |
| **CPA on track** | CPA: current=25, benchmark=30 | Ratio=30/25=1.2 → on_track (green) |
| **CPA behind** | CPA: current=50, benchmark=30 | Ratio=30/50=0.6 → behind (red) |

#### Summary Cards (top of Benchmarks section)

| Card | Meaning |
|------|---------|
| Total Benchmarks | Count of all |
| On Track (green) | Count where ratio ≥ 0.9 |
| Needs Attention (amber) | Count where 0.7 ≤ ratio < 0.9 |
| Behind (red) | Count where ratio < 0.7 |
| Avg. Progress | Mean of all progress percentages |

---

### Tab 4: Ad Comparison (Campaigns)

#### Ranking Cards (shown when ≥ 2 campaigns)

| Card | Logic |
|------|-------|
| Best Performing | Sorts all campaigns by selected metric, shows #1 |
| Most Efficient | Highest Conversion Rate |
| Needs Attention | Lowest Conversion Rate (must not duplicate Best Performing) |

#### Bar Chart
- Shows top 10 campaigns by selected metric
- Horizontal bars, sorted descending

#### Comparison Table

| Column | Additive? | Verification |
|--------|-----------|-------------|
| Sessions | Yes | Sum should match total (within 90-day window) |
| Users | **No** | Shows tooltip warning — sum overcounts |
| Conversions | Yes | Sum is correct |
| Revenue | Yes | Sum is correct |
| CR% | Weighted | Total CR = `(sum_conversions / sum_sessions) * 100` |

**Critical validation:**
- Switch the metric dropdown to "Users" → should see amber Info tooltip on Total card
- CR in the table must be weighted, NOT averaged: given campaigns A(300 sess, 15 conv=5%) and B(150 sess, 3 conv=2%), total CR = 18/450 = **4.0%** (not 3.5%)
- Top row should be highlighted green, bottom row red

---

### Tab 5: Insights

#### Executive Financials Section

| Card | Expected Value | Formula |
|------|---------------|---------|
| Total Spend | Same as Overview Total Spend | `financialSpend` |
| Total Revenue | Same as Overview Total Revenue | `financialRevenue` |
| Profit | Revenue - Spend | e.g., $2850 - $950 = $1,900 |
| ROAS | Same as Overview | e.g., 3.00x |
| ROI | Same as Overview | e.g., 200.00% |

**Cross-tab check:** These MUST match Overview financial cards exactly.

#### Financial Integrity Insights

| Condition | Expected Insight |
|-----------|-----------------|
| Spend exists, Revenue = $0 | HIGH: "Spend recorded, but revenue is $0 to date" |
| Revenue exists, Spend = $0 | MEDIUM: "Revenue exists, but spend is $0 to date" |
| No spend source at all | HIGH: "Spend is not configured..." |
| No revenue source at all | HIGH: "Revenue is not configured..." |
| ROI < 0 | HIGH (if ≤-20%) or MEDIUM: "ROI is negative to date" |
| ROAS < 1.0x | MEDIUM: "ROAS is below 1.0x to date" |
| KPI requires missing data | HIGH: "KPI paused: missing Spend/Revenue" |

#### KPI Performance Insights

| Condition | Expected |
|-----------|----------|
| KPI attainment < 70% | HIGH severity insight with channel-enriched recommendation |
| KPI attainment 70-90% | MEDIUM severity insight |
| KPI attainment ≥ 90% | No insight (on track) |
| KPI attainment ≥ 110% | LOW (positive): "exceeds target by X%" |

**Test:** Create a KPI with target far above current (e.g., Revenue target $10,000 with current $2,850). Should see a HIGH severity insight naming the top channel.

#### Benchmark Performance Insights

| Condition | Expected |
|-----------|----------|
| Ratio < 0.7 | HIGH: "Behind benchmark" |
| Ratio 0.7-0.9 | MEDIUM: "Below benchmark" |
| Ratio ≥ 0.9 | No insight |

#### Anomaly Detection (requires ≥ 14 days of daily data)

Run "Run Refresh" at least 14 times (or over 14 days) to build history. Then intentionally vary the data.

| Anomaly | Threshold | Severity |
|---------|-----------|----------|
| CR drop WoW | ≥ 15% decrease | HIGH |
| Engagement depth drop | ≥ 20% decrease | MEDIUM |
| Sessions drop WoW | ≥ 20% decrease | HIGH |
| Revenue drop WoW | ≥ 25% decrease | HIGH |
| Conversions drop WoW | ≥ 20% decrease | HIGH |

**Short-window (6-13 days of data):**

| Anomaly | Threshold | Severity |
|---------|-----------|----------|
| CR drop (3d vs 3d) | ≥ 25% decrease | MEDIUM |
| Sessions drop (3d vs 3d) | ≥ 30% decrease | MEDIUM |
| Revenue drop (3d vs 3d) | ≥ 35% decrease | MEDIUM |

**Test:** With < 6 days of data, should see "Anomaly detection needs more history." With 6-13 days, should see "Using 3-day comparison window (limited history)."

#### Positive Signals

| Signal | Threshold |
|--------|-----------|
| Sessions up WoW | ≥ 15% increase AND prior week > 50 sessions |
| Revenue up WoW | ≥ 20% increase |
| Conversions up WoW | ≥ 15% increase AND prior week > 5 conversions |
| Strong ROAS | ≥ 3.0x (lifetime) |
| KPI exceeds target | ≥ 110% attainment |

#### Insights Summary Cards

| Card | Expected |
|------|----------|
| Total insights | Count of all insights shown |
| High priority | Count of severity="high" |
| Needs attention | Count of severity="medium" |

Maximum 12 insights displayed, sorted by severity (high → medium → low).

---

### Tab 6: Reports

#### Standard Templates to Test

| Template | Data Source | PDF Sections |
|----------|-----------|-------------|
| Overview | `financialSpend/Revenue`, `breakdownTotals` | 2-col metric cards |
| KPIs | `computeKpiProgress()` | Cards with progress bars + status badges |
| Benchmarks | `computeBenchmarkProgress()` | Cards with progress bars |
| Ad Comparison | `campaignBreakdownAgg` | Table + Best/Worst summary cards |
| Insights | `insights` array | Cards with severity badges |

**Validation:** Download each PDF template and cross-reference values against the corresponding tab display. They should match exactly.

---

### Cross-Tab Consistency Checks

These are the most important validations — values MUST match across tabs:

| Value | Where it appears | Must match? |
|-------|-----------------|-------------|
| Total Revenue | Overview card, Insights Executive Financials, KPI "Revenue" current value | Exact |
| Total Spend | Overview card, Insights Executive Financials | Exact |
| ROAS | Overview card, Insights ROAS, KPI "ROAS" current value | Exact (display format may differ: 3.00x vs 300%) |
| ROI | Overview card, Insights ROI | Exact |
| CPA | Overview card, KPI "CPA" current value | Exact |
| Sessions | Overview Summary, KPI "Sessions" current value | Exact |
| Users | Overview Summary, KPI "Users" current value | Exact (both use deduplicated count) |
| Conversions | Overview Summary, KPI "Conversions" current value | Exact |
| CR% | KPI "Conversion Rate" current value | Must equal `(conversions/sessions)*100` |
| Blocked KPIs | KPIs tab blocked count, Insights blocked insight count | Exact |

---

## CI/CD Integration

Currently there is NO test step in the Render deployment pipeline. To add one:

### Option 1: Add to build command in `render.yaml`
```yaml
buildCommand: npm ci --include=dev && npm run test && npm run build
```
This blocks deployment if any test fails.

### Option 2: GitHub Actions (recommended)
Create `.github/workflows/test.yml`:
```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci
      - run: npm run test
```

---

## File Locations Quick Reference

| File | Purpose |
|------|---------|
| `vitest.config.ts` | Test runner configuration |
| `package.json` | `"test": "vitest run --config vitest.config.ts"` |
| `shared/metric-math.ts` | Core metric formulas (ROAS, ROI, CPA, etc.) |
| `shared/kpi-math.ts` | KPI band classification and attainment |
| `shared/linkedin-metrics-math.ts` | LinkedIn-specific metrics (CTR, CPC, CPM) |
| `server/ga4-kpi-benchmark-jobs.ts` | Scheduler KPI/benchmark computation |
| `server/metric-math.test.ts` | Metric math unit tests |
| `server/kpi-math.test.ts` | KPI math unit tests |
| `server/linkedin-metrics-math.test.ts` | LinkedIn metric tests |
| `server/ga4-filter.test.ts` | GA4 filter expression tests |
| `server/linkedin-insights-engine.test.ts` | Anomaly detection tests |
| `server/utils/googleSheetsSelection.test.ts` | Sheets utility tests |
| `server/utils/salesforceCurrency.test.ts` | Salesforce currency tests |
