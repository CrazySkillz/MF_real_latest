# Live-number monitoring

**Status on 5 November 2026:** the existing Render monitor runs revision `6fb50d18`, with actual handler and GA4 PDF comparisons and corrected memory allocation. The final extension adds the four Diagnostic PDFs and bounded log entries, as detailed below. Its release evidence is recorded in [PR 4](https://github.com/CrazySkillz/MF_real_latest/pull/4). **Coverage remains partial:** unsupported definitions, missing historical evidence and browser-only presentation paths are not certified.

- Active: read-only source reconciliation, supported section calculations and saved-PDF numeric checks; existing Render failure notifications retained.
- Hosted memory correction: `6fb50d18` completed both phases without an OOM kill; the output log exceeded Render's 64 KiB line limit. The final extension fixes this by aggregating passed identities and chunking findings without dropping them.
- Earlier hosted live (`7b29a8e2`): 1,450 matching source/helper checks, zero comparable-number differences, 34 unverified checks. Final expanded hosted results are pending. Missing evidence is not a pass.
- Open: source access, missing historical definitions, unsupported configurations and direct displayed-output coverage identified below. A separate existing provider-refresh warning also needs attention.
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
before app handlers are imported; report generation may make at most ten exact
selected-property GA4 report reads with explicit dates and campaign currency.
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
chart/ranking presentation, narratives/recommendations, forecast/health/trajectory
outputs, arbitrary custom calculations and non-GA4 diagnostic source adapters,
browser-generated PDFs and non-card portions of the four Diagnostic PDFs. Existing release
tests for these paths remain mandatory; they are not a substitute for live numeric
coverage. Historical source definitions that were never recorded cannot be
reconstructed by this extension. Do not describe the full live-number request as
complete on the strength of this extension.

The checker is a standalone process. It does not load application startup, invoke refresh/reprocess endpoints, save/send reports, update credentials in the database, repair figures, or change customer records. The output phase generates temporary PDFs in memory as described above. The only application-storage addition is `getLiveNumberCheckSnapshot`, which uses an owner/client-joined, exact campaign hash and a repeatable-read, read-only transaction. The runner also forces every PostgreSQL connection into read-only mode and verifies that setting. Database identity is pinned by hostname/port/database fingerprint.

Before and after each comparison, the runner fingerprints the complete captured campaign inputs. A source edit/deletion, credential update, publication, or other captured change invalidates that run rather than producing a false pass/difference. Running refresh work is not compared. Inputs over 10,000 rows per captured table fail explicitly; they are never silently truncated.

The standalone process restricts fetch to provider read endpoints, Google access-token exchange, and Shopify GraphQL queries; mutations, unknown hosts and redirects are rejected. Google access tokens may be obtained in memory from existing reusable refresh credentials. Rotating Salesforce/HubSpot/Shopify credentials are not renewed by this checker. Service-account authorization continues to use the existing owner/client resource grants. Request deadlines and a 300-request process budget bound provider load. Checks are sequential.

## What is checked

This is a section-level monitoring inventory, not an exhaustive value-by-value certification matrix.

| Surface | Implemented comparison | Explicit remaining boundary |
| --- | --- | --- |
| GA4 Overview | Selected property/campaigns, fixed import start, latest completed date in the campaign timezone, requested currency; provider daily sessions/users/pageviews/conversion credits/revenue/engaged sessions/engagement rate; saved aggregate and campaign rows; landing-page traffic and conversion-event credits | Browser DOM/card formatting is covered by release tests, not this recurring process. Landing-page/event revenue does not retain an explicit currency in old publications and is reported unverified rather than compared across assumed currencies. |
| Financial sources | Active source ownership, currency, materialization grain, duplicate identities; complete saved CSV rows; selected Sheets tab/columns/filter; HubSpot closed-stage mapping and selected date field; Salesforce selected campaign/date/amount/currency; Shopify selected tags/discount codes/UTMs and paid current order totals; guarded account-currency lookup and saved zero-import handling | CSV comparison validates the uploaded data retained by the app, not an external accounting ledger. Nonzero CRM imports without recorded daily materialization/query timing are unverified. The partially recorded CRM lower-bound day is excluded explicitly. Google Ads spend, unknown adapters, unsupported field formats and expired/rejected access fail as unverified. Pipeline estimates are not treated as confirmed revenue or independently certified by this check. |
| GA4 KPIs and Benchmarks | Active GA4 `applyTo=all` current values compared with independent arithmetic over the same import-to-date native and financial inputs, including fractional conversion credits; existing card/PDF value resolver, target progress and delta calculations | Specific-campaign/custom calculation configurations are unverified; target edits, browser status/variance badges and historical progress rendering remain release-test responsibilities. No configured KPI/Benchmark is not evidence that its screen was exercised. |
| Campaign Comparison | Fresh provider dimension rows and aggregate against saved publication, keyed by campaign/source/medium/channel/device/country/date; imported campaign scope | Additional browser-side chart transforms and source-specific row attribution are not independently rendered by the monitor. |
| Insights | Fresh provider daily inputs, including missing/duplicate date checks; actual daily response rows; existing calendar/monthly rollup helpers against independent arithmetic; generated Insights PDF financial cards | Browser-selected window, individual insight text, severity, recommendations, target alignment and browser rendering are not directly compared. |
| Performance Summary | Independent ROAS/ROI/CPA/conversion-rate arithmetic over saved available inputs; extension compares the real aggregate response, availability, campaign/window and source values | Old `platform_sync` snapshots without `currentValueWindow` remain unverified. Additional paid/custom platform aggregates are not substituted with GA4-only expectations. |
| Budget & Financial Analysis | Saved financial snapshot currency/window/availability and revenue/spend/conversion inputs compared with source records and native publication; configured pacing-calendar day counts | Full budget pacing, forecast estimates and browser presentation are not newly certified. |
| Trend Analysis | Underlying GA4 daily input reconciliation/date completeness; actual Trend response window, property, GA4 daily series and daily financial ratios; existing financial-ratio helper against independent arithmetic | Trend charts, comparative-period presentation, additional daily financial transforms and explanatory text are not directly rendered by the monitor. |
| Executive Summary | Saved snapshot's property/campaign filter/window/currency and core metrics; actual aggregate response and raw metric values against independent inputs | Missing response window/availability evidence is unverified. Narrative, health recommendations and historical trajectory presentation remain outside direct output checking. |
| GA4 and Campaign Diagnostics reports | Saved artifact ownership, report/snapshot/payload/window consistency; saved PDF extraction for supported Overview/Insights/Comparison checks; actual library identities; core numeric cards/target tables in six temporary GA4 PDF variants and core cards in all four Diagnostic PDFs | Historical PDFs lack complete original source definitions. Historical source parity, CPA's conversion basis, native session-key-event-rate numerators, arbitrary custom selections, browser exports and non-card Diagnostic PDF content remain unverified or unchecked. Temporary PDFs are not saved or emailed. |
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
