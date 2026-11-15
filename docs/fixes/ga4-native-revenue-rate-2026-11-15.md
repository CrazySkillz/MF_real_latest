# GA4 native revenue precision and Conversion Rate — 15 November 2026

Scope: test-app correction; live unchanged. Real API evidence is in `server/fixtures/ga4-native-values-real-2026-11-15.json` (no credentials).

## Root cause and correction

- Native revenue merged raw daily reports but rounded every daily contribution before adding them: EUR 114,314.60. Summing the same raw contributions and rounding once gives EUR 114,314.62, matching the independent whole-period `totalRevenue` response. Preserve the existing exact-campaign traffic/conversion supplementation rules.
- Overview and dependent outputs divided conversion event count by sessions. GA4's session conversion rate is `sessionKeyEventRate`, the fraction of sessions with a key event. Fetch and retain this provider metric in the same exact-period queries used for Sessions and Users. Display as percent, never reconstruct it from event counts. Missing or invalid provider rates remain unavailable.

## Real comparison

Property 542352127, 2026-09-04 through 2026-11-15, EUR, exact pageLocation UTM selection `yesop_brand_search` or `yesop_retargeting`.

Independent whole-period response: Sessions 4,472; Conversions 440; Revenue 114314.62467800001; sessionKeyEventRate 0.09593023255813954. Expected displayed rate 9.6%. Campaign rates: brand 10.0%, retargeting 8.3%. Landing Pages uses its own available reporting dates and provider rate (10.3%).

## Validation boundaries

Recorded real responses cover provider totals, rate acquisition, saved period values, campaign rows, landing rows and generated Overview/Custom/Comparison PDFs. Negative cases retain missing/invalid/sampled/incomplete response rejection. Regression checks cover KPI/alert consumers and legacy missing-rate display. No GA4 events are written, no live refresh is triggered, and no live source settings are edited.

Release checks and hosted test-app evidence are retained under audit-temp/ga4-native-values-release. This change does not certify unrelated historical reports or all app metrics.
