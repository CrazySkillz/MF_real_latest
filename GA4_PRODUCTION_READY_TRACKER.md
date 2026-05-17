# GA4 Production-Ready Tracker

## Purpose

Track the final GA4-specific items required before using GA4 as the implementation template for future integrations such as Meta, LinkedIn, and Google Ads.

Rule: do not add new items here unless the root cause is confirmed in code or production validation. Operational configuration issues, such as an expired OAuth token or a report missing recipients, are not template blockers unless the code mishandles them.

## Final Known Blockers

- [x] Update the stale report regression test so it covers the current scheduler behavior for already-skipped scheduled reports with `Campaign not found` or `No recipients configured`.
- [ ] Tighten scheduled-report create/update validation so `scheduleEnabled=true` requires at least one recipient at save time.
- [ ] Fix direct report snapshot PDF legacy branding/format so it no longer uses old `MetricMind Report Snapshot` wording or the basic legacy fallback layout.
- [ ] Run final validation: targeted report tests, `npm run check`, `npm run build`, one GA4 report test-send, and one scheduled-report log cycle.

## Completed

- [x] Scheduled report processing disables stale no-recipient schedules instead of logging `already processed ... No recipients configured` every minute.
- [x] Report scheduler regression coverage now asserts already-skipped reports are disabled for both stale campaign and missing-recipient failure states.
