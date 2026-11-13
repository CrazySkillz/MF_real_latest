# GA4 campaign-list timeout recovery — test release

## Confirmed failure

Read-only live logs on 13 November show the initial GA4 service-account connection completed successfully at 18:36:06 UTC in 10.7 seconds. The subsequent campaign-list request failed with TimeoutError at 18:38:15 UTC. Its stack identifies the primary campaign-dimension report, not the supplemental page-location scan. The previous code did not retry TimeoutError; the shared discovery deadline expired and the Configure screen displayed the failure.

The logs do not identify Google's underlying latency cause, the particular dimension/page, or prove a property-data problem. No tester credentials or direct GA4 queries were used in this investigation.

## Localized change

Only `GoogleAnalytics4Service.getCampaignValues` in `server/analytics.ts` changes at runtime. For onboarding discovery, a primary page that stalls for 30 seconds is retried once with the identical request, within the original 120-second overall budget. The second attempt receives the remaining budget. Safe diagnostics record dimension, page offset, attempt, status and elapsed time; no tokens or campaign names are logged by these diagnostics.

Strict discovery and supplemental page-location behavior are preserved. Completed pages are retained internally, but an incomplete primary list is never returned as success. Query dimensions, dates, metric definitions, ordering, limits, merge rules and calculation paths are unchanged. Existing route ownership checks remain before connection access.

## Validation

- New synthetic regression suite: five cases fail against the previous implementation; all 11 pass after the correction.
- Focused discovery, provider retry, pagination, route/access contract and browser packet: 50 tests passed.
- Coverage includes identical page retry, no duplicated earlier pages, a slow valid second response, overall timeout, caller cancellation, 401/403, quality restrictions, incomplete pagination, strict discovery timing and safe diagnostics.
- Required CI, pinned Render test deployment and hosted synthetic verification receipts are retained separately under `audit-temp/ga4-list-release`.

## Scope and limits

This release targets the test app only. No live deployment, source refresh or campaign-data changes are included. A real attempt for the tester's property remains unverified because access to her credentials was prohibited. Synthetic recovery proves the application behavior, not that Google's next real request will succeed.
