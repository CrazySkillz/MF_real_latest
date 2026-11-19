# GA4 initial-import verification repair — 19 November 2026

## Confirmed failures

Initial imports save exact GA4 distinct-user values for rolling 7-day, 30-day and
calendar-month windows. The shared verifier requested only the base comparison
windows, so valid additional saved windows were reported as differences. This
affects the existing 30-day path as well as the annual option. Re-querying the full
inventory also requires distinguishing users-only windows from windows that
actually request GA4's native session conversion rate.

For Colombian_Coffee, GA4 additionally returned both sampling metadata and a
property-history truncation boundary in the Landing Pages conversion supplement.
The existing history-window recovery admitted truncation alone, but rejected this
combined response before it could request the declared available period.

## Localized correction

- `server/ga4-source-verification.ts` verifies the saved rolling-history boundary,
  requests the same full distinct-user inventory, and compares session conversion
  rates only for windows requesting that metric. Missing/extra users or required
  native-rate windows still fail verification.
- `server/analytics.ts` permits the existing Landing Pages recovery for combined
  sampling/property truncation. The original restricted response is discarded;
  the new request still passes the unchanged shared data-quality gate. History
  limitations remain explicitly recorded. Annual Overview and daily history are
  not shortened. The existing sampled zero-conversion supplement exception still
  requires a separate, unrestricted exact-scope zero-total proof.
- Independent rolling-user batches run four requests at a time, retaining four
  named date ranges per request and deterministic window order. Existing request
  limiting, cancellation, import ownership and publication safeguards remain.

No schema, campaign configuration, calculation formula, schedule, startup refresh
policy or other-campaign data is changed by this patch. Deployment and the explicit
Colombian_Coffee retry are separate release actions.

## Validation boundary

`server/ga4-initial-import-history-verification.test.ts` exercises real distinct-user
query generation through initial verification for 30, 31, 365 and 366 daily rows.
It includes recorded zeros, non-additive users, native rates, missing/extra/changed
windows, missing rate evidence, cancellation, incomplete batches and concurrency.
Landing Pages regression tests cover successful bounded-history re-queries,
still-restricted responses, thresholding and invalid provider boundaries.

The current-day policy can add today's provisional row to the selected number of
completed days; this patch preserves that policy. A 30-day selection on
19 November starts 20 October; a 365-day selection starts 19 November 2025.

Release evidence is retained in `audit-temp/import-verification-repair/`: failing
pre-fix tests, passing tests/typecheck, real-property read-only comparisons for
both selections, exact deployed diffs, CI, pre/post database fingerprints and
scheduler checks. A passing fixture is not proof of a hosted import. The hosted
retry must complete and produce its verification receipt before it is reported
as successful. Future natural scheduled runs and unrelated source/report
lifecycles are outside this repair's certification scope.
