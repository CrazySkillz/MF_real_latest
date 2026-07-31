# GA4 Overview Automated Validation

## Purpose

This file defines the accelerated validation path for GA4 Overview. It replaces repeated one-off browser-console snippets with reusable automation while preserving the no-overclaim production-readiness standard.

## Current Certification Warning

The Current Commit 11–18 queue is documented. Commit 16 runner `2026-07-31.13` deployed in `747192ff`; the authenticated existing connection response returned its saved `lookbackDays: 30`, closing the bounded saved-window correction. No live 60/90-day fixture, independent provider-value comparison, observed expiry advancement, or external seven-day durability evidence was produced. This is not complete Overview certification.

## What Is Automated

The browser helper `GA4OverviewValidation.overviewPack(...)` checks, in one command:

- campaign access
- GA4 connection health through `/ga4-metrics`
- native GA4 Overview endpoints: daily rows, to-date totals, breakdown, diagnostics, landing pages, and conversion events
- source-backed financial endpoints: revenue/spend to-date, breakdown, and sources
- source counts and financial totals summary
- stale daily-row warning state
- reconnect-required provider failures when endpoints return them
- persisted selected-property 30/60/90-day window presence and request parity

Runner `2026-07-31.13` also provides `GA4OverviewValidation.commit16Pack(...)`. It uses the saved window for three live-provider GET reads, verifies each response reports that window, rejects simulated/non-numeric properties, checks refresh-credential presence, and compares sanitized token-expiry metadata before and after. It does not call `/ga4-daily`; existing provider code can persist a renewed encrypted access token and expiry when the prior access token has expired. Seven-day post-publish durability remains external because the connection record date can predate reconnect.

`overviewPack(...)` does call `/ga4-daily` and provider-backed endpoints. It can persist GA4 daily rows and an automatically renewed token; it is not a database-read-only inventory.

The optional `GA4OverviewValidation.reportPack(...)` checks, in one command when a saved report exists:

- report list access
- selected report resolution
- optional snapshot creation
- snapshot list access
- snapshot PDF endpoint availability and PDF content type
- optional test-send endpoint and send-events access
- read-only source-damage inventory for one campaign through `GA4OverviewValidation.sourceDamageInventory(...)`

The optional `GA4OverviewValidation.googleSheetsVariantPack(...)` checks already-created Google Sheets fixture sources in one command:

- revenue and spend Google Sheets source presence
- source identity, active state, and compact source totals
- persisted mapping metadata such as tab presence, date column, campaign column, campaign value count, and row-count expectations
- duplicate active Google Sheets mapping signatures for the current campaign
- optional expected revenue/spend totals for the current fixture state

## What Is Not Fully Automated

These remain external evidence gates:

- visual UI inspection of rendered cards/modals unless a Playwright selector-specific test is later added for that exact UI surface
- reading PDF text/value parity from the downloaded PDF; the current browser pack proves PDF generation, not value-by-value PDF content
- inbox delivery; `sendTest: true` can call the test-send endpoint, but delivery is not certified without provider delivery events or actual inbox receipt. The 2026-07-03 GA4 Overview Report email packet is recorded as user-confirmed delivery evidence for that specific packet only
- source setup actions that require third-party provider UI/OAuth/mapping decisions; `googleSheetsVariantPack(...)` validates controlled sources after they already exist
- future provider data changes after GA4 delayed processing

## Fast Browser Use

Open the deployed app while logged in, then run:

```js
await import('/ga4-overview-validation-runner.js?v=2026-07-31.13');
await GA4OverviewValidation.overviewPack({
  campaignId: '8aa735ee-c02f-41e2-bb1f-7c3f43bb9458',
  propertyId: '542352127'
});
```

For any remaining Commit 16 OAuth/window evidence, use an existing live numeric-property campaign only:

```js
await GA4OverviewValidation.commit16Pack({
  campaignId: 'CAMPAIGN_ID',
  propertyId: 'PROPERTY_ID'
});
```

`overallPass` requires the persisted expiry to advance during this exact pack. If the current access token does not need renewal, that check correctly remains false; do not reconnect or reconfigure data to force it. The output always marks post-publish seven-day durability `requires_external_validation`.

If validating a saved GA4 Overview report snapshot/PDF smoke path, run with a real saved report ID:

```js
await GA4OverviewValidation.reportPack({
  campaignId: '8aa735ee-c02f-41e2-bb1f-7c3f43bb9458',
  reportId: 'REPORT_ID',
  createSnapshot: true
});
```

Only set `sendTest: true` when you intentionally want to send a real test email:

```js
await GA4OverviewValidation.reportPack({
  campaignId: '8aa735ee-c02f-41e2-bb1f-7c3f43bb9458',
  reportId: 'REPORT_ID',
  createSnapshot: true,
  sendTest: true
});
```
For Current Commit 3 read-only production source-damage inventory, run:

```js
await GA4OverviewValidation.sourceDamageInventory({
  campaignId: '8aa735ee-c02f-41e2-bb1f-7c3f43bb9458'
});
```

This inventory command is GET-only. If it returns `overallPass: false`, document the returned source IDs and record IDs before proposing cleanup.

For Current Commit 2g Google Sheets mapping variant evidence after fixture sources already exist, run:

```js
await GA4OverviewValidation.googleSheetsVariantPack({
  campaignId: '8aa735ee-c02f-41e2-bb1f-7c3f43bb9458',
  propertyId: '542352127',
  variants: [
    {
      label: 'controlled-spend-date-column',
      family: 'spend',
      sourceId: 'SOURCE_ID',
      expectedAmount: 123.45,
      expectedDateColumn: true,
      expectedCampaignColumn: true,
      expectedMinimumRowCount: 1
    }
  ]
});
```

Do not treat this as proof for all possible Google Sheets shapes. It proves only the configured fixture rows and mapping expectations in the output.

Recorded deployed Current Commit 2g evidence: on `2026-07-03T21:09:01.553Z`, runner `2026-07-03.4` returned `overallPass: true` for the configured Google Sheets spend fixture on campaign `8aa735ee-c02f-41e2-bb1f-7c3f43bb9458` / property `542352127`; spend breakdown was `$678.95`, duplicate active Google Sheets signature checks passed, and the user confirmed the Total Spend card/source modal showed `$678.95`. This evidence closes only that configured fixture.


## Playwright Use

The focused Playwright wrapper runs the same browser helper. It requires a logged-in storage state because this app uses authenticated deployed sessions.

PowerShell example:

```powershell
$env:BASE_URL = 'https://marketforensics.onrender.com'
$env:GA4_OVERVIEW_CAMPAIGN_ID = '8aa735ee-c02f-41e2-bb1f-7c3f43bb9458'
$env:GA4_OVERVIEW_PROPERTY_ID = '542352127'
npm run test:e2e -- e2e/ga4-overview-readiness.spec.ts
```

Optional report smoke validation:

```powershell
$env:GA4_OVERVIEW_REPORT_ID = 'REPORT_ID'
npm run test:e2e -- e2e/ga4-overview-readiness.spec.ts
```

If `e2e/auth.json` does not exist, the Playwright spec skips with an explicit message. That is intentional; the browser-console helper remains the fastest path when you are already logged in.

## Certification Rule

A passing automated pack is strong operational evidence for the endpoints or configured fixture variants it checks, but it is not blanket production-readiness proof for untested lifecycle actions, future source families, unlisted Google Sheets mapping shapes, PDF text parity, future inbox delivery outside recorded packets, production cleanup, or future provider behavior. Record the exact pack output and keep unresolved external gates explicit in `GA4/OVERVIEW_PRODUCTION_READINESS.md`.

For strictly read-only production investigations, do not run `overviewPack(...)`, `commit16Pack(...)`, `/ga4-daily`, provider-validation, or scheduler run-now routes: those paths can refresh OAuth tokens, persist daily rows, or run recomputation. Use database `SELECT` transactions and `/health/scheduler` only. The `2026-07-30` Current Commit 8 investigation followed this boundary.

Current Commit 9 used a database `BEGIN READ ONLY` owner/campaign/source inventory. The inventory must separately report orphan records, inactive-source records, source/record campaign mismatches, exact duplicate candidates, active sources with no records, unexpected active platform contexts, and materialized-versus-cached drift. Inventory output is evidence only: it must never trigger cleanup.

Commit `57036ebc` deployed the forward-only LinkedIn/Meta orphan-write fix. The immediate post-deploy full inventory at `2026-07-30T16:35:49.623Z` matched the final pre-deploy boundary of four groups / 325,538 rows with no new group or row. This proves immediate no-growth only; the same read-only inventory must pass after the first four-hour scheduler cycle before the forward path is closed. Existing rows and cache drift remain unchanged, and cleanup remains unauthorized.

Current Commit 10 adds scheduler-consumer guards for the shared full GA4 financial selector, campaign-to-date GA4-context revenue/spend reads, Trend GA4-context predicates, valid zero/negative revenue ROAS/ROI, and `performance_summary_aggregate_v2` compatibility. Commit `ec265895` deployed, and the user-confirmed `GA4 single` / `ga4_mock` browser comparison passed for Performance Summary Total Spend and Budget & Financial Analysis → ROI & ROAS Total Revenue against GA4 Overview. This closes the bounded Commit 10 code/browser packet; automated/local guards and these two browser comparisons do not prove scheduled attachment values, historical Trend, live multi-source variants, or valid-zero/negative production fixtures.
