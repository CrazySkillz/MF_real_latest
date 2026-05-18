# GA4 Production-Ready Tracker

## Purpose

Track the final GA4-specific items required before using GA4 as the implementation template for future integrations such as Meta, LinkedIn, and Google Ads.

Rule: do not add new items here unless the root cause is confirmed in code or production validation. Operational configuration issues, such as an expired OAuth token or a report missing recipients, are not template blockers unless the code mishandles them.

Campaign-level KPI/Benchmark production-readiness is tracked separately in `CAMPAIGN_LEVEL_KPI_BENCHMARK_PRODUCTION_READY.md` because those rules apply to every connected platform, not only GA4.

## Final Known Blockers

- [x] Update the stale report regression test so it covers the current scheduler behavior for already-skipped scheduled reports with `Campaign not found` or `No recipients configured`.
- [x] Tighten scheduled-report create/update validation so `scheduleEnabled=true` requires at least one recipient at save time.
- [x] Fix direct report snapshot PDF legacy branding/format so it no longer uses old `MetricMind Report Snapshot` wording or the basic legacy fallback layout.
- [x] Run final validation: targeted report tests, `npm run check`, `npm run build`, one GA4 report test-send, one direct snapshot PDF validation, and one scheduled-report log cycle.

## Completed

- [x] Scheduled report processing disables stale no-recipient schedules instead of logging `already processed ... No recipients configured` every minute.
- [x] Report scheduler regression coverage now asserts already-skipped reports are disabled for both stale campaign and missing-recipient failure states.
- [x] Platform report create/update routes now reject scheduled reports without at least one non-empty recipient before saving.
- [x] Direct report snapshot PDF downloads now reuse the shared report PDF builder and `mimosaas_report_...` filename pattern.
- [x] Final validation passed for the GA4 report template readiness scope:
  targeted report regression tests passed, TypeScript check passed, production build passed, GA4 report test-send/PDF delivery was validated, direct snapshot PDF output was validated, and scheduled-report log-cycle behavior was validated.

## Current Status

The tracked GA4 report template blockers are complete. GA4 can be used as the implementation template for the next integration work, provided future integrations copy the proven GA4 patterns rather than introducing parallel report, scheduler, source, or visibility paths.

Future GA4 production-readiness items should be added only when root cause is confirmed in code or deployed validation.

Template rules for future integrations:

- preserve campaign/platform ownership guards before read, update, delete, snapshot, send, or scheduler mutation
- preserve fail-closed scheduler behavior for missing campaigns, stale sources, missing recipients, and wrong platform/source identity
- preserve stable source identity for edit/refresh paths; add mode and refresh mode must not be confused
- preserve shared report PDF generation for scheduled, test-send, download, and direct snapshot output
- preserve transactional/plain report email delivery with the generated PDF as the report artifact
- add targeted regression coverage before calling a copied integration path production-ready
