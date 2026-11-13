# Initial GA4 service-account connection timeout — test release

## Confirmed boundary

The failed live retry at 17:20:20 UTC on 13 November reached the service-account connect endpoint. Its Express log was truncated at 80 characters and the endpoint did not log failure stages. Therefore historical logs cannot establish whether this particular attempt stalled during credentials, property-queue waiting, the Google request, or response cleanup. No tester credentials or direct property queries were used to investigate.

The actual route has a separately reproducible failure: one 15-second signal covers both waiting for a property request slot and the GA4 access query, with no timeout recovery. Synthetic execution of the unchanged deployed route rejects a valid 16-second response and also rejects queued work before a valid response can complete. This is proven application behavior, not proof of Google's latency or the tester's exact historical failing stage.

## Localized correction

Only `server/routes-oauth.ts` changes at runtime: one existing retry-helper import and the initial service-account connect handler. The property access check has a bounded 60-second total budget, a fresh 30-second provider deadline after acquiring a slot, and at most one retry after a timeout. Queue waiting does not consume the provider's per-attempt deadline, but does consume the total budget. A total-budget timeout is not retried. HTTP denials, other HTTP errors, ownership failures and storage errors are not retried.

Safe single-line diagnostics identify campaign/property, phase, attempt, elapsed time, response status, retry and success/failure. They do not contain credentials, access emails, raw provider responses or raw exception messages. A final timeout returns HTTP 504 with an explicit retry message instead of a raw DOM timeout. A successful Google response remains mandatory before verification/save, and persistence is outside the retry boundary.

The Google query remains exactly yesterday's `sessions`, limit 1, for the same authorized property. Scope, Viewer-access verification, ownership, draft guards, existing OAuth/legacy protections, connection response shape and persisted fields remain unchanged. No metric calculations, imports, schedules, financial logic, schema or UI application files change.

## Tests and release boundary

- Executable actual-handler fixtures reproduce the old cutoff and test valid slow responses, queue delay, a successful timeout retry with one save, terminal timeout with no save, queue-only timeout with no provider call, credential-stage diagnostic redaction and no retry on HTTP 401/403/429/500.
- Existing ownership, draft, legacy/OAuth, identity and provider-denial tests remain required.
- The actual React Auth component is exercised with synthetic HTTP: timeout retains the prepared email and Property ID, enables retry and advances only on a subsequent successful response, without provisioning another identity.
- Mandatory GitHub checks and hosted synthetic evidence are recorded in `audit-temp/ga4-connect-release/`. The live app is excluded from this deployment.

The tester's real connection remains unverified. This change does not establish that her permissions are correct or guarantee that Google responds within the new deadline. The new diagnostics can locate a future failure when a permitted user retries on a deployment containing this change.
