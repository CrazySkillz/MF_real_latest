# Automatic email imports: October 30 release exclusion

The user explicitly chose **"No—keep automatic email imports disabled"** for
this release. Implementation `02bb9ad28ad8101fd5e47248028a57b5475427b5` is
committed, pushed and verified live at 12:18 UTC. V1-004 is closed for this
enforced exclusion, not for successful provider email ingestion.

## Cause and correction

Missing provider verification settings rejected SendGrid/Mailgun requests, but
that alone did not exclude the separate token-based email route. At the beginning
of the existing route registration, the implementation unconditionally rejects:

- `POST /api/email/inbound/:token`
- `POST /api/sendgrid/inbound`
- `POST /api/mailgun/inbound`
- `POST /api/custom-integration/:campaignId/connect` (email-forwarding setup)

The response is HTTP 404 with `Automatic email imports are disabled for this release`.
The gate precedes the original route-specific parsers, authentication/provider
handlers and storage work. Existing global request parsing remains in place.

Campaign creation, Campaign Overview and Custom Integration analytics hide the
email-forwarding setup, address and readiness controls. The old email-only empty
state points to the existing upload flow. Existing imported data and connection
records are retained.

Manual uploads, Google Sheets, token-authenticated file webhooks, transfers and
outgoing report emails retain their existing paths. No schema, metric, storage,
scheduler or report-delivery implementation changed. V1-026/V1-030 retain their
separate supported-route acceptance requirements.

## Evidence and limits

- [Local evidence and source hashes](validation-2026-10-30/email-import-exclusion-validation.json):
  255/255 focused checks, TypeScript and production client/server builds pass.
  New checks cover registration order, all excluded paths including trailing
  slashes, adjacent-route non-interception and actual JSX render conditions.
- [Live verification](validation-2026-10-30/email-exclusion-deployed.json): exact
  commit and healthy HTTP 200; four disabled responses and two adjacent anonymous
  data denials pass. No valid tokens, credentials, metrics or recipients supplied.
- A preceding deployment poll did not report a healthy revision. Subsequent health
  and route checks passed; zero downtime is not claimed.
- The production signed-in UI was not operated. Its changed conditions are covered
  by local rendering/build evidence. Provider email delivery is excluded and must
  pass its original signature/retry/recovery checks before future re-enablement.
- [Hosted CI evidence](validation-2026-10-30/email-exclusion-hosted.json):
  the exact commit's complete workflow passed, including the current-version test
  command, GA4 certification-record integrity and the retained deferred-source
  test step. Public production health still matched the same commit afterward.
  Hosted test counts were not extracted from logs and are not inferred.

The rest of Batch 1 and whole-app release acceptance remain open. This exclusion
does not waive account, credential, provider or operational checks elsewhere.
