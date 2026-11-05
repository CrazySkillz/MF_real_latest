# Live-number monitoring

## Purpose and boundary

Compare published campaign figures with fresh source reads, detect disagreement between saved section inputs, and fail visibly when a comparison cannot be proved. This is monitoring, not a production-readiness certificate or a replacement for the mandatory release tests.

The checker is a standalone process. It does not load application startup, invoke refresh/reprocess endpoints, generate/send reports, update credentials in the database, repair figures, or change customer records. The only application-storage addition is `getLiveNumberCheckSnapshot`, which uses an owner/client-joined, exact campaign hash and a repeatable-read, read-only transaction. The runner also forces every PostgreSQL connection into read-only mode and verifies that setting. Database identity is pinned by hostname/port/database fingerprint.

Before and after each comparison, the runner fingerprints the complete captured campaign inputs. A source edit/deletion, credential update, publication, or other captured change invalidates that run rather than producing a false pass/difference. Running refresh work is not compared. Inputs over 10,000 rows per captured table fail explicitly; they are never silently truncated.

The standalone process restricts fetch to provider read endpoints, Google access-token exchange, and Shopify GraphQL queries; mutations, unknown hosts and redirects are rejected. Google access tokens may be obtained in memory from existing reusable refresh credentials. Rotating Salesforce/HubSpot/Shopify credentials are not renewed by this checker. Service-account authorization continues to use the existing owner/client resource grants. Request deadlines and a 300-request process budget bound provider load. Checks are sequential.

## What is checked

This is a section-level monitoring inventory, not an exhaustive value-by-value certification matrix.

| Surface | Implemented comparison | Explicit remaining boundary |
| --- | --- | --- |
| GA4 Overview | Selected property/campaigns, fixed import start, latest completed date in the campaign timezone, requested currency; provider daily sessions/users/pageviews/conversion credits/revenue/engaged sessions/engagement rate; saved aggregate and campaign rows; landing-page traffic and conversion-event credits | Browser DOM/card formatting is covered by release tests, not this recurring process. Landing-page/event revenue does not retain an explicit currency in old publications and is reported unverified rather than compared across assumed currencies. |
| Financial sources | Active source ownership, currency, materialization grain, duplicate identities; complete saved CSV rows; selected Sheets tab/columns/filter; HubSpot closed-stage mapping and selected date field; Salesforce selected campaign/date/amount/currency; Shopify selected tags/discount codes/UTMs and paid current order totals | CSV comparison validates the uploaded data retained by the app, not an external accounting ledger. CRM legacy imports without recorded daily materialization/query timing are unverified. The partially recorded CRM lower-bound day is excluded explicitly. Google Ads spend, unknown adapters, unsupported field formats and expired/rejected access fail as unverified. Pipeline estimates are not treated as confirmed revenue or independently certified by this check. |
| GA4 KPIs and Benchmarks | Active GA4 `applyTo=all` current values compared with independent arithmetic over the same import-to-date native and financial inputs, including fractional conversion credits | Specific-campaign/custom calculation configurations are unverified; target edits, status/variance badges and historical progress rendering remain release-test responsibilities. No configured KPI/Benchmark is not evidence that its screen was exercised. |
| Campaign Comparison | Fresh provider dimension rows and aggregate against saved publication, keyed by campaign/source/medium/channel/device/country/date; imported campaign scope | Additional browser-side chart transforms and source-specific row attribution are not independently rendered by the monitor. |
| Insights | Fresh provider daily inputs used by Insights, including missing/duplicate date checks | Individual insight text, severity, recommendations, target alignment and calendar rollup rendering are not directly compared in this process. |
| Performance Summary | Independent ROAS/ROI/CPA/conversion-rate arithmetic over saved available inputs | Old `platform_sync` snapshots without `currentValueWindow` are explicitly unverified for source-to-section parity. The runtime route is not called because ordinary GET paths can hydrate/migrate credentials. |
| Budget & Financial Analysis | Saved financial snapshot currency/window/availability and revenue/spend/conversion inputs compared with source records and native publication | Budget pacing, forecast estimates and browser presentation are not newly certified. |
| Trend Analysis | Underlying GA4 daily input reconciliation and date completeness | Trend charts, comparisons, additional daily financial transforms and explanatory text are not directly rendered by the monitor. |
| Executive Summary | Saved daily snapshot's property/campaign filter/window/currency and users/sessions/conversions/revenue/spend/CVR/CPA/ROAS/ROI against the same inputs | Narrative, health recommendations and historical trajectory presentation remain outside direct output checking. |
| GA4 and Campaign Diagnostics reports | Saved artifact ownership, report/snapshot/payload/window consistency and artifact envelope validation; retired definitions remain identifiable | Historical PDFs do not retain the complete original source configuration and value inventory. Numeric PDF contents/source parity are explicitly unverified; a valid artifact envelope is not a number check. No reports are created, regenerated, changed or emailed. |

The GA4 comparisons reuse existing read-only provider query/parsing methods to preserve the application's session/event/UTM attribution definitions. They detect source drift and persistence/propagation differences; they cannot independently detect every common bug in a shared provider parser. Fractional credits use the existing scale-sensitive comparison. Monetary/rate comparisons use their stated display/storage precision, not a blanket percentage tolerance. Saved daily revenue can differ from a whole-window value only within its documented half-cent-per-day storage bound. Whole-window unique users are never equated with summed daily users.

## Result and alert meaning

- `passed`: the checks actually performed agreed. It does not certify untested presentation paths listed above.
- `difference`: a comparable saved/source figure, arithmetic result, row identity, or artifact scope disagreed. Investigate before changing data. Provider values can be revised after the app's publication; a difference alone does not establish an app calculation bug.
- `unverified`: access, scope, metadata, completeness, supported definition, or stable publication was missing. This must not be described as an accurate value or a passing check.
- `not_due`: no number comparison ran in this cron slot.

Both `difference` and `unverified` exit nonzero for the existing Render failure-email mechanism. Logs contain section/check codes, counts and hashed campaign/source/report identities, not credentials, customer names, raw provider responses or financial rows. Availability checks still execute independently if an accuracy check fails.

The proposed combined cron command is `npx tsx scripts/check-hosted-monitors.ts`. Its existing ten-minute schedule is retained. Accuracy checks run only in the 08:20–08:29, 14:20–14:29 and 20:20–20:29 campaign-local windows, after the application's existing refresh grace period. DST is resolved with the configured IANA timezone. Outside those slots the number checker does not query a database/provider. A delayed cron start outside its window does not perform a catch-up check. This scheduling limitation and independent outage detection remain operational boundaries.

The current configuration names the existing three monitored live campaigns and one hosted-test campaign. New campaign enrollment is a separate task and is not silently added here.

## Configuration and rollout

`scripts/live-number-{test,live}-monitor.json` contain only database fingerprints, environment-variable names and approved campaign hashes/timezones. The cron needs separately prefixed database URLs and only the required existing provider/token-encryption configuration from each corresponding app. Never put secret values in these files or log them. Preserve all existing cron variables, notification settings and its ten-minute schedule. The live and test web applications do not need a deployment to run this standalone checker.

One-shot verification: `node --import tsx scripts/check-live-numbers.ts <config-file>`. Add `--scheduled` for normal cron execution. For rollback, restore the former cron command (`npx tsx scripts/check-hosted-health.ts scripts/hosted-test-monitor.json scripts/hosted-live-monitor.json`) and its prior deployment; no database rollback is required.

Do not describe source credentials as valid merely because the app's health check succeeds. Do not automatically delete retired reports, remap legacy sources, renew rotating provider tokens or change formulas to make the monitor pass. Resolve each finding through the existing test → mandatory checks → release workflow.

## Evidence from development on 5 November 2026

- Initial hosted-test source/persistence run: 248 comparisons passed with an unchanged captured-data fingerprint. This preceded the broader saved-section arithmetic checks and is not evidence for those later additions.
- Adding independent saved-section arithmetic detected a ROAS rounding difference in the hosted test's Executive Summary and Performance Summary snapshots (28,501.50 ÷ 100 is displayed as 285.02 to two decimals; those stored snapshots contain 285.01). No data correction was performed.
- The first read-only live run checked the three existing campaign hashes. Native GA4/source inputs matched in the covered paths; legacy CRM query metadata, provider access and historical report evidence were incomplete. Three report snapshots referenced retired report definitions; that is retained history, not proof of a number error or permission to delete it.
- Local validation and rollout receipts will be recorded below after the final revision is tested. The feature must not be represented as active until its exact cron deployment and an actual run are verified.

References: [Google report metadata](https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/ResponseMetaData), [GA4 data freshness](https://support.google.com/analytics/answer/11198161), [Google offline access](https://developers.google.com/identity/protocols/oauth2/web-server#offline), [Render cron jobs](https://render.com/docs/cronjobs).
