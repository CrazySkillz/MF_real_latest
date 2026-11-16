# Summary Conversion Rate monitor correction

Scope: six stored Executive Summary / Performance Summary comparisons for Promo,
Batch 1 Provider Check and V1 Batch 5 Test. No application calculation, campaign
configuration, source data, refresh schedule or saved report is changed.

## Cause and correction

The application already saves GA4's native `sessionKeyEventRate * 100` in both
summaries. The source monitor omitted `application.comparisonRateDefinition` when
passing its snapshot into `checkStoredNumbers`, causing Executive Summary to use
the legacy conversions/sessions expectation. Performance Summary independently
hard-coded that legacy formula. These caused two false differences per campaign.

The entry point now forwards the existing configuration. Performance Summary uses
its saved GA4 period packet, with independently checked campaign, property,
campaign filter, currency, reporting timezone and date boundaries. Its traffic
window can differ from Overview; the expected rate uses its own matching window.
Legacy deployments retain their existing formula. Invalid/missing native evidence
remains unverified; mismatch tolerances are unchanged.

## Evidence

Bounded read-only reads at 2026-11-16 07:42:22 UTC retrieved only the three exact
campaigns' connection metadata, GA4 publication and two summary snapshots. No
credentials, providers, refresh endpoints or campaign writes were used.

| Campaign | GA4 native rate (%) | Executive Summary (%) | Performance Summary (%) | Old arithmetic expectation (%) |
| --- | ---: | ---: | ---: | ---: |
| Promo | 9.593023255813954 | 9.593023255813954 | 9.593023255813954 | 9.838998211091235 |
| Batch 1 Provider Check | 9.994121105232216 | 9.994121105232216 | 9.994121105232216 | 10.405643738977071 |
| V1 Batch 5 Test | 6.267806267806268 | 6.267806267806268 | 6.267806267806268 | 6.695156695156696 |

Sanitized captured inputs are retained in
`server/fixtures/monitor-summary-rates-2026-11-16.json`. Unit tests adapt only the
summary window-mode enum for the monitor branch's legacy parser; the deployed
monitor uses the pinned current application parser. Hosted targeted verification
must use the actual current-day records without that adaptation.

Regression coverage: all six captured rates, both genuinely wrong summaries,
missing/out-of-range native values, a valid zero, mismatched scope, independent
Performance Summary window, legacy behavior and the real monitor entry point with
isolated storage/provider stubs. Tests do not connect to a database or provider.

Release requires the existing GitHub `unit-tests` gate on the exact commit, then
monitor-only promotion and deployment. The final hosted check is limited to the
six affected comparisons. Previously completed source/screen/PDF checks are not
rerun. This correction does not certify unrelated paths or historical PDFs.
