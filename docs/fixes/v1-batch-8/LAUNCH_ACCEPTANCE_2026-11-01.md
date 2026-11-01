# Minimum launch acceptance — November 1, 2026

**Status: Task 4 in progress; launch approval remains pending.** Tasks 1–3 remain
complete for their documented minimum scope. This record reconciles existing
evidence; it does not certify every analytics lifecycle or restart the audit.

## Current release and reused evidence

Live runtime: `0a42aac893b56e471246a75f3a4a0a5423e846e3`.
Repository HEAD at the check: `d38e9e745c39222154f3e00dd138d081e44ac4f6`.
The difference from runtime is documentation/local validation only; application
paths have no tracked modifications. The read-only receipt checks this boundary.

| Boundary | Evidence and limit |
| --- | --- |
| Dependency/input exposure | [Task 1](DEPENDENCY_EXPOSURE_2026-11-01.md), [collection correction](REQUEST_COLLECTION_LIMITS_2026-11-01.md), and successful hosted run `41300057713` on the live revision. No repeat UI or full-suite run is justified by this review. |
| Production identity and new domain | [Task 2](CLERK_CUTOVER_2026-11-01.md#task-2-complete--new-domain-returns-and-exact-cleanup): both user-confirmed account scopes, four callback families, independent preservation/cleanup receipts. |
| Minimum recovery | [Task 3](MINIMUM_RECOVERY_2026-11-01.md): restored-copy evidence, compatible code/schema baseline and actual saved key authenticating 16/16 encrypted fields. No repeat key prompt or restore. |
| Current deployment/access | Public health 200 with the exact production SHA; clients and campaigns deny unsigned requests with 401. This is not authenticated whole-app coverage. |
| Retained campaign refresh | All three current campaigns completed the ordinary November 1 13:00 UTC scheduled work, through October 31, without work-record errors. Earlier morning completions also remain applicable. |
| Report delivery before suspension | October 30's exact report send has a delivered Mailgun audit and a matching campaign/platform snapshot. October 31 and November 1 failed with Mailgun HTTP 401 `Forbidden`; neither failed send has a sent timestamp or snapshot. |
| Mailgun recovery | User-triggered exact report test returned HTTP 200 / `delivered`; the independent saved audit confirms success, no error and the exact saved recipient. This provider-recovery blocker is closed; it is not a new natural scheduler run. |

Current metadata receipt:
[`read-2026-11-01T14-39-31-503Z.json`](validation-2026-11-01-launch/read-2026-11-01T14-39-31-503Z.json).
The [14:33 pre-send receipt](validation-2026-11-01-launch/read-2026-11-01T14-33-58-052Z.json)
provides the comparison. Delivery count increased from two to three; failed count
remained two, and the report's schedule-enabled/status/last-sent fields and
scheduled send-event records remained unchanged.

## Mailgun restoration: COMPLETE

The user confirmed that their Mailgun account was disabled, then confirmed it
restored on November 1. This is consistent with the failed sends; no application
code defect has been established. The pre-send read contained no report attempt
after that morning's failure, so one actual delivery check was necessary.

The existing Promo GA4 Overview report is
`670f24df-9886-4332-b1c6-34c16b955331`, campaign
`b74f98af-ede9-47af-9b19-0720ebb4d2c0`, active, scheduled, with one saved recipient.
The exact existing `/api/platforms/google_analytics/reports/:reportId/send-test`
route checks report/campaign access and platform, then uses `sendTestReport`.
The helper validates the campaign, renders the PDF, creates an email audit,
sends to the saved recipient and checks Mailgun delivery. It does not change the
schedule or mark the scheduled run sent. Overview does not enter KPI/Benchmark
recompute in `preflightGA4ReportKPIConsumers`.

There is no GA4 test-send button in the current UI; do not invent one. The
[manual helper](validation-2026-11-01-launch/manual-mailgun-check.js) uses the
existing guarded API and shows a temporary button in the owner's browser. It
first displays the saved recipient. Only the user's explicit click sends one
test PDF. Wrong origin/account/report, recipient changes, duplicate clicks and
repeat attempts are guarded. It emits a redacted result and accepts only actual
`delivered` status as a pass. A pending or interrupted request must be inspected
before another send. The recipient/token is not copied into the evidence output.

Validation: `node --check` passes; the
[offline controls](validation-2026-11-01-launch/check-mailgun-helper.cjs) pass nine
cases with no network or real email. The user explicitly clicked the send button
and returned [PASS_MAILGUN_DELIVERY](validation-2026-11-01-launch/user-mailgun-delivery.json)
at `2026-11-01T14:37:32.213Z`, HTTP 200, `delivered`, one recipient.

Independent READ ONLY verification identifies exact audit
`c97157ec-614b-4392-ae1b-f7fcc5c90d7c` for the same report and campaign:
`mailgun-api`, `success=true`, `delivery_status=delivered`, no error, provider
response present and `matches_saved_recipients=true`. Database timestamp text is
`2026-11-01 14:37:23.227716` created and `2026-11-01 14:37:29.515` delivered.
The exact-audit query casts timestamp-without-time-zone columns to text to avoid
the local PostgreSQL driver's timezone conversion; older aggregate receipt times
must not be used as absolute UTC chronology. **Mailgun recovery is closed.** No
repeat send, code deployment or key change is required. This test delivery does
not constitute a new natural scheduler run or whole-Reports certification.

## Global scheduler warning: bounded disposition

The global 13:00 UTC run ended with five single-campaign refresh failures at
13:10:30 UTC. All three current campaigns independently have completed work at
13:07–13:10 UTC. No current eligible recovery work is stranded; the 193 historical
pending rows have `invalidated:` scope hashes and are excluded by the recovery
predicate, not missing customer refreshes.

The metadata-only inventory finds exactly five additional active GA4 targets.
All are historical campaigns with null client IDs, no matching client, owners
outside the two production identities and no saved GA4 credentials. The existing
scheduler eligibility utility filters status only, so these remain global-run
candidates. This is consistent with the five-failure warning; the public error
does not identify individual failures, so exact per-campaign error attribution
is not proven. Do not claim global scheduler health is green or change/delete
these historical records as part of Mailgun recovery. No failure of the three
current scheduled campaign runs is present in this evidence.

## Remaining launch decision

1. **November 1 user direction:** Google verification is still pending. Clients
   will use the alternative setup route until verification; do not keep requiring
   Google user-consent acceptance as the immediate launch task. The user confirmed
   service-account setup for GA4, Google Sheets and Google Ads; CSV is a separate
   import path, not the intended substitute for these connections. This does not
   authorize removing all Google Ads support or weakening resource permissions.
2. Verify the chosen alternative's actual new-client journey, then use that
   result with the applicable evidence above for the Task 4 decision.
   Do not add a new general audit, recovery drill or repeat provider imports.

### Alternative setup: current bounded findings

The [14:51 read-only receipt](validation-2026-11-01-launch/read-2026-11-01T14-51-43-753Z.json)
confirms Promo uses GA4 `service_account` with a matching database permission.
Its ordinary afternoon refresh completed. V1 Batch 5 Test and Batch 1 Provider
Check currently use GA4 `access_token`; the latter's Sheets connection also uses
`access_token`. No current Google Ads Spend connection exists. Do not represent
those OAuth passes as proof of fresh service-account setup for every provider.

Code-traced fresh-client limitations:

- Before the correction below, `campaigns.tsx` mounts `IntegratedGA4Auth` without
  a mode override and its `oauth` default hides the service-account form. The
  explicit-only form was unreachable from normal creation. OAuth was deliberately
  made the default in the earlier [onboarding correction](../v1-batch-1/ONBOARDING_IMPACT.md).
- GA4 shared access requires Google Viewer permission, the property allowlist
  and an exact owner/client/provider/resource grant. Sharing the property alone
  does not grant an arbitrary app client access. Missing approval is deliberately
  rejected. The internal database grant avoids a Render grant entry; it does not
  automatically approve a fresh client. There is no customer grant-writing API.
- Sheets shared access similarly requires sharing plus an exact client grant;
  its conditional UI exists, but the current retained Sheets connection is OAuth.
- Google Ads shared Spend has a conditional temporary-connection UI and requires
  its account allowlist, exact client grant, service-account permission, appropriate
  Google Cloud project API access, and compatible account currency/timezone. Real connection/import/refresh
  acceptance remains unproven for that path.

At the read-only assessment, the component, campaign page, three service-account
utilities, storage and three focused test files were unchanged from full-suite
revision `357e950f`. No new grants or imports were made. The UI correction and
current focused evidence are recorded below. Existing Promo operation is proven within the
observed scope; efficient fresh-customer alternative onboarding and a general
"no connection errors" claim are **not established**. The intended alternative is
now confirmed: service accounts for all three Google sources. Address only the
concrete missing entry/setup boundaries and verify the fresh-client path for each
source in one consolidated acceptance check, preserving exact client permissions.

### GA4 onboarding entry correction — deployed as `b2bfe6cc`

**Root cause:** the current creation page passes no connection-mode override;
the component only fetched availability and rendered shared access in explicit
service-account mode. Backend support alone therefore did not provide a usable
new-customer entry point.

**Minimal correction:** `client/src/components/IntegratedGA4Auth.tsx` now silently
reads the existing campaign-guarded availability endpoint and offers an explicit
`Use service-account access` button. OAuth remains the default and stays usable
if shared configuration is absent or its status request fails. Switching back is
explicit, and switching methods is disabled during a connection attempt. Stale
availability responses are ignored after the campaign changes. The form explains
both Google Viewer permission and the existing MimoSaaS client approval.

**Traced continuation:** component POST -> existing `ga4-service-account/connect`
owner/allowlist/client-grant/provider checks -> existing storage connection ->
`onSuccess` -> `loadWizardGA4Properties` -> `ga4-connection-status` returns only the
saved service-account property -> existing `selectGA4Property` accepts that exact
saved property -> existing campaign-scope/Confirm/initial-import path. No route,
storage, schema, provider utility, import, scheduler or calculation code changed.
No permissions, connections or campaign data were changed for validation.

**Evidence:** [focused results](validation-2026-11-01-launch/service-account-onboarding-tests.json)
record 172/172 passing tests in eight files, zero failures/skips. Nine isolated
Chromium cases execute the real auth component: slow discovery without automatic
connection, exact property submission and success continuation, permission and
provider denial without advancement, unavailable/403/503 status with working
OAuth, stale campaign response rejection, and retained explicit service mode.
Existing route/access, initial-import, service-account and fetch-credential tests
also pass. `npm run check` and `npm run build` exit 0; the build retains existing
Browserslist/chunk warnings. Initial test/build startup hit sandbox `spawn EPERM`;
the authorized process-capable reruns passed. No runtime workaround was added.

**Deployment:** commit `b2bfe6cc5bd5151d42ad000a153620ec984d7360` is pushed to main.
The [anonymous new-domain check](validation-2026-11-01-launch/onboarding-deployed-2026-11-01T15-28-38-297Z.json)
at 15:28:38 UTC confirms that exact production revision, HTTP 200 / `ok:true`,
the new choice/return/approval text in the published JavaScript, and HTTP 401 for
all three service-account status endpoints without a login. This is static
publication/access evidence, not an authenticated Google connection attempt.
The [exact-commit GitHub workflow](https://github.com/CrazySkillz/MF_real_latest/actions/runs/41321181273/job/124891551287)
completed successfully, independently read at 15:36:09 UTC. Its current-version
tests, certification check and retained deferred-source evidence steps all passed;
the [saved CI receipt](validation-2026-11-01-launch/onboarding-hosted-ci.json)
also reconfirms the exact healthy live revision. Deferred test success does not
change provider scope or constitute live Google service-account acceptance.

**Limits/remaining work:** these browser cases use synthetic HTTP and prove the
component boundary, not a complete Google import or fresh-client live acceptance.
Per-client resource approval and GA4/Ads provider allowlists are still required;
the button does not create either. Current live Sheets evidence is OAuth, and Ads
service-account connection/import/refresh remains unproven. Reuse completed
recovery/Mailgun/domain checks; final launch acceptance remains open.

### Google Ads test account — read-only setup preflight

The user supplied Customer ID `495-128-1615` for the live Google Ads check.
The [15:45 read-only preflight](validation-2026-11-01-launch/ads-setup-2026-11-01T15-45-32-561Z.json)
verifies the current second-account owner and `Batch 1 Validation` client through
its existing reference campaign. That client has zero dedicated Ads Spend
connections and no exact database grant for `4951281615`. Its reference campaign
uses EUR / Europe/Amsterdam; the Google account's own settings remain unverified.
Zero writes, token issuance or provider calls occurred. Local `.env` lacks the
service-account setup and is explicitly not evidence for Render configuration.

The user subsequently confirmed the existing `Overview -> Total Spend + -> Google Ads`
panel displays the service-account email, that email already has Read only access
in Ads account `4951281615`, and Render's
`GOOGLE_ADS_SERVICE_ACCOUNT_ALLOWED_CUSTOMER_IDS` already includes that ID.
These are setup confirmations, not yet a successful provider API connection.

The exact missing client permission was rehearsed with rollback, then applied
under the user's authorization for this account and test client. The
[preflight](validation-2026-11-01-launch/ads-grant-preflight.json) and
[committed receipt](validation-2026-11-01-launch/ads-grant-applied-2026-11-01T16-00-47-460Z.json)
prove one grant for production second account / client
`e3ec20ad-89ea-450d-8caf-8c0ab7abd220` / `google_ads` / `4951281615`, independently
verified after commit. No connection, analytics or provider writes occurred.
This replaces the earlier finding of no grant. Existing connections were not changed.

The [single-run browser check](validation-2026-11-01-launch/manual-ads-service-account.js)
is prepared for disposable draft `b89ead82-29a3-4671-b281-66756051f966` only.
It checks connection, saved preview and one explicit provider refresh, then
cancels that exact draft on success. It never activates the draft or imports a
Spend source. Google operations are reads; dedicated connection/daily-fact writes
are confined to the draft. Identity, client, customer, draft state, currency and
timezone guards remain intact. Failed runs stop without retries and retain the
exact draft for diagnosis/cleanup; repeat pastes do not repeat writes.
The [synthetic helper results](validation-2026-11-01-launch/ads-browser-helper-tests.json)
cover success with/without facts, wrong origin/account, disabled configuration,
changed draft, provider denial, foreign preview rows, skipped refresh and cleanup
denial. These tests make zero live calls. Actual provider acceptance is pending;
even a successful empty preview will not certify nonzero Spend calculations or
the full financial-source lifecycle.

The earlier developer-token requirement in this assessment was inaccurate:
current [Google documentation](https://developers.google.com/google-ads/api/docs/api-policy/developer-token)
says tokens were sunset September 9, 2026 and API access now belongs to the Cloud
project; the app already omits an absent token header. The service account's
project needs suitable API access for the target account, independently of
interactive OAuth verification. [Google's service-account setup](https://developers.google.com/google-ads/api/docs/oauth/service-accounts)
requires granting its email access in the Ads account. This documentation
correction requires no application-code change or new developer-token task.

Read-only diagnostics use public GETs or verified TLS and explicit READ ONLY database
transactions ending in rollback. Credential values, report content and recipient
addresses are omitted. The user-triggered test added the exact delivery audit
above and sent one PDF. The exact test-client permission above is the sole new
live write in this Google Ads setup step; no schedules, campaigns, source values
or provider configuration were changed. The localized
GA4 auth-component correction above is the only application-code change here.
