# Automatic client access to GA4

Implementation date: 7 November 2026. Status: implemented locally; the full release gate has two current-scope failures described below. Google Cloud setup and hosted acceptance are also pending. This document does not certify the rest of the application.

## What changes for a client

1. Sign in, create/select their Client record, and click Create Campaign.
2. Complete Details and select Google Analytics at Platform.
3. At Auth, choose Use service-account access. Enter the numeric GA4 Property ID and click Generate access email.
4. In Google Analytics, select that property and open Admin → Property access management → Add users. Add the displayed email as Viewer. The person doing this needs permission to manage access to that GA4 property.
5. Return to MimoSaaS and click Connect Google Analytics. The server checks access with Google before saving the connection.
6. Continue through Configure, choose the campaign scope, then Confirm → Create Campaign. The existing initial import and scheduled refresh process continues.

No MimoSaaS administrator approval or per-client Render environment edit is needed after the one-time setup below. Google property permission in step 4 remains necessary.

Emails use `client-name-PROPERTY_ID@PROJECT_ID.iam.gserviceaccount.com`. For example, client Acme and property 123456789 produce `acme-123456789@PROJECT_ID.iam.gserviceaccount.com`. Names are lowercased, accents/punctuation normalized, and long names shortened; the full numeric property ID is retained. Google allows hyphens, not underscores, and limits the account ID to 6–30 characters. [Google naming requirements](https://docs.cloud.google.com/iam/docs/service-accounts-create).

## One-time manual Google Cloud setup

The app owner performs this setup, not every client. Start with the test environment. Keep a separate dedicated Google Cloud project for live client access, so test and live databases cannot claim the same email identities. These projects should contain only these GA4 access identities, because the issuer receives permission to request tokens for accounts within its project. Existing `yespo1` credentials and connections do not need to change.

1. Open [Google Cloud](https://console.cloud.google.com/), click the project selector at the top, then New Project. Name it **MimoSaaS GA4 Test**. Record its actual **Project ID**; Google may add a suffix. Select the new project.
2. Open **APIs & Services → Library**. Enable **Identity and Access Management (IAM) API**, **IAM Service Account Credentials API**, and **Google Analytics Data API**.
3. Open **IAM & Admin → Roles → Create role**. Title: **MimoSaaS GA4 Access**. ID: `mimosaasGa4Access`. Add exactly these permissions and save: `iam.serviceAccounts.create`, `iam.serviceAccounts.get`, `iam.serviceAccounts.getAccessToken`. Do not grant Owner or Editor. [Custom-role instructions](https://docs.cloud.google.com/iam/docs/creating-custom-roles).
4. Open **IAM & Admin → Service Accounts → Create service account**. Name and ID: `mimosaas-ga4-issuer`. Grant it the custom **MimoSaaS GA4 Access** role on this project. Leave the optional “principals with access” section empty. Finish creation. The app uses this account to create the separate client emails; this issuer itself does not need GA4 Viewer access.
5. Open that issuer account → **Keys → Add key → Create new key → JSON → Create**. Google downloads a private JSON file. Keep it private; paste it only into the corresponding Render secret field, never into chat, source code, or a client form. If your organization blocks key creation, its administrator must resolve the policy; do not bypass it. [Google key instructions](https://docs.cloud.google.com/iam/docs/keys-create-delete).
6. In Render, select the **test app** → **Environment**. Add `GA4_CLIENT_SERVICE_ACCOUNT_JSON` with the complete contents of that JSON file. Initially set `GA4_CLIENT_SERVICE_ACCOUNTS_ENABLED` to `false`. Preserve all existing Google OAuth and legacy service-account variables.

The developer then deploys the tested code and migration to the test app, enables the flag there, and performs the acceptance checks below. Do not enable the feature on an older app revision.

For live activation, repeat these steps in a separate **MimoSaaS GA4 Live** project and apply its JSON only to the live app. The project ID is part of every generated address; do not change it after clients connect.

Google API and IAM changes can take time to propagate. If Generate or Connect reports an error immediately after setup, retry after propagation; a failed request does not activate the campaign. Check the project's service-account quota before onboarding enough client/property pairs to exceed it. The app also limits new reservations to 20 per Client record.

## Monitoring and release pairing

The existing monitor must receive the credential-path support in `scripts/check-live-numbers.ts` and `scripts/check-live-number-run.ts` before this feature is activated. Its read-only database configuration remains unchanged.

- For each monitored environment, add `<credentialsEnvironmentPrefix>GA4_CLIENT_SERVICE_ACCOUNT_JSON` to the monitor's Render environment. Use the prefix from that environment's existing monitor configuration; live currently uses `LIVE_NUMBER_`.
- A separate issuer in the **same corresponding project**, with a custom role containing only `iam.serviceAccounts.getAccessToken`, is sufficient for monitoring. It needs no create/get account permission and no GA4 Viewer grant. Its own JSON goes in the prefixed monitor variable.
- The monitor never enables client provisioning. Its HTTP guard permits only a one-hour token for `analytics.readonly`; account creation, permission changes, delegates, and broader token scopes remain blocked.
- Update the monitor's expected deployed app revision through the existing release workflow. Do not replace its database fingerprint, campaign scope, schedules, or alert recipients.

This feature branch was created from `codex/live-number-checks`, whose history includes monitor-only work beyond live `main`. Release the feature's app commit onto the existing app release branch, and the monitor changes onto the monitor branch. **Do not merge the entire feature branch/history into live.** Resolve any patch conflicts against the actual release versions, then run their mandatory checks before deployment.

Migration `0028_ga4_client_service_accounts.sql` is additive and part of the startup migration manifest. It adds identity reservations and a nullable connection binding. Existing connection rows, grants, analytics, schedules, and source settings are not rewritten. An old monitor without this support cannot verify a newly connected dedicated account.

## Hosted acceptance before live activation

Use a disposable test campaign and a GA4 property the tester controls:

1. Generate the email; retry/reopen setup and confirm it stays the same for the same Client/property. Creating another campaign for that Client/property reuses the identity.
2. Before adding Viewer access, Connect must fail and must not create a usable connection. Add Viewer access, then Connect must succeed.
3. Configure an exact GA4 campaign filter and finish creation. Confirm the import uses that property, filter, reporting dates, currency and existing metric definitions. Compare the imported results with the matching source query.
4. Confirm the new campaign enrolls in the existing monitor and its source comparisons complete through the dedicated identity.
5. Check a scheduled refresh/restart uses the saved identity without asking for setup again; another client cannot retrieve or attach it. Check an existing OAuth and legacy shared-account campaign still reads successfully.

These real-Google and hosted checks are **not yet performed**. Local fixtures validate the request, storage, UI, credential and refresh-scope boundaries; they cannot prove Google IAM configuration or a hosted deployment.

## Implementation and lifecycle boundaries

- Routes remain in `server/routes-oauth.ts`; persistence remains in `server/storage.ts`; the existing Auth component and Configure/Confirm flow remain in use.
- Prepare reserves the exact owner/Client/property, creates an account only with that reservation's marker, and saves its immutable Google unique ID. A repeated or concurrent request reuses that exact identity. A collision with another client or external Google account fails; the code never adopts or overwrites it.
- Connect performs a read-only GA4 query as that identity before verification and connection save. Request ownership is checked again at persistence. Existing active campaigns cannot provision/rebind through these new setup routes.
- Every credential read verifies the current campaign owner, Client owner, property, binding and verified state before using even a cached token. No per-client private keys are generated or stored. The app requests short-lived read-only Google tokens.
- Changing a Client's name does not rename its existing access emails. Editing the entered Property ID clears the prepared UI email; Connect requires the new property's exact preparation.
- Deleting a campaign/client removes access through the existing ownership joins. Identity reservations and Google accounts remain to prevent another tenant inheriting an old email. Automated Google-account deletion/reassignment is intentionally not included; no existing customer data is cleaned up by this migration.
- OAuth and legacy shared-account connections retain their existing credential and authorization paths. OAuth replacement clears the dedicated binding. Disabling the setup flag stops new setup, while existing dedicated connections still work as long as their issuer secret and Google permissions remain available.
- The existing scheduler, analytics calculations, reports and alert formulas are unchanged. The connection binding participates in refresh ownership checks; null bindings retain the old durable scope hash exactly.
- Rolling back activation means setting the setup flag false. After any client connects, keep the compatible credential-reading code, migration and issuer secret; rolling back to an older binary without dedicated-account support would interrupt those new connections.

## Local evidence

Tests use synthetic provider responses and isolated local PostgreSQL schemas. They do not modify live Google accounts, Render settings, production data, or customer metrics.

- `ga4-client-service-account.test.ts`: naming, provisioning retry/collision/deletion, immutable identity, disabled accounts, token validation/cache and legacy isolation.
- `ga4-client-service-account-routes.test.ts`: actual route handlers, authenticated ownership, provider denial, verification-before-save, draft-only setup, legacy/OAuth preservation, disabled setup and error redaction.
- `ga4-client-service-account-postgres.test.ts`: real SQL migration, concurrent reservations, exact owner/Client/property isolation, connection persistence/runtime hydration, deletion, owner transfer, quota and repeat migration.
- `ga4-service-account-onboarding-browser.test.ts`: real React form with synthetic HTTP, including existing flows, generated email, property edits, failed access and stale responses after a campaign change.
- `ga4-refresh-work-postgres.test.ts`: existing durable refresh ownership plus invalidation when the credential binding changes.
- `live-number-checks.test.ts`: monitor permits only the exact read-only token request and rejects broader credentials/account mutations.

### Command results, 7 November 2026

| Check | Result |
| --- | --- |
| Focused account, route, real PostgreSQL, refresh ownership and monitor tests | 177 passed across five files, including the final route-error-redaction check. |
| Onboarding browser tests | 13 passed, including the four new self-service scenarios. |
| Existing shared-account and timeout tests | 9 passed. |
| `npm run check` | Passed. |
| `npm run build` | Passed. |
| `npm run check:ga4-kpi-certification` | Passed; this checks evidence/status consistency, not hosted certification. |
| Full current-version suite | 7,718 passed / 7,722; 4 failed in 429 files. Two current-scope failures block the gate. Two retained Meta failures are non-blocking under the existing manifest. No failures were suppressed. |
| Real Google provisioning, hosted connection/import/refresh and monitor | Pending manual Cloud setup and a passing release gate. |

The full run's failing current-scope report case is
`ga4-ad-comparison-download-browser.test.ts` → `downloads with promo-rounding refresh timing and recovers after core refresh failures`.
It times out checking the publication-status message after simulated refresh failures.
The isolated case failed again on the feature and also failed on an isolated archive
of unchanged parent `7de67ec009b0c9bebb0d8756eee49a4052c18425` (publication-status
visibility assertion). This establishes a pre-existing failing case; its underlying
cause is not established. No report code or test assertion was changed to hide it.
It must be resolved separately before deployment, rather than declaring the gate passed.

The second current-scope failure is `custom-report-regression.test.ts` → `fails
closed on unsourced standalone report creation`. Its source-string assertion expects
LF line endings, while this Windows checkout and the initial parent archive have
CRLF. The expected text is present after newline normalization. The unchanged test
passes after normalizing only the isolated baseline fixture's `reports.tsx` to LF.
No application file or assertion was changed for this diagnosis; this is a test
portability issue, not evidence of missing campaign access protection.

The full run completed once in 1,307 seconds. Only the failing cases were rerun for
diagnosis. Existing analytics fixtures regenerated by the tests were restored;
the earlier modified `precision2-ui-download.pdf` was preserved and excluded from
the feature commits. No live data or hosted environment was changed.

Local receipts are in `.local-test/ga4-self-service-*.log` (ignored, not committed).
