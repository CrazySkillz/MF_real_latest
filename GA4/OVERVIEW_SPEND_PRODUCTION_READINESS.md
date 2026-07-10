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

Current clean-certification status:

- **Google Sheets spend is unproven in the deployed runtime.** On `2026-07-10`, the natural scheduler reached source `618e5e12-0f3f-44a2-837a-d2677ad95f64` but the Google Sheets API fetch failed with `401 UNAUTHENTICATED`. The same packet exposed `spend-to-date = 0` while `spend-breakdown = 498.75`. Historical successful packets remain evidence for those exact earlier runs, but they do not override the current failure.
- **Upload CSV spend retains its bounded historical lifecycle evidence.** Current local tests cover the shared lifetime spend recompute change, but new deployed CSV file shapes or mappings remain unproven.
- Local fixes now require a newly issued refresh token during explicit Google Sheets reconnect and align persisted spend-to-date with the lifetime spend-record window. These fixes are not deployed/provider proof.

Do not call the Google Sheets spend path production-ready again until Current Commits 5, 6, and 7 are closed with deployed evidence.

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

- The deployed Google Sheets spend source held credentials that Google rejected with `401 UNAUTHENTICATED`; automatic refresh and all campaign fallback connections failed to produce a usable token.
- The explicit OAuth callback could reuse an old stored refresh token when Google omitted a new refresh token. After a failed connection, that could silently carry the rejected credential into the replacement connection instead of repairing it.
- The shared spend recompute started at `campaign.startDate`, while the documented spend-to-date and Overview breakdown contracts use the full imported lifetime window. This produced the observed split: `spend-to-date = 0` and `spend-breakdown = 498.75`.
- The validation runner's successful endpoint/source-state packet did not prove provider refresh success when the raw run-now route returned `502`; unchanged materialized spend is not evidence that updated sheet values propagated.
- Whether Google invalidated the original refresh token because of OAuth consent-screen Testing status, user/admin revocation, token limits, or another provider policy is not locally distinguishable.

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

Recorded local result after the Current Commit 5 fixes on `2026-07-11`:

- 9 test files passed.
- 116 tests passed.
- The four in-scope source-safety checks passed inside the broad file run. The broad file still failed only on seven unrelated Instagram assertions, so the full file is not claimed as passing evidence.

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
| Google Sheets spend | Historical packets closed for sources `8f67b03f-a00b-434f-b81f-db1b2b951595` and `62772549-88dc-4cc5-bfe6-2e991d518ef5`. | Historical packets closed for those exact sources and runs. | **Currently unproven:** the `2026-07-10` natural scheduler and raw run-now attempts for source `618e5e12-0f3f-44a2-837a-d2677ad95f64` failed with Google Sheets `401 UNAUTHENTICATED`. Earlier run-now/startup packets remain historical evidence only. | Historical delete packets remain closed for their exact source IDs. | Requires deployed Current Commit 5 credential repair, source-stable provider mutation proof, spend-to-date/breakdown parity, and a successful natural scheduler packet before a current production-ready claim. |
| Upload CSV spend | Closed for recorded deployed CSV spend add/import at `$2,020`. | Closed for recorded deployed CSV spend edit/update at `$3,120`. | Not applicable as a separate scheduler/provider action. Manual edit/re-upload or stored-row recalculation is the reprocess path covered by edit/update evidence. | Closed for source `c3611c0f-4bbf-47b9-8615-93e4b140385e` with `$3,120` removed. | Certified only for the recorded CSV spend campaign/source lifecycle. Other files, mappings, campaigns, and properties remain unproven. |

## Current Commit Queue

This queue is scoped only to GA4 Overview spend readiness for Google Sheets and Upload CSV.

| Current Commit | Status | Scope | Smallest safe action | Blocking? |
| --- | --- | --- | --- | --- |
| Current Commit 1: Create GA4 Overview spend readiness doc | Completed and committed. | Separate Google Sheets/CSV spend evidence from whole-Overview evidence. | No further action. | No. |
| Current Commit 2: Automated local validation packet | Completed and committed; refreshed on `2026-07-11`. | Local Google Sheets/CSV spend regression evidence. | Current focused suite: 9 files / 116 tests passed. Four spend source-safety assertions passed inside the broad run; seven unrelated Instagram assertions failed. | No. |
| Current Commit 3: Natural scheduler proof | **Attempted and failed on `2026-07-10`.** | Source `618e5e12-0f3f-44a2-837a-d2677ad95f64`, campaign `8aa735ee-c02f-41e2-bb1f-7c3f43bb9458`. | Preserve the failed `401 UNAUTHENTICATED` packet as root-cause evidence; do not count unchanged `$498.75` as refresh success. | Yes for Google Sheets automatic-update readiness. |
| Current Commit 4: Token lookup/self-heal hardening | Completed across commits `ce4c8947`, `fc6d9f30`, `72294e3e`, `3264e61d`, and `df68595d`. | Purpose-agnostic connection lookup, fallback token refresh, failure details, and durable-token storage guard. | No further code in this group. Existing invalid production credentials still require one explicit repair after deployment. | Did not close Current Commit 3 by itself. |
| Current Commit 5: Fresh reconnect token and lifetime spend parity | **Implemented locally; uncommitted.** | Prevent explicit reconnect from reusing a rejected refresh token; make persisted spend-to-date use the same lifetime window as spend breakdown. | Commit only `server/routes-oauth.ts`, the two focused tests, and this readiness file after diff review. | Yes until committed, deployed, and validated. |
| Current Commit 6: Deployed provider mutation and propagation packet | Outstanding external validation. | Existing source `618e5e12-0f3f-44a2-837a-d2677ad95f64`. | After Current Commit 5 deploys: reconnect Google Sheets once without deleting the spend source; confirm raw run-now `200/success:true`; change a known sheet spend value; rerun; prove the same source ID, expected new total, `spend-to-date === spend-breakdown`, Overview parity, and unchanged unrelated revenue. | Yes for Google Sheets production readiness. |
| Current Commit 7: Successful natural wall-clock scheduler mutation | Outstanding external validation. | Automatic update after a user changes the sheet. | Capture before values, change one known sheet value, wait for the configured natural scheduler, then prove provider success, same source ID, exact delta, spend-to-date/breakdown/Overview parity, and downstream financial parity. | Yes for the claim that user sheet edits update automatically. |
| Current Commit 8: Additional Google Sheets tab/mapping variants | Optional for broader claims. | Unlisted tabs, headers, dates, filters, and mappings. | Run one bounded packet per mapping family. | Only blocks broader mapping claims. |
| Current Commit 9: Additional CSV file/mapping variants | Optional for broader claims. | Unlisted CSV shapes and mappings. | Run preview/process/edit/delete evidence per file family. | Only blocks broader CSV claims. |
| Current Commit 10: Additional production source inventory | Optional for broader campaigns. | Other campaign/source health. | Run bounded read-only inventory per new campaign scope. | Only blocks broader production-data claims. |

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

- Historical Google Sheets spend add/import, edit/update, run-now refresh, startup-fired scheduler reprocess, configured mapping fixture, second-campaign lifecycle, source modal parity, and delete/deactivate remain proven only for the exact earlier source IDs and runs listed in the lifecycle matrix. They do not prove the currently failing production credential.
- Upload CSV spend add/import, edit/update, source modal parity, no separate scheduler refresh path, and delete/deactivate remain proven for the recorded source ID and lifecycle packet.

## Unproven

- Current deployed Google Sheets credential durability and provider refresh success after the Current Commit 5 change.
- Exact propagation of a new sheet value to the same spend source, spend records, campaign spend-to-date, spend breakdown, GA4 Overview, and derived financial consumers.
- Successful natural wall-clock scheduler processing after a real sheet mutation.
- Google Ads spend, because it is on hold and excluded from this component.
- Unlisted Google Sheets tabs, header layouts, date formats, campaign filters, and mapping shapes.
- Unlisted CSV files, parser edge cases, mappings, date formats, and campaign filters.
- Other campaigns/properties that are not part of the recorded deployed packets.
- Other spend source families.
- Future provider behavior, future runtime behavior, and future code changes.
- Future scheduled/test report emails and untested report variants unless a separate packet traces Google Sheets or CSV spend propagation specifically.
- Production database source health outside recorded campaign/scope inventories.

## Not Locally Verifiable

- Live Google Sheets API availability, permissions, token/provider behavior, OAuth consent-screen Publishing status, and sheet cell contents.
- Whether Google invalidated the prior refresh token because of Testing status, user/admin revocation, token limits, or another provider policy.
- Deployed reconnect, provider mutation, and normal wall-clock scheduler behavior after Current Commit 5.
- Browser UI pixel parity beyond user-confirmed recorded packets.
- Production database inventory for campaigns/scopes not explicitly inventoried.
- Inbox delivery or provider delivery events for future emails.

## Stable Response For Future Chats

Use only when the request is limited to GA4 Overview spend from Google Sheets and Upload CSV:

`GA4 Overview Google Sheets spend is not currently production-ready: the latest deployed natural scheduler/run-now packet failed with Google Sheets 401, and the same evidence showed spend-to-date 0 versus spend-breakdown 498.75. Current Commit 5 fixes stale refresh-token reuse during explicit reconnect and aligns lifetime spend recompute locally; Current Commits 6 and 7 must still prove deployed provider mutation, same-source propagation, spend-to-date/breakdown/Overview parity, and natural scheduler success. Upload CSV retains only its previously recorded bounded lifecycle evidence. Google Ads and all other source families remain excluded.`
