# Shared email recipient boundary — November 1

Status: **deployed and verified**, `9848ef9c`. This is a targeted correction
within the existing dependency launch task, not a new launch gate.

## Confirmed boundary and smallest correction

The shared `EmailService.sendEmail` normalized recipients but checked only that
the list was nonempty. It passed unsupported address syntax directly to SMTP or
Mailgun. GA4 report routes and the GA4 scheduler validate plain email addresses,
but retained non-GA4 report paths and existing alert records do not all pass those
guards. The development test-email endpoint is disabled in production and is not
the justification for this change.

Traced paths:

- `server/routes-oauth.ts`: platform report create/update persists selected
  recipients; the strict recipient guard is currently GA4-specific.
- `server/report-scheduler.ts`: scheduled and test report delivery resolves the
  owned report/campaign, prepares its PDF, then calls `sendReportEmail` and the
  shared service with saved recipients. No access or campaign guard is changed.
- `server/services/alert-monitoring.ts`: immediate/scheduled alert handling splits
  saved recipient text and calls `sendAlertEmail`, which calls `sendEmail`.
- `server/services/email-service.ts`: both SMTP and Mailgun send branches follow
  the common normalization step. SMTP hands its recipient string to Nodemailer.

The installed Nodemailer address-parser advisories make unvalidated structured
address syntax relevant. The [upstream parser correction](https://github.com/nodemailer/nodemailer/releases/tag/v7.0.11)
documents one affected parser behavior. This app correction does not claim to fix
every Nodemailer advisory or prove a production crash. Local mocked transport
tests prove the actual application boundary previously forwarded unsupported
recipients; no production traffic or resource-exhaustion experiment was used.

Seven added runtime lines in `server/services/email-service.ts` reuse the existing
Zod `.email()` rule before either transport. A message containing an invalid
recipient fails as a whole and records a failed audit through the existing method.
This prevents partial sends and preserves the established boolean return shape.
Plain email strings are the current GA4 UI/API contract; display-name, comment and
group syntax are not newly supported. Valid strings, trimming, multiple recipients,
case, aliases, attachments and success/failure delivery bookkeeping are preserved.
No dependency, schema, calculation, connection, schedule or saved record changes.

## Validation and limits

Evidence: `validation-2026-11-01-dependencies/`.

- `email-baseline.json`: nine controls pass and nine rejection cases fail before
  the runtime change. `email-before.json` is the earlier test-table run; its array
  case wrapping was corrected before recording the authoritative baseline.
- `email-final.json`: **80/80 pass**, including 18 new service boundary cases plus
  existing report, alert, delivery-status, audit, retry and immediate-route tests.
  SMTP/Mailgun and audit persistence are mocked in the new test; no email, provider
  or database calls occur. It checks failed-audit invocation, not a new database
  persistence certification. Existing audit/retry regressions remain applicable.
- TypeScript and client/server production builds pass; logs and file hashes are
  retained in `email-validation-receipt.json`.
- `git diff --check` passes for the changed runtime/test files.

Existing invalid stored recipients will be rejected when a send is attempted;
their records are not rewritten. The unchanged retry/audit handling receives the
failure. No live email send or recipient-data cleanup is needed for this guard.
Provider acceptance/delivery is not newly certified. Other dependency candidates,
changed-domain callbacks, minimum recovery evidence and final acceptance retain
their documented open boundaries.

## Release evidence

Hosted workflow [41297917427](https://github.com/CrazySkillz/MF_real_latest/actions/runs/41297917427)
passed, including the current-version suite and retained deferred-source checks.
At 10:41 UTC, the exact revision was deployed and healthy. The independent
new-domain check returned 200 for health/homepage, 401 for unsigned client/campaign
APIs, and the expected Clerk CSP/HSTS headers. `email-release-ci.json`,
`email-public-release.json` and the validation receipt preserve these results.
This release has no database migration or provider configuration change. No live
email was sent. A code rollback is schema-compatible but would remove this guard.
