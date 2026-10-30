# Batch 1 acceptance status, October 30

Batch 1 release acceptance remains **OPEN: 3 closed, 17 open**. All 20 original
forward corrections are implemented. This record accounts for every finding;
it does not turn local tests into live provider acceptance. The earlier full
hosted run [41116916268](https://github.com/CrazySkillz/MF_real_latest/actions/runs/41116916268)
passed on test-only commit `05542b6e`; that success predates the toast correction below.

## Additional confirmed correction

V1-052's module-state review reproduced a notification crossing accounts in
isolated Chromium: the actual `App` keyed query provider remounted `Toaster`, but
`use-toast.ts` retained its module-global notification. A report-name notification
from account A remained visible in account B. This is a synthetic reproduction,
not an observation of another customer's production data.

The existing per-account QueryClient now also identifies the notification scope.
`client/src/components/ui/toaster.tsx` activates/clears that scope on its existing
mount boundary. `client/src/hooks/use-toast.ts` filters initial render, cancels old
removal timers, and binds notification callbacks to that scope. Delayed callbacks
from the previous account cannot display a message or replace the current
account's message. Returning to the same account creates a new scope, so the
previous session's callbacks remain rejected. The underlying toast store, limit,
visuals and ordinary update/dismiss behavior are preserved.

Only those two application files change. No endpoint, database record, credential,
formula, scheduled refresh or report-generation path changes.

Validation:

- [Before](validation-2026-10-30/toast-isolation-before.json): old-account toast
  remains visible; the isolation assertion fails.
- [After](validation-2026-10-30/toast-isolation-after.json): six browser checks pass,
  including switch, delayed callback, sign-out, return-to-account, update and dismiss.
- The new `server/v1-toast-account-browser.test.ts` runs the browser regression in
  normal CI. Browser requests are restricted to loopback; identities are synthetic.
- [Focused receipt](validation-2026-10-30/toast-validation.json): 93/93 tests across
  five files pass, zero skipped; TypeScript and the production client/server build pass.
- Real signed-in deployed notification transitions have not been operated by the
  agent. The user retains control of their browser. Deployment/full hosted results
  for this correction must be recorded separately.

## Remaining acceptance, every finding

The user subsequently confirmed **both accounts said PASS** for the consolidated
12-read procedure: [24 reported successful checks](validation-2026-10-30/user-remaining-reads.json).
This completes the requested read group for V1-002/V1-003/V1-006. Empty lists
cannot prove a positive owned insertion or an actual foreign-row case, and no
write/provider/full-page acceptance is inferred. The requests below for this
specific read group are fulfilled and must not be repeated.

The detailed implementation evidence remains in [the Batch 1 record](README.md).
Existing completed checks are carried forward; they are not being requested again.

| Finding | Current evidence and exact remaining requirement |
| --- | --- |
| V1-001 | Conversion owner/token, zero/currency/date/retry and PostgreSQL race controls pass locally. New read-only inventory finds one event with a missing campaign, none for either protected campaign. A valid deployed sender/retry and downstream check remains; no orphan event was deleted. |
| V1-002 | Authenticated owner filters and encrypted/redacted inserts are tested. Current global tables contain 4/7/5 unowned metrics/performance/integration rows; all five integration credential fields are empty. Sole runtime list callers pass the actor. These rows remain unassigned and excluded, not guessed into a customer. Consolidated live owner/second-account reads requested; owned live creation remains unverified. |
| V1-003 | Previously recorded anonymous denial and Promo owner/foreign checks remain valid. Consolidated remaining campaign reads are prepared/requested. Google Trends' ordinary missing-keywords/provider branch is separate; no provider query was fabricated. |
| V1-004 | **CLOSED.** User-excluded automatic email imports are disabled in UI/setup/ingestion. Re-enablement requires provider acceptance. |
| V1-005 | **CLOSED.** Production test-email transport is disabled and deployed denial verified. |
| V1-006 | Local owned persistence, deletion races and foreign-parent checks pass. All five current attribution tables are empty. Consolidated reads requested; deployed owned create/reload/restart remains unverified. No invisible attribution UI journey is invented. |
| V1-008 | Explicit production-key/verified-TLS code and local negative tests pass; user-executed Render check decrypted all populated properly linked credentials. Key custody and same-machine protected restore are recorded. New direct DB connection uses verified TLS 1.3; this does not identify/inspect Render's process configuration. Historical incompatible ciphertext disposition and independent-machine recovery remain open. |
| V1-026 | Local URL/DNS/redirect/size/deadline and current-parent controls pass. Supported token-authenticated file webhook still needs a valid deployed attachment/egress test; automatic email exclusion does not exclude this route. |
| V1-027 | Real-browser synthetic callback encoding tests pass. Actual configured successful provider callbacks remain unverified. |
| V1-030 | PostgreSQL whitelist save/reload/clear/omission/removed-sender controls pass. Supported generic whitelist path's deployed edit/sender acceptance remains open; no automatic email-import re-enablement is proposed. |
| V1-034 | Temporary-ID bypass removed; both transfer parents guarded and Batch 4 tests retained. Actual owned draft/transfer journey remains unverified. |
| V1-052 | User-confirmed ordinary sign-out/Back/account switch; report-cache guard deployed; additional toast leak reproduced and locally corrected above. Complete deployed Reports/notification and retained persistent-state acceptance is not claimed. |
| V1-053 | Production caller-test-flag bypass removed; local environment/internal-refresh/identity quota tests pass. Deployed authenticated quota behavior remains unverified. No live saturation traffic was sent. |
| V1-054 | Local real-handler and PostgreSQL immutable-parent controls pass; user confirmed invalid campaign edit gives owner 400 / second account 404. Valid owned child edits and rejected foreign-parent live mutations remain unverified. |
| V1-057 | Forward bearer/body/provider-error logging corrections and synthetic marker tests pass. Historical hosting/provider log access/retention and any necessary narrowly scoped rotation remain unverified. Removing old database plaintext does not erase historical logs. |
| V1-063 | **CLOSED.** Both production mock-write endpoints deny access; deferred provider features remain deferred. |
| V1-075 | Both spend aliases enforce owner/currency/dated records with atomic storage. Current inventory finds no `connector_derived` sources. Previously inventoried orphan spend rows remain excluded by the traced active-source financial joins. Their full historical/downstream disposition and owned deployed route acceptance remain open. |
| V1-078 | Purpose-specific configured/missing/tampered/expired signing tests pass. Configured real callback/session acceptance remains open; postponed provider functions are not silently included or waived. |
| V1-088 | Ten PostgreSQL stale-migration/renewal interleavings pass. Exact approved 223 plaintext rows cleared and independently verified. Live renewal/reconnect and remaining historical ciphertext disposition remain open. |
| V1-123 | Exact resource grants enforced in connect/storage/hydration; reviewed Promo grant and earlier scheduled continuity evidence retained. Real customer Google consent and deployed resource denial/revocation across workers remain unverified. Do not revoke Promo's working grant as a test. |

## Current read-only database evidence

[Receipt](validation-2026-10-30/remaining-data-2026-10-30T20-02-56-770Z.json),
20:02 UTC: exact target fingerprint, certificate verification,
`REPEATABLE READ READ ONLY`, rollback. No app startup, storage getter, provider call,
credential value or write. Both Promo and V1 Batch 5 Test remain active with
consistent campaign/client ownership. Inventory script:
[read-remaining-data.cjs](validation-2026-10-30/read-remaining-data.cjs).

## Browser-state inventory boundary

- Query cache and client selection: existing per-actor provider/reset and selection
  keys; actual Clerk ordinary transition was user-confirmed.
- Reports metadata: campaign-access gate implemented/deployed; local real storage
  and component-effect tests pass. Full live Reports transition remains unverified.
- Toast module store: confirmed additional defect and correction above.
- Campaign summary snapshots: campaign-specific key, evaluated below the campaign
  loading/not-found guard. No cross-account render reproduced.
- Draft request ID: session-storage client key plus owned-client/server draft guards;
  contains an idempotency ID, not campaign figures.
- Comparison tab: whitelisted tab name only, no metric payload.
- Shopify remembered domain and Sheets tab selection: campaign/resource keys and
  guarded parent flows traced in current GA4/campaign pages. All retained platform
  entry paths are not dynamically certified by that trace.
- Legacy `ga4-client.ts` session-token singleton: only imported by the unmounted
  `TokenExpiryWarning` component; no current registered page caller found. No token
  migration/removal was attempted on that unused path.

## Execution groups that require the user's environment

1. **Account checks:** run the prepared [12-read procedure](validation-2026-10-30/manual-remaining-reads.js)
   once per account. It emits only statuses/counts. Additional positive write and
   draft/transfer checks must use separately identified disposable records, not
   Promo or V1 Batch 5 Test.
2. **Provider checks:** actual consent/reconnect, configured callback, authorized
   file/conversion sender, and grant revocation on a disposable source. The agent
   has no authorized signed-in provider/test-browser session; synthetic responses
   cannot close these requirements.
3. **Operations:** Render process configuration/log disposition, incompatible old
   ciphertext disposition and recovery using the saved key on an independent
   machine. Existing backup/key-custody checks are not being repeated. Production
   Clerk cutover and Google Ads acceptance remain postponed under the user's
   earlier instructions; they are shared release dependencies, not newly added fixes.

No count or release gate is silently closed by this record. No historical record
is deleted or credential rotated by the new checks.
