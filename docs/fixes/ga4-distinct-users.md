# GA4 distinct Users — local implementation, 10 November 2026

## Status

Implemented locally; not deployed or certified against a live GA4 property. No production data, source settings or schedules were changed. Earlier readiness statements are not evidence for this revision.

## Root cause and definition

Summary and several consumers added daily `totalUsers`. Campaign Comparison also added campaign-row users. A returning user can occur on several dates and in several campaigns, so these sums cannot represent the combined audience. Conversion Events and Landing Pages already use GA4 users within their individual row scope.

Users now means GA4 `totalUsers`, queried without dimensions for the exact property, selected campaigns and displayed completed-day period. GA4 deduplicates that scope. Each campaign gets its own native aggregate; the overall total is a separate query. Daily charts retain distinct users per day. Row counts may overlap and must not be added together.

## Traced paths and changes

- `server/analytics.ts`: retain the existing session-campaign filter and exact UTM fallback date boundary. Query native period, campaign, daily and supported comparison-window audiences. Reject mismatched scope, malformed, truncated or quality-limited responses. Independent queries use at most four concurrent requests.
- `server/ga4-daily-scheduler.ts`: save versioned user evidence inside existing Overview JSON, together with daily rows. First migration refresh uses full history. Provider failure keeps the previous publication. No schema migration, schedule changes or page-read writes.
- `shared/ga4-traffic-window.ts`: read exact native evidence; missing evidence is unavailable. No daily-sum fallback. This is used by routes, KPI/Benchmark jobs, alerts, diagnostics, summaries and scheduled PDFs.
- Overview and Campaign Comparison show period/campaign users; their total is never the sum of campaign users. Conversion Events and Landing Pages retain their original per-row values. Discovery screens no longer show misleading summed user badges.
- Trend comparisons query the historical audience instead of subtracting daily users. Source contribution receives the native user evidence through the existing response. Other traffic and financial formulas are retained.
- KPI progress marks the Users definition and excludes older daily-sum points from new rolling comparisons. History readers exclude incompatible points; saved historical reports are not rewritten or re-certified.
- Initial-import verification compares saved native total, campaign, daily and comparison-window counts with fresh native GA4 results. Existing monitoring readers have matching changes in the separate `distinct-users-monitor` checkout, including required-definition checks for missing evidence.

## Local validation

- Native-query tests include returning users, users shared by campaigns, exact campaign exclusion, native/UTM boundary, empty results, malformed responses and historical counts.
- Publication tests cover native daily-user replacement, failed-query retention, incremental/full refresh and client separation. Financial and conversion regression tests remain passing.
- Actual API/report integration tests exercise KPI and Benchmark saves, alert decisions, report preflight/builders and owner access with mocked providers/storage.
- Actual Campaign Comparison component rendering checks combined Users and unavailable behavior, while preserving other metrics. Scheduled PDF tests check native Summary Users and unchanged Landing Pages Users.
- Independent monitor tests cover total/campaign differences, missing evidence and malformed scope, plus existing output, browser-rule and notification checks. These are local tests, not a live monitoring run.

Evidence logs: `audit-temp/distinct-users-final-tests.log`, `audit-temp/distinct-users-local-http-tests.log`, `audit-temp/distinct-users-final-followup.log`, `audit-temp/distinct-users-refresh-final.log` (the passing native/refresh suites), and `audit-temp/distinct-users-browser-report-tests.log` (the corrected browser-export fixture, 122 passing tests). `audit-temp/distinct-users-validation.json` lists the latest passing result per test file, without counting repeat runs. Both application and monitor TypeScript checks pass. The production build passes. Generated PDF test artifacts were copied to `audit-temp/users-regression-pdfs`; the six historical tracked PDFs overwritten by the existing test were restored byte-for-byte from HEAD.

Monitor checkout: `C:/Users/me/.codex/worktrees/distinct-users-monitor/MF_real_latest`; its `audit-temp/distinct-users-monitor-tests.log` records 211 passing tests. Monitor source-query code and application replay pins still need to be synchronized to the application release commit before deployment; the currently deployed monitor has not been changed.

## Remaining release checks

1. Release to the Render test app and pin the monitor's application replay source to that exact tested commit. Configure `usersDefinition: ga4_totalUsers_distinct_v1`; the older deployed definition must not be silently accepted after rollout.
2. Allow the normal refresh to populate native user evidence, then compare actual GA4 responses, rendered screens and generated PDFs. No out-of-schedule production refresh is authorized by this change.
3. Release the same verified application and monitor revisions together to live. Until a campaign has native evidence, affected Users values are unavailable; other metrics remain available. Historical PDFs retain their original definition.

Live latency, provider quotas at client scale, real browser/API reconciliation and deployment remain unverified. Delete/deactivate flows were not changed and are not newly certified by this work.
