# GA4 Benchmark loading transition — 2026-10-29

## Symptom and proven cause

The Benchmark warning, last-good badge, and explanation could appear during page
entry before the current verification request completed. The page treated cached
daily freshness/status as the new visit's outcome. Its publication-pending flag
only started after the status effect accepted a publication receipt. Separately,
the Benchmark card rendered the generic unverified explanation for `loading`.

The regression was reproduced with the actual page in isolated Chromium: a cached
failed status and stale daily data were retained while fresh requests were held.
The pre-fix test found one `Some Benchmarks Are Not Freshly Verified` banner when
zero were expected. No production records were changed to reproduce this.

## Trace and localized correction

- `ga4-daily?statusOnly=1` reads the scoped persisted publication receipt/version
  through storage. `ga4-daily?...&readOnly=1` returns saved metrics/freshness.
- The existing query cache supplies retained results during page entry.
- `ga4-metrics.tsx` now waits for this mount's first status result and the initial
  publication handoff before treating traffic inputs as verified or failed.
- `trafficKpiInputState` and `kpiTrafficInputState` keep this transition unscored.
  Benchmark `loading`/`updating` states render without a status badge or warning
  explanation. Existing values remain available while verification runs.
- Settled failed checks still retain last-good values and exclude them from
  scoring. No server, storage, schema, scheduler, interval, or formula changed.

## Validation

- 291 distinct tests passed across publication coordination, rendered browser,
  Benchmark/KPI state and snapshots, Insights snapshots, and report gating.
- Browser cases cover a cached failed receipt with both daily-first and
  status-first completion, a first visit without cached data, and a failed first
  verification followed by recovery. A DOM observer records any warning flash
  throughout successful loading; all three loading cases recorded none.
- Existing browser cases also cover active scheduled work, retained values on
  real request failures, recovery, currency/date isolation, and 15 simulated idle
  minutes with no additional requests.
- TypeScript check, client build, and server build passed.
- Read-only deployed Promo checks before the patch: 17 requests returned HTTP
  200; status and native metrics were current through October 28, and a clean
  isolated page showed no warning. This confirms a clean load was already healthy;
  the delayed cached-state regression is the evidence for the reported transition.

Files: `client/src/pages/ga4-metrics.tsx`,
`server/ga4-publication-browser.test.ts`, and
`server/ga4-browser-publication-refresh.test.ts`.

The compact validation receipt is
`validation-2026-10-27-report-incident/benchmark-loading-validation-oct29.json`.
This is a loading-state fix, not whole-tab certification. Provider failure
injection, production data mutations, scheduled emails, and every source lifecycle
were not exercised. Browser tests isolate unrelated authentication/navigation/setup
components; they exercise the actual analytics page and query client.
