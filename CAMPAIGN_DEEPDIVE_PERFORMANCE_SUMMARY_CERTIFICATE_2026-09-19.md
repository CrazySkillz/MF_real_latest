# Campaign DeepDive → Performance Summary Clean Certification

## Decision

**CLEAN-CERTIFIED / PRODUCTION-READY / NO-OVERCLAIMING** for the bounded scope, exact runtime, and configuration recorded below.

| Scope | Result |
|---|---|
| Key Outcomes | PASS |
| Recent Movement | PASS |
| Recommended Actions | PASS |
| Campaign Health | PASS |
| Top Priority Action | PASS |
| Combined Performance Summary page | PASS |

The combined-page result passes because every displayed Performance Summary state and comparison option in this certificate passed. There are **zero remaining gates within this stated scope**.

## Exact Runtime And Configuration

- Production revision: `ee6e11ebf8cb0a13dd182dde54af790a3757ef2f`
- Production health: `nodeEnv=production`; exact commit returned by `/api/health` on `2026-09-19`
- `origin/main`: exact same revision at certification
- Primary live campaign: `eee3e654-b736-4e8e-86ec-1050e4d905c0` (`Campaign2`)
- Configured-target validation campaign: `8aa735ee-c02f-41e2-bb1f-7c3f43bb9458` (`ga4_mock`)
- Selected active primary GA4 property: `542352127`
- Campaign reporting timezone: `Europe/Amsterdam`
- Currency: `USD`
- Data-through date: `2026-09-18`
- Primary campaign target inventory: 0 GA4 KPIs, 0 GA4 Benchmarks
- Configured campaign target inventory: 8 GA4 KPIs, 2 GA4 Benchmarks
- Validation mode: authenticated GET-only browser/API validation plus database `READ ONLY` transaction; zero application mutations; temporary Clerk sessions revoked

## Certified Results

### Key Outcomes — PASS

Primary live campaign values reconciled from source-specific APIs through the aggregate and rendered UI:

- Total Users: `532`, Google Analytics
- Total Sessions: `532`, Google Analytics
- Total Conversions: `91`, Google Analytics
- Total Revenue: `$69,157.90`
  - GA4 native Revenue: `$11,481.00`
  - Imported Revenue: `$57,676.90`
  - Imported source records: Google Sheets `$54,200.00`, HubSpot `$3,200.00`, Salesforce `$251.00`, Shopify `$5.90`, CSV `$20.00`
- Total Spend: `$338.00`
  - Google Sheets `$300.00`
  - CSV `$38.00`

The API, aggregate, source labels, currency, completed-day boundary, and UI values agreed. Legitimate zero values remain distinct from unavailable values.

### Recent Movement — PASS

All three visible selector paths reconciled against the exact comparison date:

| Comparison | Sessions | Conversions | Spend | Revenue |
|---|---:|---:|---:|---:|
| Yesterday (`2026-09-17`) | 531 | 91 | `$338.00` | `$67,674.40` |
| 7 days ago (`2026-09-11`) | 289 | 48 | `$300.00` | `$59,604.80` |
| One month ago (`2026-08-18`) | 68 | 11 | `$300.00` | `$57,400.00` |

The current values were Sessions `532`, Conversions `91`, Spend `$338.00`, and Revenue `$69,157.90`.

The final defect was a false rejection of the one-month Revenue total. On `2026-08-18`, the exact-date GA4 response successfully returned native Revenue `0` from the same property and currency, but omitted the `revenueMetric` label because no native Revenue rows existed yet. Revision `ee6e11eb` accepts that case only when:

- both requests succeeded;
- the normalized GA4 property IDs match;
- the currencies match;
- both values are finite; and
- an omitted earlier metric label accompanies an exact zero.

It still fails closed for a different property, currency, nonzero unlabeled value, different metric, failed response, invalid number, undated imported source, duplicate source, or source-set mismatch.

### Recommended Actions — PASS

Target-free campaign:

- Rendered `No target-backed action available`.
- Directed the user to configure a supported GA4 KPI or Benchmark before using the section for a decision.
- Did not generate advice from metrics without a target.

Configured-target campaign:

- Recommended `Review Conversion Rate` using verified live `12.9%` versus the `39%` KPI target.
- Recommended `Review Engagement Rate` using verified live `68.16%` versus the `90%` KPI target.
- Kept the required instruction to investigate the underlying cause before changing spend.
- Ignored older persisted KPI/Benchmark `currentValue` fields and used current source-derived values.

Recommendation selection, lower/higher-is-better direction, target validity, missing denominator handling, duplicate targets, unavailable input handling, and no-target handling are covered by the focused regression and browser failure-state evidence.

### Campaign Health — PASS

- Target-free campaign: rendered the setup state and no score.
- Configured-target campaign: rendered `80%`, `Excellent`, `8 of 10 configured metrics on track`, `6/8 KPIs`, and `2/2 Benchmarks`.
- Incomplete KPI/Benchmark input states fail closed instead of scoring only a convenient subset.

### Top Priority Action — PASS

- Target-free campaign: rendered `No GA4 KPI or Benchmark targets configured`.
- Configured-target campaign: selected Conversion Rate at live `12.9%` versus target `39%`.
- Priority uses verified source-derived current values. A browser-only `999999` persisted-value fixture did not alter Campaign Health, Top Priority, or Recommended Actions.

### Combined Page — PASS

Key Outcomes, Campaign Health, Top Priority Action, all three Recent Movement options, and Recommended Actions rendered together from compatible windows and source identities. No displayed path used a manual refresh as scheduler proof.

## Source, API, Calculation, And UI Trace

The certified live path is:

`owned campaign and active primary property configuration → scheduled/persisted GA4 daily facts and exact-date GA4 totals → dated imported Revenue/Spend records → campaign-scoped APIs → Performance Summary aggregate and target calculations → rendered section`

Verified endpoints included:

- `/api/campaigns/:id/ga4-connections?readOnly=1`
- `/api/campaigns/:id/ga4-daily?days=31&readOnly=1`
- `/api/campaigns/:id/ga4-to-date?...&readOnly=1&endDate=...`
- `/api/campaigns/:id/revenue-to-date?platformContext=ga4&endDate=...`
- `/api/campaigns/:id/spend-to-date?platformContext=ga4&endDate=...`
- `/api/campaigns/:id/revenue-sources?platformContext=ga4`
- `/api/campaigns/:id/spend-sources?platformContext=ga4`
- `/api/campaigns/:id/outcome-totals?dateRange=90days`
- campaign-scoped Google Analytics KPI and Benchmark APIs

Ownership was verified through the campaign/client owner join and authenticated campaign-scoped routes. Exact-date, source-set, currency, active-source, materialization, stale, unavailable, and failure checks remain fail closed.

## Refresh And Scheduler Evidence

Actual timer-fired evidence was captured on immediate parent runtime `2ee07fa6b80c798527d5cc4cae8c1850a613b19f`:

- Financial-source scheduler: scheduled trigger at `2026-09-18T22:00:00.013Z`; finished `22:11:14.121Z`.
- GA4 scheduler: scheduled trigger at `2026-09-18T22:30:00.001Z`; finished `22:31:38.023Z`.
- Both scoped campaign hashes were in scheduled GA4 recompute `campaignIdsProcessed`; no scoped recompute failure was recorded.
- All 8 configured KPIs and 2 configured Benchmarks received scheduled-run updates.
- The gated daily financial snapshot observer recorded 2 ready campaigns, 2 writes, and 0 write failures.
- Exact scoped snapshot rows were recorded at `22:31:27.089Z` and `22:31:37.925Z`.

This evidence is reused because the complete parent-to-certified revision diff contains only:

- `client/src/lib/performance-financial-source-dates.ts`
- `client/src/pages/campaign-performance.tsx`
- `server/performance-financial-source-dates.test.ts`
- `server/campaign-performance-overview-regression.test.ts`

No scheduler, provider, API, storage, schema, ownership, source-refresh, snapshot, or runtime-configuration code changed. On exact runtime `ee6e11eb`, both schedulers were started and had their next timers armed after deployment.

The process-wide runs reported failures for unrelated campaigns/providers. This certificate makes no global scheduler-health claim. The two scoped campaigns passed their campaign-specific recompute and gated-write evidence.

GA4 can revise prior-day values after a scheduled observation; Google states that processing can take 24–48 hours and reports can change during that period ([GA4 data freshness](https://support.google.com/analytics/answer/11198161?hl=en)). The scheduled financial rows are therefore certified as timestamped point-in-time snapshots, not immutable final GA4 totals. The visible Performance Summary reads the latest exact-date provider/source totals and did not use the older snapshot as current authority.

## Failure, Zero, Stale, And Unavailable Evidence

- GA4 daily failure fixture: Key Outcomes, Campaign Health, Top Priority, Recent Movement, and Recommended Actions withheld dependent claims.
- KPI API failure fixture: Campaign Health and Top Priority became unavailable/unscorable; Recommended Actions were withheld.
- Older persisted target-value fixture: live values remained authoritative.
- Exact historical native Revenue `0`: accepted only under matching successful property/currency evidence.
- Invalid historical native zero evidence: rejected by focused regression.
- Missing target state: rendered setup guidance rather than a fabricated score or action.
- Source totals and cards distinguish a valid zero from unavailable, stale, or failed input.
- No browser validation request mutated application data.

## Validation Gates

- Focused regression packet: **PASS**, 6 files / 102 tests.
- TypeScript: `npm run check` — **PASS**.
- Production build: `npm run build` — **PASS**.
- Exact deployed revision health: **PASS**.
- Authenticated exact-revision read-only API/UI reconciliation: **PASS**.
- Yesterday, 7-day, and one-month comparison controls: **PASS** on both target-free and configured-target campaigns.
- Scheduler firing: **PASS** using unchanged immediate-parent evidence plus exact-revision armed-timer verification.
- Protected existing certificate and master ledger: unchanged.

## Exclusions And Boundary

This certificate is limited to Campaign DeepDive → Performance Summary on the exact revision, two recorded campaign configurations, property, currency, reporting timezone, source inventory, and data-through date above.

It does not certify:

- global scheduler health across unrelated campaigns;
- future GA4 restatements after the recorded read time;
- future source/configuration/currency/timezone changes;
- Trend Analysis, Budget & Financial Analysis, Platform Comparison, Executive Summary, Custom Reports, report delivery, or their independent calculations;
- the disabled legacy Metric Trends render path;
- provider behavior after this exact evidence boundary.

The visible `View Trend Analysis` control remains present and points to the existing campaign route; its destination is an independent certification scope.

## Remaining Gates

**Zero remaining gates within this certificate's stated scope.**
