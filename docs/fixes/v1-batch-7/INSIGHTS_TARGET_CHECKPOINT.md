# Scheduled Insights target checkpoint — October 26, 2026

**Historical narrow checkpoint:** The [consolidated report context packet](REPORT_CONTEXT_CHECKPOINT.md) now holds current source/build/artifact evidence. It extends this work to history, channels, browser inputs and immutable output checks; use its explicit remaining limits for current status.

This follows `ec358757` and is **uncommitted and undeployed**. The user's “done” is recorded as a user-reported deployment/basic campaign-opening check for that prior commit, not independent verification of all changed pages or report artifacts.

**266/266 checks pass in 21 files, zero failed/skipped. TypeScript and the server production build pass.** The client is unchanged from the preceding client-build packet. [Evidence manifest](validation-2026-10-26/insights-evidence.json), [test results](validation-2026-10-26/insights-verified.json), [build results](validation-2026-10-26/insights-verified-build-checks.json).

Only one application file changes: `server/ga4-scheduled-report-pdf.ts`. Test changes and evidence are separate. No browser, provider account, production database or email was accessed. No source, scheduler, storage, schema, connection, financial aggregation, historical PDF or notification implementation changes.

## Confirmed defects and correction

| Root cause | Correction and evidence |
|---|---|
| Insights omitted the saved KPI loop, and its required-input predicate swallowed KPI-list failures. | Standalone/custom Insights require the campaign-scoped KPI list. Standard KPI misses, lower-is-better direction, saved priority and positive target signals use existing shared math. All ten supported metric identities are compared with executable current browser target branches. |
| Benchmark evaluation silently skipped invalid/insufficient values and could score custom values without a matching reporting window. | Existing consumer-state, period and sufficiency helpers gate comparisons. Invalid targets produce configuration findings; unverifiable targets produce a consolidated withheld finding; custom reporting windows require review. Benchmark thresholds remain unchanged. |
| The report omitted measured-zero-spend, negative-ROI and below-one-ROAS checks. | Those findings use reconciled financial inputs. Missing spend, zero and negative values remain distinct. Negative spend cannot pass the existing financial publication schema. |
| The legacy provider fallback retained stored target current values; adding KPI scoring there could turn stale values into new conclusions. | New target conclusions require the reconciled saved publication. Legacy fallback target values are withheld explicitly; no provider request or aggregation is added. The existing fallback's other behavior is not certified by this guard. |
| Scheduled output capped findings at eight instead of the browser summary's twelve; titles were truncated to 80 characters. | The report uses twelve, retains the omitted-count disclosure, prioritizes severity/setup/financial/target findings, and measures/wraps full titles. A five-page real PDF with twelve findings is rendered and visually inspected. A separate long-name render checks complete title text and page/text bounds in memory. |

Exact application path: `report-scheduler.ts:buildPdfAttachmentForReport` -> the existing GA4 builder -> `buildGA4ReportPayload` -> `storage.getPlatformKPIs("google_analytics", campaignId)` / `getPlatformBenchmarks(...)` -> saved Overview/daily/financial reconciliation -> existing `resolveGA4KpiLiveValue` -> `buildInsightsItems` -> existing PDF renderer. Storage queries retain exact campaign/platform equality. Builder failures still refuse the generic report fallback. No write is added to this path.

The current-value inventory is sessions, users, pageviews, fractional conversions, conversion rate, engagement rate, revenue, ROI, ROAS and CPA. Standard targets remain absolute cumulative goals; legacy period fields do not scale them. Saved custom targets remain unscored when their window cannot be verified.

## Validation and lifecycle boundaries

The 39 new cases execute the actual builder with synthetic storage/provider fixtures, actual shared math and real jsPDF. Thirty-seven fail against `ec358757`; two controls pass. [Baseline results](validation-2026-10-26/insights-verified-baseline.json). Browser comparisons execute the actual target loops/progress functions for verified eligible inputs; this is not a complete browser-state or DOM test.

| Path | Proven in this packet | Not established |
|---|---|---|
| Add/edit/delete target | Replacing synthetic saved target rows changes/removes the next report's findings; no retained findings leak between builds. | Real UI/API target mutations or provider data changes. |
| Read/list/current values | Exact campaign/platform arguments, required-list failure, absolute targets, priority, near-target misses, fractional conversions, invalid/rate bounds, custom periods, missing/zero/negative spend and legacy fallback. | Every browser loading/stale/failed-state combination or non-primary-property journey. |
| Totals/refresh | Saved source reconciliation preserves EUR 1,400 native + EUR 250 imported = EUR 1,650 and rejects a mismatched financial publication. Existing source/window/report regression cases pass. | New real provider/scheduler/DB lifecycle acceptance; those implementations are unchanged. |
| Report output | Twelve findings, priority order, actual PDF content, complete long title and measured page bounds; final five-page fixture inspected. | Extremely large consolidated configuration messages and full historical/channel recommendation parity. |
| Historic PDFs/email | Existing artifact/publication checks rerun; no history or dispatch code changes. | Fresh browser/scheduled/immutable-artifact source-mix comparison, actual provider acceptance or confirmed inbox delivery. |
| Persisted data | No production records modified. | Inventory or cleanup of previously generated inaccurate reports. Immutable historical PDFs are not regenerated. |

The initial wider run exposed four outdated assertion cases and one outdated scheduler mock. Transaction tests now follow the existing `writeGA4RefreshInputChange` wrapper through its `db.transaction`; text assertions follow existing missing-date/unavailable wording and advisory recommendations. The KPI-window fixture now supplies the existing publication-version read and asserts that version accompanies writes. Its July 30 campaign cutoff and numeric expectations are unchanged. No runtime transaction, reporting-date or KPI-job fix was made to satisfy those tests. Diagnostic packets remain local; the final packet is the acceptance evidence.

Existing committed PDF fixtures are protected by the test runner's `--preserve-artifacts` switch. Re-running their render checks does not rewrite historical evidence. The new five-page PDF is synthetic test output, not a user report.

## Remaining scope — no production sign-off

**V1-085 remains OPEN.** This packet closes the tested current-target/financial omissions, not full Insights parity. Remaining work is scoped KPI/Benchmark history context and failure handling, reconciled channel concentration/recommendations, and the complete browser/server negative-state matrix, including cases where the browser retains last-good content but the scheduled builder refuses the artifact. Recommendations are still intentionally generic in the scheduled target findings. No unverified channel allocation or history is invented.

**V1-015 remains OPEN.** Current browser, scheduled and immutable report artifacts across the offered types/source mixes and real email delivery still require evidence. Provider acceptance is not confirmed delivery. No real email has been sent by this audit.

Batch 7 counts are unchanged: 26 findings with local forward-path evidence, one user-approved local exclusion, two open findings, and all 29 release acceptances open. Batch 6's postponed Google Ads live sign-off and whole-app NO-GO remain unchanged. The next local pass should consolidate the remaining history/channel/report comparisons; deployment and user validation should then use one combined checklist, not separate checks for each internal helper.
