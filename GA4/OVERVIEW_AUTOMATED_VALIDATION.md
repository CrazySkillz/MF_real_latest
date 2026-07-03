# GA4 Overview Automated Validation

## Purpose

This file defines the accelerated validation path for GA4 Overview. It replaces repeated one-off browser-console snippets with reusable automation while preserving the no-overclaim production-readiness standard.

## What Is Automated

The deployed browser helper `GA4OverviewValidation.overviewPack(...)` checks, in one command:

- campaign access
- GA4 connection health through `/ga4-metrics`
- native GA4 Overview endpoints: daily rows, to-date totals, breakdown, diagnostics, landing pages, and conversion events
- source-backed financial endpoints: revenue/spend to-date, breakdown, and sources
- source counts and financial totals summary
- stale daily-row warning state
- reconnect-required provider failures when endpoints return them

The optional `GA4OverviewValidation.reportPack(...)` checks, in one command when a saved report exists:

- report list access
- selected report resolution
- optional snapshot creation
- snapshot list access
- snapshot PDF endpoint availability and PDF content type
- optional test-send endpoint and send-events access
- read-only source-damage inventory for one campaign through `GA4OverviewValidation.sourceDamageInventory(...)`

## What Is Not Fully Automated

These remain external evidence gates:

- visual UI inspection of rendered cards/modals unless a Playwright selector-specific test is later added for that exact UI surface
- reading PDF text/value parity from the downloaded PDF; the current browser pack proves PDF generation, not value-by-value PDF content
- inbox delivery; `sendTest: true` can call the test-send endpoint, but delivery is not certified without provider delivery events or actual inbox receipt. The 2026-07-03 GA4 Overview Report email packet is recorded as user-confirmed delivery evidence for that specific packet only
- source setup actions that require third-party provider UI/OAuth/mapping decisions
- future provider data changes after GA4 delayed processing

## Fast Browser Use

Open the deployed app while logged in, then run:

```js
await import('/ga4-overview-validation-runner.js?v=2026-07-03.3');
await GA4OverviewValidation.overviewPack({
  campaignId: '8aa735ee-c02f-41e2-bb1f-7c3f43bb9458',
  propertyId: '542352127'
});
```

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

A passing automated pack is strong operational evidence for the endpoints it checks, but it is not blanket production-readiness proof for untested lifecycle actions, future source families, PDF text parity, future inbox delivery outside recorded packets, production cleanup, or future provider behavior. Record the exact pack output and keep unresolved external gates explicit in `GA4/OVERVIEW_PRODUCTION_READINESS.md`.
