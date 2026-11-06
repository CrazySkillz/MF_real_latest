# Live-number monitoring

## Browser, PDF and notification extension — 6 November

The remaining static browser/notification coverage warnings are replaced by executable checks. This release extends only the existing Render monitor; neither hosted application is deployed and no customer record is written.

- An isolated Chromium instance renders the actual styled GA4 Overview, KPIs, Benchmarks, Campaign Comparison and Insights components, all four Campaign Diagnostic pages, the Reports library and Notifications. It compares displayed numeric cards, selected target values, individual financial-source amounts, five comparison chart series, daily chart data and narrative window denominators with independently calculated captured inputs. Charts must also render an SVG.
- The actual browser download function generates and parses all five standard GA4 PDFs, a combined custom PDF, and up to twenty saved GA4 definitions. Existing server-generator checks retain the ten GA4/Diagnostic PDF variants and saved Diagnostic definitions. Every unsupported or excess configuration remains unverified.
- Notification checks independently identify missing required alerts, duplicate active alerts, inappropriate alerts after a threshold clears or is disabled, and explicit dismissals. The actual screen's title, campaign, numeric current/threshold values, condition and destination link are checked. Empty lists must render the successful empty state. The real email template is rendered with captured target values while its transport is replaced in the private monitor process; nothing is sent. Delivery audit checks distinguish confirmed delivery from provider acceptance and detect failed/stuck sends.
- Client components use a private fixture identity and an owner-scoped handler replay, not a customer sign-in session. Every browser read goes through the existing read-only boundary. The browser process receives no database/provider credentials; writes, external requests and actual notification reconciliation are blocked. Alert absence is assessed independently rather than creating alerts as part of monitoring.
- Source-list reads require an existing application `SELECT ... FOR SHARE` query. Only that exact single-campaign query is adapted to a plain SELECT in the monitor's private database adapter. PostgreSQL read-only mode, the SQL barrier and before/after capture fingerprints remain mandatory.
- Chromium is installed from the existing locked Playwright dependency by `scripts/install-monitor-browser.cjs`; its launch is verified during the monitor build. The existing 2 GiB plan remains unchanged. The browser has a 384 MiB heap and a three-minute deadline; the full output process has a five-minute deadline and the coordinator eighteen minutes. The existing health checks continue every ten minutes even while an accuracy pass is running. Browser reads are capped at 160 unique scoped requests; selected-property provider reads retain the sixty-read ceiling.

Validation before release: 285 styled-browser checks passed against captured live-campaign responses. A separate synthetic breached-alert fixture exercises the populated notification screen and campaign link without creating any alert. Focused tests cover incorrect values/currency, unavailable versus zero, fractional conversions, weighted conversion rates, missing/duplicate/dismissed alerts, delivery evidence and blocked email transport. Chromium installed and launched successfully on the existing Render monitor in isolated preflight job `job-dbn13fei0phs73d2ivhg`. Final CI and hosted verification receipts are maintained in [PR 4](https://github.com/CrazySkillz/MF_real_latest/pull/4).

**Scope limits and findings remain explicit:** original historical generation inputs that were never retained cannot be reconstructed; unavailable provider access and unsupported custom/source definitions fail visibly. The separately detected app PDF availability/ROAS issues are not repaired by this monitor. Live authentication, arbitrary narrative/forecast semantics and every possible custom configuration are not certified by these checks. A missing prerequisite or failed check is never converted into a passing result. This is monitoring coverage, not a new production-readiness certification.

## Previous release evidence — revision 76fc917a, 6 November

The following records describe earlier releases; their browser/notification implementation gaps are superseded by the extension above.

This update closes the remaining bounded API/report checks in one monitor release:

- Financial comparison responses for 1, 7, 14, 30 and 90 days and the previous calendar month. Checks cover exact dates, stored snapshot identity, currency/timezone, input availability and source identities. Missing snapshots use independently summed complete dated inputs. A historical currency/window mismatch is checked against the actual Trend display rejection guard instead of being confused with a current value.
- Each saved GA4/Diagnostic report configuration is generated temporarily and checked with its selected sections and target IDs. Identical artifacts are reused. GA4 Comparison supports all five chart metrics, including fractional conversions and weighted session key-event rate, plus the native All Campaigns table. Unknown selections and report limits remain unverified.
- Browser rendering/exports, narrative/chart presentation and missing-notification/email coverage gaps now appear explicitly in recurring monitoring receipts. They are not silently absent from the result.

Safety limits remain: read-only database and exact provider/API allowlists, no application deployment, no saved/generated report writes or emails, pinned app revisions and stable capture fingerprints. At most twenty saved report definitions are replayed per campaign; every excess definition receives an unverified finding. The selected-property/date/currency provider ceiling is sixty reads for ten standard variants, six date comparisons and those bounded saved selections; the existing deadlines and compute plan are unchanged.

Local validation exercised the six new comparison responses against the hosted test campaign. The first probe identified a monitor assumption: a connected spend source with no records before the comparison date is unavailable, whereas a recorded zero is available. After tracing `getSpendTotalForRange`, the corrected comparison passed 140 checks on the same captured responses without querying providers again. Six temporary custom PDFs (summary only, four additional chart metrics and All Campaigns) also completed with no new finding or blocked operation; no custom report was saved. Existing ROAS findings remained visible. Final required CI/deployment receipts are linked in [PR 4](https://github.com/CrazySkillz/MF_real_latest/pull/4).

**Outstanding:** authenticated browser rendering and browser exports; narrative/recommendation/chart presentation; missing-notification detection and email contents; unsupported custom metric/source definitions; original historical inputs that were never recorded; credentials unavailable at a run; the separately detected app PDF/ROAS bugs. Exact generation-input retention requires an application change and is not implemented by this monitor-only update. This is a completed bounded monitor update, not completion of every requested live-value path or a new production-readiness certification.

**Status on 6 November 2026:** the 55 findings from revision `50b96f9c` have been investigated. The follow-up extends the existing monitor only; application calculations, records and deployments are unchanged. [PR 4](https://github.com/CrazySkillz/MF_real_latest/pull/4) contains the implementation. **The complete live-number request remains incomplete:** the remaining boundaries below must not be described as passed.

- The original 55: 24 monitor/source-access limitations resolved or evidenced, four missing-spend PDF findings classified as real differences, and 27 historical checks that cannot be reconstructed from the retained artifacts. A newly generated historical report adds three more evidence gaps on 6 November.
- Added: selected-stage CRM Pipeline Proxy, Executive target/status/trajectory responses, budget/pacing PDF values, Overview campaign/event/landing rows, Comparison leaders/default chart labels, individual financial contributors, dated Insights tables, Trend website values and Executive exception values.
- Existing Render failure notifications are retained. Missing evidence continues to fail the monitor; it is never silently waived.
- Open: historical provenance, the detected app PDF availability issue, the existing test ROAS issue, and the explicitly unimplemented output/configuration paths below. See the dated evidence sections for deployment-specific results.
- Application releases/settings and customer records were not changed by this monitoring extension.

## Purpose and boundary

Compare published campaign figures with fresh source reads, detect disagreement between saved section inputs, and fail visibly when a comparison cannot be proved. This is monitoring, not a production-readiness certificate or a replacement for the mandatory release tests.

## Actual-output extension

`scripts/check-live-number-outputs.ts` runs the existing application handlers in a
private child process. Its loopback listener accepts only exact allowlisted GETs
with a random per-run capability. Its temporary actor is the owner of the already
validated campaign/client; this does not add authentication to either deployed app.
The runner checks the real app's `/api/health` commit before and after replay.
The reviewed live and test runtime files match this checkout; their only storage
difference is the operator-only capture method. After an app release, reconcile
the monitor checkout with that release before updating the pinned commit. A stale
pin fails visibly rather than claiming the old handlers tested a new app.

New comparisons cover:

- Real Overview totals and dates; native totals, Campaign Comparison, landing-page
  and conversion-event rows; Insights daily rows, including row identities.
- Revenue/spend totals and source-list contributions; KPI/Benchmark current and
  target values and campaign boundaries; report-library identities.
- Performance and Executive aggregate values/availability, Executive metric
  fields, published financial inputs, configured budget-period spend, Trend daily
  inputs and daily financial ratios, and visible alert values/links.
- Newly generated scheduled GA4 Overview, KPI, Benchmark, Comparison, Insights and
  a combined Overview/KPI/Benchmark custom PDF. The monitor checks actual extracted
  core numeric cards and target tables against captured inputs. PDFs exist only in
  memory and are never saved, added to the library or emailed. This is not coverage
  of every custom selection or every sentence/chart in those PDFs.
- Core numeric cards in the existing Performance Summary, Budget & Financial
  Analysis, Trend Analysis and Executive Summary PDF generators. Comparisons use
  independent captured-input totals, each displayed precision and the campaign
  currency. Additional non-GA4 diagnostic sources fail closed. Unsupported chart,
  forecast, narrative and exception-table values are not certified by card checks.

All DB connections retain PostgreSQL read-only mode. A second SQL barrier rejects
writes, guard changes and multiple statements. Raw SDK HTTP is blocked. The existing
Google service-account helper may obtain an in-memory `analytics.readonly` token
before app handlers are imported; report generation may make at most twenty exact
selected-property GA4 report reads with explicit dates and campaign currency
(the follow-up raises the bounded allowance from ten to twenty after observing
thirteen legitimate reads across the report variants).
Provider writes, rotating-token renewal and email sending remain blocked. Captured
inputs must be identical before/after; failures, blocked operations and deadline
expiry are unverified and make the existing Render monitor exit unsuccessfully.
The child has a three-minute deadline, response/output size bounds and redacted
receipts. No new dependency, application route, schema or calculation is introduced.

Hosted capacity correction: the first output-enabled test job on `4117936f`
(`job-dbmfc9d6e07s73c56n6g`) exceeded the existing 512 MiB limit. Render's
`job_run_ended` event explicitly reported an OOM kill at 21:34:57 UTC. The source
checker had retained its database/PDF dependencies while starting the full handler
replay. `check-live-number-run.ts` now coordinates separate phases and waits for
the source process to exit before starting any replay. Only redacted receipts and
input fingerprints cross the boundary. The replay requires the same fingerprint
at both its start and end, preserving source-to-output consistency. A standalone
replay with a 512 MiB V8 heap completed 647 comparisons and peaked at 616 MiB RSS;
192/256 MiB heaps failed. The release therefore requires the existing cron's
2 GiB `1c-2g` compute plan, plus the sequential phases and 512 MiB replay heap.
This changes monitoring capacity only. No application or database setting changes.
Render bills this cron size at $0.00058 per running minute, prorated by second,
with a $1 monthly minimum ([pricing](https://render.com/pricing),
[cron billing](https://render.com/docs/cronjobs)).

Local validation: 121 focused tests passed, including deliberately corrupted API
and PDF numbers, source identity duplication, target/campaign mismatch, wrong alert
links, budget-period mistakes, and SQL/network boundary rejection. Read-only live
probes returned unchanged capture fingerprints for all three enrolled campaigns:
2,691 matching output checks and 11 unverified checks, with no numeric differences
detected by this output phase. The unverified checks concern the Executive
response's missing source-window metadata and raw unavailable-value basis.
The test campaign's existing ROAS discrepancy also appears in actual aggregate
responses and the newly generated Insights and Financial Analysis PDFs. No rounding
correction is included. The ten-PDF local probe completed with 676 matching output
checks and five ROAS differences; its captured inputs remained unchanged. Trend's
existing comparison path attempted Google credential renewal and remained
unverified when the monitor blocked it. This is not proof of a failed app connection.

The publication-version reader uses three exact bounded `SET LOCAL` timeout
statements. The output guard now allows those statements; PostgreSQL read-only
mode and mutation/guard-change rejection remain enforced. Tests reject unlimited
timeouts, altered read-only settings and appended statements. Credential renewal
with persistence remains blocked. No diagnostic-generated report is saved or sent.

Passing output checks are grouped by section/code with their original counts.
Every non-passing subject hash is retained. Output records contain at most 64 groups
and numbered `part`/`parts` fields, avoiding the hosted 64 KiB log-line truncation
observed on `6fb50d18`. Tests verify all 200 synthetic failure subjects survive
chunking and that passing-row compaction preserves the comparison count.

Still outside direct recurring output comparison: authenticated browser DOM,
browser chart/selector presentation, narratives/recommendations and risk explanations,
arbitrary custom calculations and non-GA4 diagnostic source adapters,
browser-generated PDFs, browser presentation of financial comparison fallbacks,
unsupported trajectory fallback configurations and unimplemented non-card Diagnostic PDF fields. Existing release
tests for these paths remain mandatory; they are not a substitute for live numeric
coverage. The follow-up now checks current target health, compatible saved revenue
trajectory, default Comparison PDF leaders/chart labels and the detailed PDF fields
listed above. This is not coverage of all rendered values. Historical source definitions that were never recorded cannot be
reconstructed by this extension. Do not describe the full live-number request as
complete on the strength of this extension.

The checker is a standalone process. It does not load application startup, invoke refresh/reprocess endpoints, save/send reports, update credentials in the database, repair figures, or change customer records. The output phase generates temporary PDFs in memory as described above. The only application-storage addition is `getLiveNumberCheckSnapshot`, which uses an owner/client-joined, exact campaign hash and a repeatable-read, read-only transaction. The runner also forces every PostgreSQL connection into read-only mode and verifies that setting. Database identity is pinned by hostname/port/database fingerprint.

Before and after each comparison, the runner fingerprints the complete captured campaign inputs. A source edit/deletion, credential update, publication, or other captured change invalidates that run rather than producing a false pass/difference. Running refresh work is not compared. Inputs over 10,000 rows per captured table fail explicitly; they are never silently truncated.

The standalone process restricts fetch to provider read endpoints, Google access-token exchange, and Shopify GraphQL queries; mutations, unknown hosts and redirects are rejected. Google access tokens may be obtained in memory from existing reusable refresh credentials. Rotating Salesforce/HubSpot/Shopify credentials are not renewed by this checker. Service-account authorization continues to use the existing owner/client resource grants. Request deadlines and a 300-request process budget bound provider load. Checks are sequential.

## What is checked

This is a section-level monitoring inventory, not an exhaustive value-by-value certification matrix.

| Surface | Implemented comparison | Explicit remaining boundary |
| --- | --- | --- |
| GA4 Overview | Selected property/campaigns, fixed dates/timezone/currency; fresh provider daily and campaign metrics; actual handler rows; generated campaign allocation, fractional event credits and landing-page rows | Browser DOM is not directly checked. Landing/event revenue fields are internal unused fields with no rendered column; their absent legacy currency is not a visible-value gap. Native and imported financial revenue remain separately checked. |
| Financial sources | Active ownership/currency/grain/duplicate checks; retained CSV rows; selected Sheets tab/columns/filter; HubSpot and Salesforce selected stage/campaign/date/amount/currency; Shopify selected paid order totals; guarded currency lookup and saved zero-import handling; separate current-stage Pipeline Proxy provider/response totals | CSV verifies retained uploads, not an external ledger. Nonzero CRM imports without recorded daily/query evidence and partially recorded lower-bound days remain limited. Google Ads spend, unknown adapters, unsupported fields and expired access fail unverified. Pipeline is never substituted for confirmed revenue. |
| GA4 KPIs and Benchmarks | Active GA4 `applyTo=all` current values compared with independent arithmetic over the same import-to-date native and financial inputs, including fractional conversion credits; existing card/PDF value resolver, target progress and delta calculations | Specific-campaign/custom calculation configurations are unverified; target edits, browser status/variance badges and historical progress rendering remain release-test responsibilities. No configured KPI/Benchmark is not evidence that its screen was exercised. |
| Campaign Comparison | Fresh dimension rows and aggregate against publication; exact imported campaign allocation; default generated PDF leaders, campaign count, total Sessions and top-ten Sessions chart labels | Browser chart/metric selector variants are not directly rendered. Truncated/ambiguous extracted rows cannot prove the complete underlying label. |
| Insights | Fresh daily inputs/date coverage; actual daily response; calendar/monthly rollups against independent arithmetic; generated financial cards, Data Summary and every dated default Trend Table row | Browser-selected windows, insight text, severity, recommendations and target alignment are not directly compared. |
| Performance Summary | Independent ROAS/ROI/CPA/conversion-rate arithmetic over saved available inputs; extension compares the real aggregate response, availability, campaign/window and source values | Old `platform_sync` snapshots without `currentValueWindow` remain unverified. Additional paid/custom platform aggregates are not substituted with GA4-only expectations. |
| Budget & Financial Analysis | Snapshot currency/window/availability and inputs; configured period spend; generated budget, used/remaining/utilization, daily burn/target/status and source contribution amounts; exact-date comparison responses and dated fallback inputs | Browser presentation and any separately configured estimate are not newly certified. |
| Trend Analysis | Underlying GA4 daily input reconciliation/date completeness; actual Trend response window, property, GA4 daily series and daily financial ratios; existing financial-ratio helper against independent arithmetic | Trend charts, comparative-period presentation, additional daily financial transforms and explanatory text are not directly rendered by the monitor. |
| Executive Summary | Snapshot scope and core metrics; actual outcome response consumed by the page; legacy zero-sentinel availability guard; KPI/Benchmark current/target/status/progress; seven-day trajectory arithmetic/band, including complete dated revenue reconstruction after source changes and the native-GA4 financial fallback; generated exception names/status/values | Missing/incomplete history and unsupported fallback evidence remain unverified. Narrative/risk/recommendation text and browser presentation are not directly checked. |
| GA4 and Campaign Diagnostics reports | Saved artifact scope/window checks; supported historical PDF arithmetic; actual library identities; ten temporary PDF variants including core cards, target tables and the detailed fields listed above | Historical source definitions/CPA conversion basis/session-rate basis cannot be reconstructed. Arbitrary custom selections, browser exports and remaining non-card narrative/comparison content are unchecked. Temporary PDFs are never saved or emailed. |
| Alerts and notifications | Related supported KPI/Benchmark current values; threshold-decision and unavailable-input suppression helpers; extension checks returned visible alert current value, threshold, breached condition, target identity and destination | Creation, missing-notification detection, historical breach context and delivered email contents remain outside this read-only replay. |

The GA4 comparisons reuse existing read-only provider query/parsing methods to preserve the application's session/event/UTM attribution definitions. They detect source drift and persistence/propagation differences; they cannot independently detect every common bug in a shared provider parser. Fractional credits use the existing scale-sensitive comparison. Monetary/rate comparisons use their stated display/storage precision, not a blanket percentage tolerance. Saved daily revenue can differ from a whole-window value only within its documented half-cent-per-day storage bound. Whole-window unique users are never equated with summed daily users.

## Result and alert meaning

- `passed`: the checks actually performed agreed. It does not certify untested presentation paths listed above.
- `difference`: a comparable saved/source figure, arithmetic result, row identity, or artifact scope disagreed. Investigate before changing data. Provider values can be revised after the app's publication; a difference alone does not establish an app calculation bug.
- `unverified`: access, scope, metadata, completeness, supported definition, or stable publication was missing. This must not be described as an accurate value or a passing check.
- `not_due`: no number comparison ran in this cron slot.

Both `difference` and `unverified` exit nonzero for the existing Render failure-email mechanism. Logs contain section/check codes, counts and hashed campaign/source/report identities, not credentials, customer names, raw provider responses or financial rows. Availability checks still execute independently if an accuracy check fails. Each standalone accuracy process has a ten-minute hard deadline, including provider-library authentication calls; a deadline exit reports unverified and releases its read-only database connections when the process ends.

The deployed combined cron command is `node --import tsx scripts/check-hosted-monitors.ts`. Its existing ten-minute schedule is retained. Accuracy checks run only in the 08:20–08:29, 14:20–14:29 and 20:20–20:29 campaign-local windows, after the application's existing refresh grace period. DST is resolved with the configured IANA timezone. Outside those slots the number checker does not query a database/provider. A delayed cron start outside its window does not perform a catch-up check. This scheduling limitation and independent outage detection remain operational boundaries.

The current configuration names the existing three monitored live campaigns and one hosted-test campaign. New campaign enrollment is a separate task and is not silently added here.

## Configuration and rollout

`scripts/live-number-{test,live}-monitor.json` contain only database fingerprints, environment-variable names and approved campaign hashes/timezones. The cron needs separately prefixed database URLs and only the required existing provider/token-encryption configuration from each corresponding app. Never put secret values in these files or log them. Preserve all existing cron variables, notification settings and its ten-minute schedule. The live and test web applications do not need a deployment to run this standalone checker.

One-shot verification: `node --import tsx scripts/check-live-number-run.ts <config-file>`. This runs source and output phases sequentially. Add `--scheduled` for normal cron execution. `check-live-numbers.ts` alone runs only the source phase. To roll back this extension, redeploy monitor commit `7b29a8e29cb6db7d242cd2d5e224a4e96ec0d4e9` with the same combined command and existing configuration. That retains the previous source/saved-PDF checks. No database rollback is required. An incident rollback was not performed during this activation.

Do not describe source credentials as valid merely because the app's health check succeeds. Do not automatically delete retired reports, remap legacy sources, renew rotating provider tokens or change formulas to make the monitor pass. Resolve each finding through the existing test → mandatory checks → release workflow.

## Evidence from development on 5 November 2026

- Initial hosted-test source/persistence run: 248 comparisons passed with an unchanged captured-data fingerprint. This preceded the broader saved-section arithmetic checks and is not evidence for those later additions.
- Adding independent saved-section arithmetic detected a ROAS rounding difference in the hosted test's Executive Summary and Performance Summary snapshots (28,501.50 ÷ 100 is displayed as 285.02 to two decimals; those stored snapshots contain 285.01). No data correction was performed.
- The first read-only live run checked the three existing campaign hashes. Native GA4/source inputs matched in the covered paths; legacy CRM query metadata, provider access and historical report evidence were incomplete. Three report snapshots referenced retired report definitions; that is retained history, not proof of a number error or permission to delete it.
- Final targeted validation: 44 new checker tests and 39 existing monitor tests passed. Required [branch CI](https://github.com/CrazySkillz/MF_real_latest/actions/runs/42083823938) and [PR CI](https://github.com/CrazySkillz/MF_real_latest/actions/runs/42083832982) both passed on `c1856e539dbf707ed42e696dfc4dc5159df45f34`. The branch run passed TypeScript, build, the existing release gate, and 7,453 current-version tests in 418 files. The separate deferred-source step remained non-blocking and reported 45 passed / 166 skipped; no exclusion was added.

## Initial hosted activation evidence (`c1856e53`)

- Existing service: [Render monitor](https://dashboard.render.com/cron/crn-dbm6oql6e07s73bar4eg). Deployment `dep-dbmcpejl550s739f3u3g` became live at 18:37:35 UTC on 5 November. Only its branch/command and separately prefixed read-access configuration were changed. Automatic monitor deployment remains off. Code is retained in [draft PR 4](https://github.com/CrazySkillz/MF_real_latest/pull/4); no live-app merge/deployment was performed.
- Hosted test job `job-dbmcr16k1f9s73bbun4g`: 258 matching comparisons, two ROAS differences in saved Executive Summary/Performance Summary values, and two unverified checks. Its nonzero result is expected and confirms that those findings are not treated as passes.
- Hosted live job `job-dbmcs13l550s739fcj7g`: 1,139 matching comparisons and 24 unverified checks across the three configured campaigns, with no comparable-number difference reported. Breakdown: `b85505d40a0a` 494 matched / 9 unverified; `de4775c3b435` 349 / 10; `156b23ba019e` 296 / 5. Missing reporting-window/currency/history evidence, unavailable HubSpot/Salesforce credentials, and rejected Shopify scope access prevent full verification. A healthy app connection cannot be inferred from these monitor credentials, or vice versa.
- Each returned comparison retained an unchanged before/after captured-data fingerprint. PostgreSQL read-only mode was verified by the runner. The test/live applications, their deployed revisions, configuration and environment-variable hashes were unchanged at the final 18:47:47 UTC readback. Live remains `706a7bac`; hosted test remains `5ed8e816`.
- Combined cron run `crn-dbm6oql6e07s73bar4eg-1793904185` finished successfully at 18:44:02 UTC: both availability/refresh checks passed, and both accuracy children correctly returned `not_due` outside their configured slots. The source-query executions above were separate hosted one-shot verifications; they do not prove a natural scheduled number run has occurred yet.
- Failure notifications remain enabled and all former monitor variables were preserved. The existing Render failure-email mechanism was inbox-verified earlier by the user. A new finding email's actual inbox arrival and the first natural accuracy slot were not verified during this activation. Persistent unverified findings will continue to produce failure status at accuracy slots until resolved; do not suppress them merely to make the monitor green.
- Redacted local receipts: `.local-test/live-number-hosted-test-receipt.json`, `.local-test/live-number-hosted-live-receipt.json`, `.local-test/live-number-rollout.json` and `.local-test/live-number-ci.json`. These contain no database URLs, provider tokens or source financial rows.

## Remaining work in the live-number request

### Continuation on 5 November (`7b29a8e2`)

The checker now also exercises the existing pure KPI/Benchmark card and PDF value
resolver, target progress/delta arithmetic, Insights calendar/monthly rollups,
Trend financial ratios, budget calendar day counts, and alert threshold/suppression
calculations against independent arithmetic over captured live inputs. This is
calculation coverage, not proof of the HTTP response, browser join, chart rendering,
notification delivery or narrative generated by each caller.

Saved PDF bytes are parsed with the existing `pdf-parse` dependency. Supported
numeric checks cover Overview Summary conversion rate and financial Profit/ROAS/ROI,
Insights revenue card/table agreement, and Campaign Comparison revenue-source sums.
Ownership/report/type/window consistency is required before parsing; count, bytes,
pages and extracted text are bounded. PDFs are not regenerated or changed. An
ambiguous label, mixed currency, unsupported layout or missing historical basis is
unverified. Printed-money rounding bounds prevent a half-cent input ambiguity from
being reported as a proved financial discrepancy.

GA4 campaign-table conversion rate is the native **session key-event rate**, not
key-event count divided by sessions. The monitor now compares that provider field
directly in current publication rows; old PDFs lack its numerator and remain
unverified for this column. The preliminary PDF count/session comparison was
rejected during local validation and was never deployed. CPA's historical
conversion-window basis is also not assumed. Historic source parity remains open.

CRM currency reads now follow the existing app semantics: missing HubSpot deal
currency is checked against authenticated account details; a Salesforce query may
omit the unavailable Opportunity currency field only after an exact missing-field
response and a verified single-currency organization response. The fetch guard
permits only the exact existing read-only SOAP `getUserInfo` envelope; mutations,
other SOAP calls and credential renewal remain blocked. Relevant provider reference:
[Salesforce getUserInfo](https://developer.salesforce.com/docs/platform/api/guide/sforce-api-calls-getuserinfo.html).

Focused validation at this continuation: 70 tests passed, including deliberate
corruption of the actual Insights, KPI, Trend and alert helper outputs, genuine
stored-PDF extraction, currency mismatch/multi-currency rejection, and mutation
blocking. Required [branch CI](https://github.com/CrazySkillz/MF_real_latest/actions/runs/42098669168)
and [PR CI](https://github.com/CrazySkillz/MF_real_latest/actions/runs/42098678972)
passed on `7b29a8e29cb6db7d242cd2d5e224a4e96ec0d4e9`: TypeScript, build,
release gate, and 7,479 current-version tests in 419 files. The existing separate,
non-blocking deferred-source step reported 45 passed / 166 skipped; no exclusions
were added. The coverage table above now includes this extension's explicit checks.

The existing monitor deployment `dep-dbme4js9v7es73cp3nf0` became live at
20:09:36 UTC. No environment variables were added or changed. At 20:10:32 UTC,
readback confirmed the monitor configuration and unchanged application revisions,
configuration and environment hashes; this was confirmed again at 20:19:38 UTC.

Hosted execution on that exact revision:

| Run | Matching | Differences | Unverified | Result |
| --- | ---: | ---: | ---: | --- |
| Test `job-dbme5i8u01pc73a9u2h0` | 342 | 2 | 2 | Finished 20:12:33 UTC; nonzero exit for the saved ROAS findings and missing evidence |
| Live `job-dbme6qp5efls73a919m0` | 1,450 | 0 | 34 | Finished 20:16:55 UTC; nonzero exit for missing evidence/access |

Live campaign breakdown: `b85505d40a0a` 619 matched / 21 unverified;
`de4775c3b435` 444 / 9; `156b23ba019e` 387 / 4. Actual saved PDF extraction
ran on Render. The empty Salesforce import was compared successfully. Three
HubSpot sources lacked a usable unexpired access token at this late one-shot run;
Shopify access/scope could not be verified for one source. These are not evidence
that reconnection is required: the monitor deliberately does not renew credentials,
and an application's next normal refresh can change their availability. Historical
report definitions, conversion-event currency and saved Performance Summary window
evidence remain incomplete. Every returned check retained an unchanged before/after
captured-input fingerprint. Receipts are in
`.local-test/live-number-hosted-{test,live}-extension-receipt.json`.

The natural 21:10 Amsterdam operational run continued to check both applications:
test health passed; live health reported `RECORDED_JOB_FAILURE`; accuracy correctly
returned `not_due`. This live warning predates the extension's 20:09 UTC deployment:
the app's own 20:02:03–20:03:34 UTC provider refresh attempted five jobs and none
succeeded. Logs identify four HubSpot mapping requests with no usable access/refresh
token across `ga4_ga` (`7d54956576d4`) and `ga4_no_rev` (`2fbf15cb66be`), plus a
stale Salesforce revenue source in `ga4_test` (`8953c822705f`). Read-only SQL
confirmed these three active campaigns have no client ID; they are outside the
three enrolled live-number campaigns. The GA4 daily scheduler itself reported
success and no error. No records were deleted, mappings rewritten or warning
suppressed. These additional campaigns were not part of the earlier five-campaign
cleanup; any cleanup needs its own exact ownership/dependency review. The underlying
stale Salesforce mapping was not traced further or repaired in this monitoring task.

The existing Render failure-email path remains enabled and was inbox-verified
earlier. Delivery of this extension's particular emails has not been inbox-verified.

The earlier revision's natural 20:20 Amsterdam run was also observed: the test
campaign reported 258 matches / 2 differences / 2 unverified checks; the three live
campaigns reported 1,140 matches / 23 unverified checks. This proves a natural
hosted accuracy slot occurred, but is not evidence for the later extension's checks.

The three earlier `CRM_SAVED_QUERY_WINDOW_UNVERIFIED` findings were traced further:
the current HubSpot/Salesforce importers intentionally store `dailyMaterialization:
null` when their dated revenue map is empty (`routes-oauth.ts` revenue mapping
construction). All three inspected sources have a saved zero total and only a
zero materialized record. The original monitor incorrectly required a dated-map
marker even for this case. The extension permits this exception only with an
explicit zero total, nonempty all-zero campaign/currency-checked records, saved
selection/date/window configuration and a fresh complete provider query. A nonzero
undated import remains unverified; conversion-value modes are not silently treated
as native revenue. No source mapping or customer record was repaired or rewritten.

1. Resolve the exact source-access and saved-query-evidence gaps reported above without automatically renewing rotating credentials or rewriting source records. Historical evidence that cannot be reconstructed must stay unverified.
2. Extend direct numeric checks to the currently unimplemented displayed-section/PDF/alert outputs and unsupported calculation/source configurations listed in the coverage table. Existing input checks and release tests are not a substitute for that direct output coverage.

**Separate accuracy finding:** the saved ROAS discrepancy requires its own investigation and correction through the test/release workflow. This monitoring change detected it and did not repair it. Other reporting/rounding paths have not been certified by that finding.

Automatic enrollment of new campaigns, Sentry and independent outage monitoring remain separate tasks. Do not mark the complete live-number request finished on the strength of this partial installation.

References: [Google report metadata](https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/ResponseMetaData), [GA4 data freshness](https://support.google.com/analytics/answer/11198161), [Google offline access](https://developers.google.com/identity/protocols/oauth2/web-server#offline), [Render cron jobs](https://render.com/docs/cronjobs).

## Follow-up investigation — 6 November

The original 55 findings are accounted for as follows. These counts describe the
original receipt, not the number of current findings after more reports are saved.

| Original checks | Count | Evidence and disposition |
| --- | ---: | --- |
| Executive response window and unavailable legacy fields | 11 | The current page consumes outcome totals/window and availability. The monitor now checks that actual input and the legacy zero sentinel together; a missing display guard is a difference. |
| Conversion-event unused revenue currency | 3 | No revenue column is rendered in the current event/landing tables. Counts and rates remain source-checked; financial revenue retains its currency checks. |
| Trend credential renewal and blocked auxiliary operation | 4 | Expired stored Google tokens caused the app helper to attempt persistence. The isolated monitor supplies a refreshed Google token in memory to the same bounded read only. The actual Trend PDF completed without a write attempt. |
| CRM access / Shopify scope | 6 | All six source checks passed in the natural 6 November 14:20 Amsterdam run. An expired token during a later off-slot run is a new observation, not proof that reconnecting is required. |
| Performance/Executive PDF missing Spend basis | 4 | Real differences: two no-spend campaigns render zero in both PDFs. `campaign-current-values.ts` treats a fulfilled empty spend query as available; `report-scheduler.ts` propagates that flag. The monitor now distinguishes missing data from numeric zero. App code was not changed. |
| Latest legacy Performance snapshot window | 3 | Retained `platform_sync` payloads contain no exact `currentValueWindow`. Current response correctness cannot retroactively prove their original window. |
| Historical reports: settings, CPA basis, session-rate basis, retired definitions | 24 | Original payloads lack source settings/conversion basis; three retired reports have no usable original definition. Current mappings cannot be substituted for historical mappings. Artifacts were preserved. |

Historical source parity remains unverified: 27 original checks plus three checks
for one additional report generated on 6 November. Preventing new provenance gaps
requires a separate application change that captures the exact generation inputs
with the saved artifact. Re-fetching current settings after PDF generation would
not prove its inputs and is not implemented as a shortcut here.

Follow-up validation before hosted release: TypeScript passed and 151 focused
tests passed. Deliberately wrong rates, currency, stage, campaign, source amounts,
duplicate/truncated provider pages, campaign cent allocation, target status,
trajectory boundaries, tiny nonzero conversion credits and SQL/network mutations are covered. A captured live
campaign completed 1,267 output/PDF comparisons with no finding; its pipeline
response was captured from the real read-only handler. This does not prove fresh
pipeline provider parity when its credential is expired. The full run exposed a
ten-read ceiling (thirteen legitimate calls) and Insights history starting at
campaign creation; both monitor assumptions were corrected. Source-change
trajectory reconstruction now checks both independently summed cutoffs and exact
source identities, and rejects incomplete history. Hosted test verification then
identified a missing Executive-snapshot fallback; a targeted follow-up checks
native-GA4-only revenue from complete dated records against the same seven-day
cutoff without manufacturing a saved snapshot. Its captured test data passed, and
all 63 output-check tests passed. Imported-source or incomplete history cannot use
this exception. Final source/output and
hosted results are retained in `.local-test/phased-number-live-result.json` and
the rollout/hosted receipts, with no raw credentials in checked-in documentation.

Only monitor files and this evidence document are changed. App/DB settings,
scheduled refreshes, credentials in storage, campaign data and saved reports are
unchanged. The forward PDF availability bug and previously detected test ROAS
rounding bug remain separate application corrections. No section is newly
certified production-ready by this monitoring work.

## Final hosted verification — 5 November, 22:46 UTC

Runtime revision `50b96f9c06fe4c6a787355b004d78e4d706dd3f2` became live in
monitor deployment `dep-dbmg8id9el5s738kqkp0` at 22:34:38 UTC. Both required
[branch CI](https://github.com/CrazySkillz/MF_real_latest/actions/runs/42120928335)
and [PR CI](https://github.com/CrazySkillz/MF_real_latest/actions/runs/42120935253)
passed TypeScript, build, the release gate and 7,530 current-version tests in 421
files. The separate existing deferred-source step retained 45 passed / 166 skipped;
no exclusion was added. Focused monitoring tests: 121 passed.

| Hosted target | Matches | Differences | Unverified | Complete output log |
| --- | ---: | ---: | ---: | --- |
| Test `2e353d874c51` | 1,018 | 7 | 5 | Yes |
| Live `b85505d40a0a` | 1,776 | 0 | 22 | Yes, 4 output parts |
| Live `de4775c3b435` | 1,309 | 0 | 19 | Yes, 3 output parts |
| Live `156b23ba019e` | 1,140 | 0 | 14 | Yes, 3 output parts |

Test job `job-dbmg9h3ncjis73adplq0` finished at 22:37:15 UTC. Live job
`job-dbmgase417fc739ndt0g` finished at 22:45:48 UTC. Their nonzero exit reflects
the findings and unverified checks; neither run was an OOM failure. Test source
phase: 342 matches / 2 ROAS differences / 2 unverified; output phase: 676 / 5 / 3.
Live source phases: 1,448 matches / 36 unverified; output phases: 2,777 / 19.
No comparable live numeric discrepancy was found in those performed checks.

All source captures retained stable before/after fingerprints, and all output
replays accepted the same source fingerprints and completed their read-only guards.
No mutation attempt was observed in the final output receipts. No malformed or
truncated JSON record remained: the longest test line was 12,482 characters and
the longest live line was 20,331. Output part counts and distinct part indices
matched for all four campaigns.

The 55 live unverified checks are explicit: missing historical source/query or
conversion/currency evidence, retired report definitions, unavailable HubSpot or
Salesforce credentials, unverified Shopify scope, missing Executive window or
unavailable-value basis, two campaigns' ambiguous unavailable Spend cards in the
Performance/Executive PDFs, and blocked Trend credential-renewal paths. A late
one-shot credential result does not prove that the app requires reconnection;
normal scheduled refresh may change token availability. No credentials were
renewed with persistence, source records rewritten, formulas changed or historical
reports deleted to make a check pass. The seven test differences are occurrences
of the same previously identified ROAS discrepancy, including the Financial
Analysis PDF; correcting that app behavior is separate from this monitor release.

At 22:46:57 UTC, readback confirmed unchanged application deployments, configuration
and original environment-variable hashes: live `706a7bac`, test `5ed8e816`.
Only the monitor was released. Its schedule remains every ten minutes, with number
checks restricted to the three campaign-local accuracy slots. Its 2 GiB plan and
failure notifications remain enabled. The natural 22:40 UTC run checked test
health successfully, retained the existing live `RECORDED_JOB_FAILURE` warning,
and correctly returned `not_due` for both number configurations. A natural accuracy
slot on this final revision has not yet been observed; the one-shot executions
above exercised its full comparison phases. The existing email channel was
inbox-verified earlier; receipt of these particular finding emails was not verified.

Redacted evidence: `.local-test/live-number-hosted-{test,live}-final-receipt.json`,
`.local-test/live-number-rollout.json`, `.local-test/live-number-ci.json` and
the corresponding hosted CI logs. The scope boundaries in the table and
actual-output section above still apply. This record does not certify untested
browser rendering, narratives, forecasts or arbitrary source/custom configurations.
