# Recurring Ad Comparison download failure — October 27, 2026

Follow-up: the user reported the same banner after `692118a5` deployed. This
saved-breakdown correction was insufficient to close the incident. The separately
reproduced browser cancellation race and its correction are recorded in
[the controlling follow-up](REPORT_PUBLICATION_CANCELLATION_2026-10-27.md).

Status: localized fix and regression validation complete; the user authorized
commit and push. Deployment and deployed UI acceptance remain pending. Reports and Ad Comparison remain
UNVERIFIED as whole sections. This incident supersedes an assumption that the
October 26 Insights dependency correction covered every provider dependency.

## Symptom and evidence boundary

The user reported the Reports banner “Some figures could not refresh” and the
download error “The latest displayed figures are still being checked”. Those
messages come from the shared publication receipt, before PDF construction.
The screenshot does not identify which production request failed. No live browser
session or underlying production HTTP error was obtained; a specific Google
error must not be asserted as the observed production cause.

Read-only production evidence at 12:47 UTC showed saved native revenue EUR
7,653.96, financial revenue EUR 8,003.96 and a completed aligned publication for
the affected campaign. The recurring defect was reproduced locally using the
actual breakdown handler and actual React page, with a failed provider response
after valid figures had already been saved.

## Confirmed defective boundary and minimal correction

1. `client/src/pages/ga4-metrics.tsx` mounts the native Ad Comparison query on
   both Ad Comparison and Reports. It requests
   `ga4-breakdown?window=import-to-date&propertyId=...&adComparisonCampaignBreakdown=1`.
2. Unlike the Overview variant, this request fell through the saved-snapshot
   branch in `server/routes-oauth.ts` to `getAcquisitionBreakdown`. It performed
   another live Google request for the same campaign/property/import window.
3. That query participates in the core publication receipt. A provider failure
   therefore prevented the receipt completing and blocked the download despite
   synchronized saved inputs. Separately, the live provider's unguarded token
   renewal path can call `updateGA4ConnectionTokens`, which invalidates publication
   through `writeGA4RefreshInputChange`; this feedback path was traced in code,
   not observed in the user's failing request.
4. The runtime change is one condition: both Overview and Ad Comparison use the
   existing `getSynchronizedGA4OverviewSnapshot` branch. Scheduled Ad Comparison
   reports already read this same saved native breakdown for real scoped campaigns.

No publication, financial alignment, report-input, currency, attribution or
precision guard was removed. There is no new fallback, allocation, cache layer,
schema, dependency or background job. No source records or saved reports were
rewritten. The earlier raw-sum rounding correction remains unchanged.

## Data, scope and neighboring paths traced

- The daily scheduler calls `getAcquisitionBreakdown` with the saved property,
  exact selected campaign names, saved import start, campaign-timezone completed
  end, campaign currency and `preferOverviewCampaignTotals=true`, the same
  semantics as the former browser request. It captures daily traffic and
  reconciles sessions, conversion credits, revenue and currency before saving.
- `replaceGA4DailyMetricsWindow` writes daily facts and the native breakdown in
  one transaction. Existing guards check campaign owner/client/status/filter,
  currency/timezone, connection/property/import boundary, prior publication and
  work lease. Scope edits and connection/campaign deletion invalidate the saved
  snapshot. These paths were traced; they were not modified by this fix.
- `getGA4OverviewSnapshot` selects the exact campaign and property. The route
  still checks campaign access, explicit property, selected campaign scope and
  saved import window. The existing synchronized-reader helper rejects missing
  snapshots/daily data, different import starts, inconsistent end dates and an
  explicitly requested differing cutoff.
- The saved native rows retain unrounded revenue and fractional conversion
  credits; totals retain existing provider rounding. Existing request limits,
  metadata flags and last-updated provenance are preserved by the saved branch.
  Its `revenueWindow` metadata is additive for this request variant.
- Browser native aggregation, imported-source matching, chart/card aggregation,
  Revenue Breakdown, total rounding and PDF rendering remain unchanged.
  Unmapped HubSpot EUR 250 and Salesforce EUR 100 remain separate from native
  GA4 EUR 7,653.96; the combined financial total remains EUR 8,003.96.
- Ordinary rolling-date and Insights channel queries retain their existing
  provider paths. The prior Insights-context isolation remains intact. Scheduled
  report selection, PDF generation, sending and snapshots were not changed.
- Financial add/edit/delete, scheduled source refresh, KPIs, benchmarks and
  notifications receive no runtime changes. This is not a fresh certification
  of all those lifecycle paths. No damaged-data cleanup is indicated by the
  captured affected-campaign records.

## Validation

Evidence directory: [validation-2026-10-27-report-incident](validation-2026-10-27-report-incident/).
Tests run with an empty application DATABASE_URL, stripped credentials and an
external-network blocker. Browser fixtures use a new isolated headless profile;
all requests are intercepted. The user's browser and historical PDF artifacts
were not accessed or overwritten.

- `route-before.json`: 6 passing / 11 failing checks on the original runtime.
  Valid saved figures still produced HTTP 401 for an expired-token fixture or
  HTTP 500 for a provider-outage fixture. Missing snapshot cases incorrectly
  entered the same live-provider path instead of the synchronized-reader gate.
- `browser-before.json`: both actual-page cases failed because the actual native
  API handler contacted the failing provider, leaving the native table unavailable.
  This baseline stops at the table assertion, before attempting PDF generation;
  it must not be represented as a captured production download trace.
- `route-browser-after.json`: all 19 checks pass (17 actual-handler cases and
  two full-page browser cases). Each browser case creates five PDFs. They verify
  EUR 7,653.96 / EUR 8,003.96, the separate EUR 250 / EUR 100 source values,
  no native provider calls, and recovery after core status/data failures and a
  financial mismatch. Required failures still prevent downloading; unrelated
  pending/failed Insights context does not block Ad Comparison.
- `adjacent-regressions.json`: 259 checks pass, no failures or skips, covering
  accumulation windows, chart/card behavior, Revenue Breakdown render/PDF,
  publication token transitions, browser report guards, currency/source parity,
  Overview routes and saved scheduled-report inputs. Total: **278 passing checks**.
- `report-fix-build-checks.json`: TypeScript and production server build pass.
  The application client code was not changed; the actual client was bundled and
  exercised in the browser tests. A full unrelated suite was not rerun.
- `storage-2026-10-27T13-10-10-655Z.json`: the corrected handler ran against the
  affected campaign's real persisted records inside a REPEATABLE READ READ ONLY
  transaction and rolled back. It returned HTTP 200, two exact saved native rows,
  September 23–October 26, EUR 7,653.96, matching EUR 8,003.96 financial revenue,
  with **zero provider calls**. Owner/client fingerprints were asserted. This
  bypasses HTTP authentication after verifying the fixed target; it is data-path
  evidence, not a deployed authenticated-route or browser acceptance check.
- The earlier `storage-2026-10-27T12-54-49-618Z.json` diagnostic contains one
  read-only transaction rejection for `getGA4RevenuePublicationStatus`, which
  uses `SELECT FOR SHARE`. That is a diagnostic limitation, not an application
  failure, and no product change was made in response to it.

## Changed files and remaining acceptance

- Runtime: `server/routes-oauth.ts`, one condition.
- Regression coverage: new `server/ga4-ad-comparison-published-route.test.ts`;
  existing `server/ga4-ad-comparison-download-browser.test.ts` now uses the actual
  native API handler, not an unconditional successful JSON fixture.
- References: `GA4/REPORTS.md`, `GA4/AD_COMPARISON.md`, this record and its receipts.

After deployment, reload the affected campaign, open Reports, choose Create
Report → Ad Comparison → Generate & Download Report. Confirm the downloaded
native and combined totals against Overview. This validates the exact caller
changed. A real core data failure must still be surfaced; the fix does not promise
that all future network/database errors disappear. No further production edit,
test email, source deletion or campaign recreation is needed for this change.
