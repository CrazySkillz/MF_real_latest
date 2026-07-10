# GA4 Overview Spend Production Readiness

## Mandatory Anti-Overclaim Rule

Apply `AGENTS.md`, `PRODUCTION_READINESS.md`, `GA4/README.md`, `GA4_DEVELOPMENT_WORKFLOW.md`, `GA4/OVERVIEW.md`, `GA4/FINANCIAL_SOURCES.md`, and `GA4/REFRESH_AND_PROCESSING.md` before using this file as readiness evidence.

A previous readiness statement is not evidence. A passing test suite is not evidence for a path the tests do not cover. Do not call any spend path production-ready unless the current request's value inventory, source lifecycle, post-fetch transforms, fallback branches, negative cases, and downstream propagation boundary are covered by current documented evidence.

## Purpose

This is the component readiness file for GA4 Overview spend from:

- Google Sheets spend sources
- Upload CSV spend sources

It exists so spend-specific evidence does not keep expanding `GA4/OVERVIEW_PRODUCTION_READINESS.md`. Use the main Overview readiness file for whole-tab status. Use this file only for GA4 Overview spend certification questions that are specifically about Google Sheets and Upload CSV.

Google Ads spend is on hold and is excluded from this file. Do not use Google Ads evidence, Shopify evidence, HubSpot evidence, Meta evidence, LinkedIn evidence, KPI evidence, Benchmark evidence, Reports evidence, or other source-family evidence as proof for this component unless the evidence packet is explicitly tracing downstream propagation from Google Sheets or CSV spend.

## Current Status

Bounded clean certification:

`GA4 Overview spend is production-ready for the current local Google Sheets spend and Upload CSV spend code paths, with recorded deployed evidence for the specific Google Sheets and CSV lifecycle packets listed below. The certification does not include Google Ads spend, other spend source families, unlisted Google Sheets tabs/mappings, other uploaded CSV file shapes, other campaigns/properties beyond recorded packets, normal wall-clock scheduler timing beyond the recorded startup-fired Google Sheets spend packet, or future provider/runtime behavior.`

Lower the affected path to unproven if any relevant Overview, spend-source, scheduler, storage, report, KPI, Benchmark, or shared aggregate code changes in a way that can affect GA4 Overview spend values.

## Scope

Included:

- GA4 Overview `Total Spend`
- Spend Sources modal/list provenance for Google Sheets and CSV spend
- Overview Profit, ROAS, ROI, and CPA only to the extent they consume the certified `Total Spend` value
- Google Sheets spend add/import, edit/update, run-now refresh/reprocess, startup-fired scheduler reprocess, source modal visibility, and delete/deactivate for recorded packets
- CSV spend preview/process/add/import, edit/update through stored rows or re-upload, source modal visibility, no separate scheduler refresh, and delete/deactivate for recorded packets
- Local automated tests and static code traces that cover these spend paths

Excluded:

- Google Ads spend
- Meta, LinkedIn, Shopify, HubSpot, Salesforce, Manual/legacy, Custom Integration, KPI-only, Benchmark-only, Reports-only, and other source-family evidence
- Native GA4 provider revenue/conversion correctness except where those values combine with the spend value in Overview derived financial cards
- Future scheduled/test report emails, future report variants, and PDF/inbox delivery unless a separate packet traces Google Sheets or CSV spend propagation specifically
- Production database health outside the recorded target campaigns and any new campaign/scope that has not had a bounded read-only source inventory

## Evidence-Gap Analysis

Root cause of the current evidence gap:

- The existing Overview readiness file contains Google Sheets and CSV spend evidence, but it is mixed with whole-tab, provider, Reports, Shopify, HubSpot, Google Ads, KPI, Benchmark, scheduler, and cleanup evidence.
- That structure makes it easy to overclaim by reusing adjacent source-family evidence as proof for GA4 Overview spend.
- No runtime code bug was identified in the current local Google Sheets or CSV GA4 Overview spend trace. The immediate gap is documentation structure and strict scoping.

Google Sheets spend evidence gap:

- Local code trace proves the current path from Overview UI queries to API routes, storage, active-source-only spend records, source-scoped refresh, and scheduler reprocess wiring.
- Local tests cover add-mode additivity, read-only duplicate inspection, duplicate cleanup confirmation, source lifecycle recompute latency, Google Sheets refresh behavior, Google Sheets spend preview metadata freshness, financial-card platform context, UI modal stability, and relevant safety guards.
- Recorded deployed evidence covers specific Google Sheets spend lifecycle packets, but it does not prove every tab, mapping, campaign, property, provider condition, or normal scheduled clock-time execution.

CSV spend evidence gap:

- Local code trace proves the current path from CSV preview/process to spend source/record materialization, Overview refetch, active-source-only totals, and exact-source delete.
- Local tests cover CSV process source-type safety, CSV preview campaign access ordering, ownership-checked spend source delete, and financial-card platform context.
- Recorded deployed evidence covers one CSV spend source lifecycle packet, but it does not prove every uploaded file shape, mapping, campaign, property, or future CSV parser behavior.

## Value Inventory

| Value path | Contract | Evidence | Boundary |
| --- | --- | --- | --- |
| `Total Spend` | Source-backed spend from active spend sources for the selected campaign. Overview prefers spend breakdown totals over the campaign current-value fallback when sources exist. | Local trace through `client/src/pages/ga4-metrics.tsx`, `server/routes-oauth.ts`, and `server/storage.ts`; focused tests listed below; recorded deployed GS/CSV packets. | Certified only for Google Sheets and CSV spend paths in this file. |
| Spend Sources modal/list | Shows active spend source provenance and source-backed amounts for selected campaign spend sources. | Local UI query trace and modal stability test; deployed user UI confirmation in recorded packets. | Other source families and production database inventory outside recorded campaigns are excluded. |
| Profit, ROAS, ROI, CPA | Derived Overview financial cards consume `Total Spend`; this file certifies only the spend side of those formulas. | Local trace shows spend value feeds financials; recorded UI evidence confirms visible spend-source parity for listed packets. | Revenue/conversion correctness is governed by the broader Overview readiness docs, not this spend-only component. |
| Latest-day/daily spend materialization | CSV and Google Sheets processing materialize spend records with mapped dates when present, or a current-date aggregate row when no date column exists. | Code trace through CSV and Google Sheets process routes and storage active-source joins. | Not certified as a separate visible card beyond its use in current spend records and breakdowns. |

## Automated Test Plan Before Provider/UI Validation

Run automated local evidence before using provider/UI validation:

```powershell
npm test -- server/spend-source-additivity.test.ts server/ga4-auto-refresh-regression.test.ts server/ga4-source-lifecycle-recompute-regression.test.ts server/ga4-financial-rules.test.ts server/latest-day-revenue-regression.test.ts server/ga4-ui-regression.test.ts server/report-email-regression.test.ts server/outcome-totals-ga4-fallback-regression.test.ts server/google-sheets-aggregate-source.test.ts
```

Recorded local result for this spend-readiness pass:

- 9 test files passed.
- 113 tests passed.

Targeted `server/source-safety-regression.test.ts` checks to run before provider/UI validation:

```powershell
.\node_modules\.bin\vitest.cmd run --pool forks server/source-safety-regression.test.ts -t "CSV spend process refuses"
.\node_modules\.bin\vitest.cmd run --pool forks server/source-safety-regression.test.ts -t "individual spend source delete"
.\node_modules\.bin\vitest.cmd run --pool forks server/source-safety-regression.test.ts -t "CSV preview routes"
.\node_modules\.bin\vitest.cmd run --pool forks server/source-safety-regression.test.ts -t "Google Sheets spend source delete"
```

Current Commit 2 recorded local validation packet on `2026-07-10`:

- Focused suite command above passed: 9 test files, 113 tests.
- `CSV spend process refuses` isolated source-safety check passed: 1 test, 86 skipped.
- `individual spend source delete` isolated source-safety check passed: 1 test, 86 skipped.
- `CSV preview routes` isolated source-safety check passed: 1 test, 86 skipped.
- `Google Sheets spend source delete` isolated source-safety check passed: 1 test, 86 skipped.

The full `server/source-safety-regression.test.ts` file is not used as a passing evidence packet here because unrelated Instagram tests failed in the broad file run. During this validation pass, npm argument forwarding also ran the whole file instead of applying the test-name filter; only the isolated local Vitest binary runs above are used as the targeted passing packet.

Provider/UI validation must come after these tests and must stay scoped to one source family, one campaign, and one lifecycle action per packet.

## Code Trace Inventory

Frontend trace:

- `client/src/pages/ga4-metrics.tsx` queries `/api/campaigns/:id/spend-to-date`, `/api/campaigns/:id/spend-sources`, and `/api/campaigns/:id/spend-breakdown`.
- Overview financial spend uses source-backed spend when spend sources exist and prefers `spend-breakdown` total over `spend-to-date`.
- Spend add/update and delete actions invalidate and refetch spend-to-date, spend sources, and spend breakdown queries.

API trace:

- `GET /api/campaigns/:id/spend-sources` returns campaign-scoped active spend sources behind campaign access.
- `GET /api/campaigns/:id/spend-to-date` returns selected campaign spend and source IDs behind campaign access.
- `GET /api/campaigns/:id/spend-breakdown` returns active-source spend totals for the selected campaign.
- `POST /api/campaigns/:id/spend/csv/preview` checks campaign access before CSV parsing.
- `POST /api/campaigns/:id/spend/csv/process` checks campaign access, verifies existing source updates are active CSV spend sources, writes spend records, recalculates campaign spend, and schedules heavier downstream recompute after the response.
- `POST /api/campaigns/:id/spend/sheets/preview` checks campaign access and spend-purpose Google Sheets connection state.
- `POST /api/campaigns/:id/spend/sheets/process` checks campaign access, preserves stable source IDs for edit/refresh, keeps add mode additive, writes spend records, recalculates campaign spend, persists fresh preview metadata, and schedules heavier downstream recompute after the response.
- `POST /api/campaigns/:id/spend-sources/:sourceId/google-sheets-refresh/run-now` is a campaign/source-scoped validation trigger for Google Sheets spend reprocess only.
- `DELETE /api/campaigns/:id/spend-sources/:sourceId` verifies campaign access and source membership before deleting only the requested source records and deactivating the requested source.

Storage trace:

- `getSpendSources` returns active spend sources for one campaign.
- `getSpendSource` requires source ID, campaign ID, and active state.
- `createSpendSource`, `updateSpendSource`, `deleteSpendSource`, `deleteSpendRecordsBySource`, and `createSpendRecords` are the write boundary for materialized spend.
- `getSpendTotalForRange` and `getSpendBreakdownBySource` join spend records to active spend sources.

Scheduler trace:

- Google Sheets spend reprocess posts back to `/api/campaigns/:id/spend/sheets/process` with a stable `sourceId`.
- The scheduler iterates active Google Sheets spend sources and does not use CSV snapshots as auto-refresh sources.
- Normal wall-clock scheduled-hour execution remains external unless separately captured. The recorded startup-fired Google Sheets spend packet proves only that narrow deployed scheduler execution path.

## Lifecycle Matrix

| Source family | Add/import | Edit/update | Refresh/reprocess | Delete/deactivate | Boundary |
| --- | --- | --- | --- | --- | --- |
| Google Sheets spend | Closed for recorded deployed source `8f67b03f-a00b-434f-b81f-db1b2b951595` at `$240`; closed for second campaign/property source `62772549-88dc-4cc5-bfe6-2e991d518ef5` at `$507.70`. | Closed for source `8f67b03f-a00b-434f-b81f-db1b2b951595` at `$420.20`; closed for second campaign/property source `62772549-88dc-4cc5-bfe6-2e991d518ef5` at `$706.45`. | Closed for run-now source `8f67b03f-a00b-434f-b81f-db1b2b951595` at `$198.75`; closed for startup-fired scheduler source `618e5e12-0f3f-44a2-837a-d2677ad95f64` at `$678.95`; closed for second-campaign refresh/edit-preview freshness at `$807.70`; configured mapping fixture closed at `$678.95`. | Closed for source `8f67b03f-a00b-434f-b81f-db1b2b951595` with `$198.75` removed; closed for second-campaign source `62772549-88dc-4cc5-bfe6-2e991d518ef5` with `$807.70` removed. | Certified only for listed campaign/source packets, recorded startup-fired scheduler path, and configured mapping fixture. Unlisted tabs/mappings, other campaigns/properties, and normal wall-clock scheduled-hour proof remain unproven. |
| Upload CSV spend | Closed for recorded deployed CSV spend add/import at `$2,020`. | Closed for recorded deployed CSV spend edit/update at `$3,120`. | Not applicable as a separate scheduler/provider action. Manual edit/re-upload or stored-row recalculation is the reprocess path covered by edit/update evidence. | Closed for source `c3611c0f-4bbf-47b9-8615-93e4b140385e` with `$3,120` removed. | Certified only for the recorded CSV spend campaign/source lifecycle. Other files, mappings, campaigns, and properties remain unproven. |

## Current Commit Queue

This queue is scoped only to GA4 Overview spend readiness for Google Sheets and Upload CSV.

| Current Commit | Status | Scope | Smallest safe action | Blocks current Google Sheets/CSV Overview spend certification? |
| --- | --- | --- | --- | --- |
| Current Commit 1: Create GA4 Overview spend readiness doc | Completed in this documentation pass. | Split Google Sheets and CSV GA4 Overview spend readiness into this component file and point the main Overview readiness file to it. | Documentation-only update; no runtime code changes. | No. This reduces overclaiming risk and does not change behavior. |
| Current Commit 2: Automated local validation packet | Completed on `2026-07-10`. | Google Sheets and Upload CSV GA4 Overview spend local regression evidence before provider/UI validation. | Focused suite passed 9 files / 113 tests; four isolated source-safety spend checks passed 1 test each with 86 skipped. Broad `source-safety-regression.test.ts` full-file run remains excluded because unrelated Instagram tests fail. | No. |
| Current Commit 3: Normal wall-clock Google Sheets scheduler proof | Optional external validation if strict scheduled-hour proof is required. | Google Sheets spend scheduler timer beyond the recorded startup-fired packet. | Capture a natural scheduled-hour before/after packet for one campaign/source without mixing it with source lifecycle validation. | No for current local code certification; yes only for strict normal-clock deployed scheduler certification. |
| Current Commit 4: Additional Google Sheets tab/mapping variants | Optional external validation if broader mapping certification is required. | Google Sheets spend tabs/mappings not covered by recorded packets or configured variant pack. | Run a configured variant packet and UI parity check per new tab/mapping shape. | No for recorded scopes; yes for unlisted tab/mapping claims. |
| Current Commit 5: Additional CSV file/mapping variants | Optional external validation if broader upload certification is required. | CSV spend files/mappings not covered by the recorded lifecycle packet. | Run preview/process/edit/delete before/after evidence for each new file shape or mapping family. | No for recorded scope; yes for unlisted file/mapping claims. |
| Current Commit 6: Additional production source inventory | Optional external validation for new campaigns/scopes. | Production database source health outside recorded target campaigns. | Run bounded read-only inventory before making cleanup or database-health claims for another campaign/scope. | No for recorded scopes; yes for new campaign/scope health claims. |

## Proven

Proven locally for current code:

- Overview uses spend-to-date, spend sources, and spend breakdown endpoints for GA4 spend display and derived financial cards.
- Google Sheets and CSV spend process routes materialize spend records and recalculate campaign spend before returning success.
- Heavier GA4 KPI/Benchmark recompute is scheduled after spend process responses, so source writes and Overview spend totals are durable first.
- Spend breakdown and spend totals join records to active campaign spend sources.
- Individual spend source delete verifies campaign/source ownership before cleaning records and deactivating the source.
- CSV snapshots are not auto-refreshed by the Google Sheets spend scheduler.
- Google Sheets spend refresh/reprocess uses a stable source ID.

Proven by recorded deployed evidence:

- Google Sheets spend add/import, edit/update, run-now refresh, startup-fired scheduler reprocess, configured mapping fixture, second-campaign lifecycle, source modal parity, and delete/deactivate for the source IDs and amounts listed in the lifecycle matrix.
- Upload CSV spend add/import, edit/update, source modal parity, no separate scheduler refresh path, and delete/deactivate for the source ID and amounts listed in the lifecycle matrix.

## Unproven

- Google Ads spend, because it is on hold and excluded from this component.
- Unlisted Google Sheets tabs, header layouts, date formats, campaign filters, and mapping shapes.
- Unlisted CSV files, parser edge cases, mappings, date formats, and campaign filters.
- Other campaigns/properties that are not part of the recorded deployed packets.
- Other spend source families.
- Future provider behavior, future runtime behavior, and future code changes.
- Future scheduled/test report emails and untested report variants unless a separate packet traces Google Sheets or CSV spend propagation specifically.
- Production database source health outside recorded campaign/scope inventories.

## Not Locally Verifiable

- Live Google Sheets API availability, permissions, token/provider behavior, and sheet cell contents.
- Deployed normal wall-clock scheduler timing beyond the recorded startup-fired Google Sheets spend packet.
- Browser UI pixel parity beyond user-confirmed recorded packets.
- Production database inventory for campaigns/scopes not explicitly inventoried.
- Inbox delivery or provider delivery events for future emails.

## Stable Response For Future Chats

Use only when the request is limited to GA4 Overview spend from Google Sheets and Upload CSV:

`GA4 Overview spend is production-ready for the current local Google Sheets spend and Upload CSV spend code paths, with recorded deployed evidence for the specific lifecycle packets listed in GA4/OVERVIEW_SPEND_PRODUCTION_READINESS.md. Google Ads spend and all other source families remain excluded. Unlisted Google Sheets tabs/mappings, unlisted CSV file shapes, other campaigns/properties, normal wall-clock scheduler proof beyond the recorded startup-fired Google Sheets packet, and future provider/runtime behavior remain unproven.`
