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

- **Google Sheets spend remains unproven for clean certification.** On `2026-07-11`, the deployed run-now path first reproduced `502` with an underlying Google Sheets `401 UNAUTHENTICATED`. After one explicit Google Sheets repair reconnect, the same campaign/source run-now route returned `200/success:true`, and the user confirmed GA4 Overview Total Spend displayed the newly added sheet value. This proves one repaired manual provider reprocess and visible value ingestion for source `618e5e12-0f3f-44a2-837a-d2677ad95f64`; it does not prove the automatic one-minute timer, exact before/after delta reconciliation, lifetime endpoint parity, or credential durability.
- **Upload CSV spend retains its bounded historical lifecycle evidence and now has a focused local variant packet.** Current Commit 10 covers BOM/CRLF comma files, quoted currency values, semicolon/tab/pipe delimiters, snapshot and dated aggregation, exact one/multi-campaign filters, no-valid-row rejection, stable stored-row edits, and atomic source/record replacement. These are local code/test proofs; deployed browser/database validation for the new variants remains unproven.
- The durable reconnect guard and lifetime spend-window fixes are deployed. The successful repaired run provides partial provider evidence, but the repaired token was issued while the Google OAuth app was still `External + Testing` and therefore is not durable production-token evidence.
- Product requirement added on `2026-07-11`: mapped Google Sheets spend edits must update the same source, GA4 Overview, and downstream financial consumers automatically. The implementation target is a source-family-only provider poll every 1 minute plus an open Overview refetch within 15 additional seconds, approximately 75 seconds under normal provider/runtime conditions; literal zero-latency delivery is not guaranteed.

Do not call the Google Sheets spend path production-ready again until Current Commits 5, 6, 7, 8, 8b, and 8c are closed with deployed evidence. Current Commit 8c records the user-requested hold on Google OAuth verification and production-token durability work.

## Explicit Hold

On `2026-07-11`, the Google OAuth app was confirmed as `External + Testing`, which explains the recurring seven-day authorization expiry for the requested Sheets/Drive scopes. The user changed Publishing status to `In production`. Google still requires branding and sensitive-scope verification.

The remaining OAuth verification work is explicitly on hold at the user's request:

- connect the owned `mumus.app` domain to the deployed application
- publish a public app homepage, Privacy Policy, and Terms of Service on `mumus.app`
- verify domain ownership through Google Search Console
- complete Google Auth Platform branding and data-access verification
- perform one final Google Sheets and GA4 reconnect after the production OAuth configuration is ready
- prove automatic token renewal and continued operation beyond seven days without another reconnect

No clean-certification claim may treat the hold as completed evidence.

## Scope

Included:

- GA4 Overview `Total Spend`
- Spend Sources modal/list provenance for Google Sheets and CSV spend
- Overview Profit, ROAS, ROI, and CPA only to the extent they consume the certified `Total Spend` value
- Google Sheets spend add/import, edit/update, run-now refresh/reprocess, one-minute source-family polling, startup-fired scheduler reprocess, source modal visibility, and delete/deactivate for recorded packets
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
- The recurring disconnect cause is now confirmed for this OAuth project: Google Auth Platform showed `External + Testing`, which imposes seven-day authorization/refresh-token expiry for the requested Sheets/Drive scopes. Publishing status was changed to `In production`, but verification and a final post-publish reconnect are on hold; the token used for the successful repaired run was issued before that publishing change.
- Even with valid credentials, the only automatic Google Sheets spend pull was inside the once-daily all-provider scheduler, while Overview polled only persisted spend every 10 minutes. Therefore sheet edits could not meet the automatic near-real-time requirement: reloading before the provider pull returned the old stored value. Current Commit 8b addresses this locally with source-family-only one-minute polling and 15-second Overview spend refetch; deployed mutation evidence remains outstanding.
- There is no Google Drive `files.watch` webhook/channel lifecycle or server-to-browser push path in the current implementation. Therefore literal event-triggered zero-delay propagation is not available; the smallest current-architecture fix is near-real-time polling, while Drive webhook registration/renewal remains a larger future enhancement.
- Before Current Commit 10, CSV dated imports counted positive-spend rows with blank or invalid dates in the API `spendToDate` response but omitted those rows from persisted daily records whenever at least one valid date existed. That could make the response disagree with campaign spend, spend breakdown, and Overview.
- The CSV spend route also caught spend-record creation failures, logged a warning, recalculated, and returned success, allowing false-success or partially materialized source state.

Google Sheets spend evidence gap:

- Local code trace proves the current path from Overview UI queries to API routes, storage, active-source-only spend records, source-scoped refresh, and scheduler reprocess wiring.
- Local tests cover add-mode additivity, read-only duplicate inspection, duplicate cleanup confirmation, source lifecycle recompute latency, Google Sheets refresh behavior, Google Sheets spend preview metadata freshness, financial-card platform context, UI modal stability, and relevant safety guards.
- Recorded deployed evidence covers specific Google Sheets spend lifecycle packets, but it does not prove every tab, mapping, campaign, property, provider condition, or normal scheduled clock-time execution.

CSV spend evidence gap:

- Local code trace proves the current path from CSV preview/process to spend source/record materialization, Overview refetch, active-source-only totals, and exact-source delete.
- Local tests cover CSV process source-type safety, CSV preview campaign access ordering, ownership-checked spend source delete, financial-card platform context, representative delimiter/line-ending parsing, snapshot and dated totals, exact campaign filtering, invalid-row rejection, stored-row edit guards, and transactional source/record replacement.
- Current Commit 10 directly proves the listed local parser/aggregation variants and ensures a source definition plus replacement records commit or roll back together. It does not prove deployed multipart upload, live database behavior, UI rendering, every file shape, every date/number locale, another campaign/property, or future parser behavior.
- Recorded deployed evidence still covers one earlier CSV spend source lifecycle packet only.

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

Current Commit 8b local validation on `2026-07-11`:

- Focused automatic-update packet passed: 5 files, 60 tests.
- Broader Overview spend packet passed: 9 files, 118 tests.
- `npm run check` passed.

Current Commit 10 local validation on `2026-07-11`:

- Focused CSV variant packet passed: `server/csv-spend-validation.test.ts`, 10 tests.
- Adjacent GA4 Overview spend packet passed: 6 files, 65 tests.
- The broad mixed source-safety run passed all 80 non-Instagram assertions, including the three CSV preview/process/delete guards; its seven unrelated Instagram assertions still failed and are not claimed as passing evidence.
- `npm run check` passed.
- `git diff --check` passed for the Current Commit 10 files.

Current Commit 8 local validation on `2026-07-11`:

- Focused OAuth/spend packet passed: 4 files, 27 tests.
- Broader Overview spend packet passed: 9 files, 117 tests.
- `npm run check` passed.

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
- One-minute source-family timer execution remains unproven until a deployed mutation packet is captured without the manual validation trigger. The recorded `200/success:true` packet proves only the repaired manual run-now path.

## Lifecycle Matrix

| Source family | Add/import | Edit/update | Refresh/reprocess | Delete/deactivate | Boundary |
| --- | --- | --- | --- | --- | --- |
| Google Sheets spend | Historical packets closed for sources `8f67b03f-a00b-434f-b81f-db1b2b951595` and `62772549-88dc-4cc5-bfe6-2e991d518ef5`. | Historical packets closed for those exact sources and runs. | **Partially revalidated:** source `618e5e12-0f3f-44a2-837a-d2677ad95f64` failed with `401`, then returned `200/success:true` after an explicit repair reconnect and visibly ingested the newly added sheet value through the manual run-now route. Automatic timer execution, exact delta/parity, and durable production-token operation remain unproven. | Historical delete packets remain closed for their exact source IDs. | Requires Current Commits 5, 6, 7, 8b, and 8c evidence before a current production-ready claim. OAuth verification work is on hold. |
| Upload CSV spend | Closed for recorded deployed CSV spend add/import at `$2,020`; local Current Commit 10 covers representative delimiter, snapshot, dated, and campaign-filter variants. | Closed for recorded deployed CSV spend edit/update at `$3,120`; local Current Commit 10 covers stored-row mapping guards and atomic source/record replacement. | Not applicable as a scheduler/provider action. Manual edit/re-upload or stored-row recalculation is the update path. | Closed for source `c3611c0f-4bbf-47b9-8615-93e4b140385e` with `$3,120` removed. | Deployed certification remains bounded to the recorded lifecycle. Current Commit 10 broadens local proof only; its new variants are not deployed evidence. |

## Current Commit Queue

This queue is scoped only to GA4 Overview spend readiness for Google Sheets and Upload CSV.

| Current Commit | Status | Scope | Smallest safe action | Blocking? |
| --- | --- | --- | --- | --- |
| Current Commit 1: Create GA4 Overview spend readiness doc | Completed and committed. | Separate Google Sheets/CSV spend evidence from whole-Overview evidence. | No further action. | No. |
| Current Commit 2: Automated local validation packet | Completed and committed; refreshed on `2026-07-11`. | Local Google Sheets/CSV spend regression evidence. | Current focused suite: 9 files / 118 tests passed after Current Commit 8b. Four spend source-safety assertions passed inside the broad run; seven unrelated Instagram assertions failed. | No. |
| Current Commit 3: Natural scheduler proof | **Attempted and failed on `2026-07-10`; superseded by Current Commit 7.** | Source `618e5e12-0f3f-44a2-837a-d2677ad95f64`, campaign `8aa735ee-c02f-41e2-bb1f-7c3f43bb9458`. | Preserve the failed `401 UNAUTHENTICATED` packet as root-cause evidence; do not count unchanged `$498.75` as refresh success. The replacement successful automatic proof belongs only to Current Commit 7. | No separate action; Current Commit 7 is blocking. |
| Current Commit 4: Token lookup/self-heal hardening | Completed across commits `ce4c8947`, `fc6d9f30`, `72294e3e`, `3264e61d`, and `df68595d`. | Purpose-agnostic connection lookup, fallback token refresh, failure details, and durable-token storage guard. | No further code in this group. The explicit repair reconnect is recorded under Current Commit 5; durable production-mode credentials remain Current Commit 8c. | No. |
| Current Commit 5: Fresh reconnect token and lifetime spend parity | **Code deployed; partial runtime validation passed.** | Prevent explicit reconnect from reusing a rejected refresh token; make persisted spend-to-date use the same lifetime window as spend breakdown. | The repaired source returned `200/success:true`; still capture `spend-to-date === spend-breakdown` after an exact mutation, and do not treat the pre-publish Testing token as durable evidence. | Yes until parity and production-token durability are validated. |
| Current Commit 6: Deployed provider mutation and propagation packet | **Partially passed.** | Existing source `618e5e12-0f3f-44a2-837a-d2677ad95f64`. | Recorded: repaired run-now `200/success:true`, same requested source ID, and user-confirmed new sheet value visible in Total Spend. Still required: exact before/after delta, spend-to-date/breakdown parity, source-count/provenance parity, and unchanged unrelated revenue. | Yes for Google Sheets production readiness. |
| Current Commit 7: Successful automatic timer mutation | **Outstanding; first deployed attempt failed on the Testing-mode credential.** | Automatic update after a user changes the sheet. | After OAuth work resumes and a production-mode token is issued, capture before values, change one known sheet value, use no manual trigger or browser reload, and prove same-source exact delta plus endpoint/Overview/downstream parity within the normal target. | Yes for automatic-update readiness. |
| Current Commit 8: Durable GA4 OAuth reconnect | **Code deployed; Testing-mode reconnect succeeded, durability unproven and on hold with 8c.** | Require a newly issued GA4 refresh token, preserve existing GA4 rows until a durable replacement is created and promoted, and regression-cover the replacement order. | After OAuth verification work resumes, reconnect GA4 under the production configuration and prove automatic token refresh without another consent prompt. | Yes for GA4-derived downstream spend-consumer validation; does not block source-backed Total Spend itself. |
| Current Commit 8a: GA4 reconnect control reachability | **Completed and user-confirmed deployed.** | The campaign-card reconnect button previously expanded a second OAuth control below the viewport. | The user reached and completed the existing GA4 reconnect flow after deployment; no further code action in this item. | No for reconnect-control usability. |
| Current Commit 8b: Automatic Google Sheets spend propagation | **Committed, pushed, deployed; automatic timer evidence pending.** | Replace the once-daily-only Google Sheets spend freshness gap without increasing any other source-family cadence. | Commit `e4c3de5a` adds a 1-minute source-only timer and 15-second Overview polling. The manual repaired run reached the UI, but no successful no-click timer mutation packet has been captured. | Yes for automatic-update readiness. |
| Current Commit 8c: Production Google OAuth publishing and verification | **Partially completed, explicitly on hold.** | Eliminate Testing-mode seven-day token expiry for Google Sheets and GA4. | Confirmed `External + Testing`, changed Publishing status to `In production`; remaining `mumus.app` public pages/domain verification, Google branding/data-access verification, final post-publish reconnects, automatic token renewal, and >7-day durability proof are deferred until the user resumes this work. | Yes for stable-connection clean certification. |
| Current Commit 9: Additional Google Sheets tab/mapping variants | Optional for broader claims. | Unlisted tabs, headers, dates, filters, and mappings. | Run one bounded packet per mapping family. | Only blocks broader mapping claims. |
| Current Commit 10: Upload CSV automated validation packet | **Implemented locally; deployed variant validation remains optional for broader runtime claims.** | Representative CSV parser, snapshot/dated aggregation, campaign-filter, edit, negative, and atomic materialization paths. | Added 10 focused tests; fixed invalid-date response/persistence divergence, rejected zero-valid-row imports before mutation, and made CSV source plus spend-record replacement transactional. | No for the previously recorded CSV lifecycle; yes before claiming these new variants are deployed/browser certified. |
| Current Commit 11: Additional production source inventory | Optional for broader campaigns. | Other campaign/source health. | Run bounded read-only inventory per new campaign scope. | Only blocks broader production-data claims. |

## Proven

Proven locally for current code:

- Overview uses spend-to-date, spend sources, and spend breakdown endpoints for GA4 spend display and derived financial cards.
- Google Sheets and CSV spend process routes materialize spend records and recalculate campaign spend before returning success.
- Heavier GA4 KPI/Benchmark recompute is scheduled after spend process responses, so source writes and Overview spend totals are durable first.
- Spend breakdown and spend totals join records to active campaign spend sources.
- Individual spend source delete verifies campaign/source ownership before cleaning records and deactivating the source.
- CSV snapshots are not auto-refreshed by the Google Sheets spend scheduler.
- CSV parser/aggregation automation covers BOM/CRLF comma files, quoted currency values, semicolon/tab/pipe delimiters, snapshot totals, dated totals, and exact one/multi-campaign filters.
- When a date column is mapped, blank/invalid-date rows are excluded before both response and record totals; zero-valid-row imports fail before source mutation.
- CSV source add/edit and replacement spend records are committed in one campaign/source/type-scoped database transaction, and materialization failures do not return success.
- Google Sheets spend refresh/reprocess uses a stable source ID.
- Local code now gives Google Sheets spend its own bounded polling path without adding CSV or another provider family to that timer; this is implementation evidence, not deployed timing/provider proof.

Proven by recorded deployed evidence:

- Historical lifecycle packets remain bounded to their recorded source IDs. For the current source, one repaired manual run-now returned `200/success:true` and the user confirmed the new sheet value appeared in Total Spend. This does not prove automatic timer execution, exact reconciliation, or durable production OAuth.
- Upload CSV spend add/import, edit/update, source modal parity, no separate scheduler refresh path, and delete/deactivate remain proven for the recorded source ID and lifecycle packet.

## Unproven

- Durable Google Sheets and GA4 production-mode credentials after Google OAuth verification and final post-publish reconnects.
- Exact propagation of a new sheet value to the same spend source, spend records, campaign spend-to-date, spend breakdown, GA4 Overview, and derived financial consumers.
- Successful deployed one-minute source-family timer processing after a real sheet mutation, including visible Overview convergence within the approximately 75-second normal target.
- Deployed proof that the Google Sheets-spend-only timer fires at the configured one-minute interval, preserves source identity, propagates an exact changed value, and becomes visible in an already-open Overview within the approximately 75-second normal target.
- Google Ads spend, because it is on hold and excluded from this component.
- Unlisted Google Sheets tabs, header layouts, date formats, campaign filters, and mapping shapes.
- Deployed browser/database behavior for the new Current Commit 10 CSV variants; duplicate-header files, locale-specific decimal formats, ambiguous non-ISO dates, row/file limit boundaries, and other unlisted mappings remain unproven.
- Other campaigns/properties that are not part of the recorded deployed packets.
- Other spend source families.
- Future provider behavior, future runtime behavior, and future code changes.
- Future scheduled/test report emails and untested report variants unless a separate packet traces Google Sheets or CSV spend propagation specifically.
- Production database source health outside recorded campaign/scope inventories.

## Not Locally Verifiable

- Live Google Sheets API availability, permissions, token/provider behavior, and sheet cell contents. Publishing status was user-confirmed `In production`, but branding/data-access verification remains external and on hold.
- Future token durability beyond seven days, automatic access-token renewal, user/admin revocation, and provider token-limit behavior.
- Final post-publish reconnects, exact deployed mutation reconciliation, and successful one-minute automatic timer behavior after Current Commits 5, 7, 8b, and 8c resume.
- Browser UI pixel parity beyond user-confirmed recorded packets.
- Production database inventory for campaigns/scopes not explicitly inventoried.
- Inbox delivery or provider delivery events for future emails.

## Stable Response For Future Chats

Use only when the request is limited to GA4 Overview spend from Google Sheets and Upload CSV:

`GA4 Overview Google Sheets spend is not yet clean-certified. A repaired manual run-now returned 200 and the user confirmed the new sheet value appeared in Total Spend, but exact delta/parity, successful no-click one-minute timer propagation, and durable production OAuth remain unproven. The recurring disconnect root cause was confirmed as External + Testing; Publishing status is now In production, while mumus.app public legal pages, domain/Google verification, final post-publish reconnects, and >7-day durability proof are explicitly on hold. Upload CSV retains its recorded bounded deployed lifecycle evidence and now has a locally passing representative parser/mapping/atomic-materialization packet; the new variants are not yet deployed browser/database proof. Google Ads and all other source families remain excluded.`
