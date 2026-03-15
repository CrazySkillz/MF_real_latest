# GA4 Test Coverage — Complete Reference

> **281 total tests** (140 unit + 141 E2E) covering every section of every GA4 tab, with exact value verification, cumulative refresh validation, and multi-campaign aggregation.

---

## How to Run

```bash
npm run test                    # 140 unit tests (instant, no browser)
npm run test:e2e:headed         # 109 E2E tests (opens browser, ~5 min)
npx playwright show-report      # View HTML report with screenshots
npx playwright test --update-snapshots  # Update visual baselines after UI changes
```

---

## Unit Tests (140 tests)

Run with: `npm run test`

These test math formulas with hardcoded inputs — no browser, no server needed.

### Test Files

| File | Tests | What it covers |
|------|-------|----------------|
| `server/ga4-cross-tab-consistency.test.ts` | 109 | All 5 yesop profiles × all formulas + KPI/Benchmark progress scenarios |
| `server/metric-math.test.ts` | 6 | ROAS, ROI, CPA, Conversion Rate, Progress |
| `server/kpi-math.test.ts` | 5 | KPI band classification, attainment %, fill capping |
| `server/ga4-filter.test.ts` | 3 | GA4 campaign filter expression building |
| `server/linkedin-metrics-math.test.ts` | 2 | LinkedIn CTR, CPC, CPM, CVR, CPA, CPL, ER |
| `server/linkedin-insights-engine.test.ts` | 4 | WoW anomaly detection (CVR drop, CPC spike, ER decay) |
| `server/utils/googleSheetsSelection.test.ts` | 7 | Sheet normalization, dedup, connection logic |
| `server/utils/salesforceCurrency.test.ts` | 4 | Currency detection fallback chain |

### What Unit Tests Validate

| Formula | Input Example | Expected Output | Tested? |
|---------|--------------|-----------------|---------|
| Conversion Rate | sessions=750, conv=38 | 5.07% | Yes |
| ROAS | revenue=$2850, spend=$950 | 300% | Yes |
| ROI | revenue=$2850, spend=$950 | 200% | Yes |
| CPA | spend=$950, conv=38 | $25.00 | Yes |
| Engagement Rate | rate=0.62 | 62% | Yes |
| KPI band (above) | current=300, target=250 | "above" | Yes |
| KPI band (below) | current=2850, target=5000 | "below" | Yes |
| KPI band (near) | current=750, target=740 | "near" | Yes |
| CPA lower-is-better | current=$25, target=$30 | "above" (good) | Yes |
| Benchmark on_track | ratio=0.94 | "on_track" | Yes |
| Benchmark behind | ratio=0.57 | "behind" | Yes |
| Zero denominators | spend=0 → ROAS=0 | 0 | Yes |
| All 5 yesop profiles | Each with different numbers | All match | Yes |

### Test Input Data (Yesop Mock Profiles)

| Campaign | Sessions | Conversions | Revenue | Spend | CR% | ROAS% | ROI% | CPA |
|----------|----------|-------------|---------|-------|-----|-------|------|-----|
| yesop-brand | 750 | 38 | $2,850 | $950 | 5.07 | 300.00 | 200.00 | $25.00 |
| yesop-prospecting | 420 | 18 | $1,350 | $680 | 4.29 | 198.53 | 98.53 | $37.78 |
| yesop-retargeting | 260 | 22 | $1,650 | $410 | 8.46 | 402.44 | 302.44 | $18.64 |
| yesop-email | 180 | 12 | $900 | $150 | 6.67 | 600.00 | 500.00 | $12.50 |
| yesop-social | 375 | 15 | $1,125 | $750 | 4.00 | 150.00 | 50.00 | $50.00 |

---

## E2E Tests (109 tests)

Run with: `npm run test:e2e:headed`

These open a real browser, click through the actual app, and check values on screen.

### Test Campaign

Uses `yesop-brand` (campaign ID: `"yesop-brand"`) — a pre-seeded demo campaign created by `POST /api/seed-yesop-campaigns`. Mock GA4 property ID: `"yesop"`.

### Prerequisites

1. App running (deployed on Render or local via `npm run dev`)
2. Auth saved: `npx playwright codegen https://mforensics.onrender.com --save-storage=e2e/auth.json`

---

### Phase A: Overview — Exact Metric Values (5 tests)

| Test | What it checks |
|------|----------------|
| A1 | Sessions card shows value > 10,000 |
| A2 | Users metric displayed |
| A3 | Conversions metric displayed |
| A4 | Revenue shows dollar amount |
| A5 | ROAS shows positive value (Xx format) |

### Phase B: Financial — API vs UI Exact Match (5 tests)

| Test | What it checks |
|------|----------------|
| B1 | API spend-breakdown total matches UI dollar amounts |
| B2 | API revenue-to-date matches UI |
| B3 | ROAS calculation = revenue / spend (verified via API) |
| B4 | CPA calculation = spend / conversions (verified via API) |
| B5 | ROI calculation = (revenue - spend) / spend * 100 |

### Phase C: Landing Pages (2 tests)

| Test | What it checks |
|------|----------------|
| C1 | Table shows page paths (/, /pricing) |
| C2 | API returns rows with sessions > 0 |

### Phase D: Conversion Events (2 tests)

| Test | What it checks |
|------|----------------|
| D1 | Event names appear, API returns 5+ events |
| D2 | "purchase" has the most conversions |

### Phase E: Mock Refresh Accumulation (2 tests)

| Test | What it checks |
|------|----------------|
| E1 | 3 refreshes → daily row count increases, all tabs work |
| E2 | Each refresh returns exact values: 750 sessions, 38 conv, $2,850 revenue |

### Phase F: Ad Comparison — API + Structure (3 tests)

| Test | What it checks |
|------|----------------|
| F1 | Tab shows campaign breakdown data |
| F2 | API returns rows with sessions > 0 |
| F3 | Weighted CR = totalConv/totalSessions (not averaged) |

### Phase G: Campaign Isolation (2 tests)

| Test | What it checks |
|------|----------------|
| G1 | yesop-brand has more sessions than yesop-prospecting (same property, different filters) |
| G2 | Different campaign names shown in browser header |

### Phase H: Overview — Missing Metric Cards (6 tests)

| Test | What it checks |
|------|----------------|
| H1 | Engagement Rate shows percentage |
| H2 | Latest Day Revenue card exists |
| H3 | Latest Day Spend card exists |
| H4 | Profit/ROI metric displayed |
| H5 | Revenue microcopy shows source labels or "Add Revenue" button |
| H6 | Spend microcopy shows source labels or "Add Spend" button |

### Phase I: KPIs — Summary + Progress (4 tests)

| Test | What it checks |
|------|----------------|
| I1 | Summary card counts (Above + OnTrack + Below ≤ Total) |
| I2 | Progress bars have green/amber/red color classes in HTML |
| I3 | KPI current values are numeric |
| I4 | Avg Progress card shows percentage |

### Phase J: Benchmarks — Summary + Edit (2 tests)

| Test | What it checks |
|------|----------------|
| J_B1 | Summary cards show On Track, Needs Attention, Behind |
| J_B2 | Edit benchmark via pencil icon opens modal |

### Phase K: Ad Comparison — Ranking + Details (3 tests)

| Test | What it checks |
|------|----------------|
| K1 | Ranking cards appear (Best Performing, etc.) |
| K2 | Table rows have numeric values |
| K3 | Metric selector/labels present |

### Phase L: Insights — Financials + Severity (4 tests)

| Test | What it checks |
|------|----------------|
| L1 | Executive Financials shows Spend, Revenue, ROAS |
| L2 | Summary cards show numeric counts |
| L3 | At least one insight has recommendation text |
| L4 | Severity badges present (High/Medium/Low) |

### Phase M: Reports (2 tests)

| Test | What it checks |
|------|----------------|
| M1 | Report templates/options visible |
| M2 | Tab has substantial content (not empty) |

### Phase N: UI Interaction Coverage (15 tests)

| Test | What it checks |
|------|----------------|
| N1 | KPI delete via trash icon → confirmation dialog appears |
| N2 | Benchmark delete via trash icon → confirmation dialog appears |
| N3 | Ad Comparison metric dropdown → switch to Revenue |
| N4 | Users non-additivity warning elements present |
| N5 | Campaign Breakdown table exists on Overview |
| N6 | Insights Trends 7d toggle clickable |
| N7 | Daily chart SVG elements exist on page |
| N8 | Report date (UTC) banner with date |
| N9 | Back to Campaign link → /campaigns/yesop-brand |
| N10 | Run Refresh button visible for yesop campaign |
| N11 | Ad Comparison bar chart container exists |
| N12 | Insight recommendation has actionable text |
| N13 | Campaign name "Brand Search" in header |
| N14 | Property ID "yesop" in data banner |
| N15 | Campaign filter in data banner |

### Spend Journeys (4 tests)

| Test | What it checks |
|------|----------------|
| J1 | Add manual spend via wizard → page shows $950 |
| J2 | Add $500 more → ROAS decreases |
| J3 | Edit spend via pencil icon → amount updates |
| J4 | Delete spend via trash → ROAS changes |

### Revenue Journeys (2 tests)

| Test | What it checks |
|------|----------------|
| J5 | Add revenue via wizard → modal opens |
| J6 | Delete revenue via trash icon |

### Refresh Cycles (3 tests)

| Test | What it checks |
|------|----------------|
| J7 ×3 | Click Run Refresh → all tabs still work after each cycle |

### KPI Journeys (9 tests)

| Test | What it checks |
|------|----------------|
| J8 ×7 | Create KPI for each template (ROAS, ROI, CPA, Revenue, CR, Sessions, Users) |
| J9 | Edit KPI → modal opens |
| J10 | Delete KPI via API → count decreases |

### Benchmark Journeys (6 tests)

| Test | What it checks |
|------|----------------|
| J11 ×5 | Create Benchmark (Sessions, Revenue, CPA, ROAS, Engagement Rate) |
| J12 | Delete Benchmark via API → count decreases |

### Insights Validation (5 tests)

| Test | What it checks |
|------|----------------|
| J13: kpi_behind | KPI with $50k target → "Needs Attention" appears |
| J13: kpi_exceeds | KPI with 100 session target → "exceeds target" appears |
| J13: financial_integrity | "Spend" and "Revenue" labels both visible |
| J13: strong_roas | "ROAS" text appears |
| J13: benchmark_behind | Benchmark with $50k target → "Behind" appears |

### Data Integrity (3 tests)

| Test | What it checks |
|------|----------------|
| J14 | API spend-breakdown ≥ 0 |
| J15 | API revenue-to-date ≥ 0 |
| J16 | UI ROAS ≈ API outcome-totals ROAS |

### Cross-Tab + Stability (2 tests)

| Test | What it checks |
|------|----------------|
| J17 | ROAS on Overview matches ROAS on Insights tab |
| J18 | Rapidly switching all 6 tabs → no crash |

### Phase O: Multi-Campaign Aggregation (10 tests)

Tests what happens when a user selects 2+ campaigns from the campaign picker. Verifies that 9 sections aggregate correctly and spend/revenue stay per-campaign.

| Test | What it checks |
|------|----------------|
| O1 | Single campaign — record baseline sessions/revenue/users |
| O2 | Select 2 campaigns → API sessions INCREASE (brand 1.0 + prospecting 0.6 = 1.6x) |
| O3 | Landing Pages — returns rows for multi-campaign |
| O4 | Conversion Events — returns rows for multi-campaign |
| O5 | Breakdown — shows both campaign names in rows |
| O6 | UI Overview — shows "Campaigns (2)" and aggregated dollar amounts |
| O7 | KPIs tab — loads with aggregated current values |
| O8 | Insights tab — shows financial data using aggregated metrics |
| O9 | Ad Comparison — shows comparison between both campaigns |
| O10 | Spend NOT affected — spend-breakdown stays same regardless of GA4 filter |

**Key insight:** Spend/Revenue are per-campaign (stored in `spend_sources`/`revenue_sources` tables by `campaignId`). They do NOT change when the GA4 campaign filter changes. Only GA4 metrics aggregate.

### Visual Snapshots (6 tests)

| Test | What it checks |
|------|----------------|
| J21 ×6 | Screenshot baseline for Overview, KPIs, Benchmarks, Ad Comparison, Insights, Reports |

---

## What is NOT Tested (and Why)

| Item | Why it's OK to skip |
|------|---------------------|
| PDF report download | Client-side jspdf — can't inspect PDF content in Playwright |
| Report scheduling form | UX feature, not data accuracy |
| KPI alert breach red dot | CSS animation detection is fragile/flaky |
| Toast notifications | Auto-dismiss timing makes tests unreliable |
| Error states (API failures) | Requires intercepting network requests — complex setup |
| Loading spinners | Transient UI — not accuracy-related |
| Campaign picker modal | Tested indirectly via campaign isolation (G1-G2) |
| Property selector switching | Mock has single property — not applicable |

---

## CI/CD

GitHub Actions (`.github/workflows/test.yml`) automatically runs the 140 unit tests on every git push. E2E tests are run manually via `npm run test:e2e:headed`.

---

## Test Configuration Files

| File | Purpose |
|------|---------|
| `vitest.config.ts` | Unit test runner config |
| `playwright.config.ts` | E2E test runner config (base URL, HTML reporter, screenshots) |
| `e2e/fixtures/ga4-scenarios.json` | Data-driven test scenarios (KPIs, benchmarks, insights) |
| `e2e/fixtures/test-spend.csv` | Test CSV for CSV upload journey |
| `e2e/auth.json` | Saved Clerk auth session (gitignored, created manually) |
| `.github/workflows/test.yml` | CI/CD — runs unit tests on push |
