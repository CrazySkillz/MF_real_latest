# GA4 Reports Certification — 2026-09-21

## Decision and exact boundary

**CLEAN-CERTIFIED / PRODUCTION_READY for the bounded GA4 Reports surface described below** on exact deployed application revision `a7271fc18058b6db78a11e88bf79b887abda5f44`. The covered surface is:

1. Report Library and CRUD
2. Standard Templates and Ad Hoc Downloads
3. Custom Report Builder and Composition
4. Scheduling, Snapshots, and Delivery
5. the combined GA4 Reports tab

**Required gates remaining inside this boundary: 0.** This is a revision- and configuration-specific certificate, not a claim about arbitrary campaigns, future provider data, unrelated platform Reports, or Campaign DeepDive Reports.

This certificate records a new exact-runtime evidence packet. It does not rewrite the historical machine record in `GA4/certifications/ga4-reports.json`, the master ledger, or any protected upstream GA4 certificate. Those records remain unchanged.

## Runtime and source boundary

| Boundary | Certified evidence |
| --- | --- |
| Git and deployment | Local `main`, refreshed `origin/main`, and Render matched at `217552b346b2ce895135d769b4b50018b55bbecd` before the change. Commit `a7271fc18058b6db78a11e88bf79b887abda5f44` was then pushed to `origin/main`; production `/api/health` returned that exact SHA with `nodeEnv=production`. |
| Owner/client/campaign | Controlled production campaign hash `fc734ddaf728`, owner hash `1900b95d7361`, and client hash `613d89abb175`. Authentication used the campaign owner; temporary Clerk sessions were revoked. |
| GA4 scope | Active property `542352127`, three saved campaign filters (`yesop_paid_social`, `yesop_retargeting`, and `yesop_email_nurture`), USD, and `Europe/Amsterdam`. The validator required the exact campaign/property join and the server builder used the saved campaign scope. |
| Report schedule | The existing Benchmark report was restored to `09:00`, `Europe/Amsterdam`, and one original recipient. The pre/post configuration hashes were both `fd95883d1e7f`. |
| Provider | Mailgun HTTP API, EU region. Provider acceptance remained distinct from the later persisted `delivered` event and user-confirmed inbox receipt. |

The traced production path is:

`GA4 Reports UI -> /api/platforms/google_analytics/reports -> shared report storage -> GA4 server PDF builder -> immutable snapshot artifact -> minute scheduler -> email provider/audit -> send event, snapshot, and lastSentAt`

## Dependency-impact decision

The exact runtime commit changed four production files and five focused regression files:

| Production dependency | Bounded impact |
| --- | --- |
| `client/src/pages/ga4-metrics.tsx` | Validates scheduled recipients, awaits saved-report downloads, surfaces generation errors, and refuses unsupported GA4 report types. Report formulas and rendered values were not changed. |
| `server/routes-oauth.ts` | Validates GA4 scheduled recipients; manual GA4 snapshots persist the exact generated PDF artifact; direct GA4 snapshot PDF reads that immutable artifact and fails closed for legacy/missing artifacts. Ownership and campaign/platform consistency guards remain in force. |
| `server/report-scheduler.ts` | Honors the saved quarterly start day, rejects invalid legacy GA4 recipients before PDF/provider work, and persists the exact scheduled attachment bytes as the snapshot artifact. |
| `server/ga4-scheduled-report-pdf.ts` | Moves unchanged KPI and Benchmark blocks to the documented composition order: Overview, KPIs, Benchmarks, Ad Comparison, Insights. The moved calculations and output fields are unchanged. |

Storage schema, report table contracts, email provider implementation, Mailgun delivery classifier, reporting-timezone utility, and Render configuration were not changed. Historical evidence was reused only for byte-identical or branch-identical behavior; the changed PDF, scheduler, snapshot, and delivery paths were revalidated on the exact deployed revision.

## Results by requested area

### 1. Report Library and CRUD

PASS. Current regressions cover list, legitimate empty results versus failures, create, unchanged-edit guard, update, delete, repeated-delete truthfulness, owner/campaign/platform isolation, and download behavior. The deployed owner-authenticated validation created one temporary unscheduled `google_analytics` Custom report, verified its campaign/platform/type fields, created its snapshot, deleted the snapshot and report, and proved exact report/snapshot/send-event count cleanup. A separate natural-scheduler validation temporarily updated one existing report and restored its full report/schedule configuration to the identical hash.

Invalid or missing GA4 schedule recipients now fail before persistence or delivery. Unsupported saved report types fail visibly instead of producing a plausible fallback PDF.

### 2. Standard Templates and Ad Hoc Downloads

PASS. Overview, KPIs, Benchmarks, Ad Comparison, and Insights template rendering, selected windows, valid-zero/unavailable handling, and browser/server copy/value guards passed the current focused packet. Ad hoc generation remains download-only and does not create a saved report-library row. Saved-card download now awaits generation and reports failures.

The exact-current Campaign Breakdown server artifact contained the required `CAMPAIGN`, `SESSIONS`, `USERS`, `CONVERSIONS`, `CONV. RATE`, and `REVENUE` columns and every selected row/value. The browser renderer's relevant data/value blocks were unchanged from the recorded browser artifact packet; the changed server path was independently validated below.

### 3. Custom Report Builder and Composition

PASS. Selected sections and selected KPI/Benchmark IDs remain authoritative; empty Custom selections do not expand to all rows. The deployed fixture selected only `Overview > Campaign Breakdown` and the server produced only that intended Custom boundary. Current regression checks cover Overview, KPI, Benchmark, Ad Comparison, and Insights composition plus the corrected section order. No calculation or shared response contract was changed.

The production Campaign Breakdown values were:

| Saved campaign | Sessions | Users | Conversions | Displayed revenue |
| --- | ---: | ---: | ---: | ---: |
| `yesop_paid_social` | 1,200 | 1,202 | 112 | USD 39,977.00 |
| `yesop_retargeting` | 929 | 931 | 159 | USD 51,631.30 |
| `yesop_email_nurture` | 792 | 791 | 106 | USD 29,685.20 |

Native GA4 revenue was USD 104,593.50. Imported revenue was USD 22,700.00: USD 16,700.00 mapped exactly into the three rows and USD 6,000.00 remained unmatched, so it was not invented or allocated into a campaign row. The displayed row sum was therefore USD 121,293.50. Currency, materialization, and mapping ambiguity checks all passed.

An initial validation-harness assertion incorrectly recomputed conversion rate as conversions divided by sessions. Code tracing proved both browser and server intentionally consume GA4's weighted `sessionKeyEventRate`; the validator was corrected without changing production behavior, then the exact artifact passed.

### 4. Scheduling, Snapshots, and Delivery

PASS. Current regressions cover frequency/day/time/timezone/recipient validation, quarterly recurrence, report-ID deduplication, missing-campaign and invalid-recipient fail-closed behavior, provider pending/failure behavior, test-send semantics, snapshot/report scope, immutable downloads, and no snapshot/`lastSentAt` advancement on unsuccessful sends.

Exact-current runtime evidence:

- The minute scheduler was healthy after deployment: 38 checks, two explicitly authorized sends, zero failures, and 100% scheduler success rate.
- The final natural scheduled key was `2026-09-21T17:32@UTC`.
- The send event was `sent`, with non-null `sentAt`, no error, and immutable snapshot hash `e2df79cf4d37`.
- The attachment was a valid 7,980-byte PDF containing two exact Benchmark rows and their current/target/status values.
- Mailgun audit provider hash `d0280a118dfc` recorded EU-region `delivered`, a delivered timestamp, no error, and a provider response ID.
- `lastSentAt` was present and 180 ms after the send-event timestamp, matching the two intentional adjacent scheduler writes.
- Duplicate scheduled keys for the report: zero.
- The original report configuration and schedule were restored exactly.
- The first approved send was provider-marked delivered but was not observed in the inbox and is not counted as inbox evidence. The explicitly approved resend produced a distinct event/snapshot and the user confirmed receipt and the PDF attachment.

Manual exact-current Campaign Breakdown validation separately created an immutable 10,976-byte PDF from the same shared production builder, downloaded the stored artifact, parsed every row/value, created no send event, invoked no scheduler/email path, and proved exact cleanup with protected GA4 daily, source, KPI, and Benchmark state unchanged.

### 5. Combined GA4 Reports tab

PASS for the current combined Reports contract. The combined page remains a campaign-scoped aggregation of generated/browser rows and backend scheduled report rows. Its page implementation was unchanged by this commit. Current regressions cover backend visibility, list/empty/error separation, source-backed output guards, and download behavior; the current authenticated create/update/delete and scheduled-send exercises proved the shared backend routes still operate with the valid GA4 configuration.

Campaign DeepDive Reports remain explicitly outside this certificate and were not re-audited or modified.

## Engineering evidence

- Consolidated GA4 Reports packet: **18 files / 217 tests passed**.
- Additional non-overlapping repaired suites: Shopify downstream report content **15 tests passed** and Overview Conversion Events route **4 tests passed**. The focused unique boundary was therefore **20 files / 236 tests passed**.
- `npm run check`: passed after the production changes.
- `npm run build`: passed after the production changes.
- `npm run check:ga4-reports-certification`: passed as an internally consistent fail-closed historical machine record; it was not misrepresented as a current ready certificate.
- `git diff --check`: passed for the implementation/test boundary; only Git's informational LF-to-CRLF warnings were emitted.
- A broad repository run reported 2,101/2,144 passing tests before the last missing mock was repaired; that missing GA4 route suite then passed 4/4. The remaining 43 assertions across 15 files were traced to unrelated Google Ads, Instagram, TikTok, Meta, LinkedIn, scheduler-date, and stale historical certification-hash expectations. They are disclosed, not hidden, and are not evidence for or against this bounded GA4 Reports decision. No whole-repository green-suite claim is made.

## Reused evidence and exclusions

Reused evidence was limited to behavior whose relevant branch and configuration were unchanged: historical owner/non-owner isolation, empty/error UI states, prior browser Campaign Breakdown artifact values, and unchanged combined-page presentation. Changed scheduler, recipient validation, server PDF composition, snapshot artifact, provider, and inbox paths were all rerun on `a7271fc1`.

Excluded:

- Campaign DeepDive Reports and its untracked validation scripts
- other platforms' report builders and the unrelated broad-suite failures listed above
- arbitrary clients, owners, campaigns, properties, saved filters, currencies, or timezones
- future GA4/provider data, future provider outages, mailbox filtering, and future scheduled slots
- complete re-certification of the protected Overview, KPIs, Benchmarks, Ad Comparison, or Insights tabs outside their report-consumer boundary
- legacy GA4 snapshots created before immutable PDF artifacts were introduced; their PDF route correctly fails closed rather than regenerating a different artifact
- production failure injection; failed/pending behavior is covered by deterministic regression and retained exact historical evidence

## Invalidation and remaining gates

Remaining gates within this bounded certificate: **0**.

Revalidate this certificate if the deployed revision changes any listed dependency; if report ownership, property/filter, currency, timezone, calculation, composition, snapshot, scheduler, provider, or delivery configuration changes; or if a later defect is found in a covered path. Provider `delivered` alone must never be substituted for inbox receipt: the first attempt in this packet demonstrates that distinction.

The master ledger, historical machine certificates, and protected upstream certificates were not updated. This certification document and the two evidence-harness corrections were committed and pushed only after explicit user approval; they do not change the certified production behavior at `a7271fc1`.
