# Initial-import restart receipt

The startup bootstrap previously treated a newly activated, verified initial import as overdue because it has no scheduled executive-publication marker. A deployment could therefore import its GA4 data again.

The startup-only check now reads the latest durable work receipt. It accepts a completed initial import only when the campaign remains active with the same owner, client, filter, currency, timezone and connections, every property has the matching verification/publication receipt, and hashes of the saved overview and daily inputs still match. Reads use a read-only repeatable-read transaction. Initial-import write/claim paths still require a draft campaign.

Startup also requires valid existing overview, daily and financial inputs, a compatible reporting date, and completion after the latest due slot but not in the future. The next scheduled slot remains due normally. Missing, changed, invalidated or incomplete receipts cannot suppress recovery; database discovery failures do not execute a speculative refresh.

This receipt does not create an executive snapshot, mark a scheduled report ready, or change `getCompletedGA4RefreshState`. It does not change provider calls, refresh intervals, schedule anchors, calculations, schemas or campaign data.

Validation scope: initial-import PostgreSQL ownership/publication/restart tests, startup pipeline and scheduled-report regression tests, interval-anchor tests, TypeScript checks, and read-only pre/post-deployment comparisons. Deployment is permitted only after executing the prepared startup logic against saved live data with provider execution blocked and confirming zero bootstrap candidates and zero eligible recovery jobs.

This is evidence for the restart path; it does not certify unrelated application paths.
