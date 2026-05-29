# Campaign DeepDive Platform Comparison Production Readiness

## Purpose

Track the outstanding work required to make the Campaign DeepDive `Platform Comparison` section production ready.

The intended product behavior is:

- `Connected Platforms` shows which campaign-scoped main data sources are attached.
- `Platform Comparison` compares only the metrics currently available from those connected main sources.
- If only GA4 is connected, Platform Comparison uses only GA4-capable metrics.
- Revenue and spend sources connected inside a platform, such as Salesforce, HubSpot, Shopify, CSV, or Google Sheets imports inside GA4, are platform child inputs. Users do not connect these as separate main `Connected Platforms`; they can only feed financial totals through the parent platform/campaign financial path.
- As main Connected Platforms such as GA4, LinkedIn, Meta, Google Ads, Google Sheets, Custom Integration, TikTok, Instagram, and future integrations are connected, their available metrics must be automatically included in the comparison without double-counting.
- Campaign DeepDive subsections should fetch and aggregate main metrics from all main sources shown in the campaign `Connected Platforms` section. They should not require users to create duplicate revenue/spend inputs inside Campaign DeepDive for child systems already configured within a parent platform.
- The section should provide a marketing-executive-ready cross-source comparison, not another platform-specific drilldown.

## Required Architecture

Preserve the documented split in `ARCHITECTURE_USER_JOURNEY.md`:

- `Connected Platforms` = source-level campaign inputs.
- `View Detailed Analytics` = platform-specific drilldown.
- `Campaign DeepDive` = campaign-wide cross-platform analysis.
- `Platform Comparison` = campaign-level comparison of available connected-source metrics.

Do not turn Platform Comparison into another platform-specific page.
Do not duplicate aggregation logic across tabs.
Do not invent unavailable metrics for sources that do not provide them.
Do not display platform child revenue/spend inputs as separate main platforms.
Do not guess when Platform Comparison values differ from the connected platform source-of-truth page. Trace the exact source field, merge rule, date window, and rendered value before editing.

## Boundary With Budget & Financial Analysis

Platform Comparison and Budget & Financial Analysis intentionally share the same connected-source aggregate contract, but they should not duplicate the same product job.

Platform Comparison should answer:

- which main Connected Platforms are contributing data
- which metrics each connected source can and cannot provide
- how sources compare side by side for available metrics
- which source leads or lags for comparable metrics

Budget & Financial Analysis should answer:

- what the campaign's aggregate financial position is
- how spend, revenue, ROI, ROAS, CPA, CPC, and CVR are performing
- whether budget pacing, utilization, and allocation need attention
- what financial actions or risks executives should consider

The correct product decision is to keep both sections because they create different executive value. Platform Comparison shows source contribution and comparability. Budget & Financial Analysis supports financial decisioning, budget pacing, and spend allocation. The source-level financial comparison belongs in Platform Comparison, but the full Budget & Financial Analysis section should not be moved into Platform Comparison because it owns campaign-wide financial decisioning. Streamline overlap through role-specific copy and source-capability gating, not by merging the sections.

Executive use case:

- A marketing executive uses Platform Comparison to answer "which connected source is contributing what?" For a GA4-only campaign, this means GA4 sessions, users, conversions, and revenue. After LinkedIn, Meta, Google Ads, or another main paid-media platform is connected, this section compares each platform's available spend, impressions, clicks, conversions, revenue, ROAS, ROI, CPA, and other supported metrics side by side.
- The same executive uses Budget & Financial Analysis for the separate question "is the campaign financially healthy and what should we do with budget?" That includes aggregate ROI, ROAS, total spend, total revenue, pacing, utilization, allocation, and financial-risk interpretation.
- Platform Comparison can include a source-level financial comparison tab, but it should not absorb campaign-wide budget pacing or financial decisioning because those are not source-comparison tasks.

## Resolved Root Cause

`client/src/pages/platform-comparison.tsx` previously partially used `/api/campaigns/:id/outcome-totals`, but still built comparison rows through page-local, hardcoded platform logic.

Resolved issues:

- source inclusion is hard-coded for LinkedIn, Meta, Custom Integration, and separate GA4 logic
- the page did not primarily use `outcomeTotals.performanceSummary.sources`
- Google Ads and future generic main sources could be missed even when they were present in the shared aggregate
- GA4-only campaigns can be mixed with paid-media comparison assumptions
- child revenue sources such as HubSpot, Shopify, and Salesforce can appear as separate revenue platforms even though they are configured inside a parent platform flow
- fallback logic could estimate revenue from conversions and average order value, which could drift from source-of-truth platform/campaign financial totals
- empty-state and explanatory copy referenced only LinkedIn and Meta in some places
- the GA4 row could drift from the GA4 platform Overview if it used raw native GA4 source-row values instead of the composed GA4 platform source-of-truth values shown in `View Detailed Analytics`

The issue was an aggregation contract problem, not a single-card display bug. The implemented fix is to treat `outcomeTotals.performanceSummary.sources` as the canonical normalized main Connected Platform list whenever the aggregate exists.

## Existing Relevant Paths

- `client/src/pages/platform-comparison.tsx`
  - Current Platform Comparison page and tab UI.
  - Fetches `/api/campaigns/:id/outcome-totals?dateRange=90days`.
  - Still performs tab-local source construction and fallback calculations.

- `client/src/pages/campaign-performance.tsx`
  - Performance Summary page.
  - Uses `/api/campaigns/:id/outcome-totals` and `performanceSummary` as the source-aware aggregate model.

- `client/src/pages/financial-analysis.tsx`
  - Budget & Financial Analysis page.
  - Uses the same aggregate contract for financial metrics and source-aware rows.

- `server/routes-oauth.ts`
  - Contains `/api/campaigns/:id/outcome-totals`.
  - Builds `performanceSummary` through the shared aggregate helper.

- `server/utils/performance-summary-aggregate.ts`
  - Current connected-source aggregate helper.
  - Contains source identity, capabilities, included metrics, excluded metric reasons, financial totals, and derived metrics.

- `server/scheduler.ts`
  - Scheduler snapshots must align with the same aggregate model used by Campaign DeepDive sections.

## Production-Ready Target Contract

Platform Comparison should consume one campaign-level aggregate contract.

The safest fix is to reuse the already-built Performance Summary aggregate contract, then wire each Platform Comparison tab to that same source-aware model.

The contract should provide:

- campaign ID and date range
- connected main sources included in the aggregate
- source capabilities
- included metrics
- excluded metrics with reasons
- source freshness metadata
- per-source current metrics
- aggregate totals when a tab needs campaign-level totals
- per-source financial inputs only as provenance, not as main platform rows
- historical comparison values derived from the same aggregate model if historical UI is later shown

Preferred approach:

- Reuse `/api/campaigns/:id/outcome-totals` and `outcomeTotals.performanceSummary`.
- Build normalized Platform Comparison rows from `performanceSummary.sources`.
- Treat `performanceSummary.sources` as the canonical normalized list of main Connected Platforms for this page, not as a limiting single-source input. If the aggregate exists, do not fall back to older hardcoded platform objects just because the source list is empty.
- Exclude `category: "financial"` sources from main platform cards/tables.
- Use source `capabilities`, `includedMetrics`, and `metrics` to decide what each tab can show.
- Keep unavailable metrics blank or explicitly unavailable instead of treating missing values as zero performance.
- Remove or gate legacy fallback calculations that can estimate values not present in the aggregate.
- Keep persistence reads in `server/storage.ts`.
- Keep API composition in `server/routes-oauth.ts`.
- Keep tab rendering in `client/src/pages/platform-comparison.tsx`.

## Source Capability Rules

### GA4

Available when connected and campaign-scoped:

- users
- sessions
- conversions
- revenue as the GA4 platform total shown in `View Detailed Analytics`, including child revenue inputs configured inside GA4, while those child inputs remain hidden as separate main platforms

Not available:

- ad impressions
- ad clicks
- ad spend
- CPC
- CPM
- CTR
- ROAS/ROI at platform-row level unless spend is explicitly available from the aggregate financial path

GA4 should appear as a web analytics source, not as a paid-media source.

### Paid Media Sources

Examples:

- LinkedIn Ads
- Meta Ads
- Google Ads
- future TikTok/Instagram ad sources

Available when provided by that source:

- impressions
- clicks
- spend
- conversions
- attributed revenue
- CTR
- CPC
- CPM
- CPA
- ROAS/ROI when both spend and revenue are available

Not available:

- sessions/users unless explicitly provided as web analytics metrics

### Custom Integration

Available only for metrics included in the source's aggregate capabilities.

Do not assume Custom Integration has spend, clicks, revenue, users, or sessions unless the aggregate says those metrics are included.

### Platform Child Revenue/Spend Inputs

Examples:

- HubSpot inside GA4
- Salesforce inside GA4
- Shopify inside GA4
- CSV revenue/spend imports inside GA4
- Google Sheets revenue/spend imports inside GA4
- LinkedIn or Meta spend imported inside GA4

Rules:

- may feed campaign financial totals through the parent platform/campaign financial path
- must not appear as separate main platforms in Platform Comparison
- may be referenced only as provenance if a future UI section explicitly displays financial inputs
- do not make LinkedIn Ads, Meta Ads, or another ad platform eligible for Platform Comparison unless that ad platform is connected as its own main Connected Platform

## Tab Implementation Plan

### Commit 1: Aggregate Contract

- Fetch `/api/campaigns/:id/outcome-totals?dateRange=90days` with the same URL-style query key pattern used by other DeepDive sections.
- Read `outcomeTotals.performanceSummary`.
- Add a small page-local normalizer that converts `performanceSummary.sources` into Platform Comparison rows.
- Exclude financial child sources from main platform rows.
- Add regression coverage proving GA4-only uses one GA4 source row and no child revenue sources appear as platforms.

Status: completed.

Evidence:

- Platform Comparison now uses a URL-style `outcome-totals` query key and reads `outcomeTotals.performanceSummary`.
- Primary platform rows are built from `performanceSummary.sources`.
- Financial child sources are excluded from main platform rows with `category !== "financial"`.
- When the aggregate is present, legacy revenue source rows are not shown as separate revenue platforms.
- Targeted regression coverage was added in `server/platform-comparison-regression.test.ts`.
- Render validation passed: `/api/campaigns/:id/outcome-totals?dateRange=30days` returned `performanceSummary.sources` with GA4, and Platform Comparison used the connected-source aggregate list as the source-of-truth path.

### Commit 2: Overview Tab

- Wire Overview cards and the summary table to normalized aggregate source rows.
- Show only available metrics per source.
- Use GA4 sessions/users/conversions/revenue where available.
- Do not show GA4 impressions/clicks/spend as zero-performance paid-media metrics; single-source aggregate spend may be shown in the Overview table when it comes from the shared campaign financial aggregate.
- Update empty-state copy to reference connected sources generally, not only LinkedIn/Meta.

Status: completed.

Evidence:

- Overview cards and the summary table now include GA4 web analytics fields from the aggregate source row: `users`, `sessions`, `conversions`, and `revenue`.
- Overview does not present missing paid-media metrics as zeroes. When exactly one main Connected Platform is present and the shared aggregate has campaign financial totals, the Channel Performance Overview table may display aggregate `Spend`, `ROAS`, and `ROI` for that single source while Financial Comparison and Insights still require true paid-media source-level spend.
- Empty-state copy now references Connected Platforms generally instead of naming only LinkedIn, Meta, or child revenue systems.
- Platform Comparison now requests the shared aggregate with `dateRange=90days`, matching Performance Summary, Budget & Financial Analysis, and the GA4 platform Overview source-of-truth window.
- GA4 revenue now uses the parent GA4 platform total from `outcomeTotals.revenue.totalRevenue`, so child revenue inputs configured inside GA4 are included in the GA4 row without being shown as separate platforms.
- Yesop/mock GA4 source rows now mirror the GA4 Overview Summary formula: sessions, conversions, and native GA4 revenue use the larger of GA4 to-date totals and merged daily lookback totals, while users use to-date totals when present.
- Overview no longer renders legacy per-platform fallback rows while the shared aggregate request is unresolved, preventing Meta or other fallback data from flashing before the connected-source aggregate loads.
- Overview renders a silent skeleton while the shared aggregate is initially unresolved, so the page does not flash a false no-data state before connected-source rows load.
- Render validation passed: the Platform Comparison Overview tab showed only Google Analytics for the current GA4-only campaign, displayed GA4-supported metrics only, matched the GA4 platform Overview values, and no longer flashed Meta before GA4 loaded.

### Commit 3: Performance Metrics Tab

- Wire detailed metrics and efficiency comparison to normalized aggregate source rows.
- Use capability-aware display logic for CTR, CPC, conversion rate, ROI, and ROAS.
- Do not rank sources on metrics they do not provide.
- Add copy explaining unavailable metrics where needed.

Status: completed.

Evidence:

- Detailed Performance Metrics now renders CTR, CPC, conversion rate, ROI, and efficiency values only when the connected source provides the required capabilities.
- Detailed Performance Metrics no longer shows a standalone source-color dot because it can be mistaken for an alert/status indicator. ROI may use single-source aggregate financial totals when there is only one main Connected Platform and the aggregate provides spend and revenue.
- Efficiency Comparison now shows an explicit unavailable explanation when a source does not provide both spend and revenue, instead of implying zero ROAS/ROI performance.
- Efficiency Comparison now excludes sources that cannot support spend-based efficiency metrics. GA4-only campaigns show a single explanatory unavailable state instead of a Google Analytics row full of unavailable paid-media metrics.
- Volume & Reach now labels engagement as `Clicks`, `Sessions`, or `Engagement` based on the source capabilities, so GA4-only rows use sessions instead of paid-media click assumptions.
- Volume Comparison now renders only volume metrics the source can provide. GA4-only campaigns no longer show a separate unavailable impressions lane because GA4 is not an ad-impression source.
- Empty-state copy now references Connected Platforms generally instead of naming only LinkedIn or Meta.
- Regression coverage updated in `server/platform-comparison-regression.test.ts`.

### Commit 4: Financial Comparison Tab

- Include only spend-capable sources for source-level financial comparison, CPA, CPC, budget allocation, ROI, and ROAS cards.
- Show a clear unavailable state when only GA4/web analytics is connected.
- Do not treat child spend imports as separate platforms.
- Keep campaign financial totals in Budget & Financial Analysis; Platform Comparison should compare source rows.

Status: completed.

Evidence:

- Financial Comparison now derives chart data, budget allocation data, and ROI/ROAS cards from `spendCapableMetrics`, which includes only non-analytics sources that explicitly provide `spend`.
- GA4-only campaigns show a clear unavailable state for Financial Comparison because GA4 is a web analytics source, not a main spend-capable platform.
- Platform child spend imports, including ad-platform spend imported inside GA4, are not treated as separate Platform Comparison sources.
- Cost-per-conversion chart rows require both spend and conversions, preventing conversion-only sources from appearing as cost-analysis rows.
- Source-level ROI and ROAS cards render only for spend-capable source rows and show unavailable when required source-level financial inputs are missing.
- Regression coverage updated in `server/platform-comparison-regression.test.ts`.
- Render validation passed: with only Google Analytics connected, the source-level financial comparison tab showed the `No paid-media platform connected` unavailable state and did not treat GA4 child spend imports as separate Platform Comparison sources.

### Commit 5: Insights Tab

- Generate insights only from sources with enough comparable metrics.
- GA4-only should not produce paid-media budget reallocation recommendations.
- Paid-media recommendations should require at least two spend-capable comparable sources.
- Use source labels and unavailable reasons from the aggregate where useful.
- Remove estimated-revenue recommendations that are not backed by aggregate revenue.

Status: completed and Render-validated.

Evidence:

- Insights now uses the same aggregate-derived `spendCapableMetrics` and metric capability helpers as the other Platform Comparison tabs.
- GA4-only campaigns show an explicit paid-media comparison unavailable explanation instead of budget reallocation recommendations.
- GA4-only and one-paid-platform campaigns now show one concise unavailable Insights state instead of multiple repeated unavailable/recommendation messages.
- ROAS/ROI winner and laggard insights require at least two comparable spend-capable sources with source-level spend and revenue.
- Volume and engagement insights are gated to spend-capable comparable sources instead of treating GA4 analytics metrics as paid-media recommendation inputs.
- Strategic recommendations require comparable main paid-media sources and no longer use missing CTR, CPC, conversion-rate, ROAS, or ROI values as if they were real metrics.
- Regression coverage updated in `server/platform-comparison-regression.test.ts`.
- Render validation passed: Platform Comparison Insights used the source-capability-safe GA4 summary and did not produce paid-media recommendations when only Google Analytics was connected.

### Commit 6: Scheduler/History Alignment

- If Platform Comparison adds historical comparisons later, use compatible `metrics.performanceSummary` snapshots only.
- Current values should refetch while visible and on window focus, matching Performance Summary and Budget & Financial Analysis.
- Add regression coverage for query keys, refresh behavior, and aggregate-only snapshot compatibility if historical UI is used.

Status: completed and Render-validated.

Evidence:

- Platform Comparison current values now refetch from `/api/campaigns/:id/outcome-totals?dateRange=90days` every 30 seconds while the page is visible.
- The aggregate query refetches on window focus and does not refetch in the background, matching Performance Summary and Budget & Financial Analysis current-value behavior.
- Platform Comparison has no visible historical comparison tab today, so snapshot compatibility is documented as a future boundary: any future historical UI must use compatible `metrics.performanceSummary` snapshots only.
- Regression coverage was updated in `server/platform-comparison-regression.test.ts` to guard the aggregate query key and refresh behavior.
- Render validation passed: the Platform Comparison page issued the `outcome-totals?dateRange=90days` request on load, refetched while visible after the refresh interval, and refetched on window focus.

### Commit 7: Documentation And Final Validation

- Update this tracker and related architecture docs.
- Run targeted Platform Comparison regression tests.
- Run `npm run check`.
- Run `npm run build` if final production-readiness validation is requested.
- Validate on Render with at least one GA4-only campaign and one multi-platform campaign when available.

Status: completed and Render-validated.

Evidence:

- This tracker records validation status for Commits 1-6 and the final Platform Comparison source contract.
- `ARCHITECTURE_USER_JOURNEY.md` documents that Platform Comparison must stay synchronized with underlying source updates through the shared aggregate, alongside Performance Summary and Budget & Financial Analysis.
- Final targeted regression passed: `npm test -- server/platform-comparison-regression.test.ts`.
- Final typecheck passed: `npm run check`.
- Final production build passed: `npm run build`.
- Render validation passed: Platform Comparison continued to show the correct GA4-only connected-source behavior across Overview, Performance Metrics, Financial Comparison, and Insights after the final documentation/validation commit.

## Production-Ready Acceptance Criteria

- Every visible platform row represents a main Connected Platform source from the aggregate contract.
- Child revenue/spend inputs do not appear as separate main platforms.
- GA4-only campaigns show only GA4-capable metrics.
- Paid-media comparison and recommendations require paid-media capable sources.
- Missing metrics are unavailable, not silently zeroed.
- Overview may show single-source aggregate financial totals for the only connected main platform, but this does not make GA4 or another analytics-only source eligible for Financial Comparison paid-media rows or budget recommendations.
- Google Ads appears automatically when connected and present in `performanceSummary.sources`.
- Future main platforms appear without tab-specific UI rewiring once they feed the shared aggregate contract.
- Current values stay synchronized with source updates through aggregate refetch.
- Regression coverage protects GA4-only, paid-media, financial child-source exclusion, and future generic source behavior.

## Current Status

Production-ready for the current aggregate-backed Platform Comparison implementation and the Render-validated GA4-only connected-source scenario.

Plain-language status before moving to Trend Analysis:

- Nothing else is outstanding for the current GA4-only Platform Comparison flow.
- The UI is ready to display future main platforms without tab-by-tab rewiring, but each future platform integration must feed the shared aggregate contract first.
- A future platform is considered ready for Platform Comparison only after the server emits it in `performanceSummary.sources` with source identity, source label, source category, capabilities, included metrics, unavailable metric reasons, metric values, and freshness where available.
- Live multi-platform validation remains a future validation step, not a known current defect. It should be run when a campaign has two or more real main Connected Platforms connected on Render.
- Platform child inputs, such as LinkedIn/Meta/Google Sheets spend imported inside GA4, remain child financial inputs and do not count as separate Platform Comparison sources.
- This handoff means Trend Analysis can start without reopening Platform Comparison unless a new source integration or multi-platform validation failure exposes a specific issue.

Proven:

- Platform Comparison is a Campaign DeepDive page.
- It already fetches `/api/campaigns/:id/outcome-totals`.
- The shared `performanceSummary` aggregate contract now supports main Connected Platform source rows, including GA4, LinkedIn, Meta, Google Ads, Custom Integration, and generic future source rows when registered.
- Commit 1: Platform Comparison now uses a URL-style `outcome-totals` query key, reads `outcomeTotals.performanceSummary`, builds primary platform rows from `performanceSummary.sources`, and excludes `category: "financial"` child revenue/spend sources from main platform rows.
- Commit 1: When the aggregate is present, legacy revenue source rows are not shown as separate revenue platforms.
- Commit 1 validation: targeted regression coverage added in `server/platform-comparison-regression.test.ts`.
- Commit 1 Render validation passed: `/api/campaigns/:id/outcome-totals?dateRange=30days` returned `performanceSummary.sources` with GA4, and Platform Comparison used the connected-source aggregate list as the source-of-truth path.
- Commit 2: Overview cards and the summary table now include GA4 web analytics fields from the aggregate source row (`users`, `sessions`, `conversions`, and `revenue`) and avoid presenting unavailable paid-media metrics as zeroes.
- Commit 2 follow-up: Channel Performance Overview renders source-capability columns dynamically. For a single connected main platform, it can show aggregate financial totals (`Spend`, `ROAS`, and `ROI`) from the shared campaign aggregate so GA4-only campaigns match the visible platform financial source of truth; Financial Comparison and Insights remain restricted to true paid-media source-level spend.
- Commit 2: Overview empty-state copy now references Connected Platforms generally instead of naming only LinkedIn, Meta, or child revenue systems.
- Commit 2 follow-up: Platform Comparison now requests the shared aggregate with `dateRange=90days`, matching Performance Summary, Budget & Financial Analysis, and the GA4 platform overview source-of-truth window for current campaign values.
- Commit 2 follow-up: Platform Comparison GA4 revenue now uses the parent GA4 platform total from `outcomeTotals.revenue.totalRevenue`, so child revenue inputs configured inside GA4 are included in the GA4 row without being shown as separate platforms. Yesop/mock GA4 source rows now use the same date-overlay daily-row merge pattern as the GA4 platform Overview before summing sessions, users, conversions, and revenue.
- Commit 2 follow-up: The GA4 mock/test aggregate now mirrors the GA4 Overview Summary formula exactly: sessions, conversions, and native GA4 revenue use the larger of GA4 to-date totals and merged daily lookback totals, while users use to-date totals when present because users are not safely additive across daily rows.
- Commit 2 Render validation passed: the Platform Comparison Overview tab showed only Google Analytics for the current GA4-only campaign, displayed GA4-supported metrics only, matched the GA4 platform Overview values, and no longer flashed Meta before GA4 loaded.
- Commit 2 follow-up: Platform Comparison no longer renders legacy per-platform fallback rows while the shared aggregate request is still unresolved, preventing Meta or other fallback data from flashing before the connected-source aggregate loads.
- Commit 2 follow-up: Overview now renders a silent skeleton while the shared aggregate is initially unresolved, so the page does not flash a false no-data state before connected-source rows load.
- Commit 3: Performance Metrics now uses source-capability aware display rules for CTR, CPC, conversion rate, ROAS, ROI, CPA, impressions, clicks, and sessions. GA4-only rows show unavailable paid-media efficiency metrics instead of zero-performance paid-media assumptions.
- Commit 3 follow-up: Detailed Performance Metrics removed the standalone platform-color dot so it is not confused with a health/status indicator, and ROI now uses the same single-source aggregate financial-total path as Overview when only one main Connected Platform is connected.
- Commit 3 follow-up: Efficiency Comparison now compares only spend-efficiency-capable sources and shows a concise unavailable explanation for GA4-only campaigns.
- Commit 3 follow-up: Volume Comparison now hides unavailable impressions lanes for sources that do not provide impressions and presents available volume metrics such as GA4 sessions.
- Commit 3 Render validation passed: with only Google Analytics connected, Efficiency Comparison correctly remained unavailable because there is no main spend-capable ad platform, and Volume Comparison correctly showed GA4 sessions. LinkedIn/Meta spend imports inside GA4 remain child financial inputs, not separate Platform Comparison rows.
- Commit 4: Financial Comparison now includes only spend-capable main connected platform sources. GA4-only campaigns show an unavailable state, and child spend imports inside GA4 remain excluded from Platform Comparison rows.
- Commit 4 follow-up: The GA4-only Financial Comparison empty state now uses shorter, clearer copy: Google Analytics is connected, but it does not provide source-level ad spend for Platform Comparison; source-level spend, CPA, ROI, and ROAS comparison requires a main paid-media platform such as LinkedIn Ads, Meta Ads, or Google Ads.
- Commit 4 Render validation passed: with only Google Analytics connected, Financial Comparison showed the `No paid-media platform connected` unavailable state and did not treat GA4 child spend imports as separate Platform Comparison sources.
- Commit 5: Insights now uses aggregate-derived source capabilities and spend-capable source rows. GA4-only campaigns show a paid-media comparison unavailable explanation, and budget recommendations require comparable main paid-media platforms.
- Commit 5 follow-up: Insights copy was simplified to one unavailable state when fewer than two spend-capable paid-media platforms are connected, so the page does not repeat the same unavailable condition across Data Source Analysis, Paid-media comparison, and Strategic Recommendations cards.
- Commit 5 follow-up: The GA4-only Insights message now explicitly says GA4 contributes analytics metrics but does not provide source-level ad spend for paid-media comparison.
- Commit 5 follow-up: GA4-only Insights now show a source-capability-safe analytics summary using GA4 sessions, users, conversions, and revenue when available, while still blocking paid-media comparison and budget recommendations until a main paid-media platform is connected.
- Commit 5 follow-up: Platform Comparison Insights now uses the same stacked insight-card presentation pattern as Performance Summary and Budget & Financial Analysis instead of a standalone centered metric grid.
- Commit 5 follow-up: GA4-only Insights copy now uses `Google Analytics Summary` and `Available Source Metrics` to avoid duplicated wording while preserving source-capability meaning.
- Commit 5 Render validation passed: Platform Comparison Insights used the source-capability-safe GA4 summary and did not produce paid-media recommendations when only Google Analytics was connected.
- Source contract follow-up: Platform Comparison treats `outcomeTotals.performanceSummary.sources` as the canonical normalized main Connected Platform list whenever the aggregate exists. Legacy hardcoded platform objects are retained only as a no-aggregate fallback, so an empty aggregate source list does not leak stale or child-source platform rows into the page.
- Commit 6: Platform Comparison current values now refetch from the shared aggregate every 30 seconds while visible and on window focus, matching Performance Summary and Budget & Financial Analysis. Historical snapshot compatibility remains a future UI boundary because Platform Comparison does not currently render historical comparison tabs.
- Commit 6 Render validation passed: the Platform Comparison page issued the shared aggregate request on load, refetched while visible after the refresh interval, and refetched on window focus.
- Commit 7 Render validation passed: final Platform Comparison validation confirmed the GA4-only page still uses connected-source aggregate data correctly across all implemented tabs after the final documentation/validation updates.
- Post-validation UX fix committed and pushed in `74a68c8b`: Platform Comparison now keeps the selected tab through refresh by controlling tab state and persisting it in the URL/session state, instead of always returning to Overview. Initial aggregate loading now renders a stable blank content area instead of temporary skeleton/no-data cards, so refresh does not flash misleading intermediate cards before the connected-source aggregate loads.
- Post-validation UX validation path: after Render deploys, open each Platform Comparison tab, refresh the page, and confirm the same tab remains selected without flashing temporary empty/skeleton cards before the aggregate-backed content appears.
- Post-validation UI alignment: Platform Comparison no longer exposes the local `Demo Data` toggle and now uses the same compact tab-list presentation as Performance Summary instead of full-width grid tabs.
- Post-validation financial overview fix committed and pushed in `50415b46`: Channel Performance Overview restores `Spend`, `ROAS`, and `ROI` for single-source campaigns when the shared aggregate provides campaign financial totals, while Financial Comparison and paid-media Insights remain restricted to main paid-media sources with source-level spend.
- Post-validation performance-metrics fix committed and pushed in `e258b446`: Detailed Performance Metrics no longer shows the standalone platform-color dot that could be mistaken for a status indicator, and ROI now uses the same single-source aggregate financial-total path as Overview when only one main Connected Platform is connected. Validation passed with `npm test -- server/platform-comparison-regression.test.ts` and `npm run check`.
- Post-validation section-distinction fix: Platform Comparison and Budget & Financial Analysis remain separate DeepDive sections. UI copy now clarifies that Platform Comparison is for connected-source contribution/comparison, while Budget & Financial Analysis is for campaign-wide budget, pacing, ROI, ROAS, and financial decisioning.
- Post-validation tab-label fix: the Platform Comparison source-level financial tab is labeled `Financial Comparison` instead of `Cost Analysis`, while keeping the internal `cost-analysis` tab value unchanged for URL/session compatibility.
- Custom Report PDF export parity fix added on 2026-05-29: selected Platform Comparison tabs now export the matching web-tab section structure from the shared connected-source aggregate instead of the generic Custom Report metric-list fallback.

Outstanding:

- Live multi-platform validation when a campaign has two or more real main Connected Platforms available on Render.
