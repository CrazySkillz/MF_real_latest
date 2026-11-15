# Native GA4 values in downstream outputs — 15 November 2026

Scope: the seven differences recorded by monitor job job-dbsv9bbl550s739jeh5g after the previous Overview correction. Test deployment only; no production writes, refresh or release authorized in this task.

## Root causes and localized correction

- Diagnostics' GA4 revenue payload and Executive Summary reused rounded daily revenue instead of the saved exact-period GA4 total. Diagnostics now uses its already-certified financial inputs; Executive Summary uses the saved total only when its validated property and period match. Missing/non-finite current-period Executive revenue fails closed; other reporting periods keep their existing behavior. The shared traffic reader remains unchanged, so traffic-only KPIs do not acquire a financial-data dependency.
- Performance and Executive aggregates recalculated Conversion Rate from event counts / Sessions. For GA4 they now consume the saved native sessionKeyEventRate (percentage), including true zero, and show unavailable if it is missing/invalid. Non-GA4 calculations are unchanged.
- Outcome and Executive route adapters, and the scheduler adapter, now propagate that native rate. Financial-analysis PDF uses the same certified Outcome aggregate; its rendering/calculation code is unchanged.

Runtime files: server/utils/performance-summary-aggregate.ts, server/routes-oauth.ts, server/scheduler.ts. No schema, import, schedule, attribution or source-selection changes.

## Evidence and required checks

Recorded real GA4 requests/responses: server/fixtures/ga4-native-values-real-2026-11-15.json. Scope: property 542352127; 2026-09-04 through 2026-11-15; selected yesop_brand_search and yesop_retargeting; same exact Page Location campaign filter. Independent API revenue 114314.624678 rounds once to EUR 114314.62; native sessionKeyEventRate 0.09593023255813954 displays as 9.6%, not event-count division (9.8%).

Recorded read-only Promo financial inputs are in server/fixtures/ga4-downstream-saved-real-2026-11-15.json (campaign/owner identities replaced). Additional confirmed revenue EUR 3700 gives EUR 118014.62; spend remains EUR 1100. These are local fixtures, not new provider events or live writes.

The new regression invokes the actual registered Outcome and Executive routes and the actual production financial PDF reader/generator, using recorded inputs with storage writes and external requests blocked. It checks the six response differences and the PDF text, plus native zero, missing/invalid rates, corrupt revenue and non-GA4 behavior. Existing period/PDF and aggregate tests retain neighboring coverage with updated native-value expectations.

Release requires passing exact-commit GitHub build/certification and all three isolated test groups. The test monitor must replay the exact new test runtime; the live replay and configuration remain unchanged. Deployment/check receipts are kept under audit-temp/ga4-downstream-release.

## Limits

This does not certify unrelated sources or reconstruct older historical PDFs. It does not refresh GA4, rewrite saved source data, replace reports or deploy the live app. The live seven differences remain until a separately authorized live release.
