# Landing Pages sampled conversion supplement

## Confirmed cause and scope

Colombian Coffee's actual GA4 requests for 2026-10-14 through 2026-11-13 showed an unsampled native Landing Pages report followed by a sampled pageLocation/sessionSource/sessionMedium conversion supplement. The shared accuracy guard rejected the supplement before the scheduler's atomic save. The earlier date-presence correction did not cover this request.

Read-only real-provider probes confirmed that the exact same selected UTM scope has zero conversions in an unsampled aggregate. GA4 returns this empty aggregate without metricHeaders, rows, or rowCount; its response retains the runReport kind and metadata. No import, source write, campaign change, or refresh was performed during those probes.

## Localized correction

Only getLandingPagesReport changes in server/analytics.ts. After a sampling-only rejection of its conversion supplement, it requests an unsampled conversion total for the identical property, filter and dates. A valid zero result preserves the original native rows unchanged. A positive, malformed, incomplete, sampled, thresholded, restricted or otherwise unavailable total still fails closed. No sampled amount is accepted, no rows are invented, and Users, Sessions, Revenue, row matching, pagination and formulas are unchanged. Other rejection reasons never enter this recovery.

## Validation boundary

Real-provider verification uses the authorized saved connection with database reads explicitly read-only, closes that connection before GA4 requests, and disables all persistence. It checks the candidate source hash, native Landing Pages value preservation, daily series, presence, Campaign Breakdown, distinct Users, Conversion Events and cross-report reconciliation. This is a read-only preflight, not an actual saved client import.

Focused regressions cover zero recovery, exact scope/date retention, unchanged base values, positive/invalid/restricted total rejection and the existing Landing Pages/API/PDF/cancellation boundaries. Existing isolated test fixtures are not evidence of provider success; actual provider evidence is retained separately under audit-temp/landing-release.

Release status and exact commits are recorded in audit-temp/landing-release/RESULT.md after deployment. Live deployment and an actual Colombian Coffee import are outside this test-only release.
