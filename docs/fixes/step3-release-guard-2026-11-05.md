# Step 3: mandatory accuracy checks before release

## Purpose and scope

Use the existing input/calculation, screen/output and source-lifecycle checks as release requirements for the enabled GA4-first app. This includes all six GA4 tabs, the current Campaign Diagnostics sections, reports, alerts and notifications. Preserve the earlier evidence and its limits; this work is not a new unrestricted certification or an assurance that future provider data can never be wrong.

Application baseline: `9744d9a6df2c319890c0a9ebd596ce7400aad67c`. Final isolated change: `2848c6ac01efda0b53a2c02e961fd27b2bd52810`, [pull request 2](https://github.com/CrazySkillz/MF_real_latest/pull/2). It contains five CI/test files only. No application, calculation, schema, dependency, connection, credential, source record or client-data change is included. The three separate test-app runtime fixes are not part of this PR.

## Existing accuracy evidence carried forward

- [Input/calculation matrix](../validation/stage1-completion-2026-11-02/STAGE1_VALUE_MATRIX.md): N1-N9 native scope/traffic/rates/rows, F1-F9 source financials/returns/budget/efficiency, D1-D11 goals/comparisons/insights/diagnostics/alerts/reports.
- [Screen/output matrix](../validation/stage2-outputs-2026-11-02/STAGE2_OUTPUT_MATRIX.md): O1-O18 context, cards, source lists, all row tables, goals, comparisons, Insights, four diagnostic pages, offered and retained exports, saved artifacts and notifications.
- [Lifecycle matrix](../validation/stage3-lifecycle-2026-11-02/STAGE3_LIFECYCLE_MATRIX.md): create/edit/delete, source refresh, exact identity/retry, publication, recovery/ownership, goals/history, alerts and saved reports.

The existing release runner executes all `server/**/*.test.ts` files. It does not select only Overview or KPI tests. The name of the runner is historical. Existing fixture tests assert expected numeric results; other tests establish UI/route wiring, real browser/PDF output and database behavior. Those evidence types remain distinct.

| Required current surface/value family | Existing enforced tests and evidence |
| --- | --- |
| Overview summary, financial formulas and source contributions | `ga4-overview-spend-downstream`, `ga4-kpi-real-path-parity-regression`, source-specific revenue/spend tests, saved-publication tests. A retained numeric example requires revenue 1,000 / spend 250 / conversions 50 to yield ROAS 4, ROI 300 and CPA 5 in goal and Performance Summary consumers. |
| Overview Campaign Breakdown, Conversion Events and Landing Pages | Their `ga4-overview-*-regression` and scheduled-PDF suites cover selected scope, ordering/limits, rows, fractional values, missing data and fallback branches; O4-O6 preserve distinct row/whole-campaign meanings. |
| KPIs | `ga4-kpi-real-path-parity-regression`, UI/browser-state, snapshot, live-value and report-consumer suites cover current values, source sufficiency, targets, direction, progress, history and actual report inputs. |
| Benchmarks | `benchmark-math`, `ga4-benchmark-regression`, real-path parity and summary/Insights tests cover rate versus count tolerances, lower-is-better metrics, missing denominators, targets and downstream current values. |
| Campaign Comparison | `ga4-ad-comparison-card-logic`, accumulation, revenue-breakdown render/PDF and campaign-row tests cover metric-specific rankings, ties, exact mapped amounts and unavailable inputs. The deferred certification-record test is metadata; it does not exempt these value tests. |
| Insights | Executive financials, data-summary accuracy, calendar/trends/findings and target suites cover source contributions, date windows, chart values, unavailable inputs and findings/report consumers. |
| Performance Summary | Performance aggregate/insights/PDF suites and `v1-batch7-metric-boundaries` cover the shared financial/traffic contract, health, actions, denominators and unavailable values. |
| Budget & Financial Analysis | `campaign-financial-analysis-regression`, metric boundaries and campaign-section PDF parity cover source financials, returns, compatible spend, calendar/DST pacing, budget dates and action decisions. |
| Trend Analysis | Trend aggregate/window/overview/anomaly tests and metric boundaries cover current/previous values, exact dates, chart gaps, non-additive meanings and unavailable comparisons. |
| Executive Summary | Executive helper, revenue-history, eligibility, freshness, fail-closed, paid-risk and scheduled-PDF tests cover funnel/trajectory/target/risk values and conditional recommendations. |
| Reports, PDFs, exports and saved artifacts | Goal/report-consumer, browser publication, scheduled builder, custom-window, retained export and real-PostgreSQL report-history tests cover selected values, formatting, dates/currency, missing inputs and immutable artifact ownership. |
| Alerts and notifications | Goal current-value, alert-publication retention, notification visibility/session/concurrency and delivery-status tests cover threshold truth, correct campaign, stale inputs and lifecycle behavior. |
| Adding/changing/removing/refreshing sources | Transaction, exact-source ownership, financial publication, retry browser/route, refresh pipeline, process-recovery and PostgreSQL concurrency tests are included in the same full suite. |

This table maps the existing documented value families to the release suite. The detailed matrices remain authoritative for individual values, negative cases and provider/deployed evidence. This task does not replace those records with a test count, expand them to disabled platforms or claim a new live reconciliation for every client configuration.

## Confirmed enforcement gaps and correction

1. Production `main` was unprotected and had no effective rules. GitHub now requires an up-to-date pull request and the `unit-tests` check from GitHub Actions app 15368, including administrators. No second reviewer is required, avoiding a new two-person dependency for the current workflow. Force pushes and branch deletion are disallowed.
2. Render previously deployed on commit. The live service now uses `autoDeployTrigger=checksPass`. Readback confirmed the same service details and live deploy `dep-dblgd8tbedkc73a9i4ig`; no deployment occurred during that setting change.
3. Seven current GA4 spend/shared-source checks were in the old non-blocking Google Ads list. The correction removes those exact identities from the list: the numeric scheduler materialization case; selected scope, disconnect/reconnect and GA4 OAuth-spend entry cases; and source identity, campaign-scoped disconnect and missing-campaign/spend-only scheduler safety cases. They now become ordinary blocking current tests. Remaining explicit deferred cases stay 21 future-platform, 20 standalone Ads, one comparison certification-record and three certification-document checks. No test is deleted or skipped.
4. TypeScript and the production build are now included in the same required job on the live branch, matching the already-tested hosted branch workflow.
5. The first PR full run reproduced the previously diagnosed CSV test upload race: the wizard replaces its file input while reopening, so direct test upload can populate a detached input and leave Next disabled. The previously validated `2e250e0c` correction is carried forward unchanged into `server/ga4-financial-import-retry-browser.test.ts`: select through the visible file picker. The actual Spend component is identical between the prior validated correction and this baseline. No application fix, extra sleep, skip, weaker assertion or timeout increase is included.

The path is `push/PR -> Tests / unit-tests -> current-version runner -> actual Vitest results -> exact deferred classification -> process exit -> GitHub required check -> Render CI deployment trigger`. The runner already rejects failed/skipped current tests, missing deferred identities, empty/incomplete runs, failed suites without assertion failures and unhandled errors. The correction changes only seven classifications and the validation steps.

## Validation and completion

- Before correction: seven deliberately failed current-spend results were wrongly classified as non-blocking; seven regression cases failed and six existing gate cases passed.
- After correction: 113 focused tests passed across the gate and affected source suites. The seven failed-result cases are now rejected correctly.
- Inventory retention: all 410 test files listed in the November 2 lifecycle baseline still exist in the clean release checkout. 338 match that historical hash; the other 72 reflect subsequent changes and are not being labelled unchanged. Relative to current live baseline `9744d9a6`, this PR changes the gate test and CSV test interaction, plus the three CI/configuration files listed above.
- GitHub/Render settings were read back. GitHub reported PR 2 as blocked while its required checks ran, and kept it blocked after the actual failed CSV run.
- The first PR full run (`42040281023`) finished with 7,286 passing cases and the single CSV test timeout. Its parallel push run passed, matching the previously established intermittent mechanism. Both CSV browser cases pass locally after the carried-forward correction.
- Final head `2848c6ac` passed both [PR validation 42042222343](https://github.com/CrazySkillz/MF_real_latest/actions/runs/42042222343) and [push validation 42042210590](https://github.com/CrazySkillz/MF_real_latest/actions/runs/42042210590), plus the security check. The full suite passed **7,287 tests in 415 files, zero failures/skips**, TypeScript and production build. The separate deferred-selection step passed 45/45 selected tests; its 166 filtered-out assertions are not skipped current-release coverage.
- PR 2 was merged at **15:20 Amsterdam on November 5** as `fc681f59df5865f21058c78d6e1a86d7b740ea35`, with `[skip render]`. The resulting Git tree matches the tested head exactly. This installs CI/test enforcement on the release branch without publishing the three pending application fixes.
- Post-merge verification: live health returned HTTP 200 / `ok=true` on unchanged app revision `9744d9a6`; test health returned HTTP 200 on unchanged `5ed8e816`. Render's live deployment remains `dep-dblgd8tbedkc73a9i4ig`; required GitHub check and admin enforcement remain enabled. Runtime, schema and dependency diffs remain empty.
- Existing operational monitoring remains active. No source refresh, app restart, email send from the application or database operation was performed by the setting changes.

Manual Render deployments and retained-artifact rollback are privileged override paths, not proof that the normal CI gate ran. Use only an exact previously validated revision for an emergency rollback; do not use manual deployment to bypass a failed check. Administrators can deliberately change release settings, so these controls are not described as tamper-proof.

Current configuration behavior was checked against [Render deploys](https://render.com/docs/deploys), [Render service updates](https://api-docs.render.com/reference/update-service), and [GitHub branch protection](https://docs.github.com/en/rest/branches/branch-protection#update-branch-protection).
