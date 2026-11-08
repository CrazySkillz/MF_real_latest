# GA4 Overview / Campaign Comparison conversion parity

User requirement: use the same Conversions and Conversion Rate definitions in
Overview and Campaign Comparison. This supersedes the previous Comparison
requirement to display GA4's session key-event rate.

## Root cause and traced boundary

- GA4 API imports conversion counts. The scheduler reconciles Campaign Breakdown
  Sessions and Conversions against its daily facts before publishing the snapshot
  (`server/ga4-daily-scheduler.ts`, `reconciliationMismatches`).
- Overview reads those daily facts through `/ga4-daily`; Comparison's chart and
  leaders use the synchronized `/ga4-breakdown` Overview rows. Both are limited to
  the selected property/campaigns and initial-import-to-completed-day window.
- `campaignBreakdownAgg` in `client/src/pages/ga4-metrics.tsx` previously derived
  its rate from `sessionKeyEventRate`, while Overview calculated
  `Conversions / Sessions * 100`. This was a definition mismatch, not evidence
  that imported conversion counts were damaged.
- `adComparisonChartRows` feeds `GA4AdComparison`, the Overview breakdown and
  browser Comparison/Custom PDFs. The server report payload independently repeated
  the old rate formula for newly generated/scheduled PDFs.

## Local correction

- Both aggregation paths now use `Conversions / Sessions * 100`.
- Case-merged rows and the overall summary recompute the ratio from summed counts.
  Individual campaign percentages are not averaged. Fractional credits and rates
  above 100% are preserved; zero conversions with sessions remains zero.
- The overall rate is unavailable when no sessions exist, matching Overview.
- Charts, leader-card selection, browser PDFs and server PDFs consume the same
  definition. Existing two-decimal leader formatting remains unchanged.
- Native provider fields, imports, scheduler, dates, selection filters, ownership,
  source records, revenue/spend allocation, KPI/Benchmark formulas and database
  schemas are unchanged. No database cleanup or provider refresh was run.

Runtime files changed: `client/src/pages/ga4-metrics.tsx`,
`client/src/pages/ga4-ad-comparison.tsx`, `server/ga4-scheduled-report-pdf.ts`.

## Validation

- New regressions reproduced the old mismatch before the fix: computed campaign
  rates were 12%/30% instead of the ratios from the supplied counts; server PDFs
  showed 50% instead of 10% for 1 conversion / 10 sessions.
- Executable frontend aggregation/render tests cover exact selected campaign
  filtering, case variants, duplicate breakdown dimensions, zero counts/sessions,
  fractional conversions, repeated conversions and non-mutation of input rows.
- Server PDF tests cover Comparison and Custom outputs, divergent native session
  key-event rates and unavailable zero-session rates.
- An isolated browser using the real page, intercepted API responses and real
  PDF downloads shows 40 conversions / 604 sessions = 6.6% in Overview and
  Comparison. The per-campaign rate for 19 / 346 is 5.49% in leaders and PDF.
  Existing financial figures, source separation and refresh failure/recovery
  assertions remain in that browser test.
- TypeScript and production client/server build pass.
- The seven focused unit/render/PDF/route files completed with 125 passing tests.
  The isolated `revenue-pipeline-no-spend` browser case passed separately with
  five actual PDF downloads, including refresh failure and recovery.
- The previously silent browser run was resolved by running remaining cases with
  verbose progress: channel passed separately; all ten other timing cases passed
  in 478 seconds. Together with the earlier pipeline case, all twelve cases pass.
  No application change was needed for the apparent stall.
- New server PDFs retain the conversion-rate definition in their existing
  verification receipt. The focused 16-test PDF suite passes with that receipt.

## Release boundary

This correction is local, not deployed. No live or test service was changed.
Hosted same-campaign/same-publication validation remains required during release.

The deployed monitor is on separate branch `codex/live-number-checks` at
`946803825d6f81cd9a51bb8dffebb1c57f709175`. Its Comparison expectations still use
the old native session rate. Before deploying this app correction, update the
monitor's browser/chart, generated-report and live-output Comparison expectations
to the new ratio (including zero-session availability). Keep direct GA4 provider
checks of raw `sessionKeyEventRate` unchanged. Coordinate live/test rollout so the
monitor uses the definition of each deployed app revision; do not waive actual
differences. That monitor update is not included in this app-only checkout.

No whole-section production-readiness claim is made. Historical PDF originals
and stored inputs were not modified or recertified.
