# Batch 1 consolidated close-out, October 31

This is the current execution ledger. It supersedes pending statements in the
October 30 acceptance record where later evidence is listed here. Historical
receipts keep their original date, scope and result.

**20 original code corrections implemented; 10 findings CLOSED and 10 OPEN for
acceptance.** This is not 10 new code fixes. Whole-app totals are **130 findings:
109 OPEN, 10 DEFERRED, 11 CLOSED** (V1-001/002/003/004/005/012/026/027/034/053/063).
Whole-app release remains NO-GO. The [conversion/file packet](INGESTION_ACCEPTANCE_2026-10-31.md)
closes V1-001/026, including the deployed one-line download compatibility correction
`3c304f97`. All account/source/ingestion fixtures were removed with independent
readback. Existing campaign figures and refresh schedules were not changed.

## Evidence already complete: do not repeat

Account session update: the user reports `PASS_OWNER` and `PASS_FOREIGN`, and
provided the full passing `PASS_RECHECK`. Exact seven-row cleanup and fresh
read-only readback pass. V1-002/003/053 are closed within their original boundaries;
see [complete evidence and limits](ACCOUNT_API_PROCEDURE_2026-10-31.md). The original browser
report fixture was invisible because `schedule:null` fails the final scheduled
list filter. This was a test-setup defect; no application change is warranted.
The [procedure correction](ACCOUNT_API_PROCEDURE_2026-10-31.md) preserves the
owner results, repairs only the existing paused browser fixture without requests,
and adds final-filter and altered-fixture coverage. The user confirms foreign
report absence but did not confirm positive owner reappearance for that first
fixture. The subsequent [source-access packet](SOURCE_ACCESS_PROCEDURE_2026-10-31.md)
now proves actual owner report visibility plus foreign absence for its own
fixture and closes V1-034. V1-052 still has notification/persistent-state limits.
Do not repeat either completed API packet.

| Completed work | Evidence and boundary |
| --- | --- |
| Both-account collection/campaign reads | [24 user-reported checks](validation-2026-10-30/user-remaining-reads.json). Empty collections do not establish owned creation or foreign existing-row denial. |
| Campaign edit denial and ordinary sign-out/Back/account switch | [Campaign edit](CAMPAIGN_EDIT_ACCESS_2026-10-30.md), [Reports/cache record](REPORT_CACHE_ACCESS_2026-10-30.md), [acceptance record](ACCEPTANCE_STATUS_2026-10-30.md). Do not repeat the invalid-name edit or ordinary Clients transition. |
| GA4 authorization, property selection, draft creation and initial import | [User journey](validation-2026-10-30/manual-provider-journey.json), [persisted active scope](validation-2026-10-30/disposable-scope-2026-10-30T21-02-08-325Z.json). Real configured Google consent succeeded in the second app account. |
| HubSpot authorization and first import | [Receipt](validation-2026-10-30/hubspot-initial-import.json): confirmed revenue EUR 0, pipeline EUR 3,200; user journey and exact persisted scope. |
| Salesforce authorization and first import | [Receipt](validation-2026-10-30/salesforce-initial-import.json): confirmed revenue EUR 0, pipeline EUR 51; combined pipeline EUR 3,251 and source split confirmed. |
| Shopify authorization and first import | [Receipt](validation-2026-10-30/shopify-initial-import.json): selected tag, one matched order, EUR 785.95; CRM amounts preserved. |
| Sheets authorization, mapping and first import | [User journey](validation-2026-10-31/google-sheets-manual-journey.json), [saved import](validation-2026-10-31/google-sheets-initial-import.json): two additive dated rows, EUR 31,000. |
| Revenue card/source-list consistency correction | [Exact trace, tests, deployed evidence and user confirmation](REVENUE_SOURCE_TRANSITION_2026-10-31.md). Full [hosted workflow 41155357151](https://github.com/CrazySkillz/MF_real_latest/actions/runs/41155357151) passes; deployed runtime `fa779287` verified. The later total EUR 64,715.97 includes the independently observed native GA4 increase. No new live import transition is inferred from the final user confirmation. |
| Approved obsolete plaintext cleanup | [Close-out record](CLOSEOUT_2026-10-30.md): 223 exact approved records cleared and independently checked; preserved connections unchanged. This does not settle other old ciphertext or historical logs. |
| Backup and key custody | Existing saved key, downloaded export and same-machine restore evidence in [recovery record](../v1-batch-8/RENDER_EXPORT_RESTORE_2026-10-29.md) and [credential record](../v1-batch-8/LEGACY_CREDENTIAL_REMEDIATION.md). Independent-machine recovery is a distinct remaining requirement. |

## V1-027 closure

The original defect was unescaped input in four OAuth popup HTML/script paths.
The existing serializers corrected those exact branches. [Current-code local
Chromium receipt](validation-2026-10-31/callback-closeout.json) passes six error
rendering cases: Salesforce error and description, LinkedIn and Meta descriptions,
Google error control, and simulation-state encoding. Browser requests were blocked;
no deployed exploit, real token or provider request was used. The current access
regressions also remain covered by the completed hosted workflow.

The finding's recorded remaining gate was **successful configured OAuth callbacks**.
The five real provider connections above supply that evidence, including the
affected enabled Salesforce callback. This closes V1-027 for the enabled release
scope. LinkedIn/Meta functionality stays deferred; their retained error-rendering
security remains tested. Simulation remains production-disabled. Closure does
not certify OAuth state replay/session handling (V1-078), renewal/migration
(V1-088), resource revocation (V1-123), or all provider analytics lifecycles.

## Three execution packages, one owner for each remaining check

These are work packages, **not a promise of three clicks or three remaining
assertions**. Do not split them into one-question-per-click instructions. Prepare
and locally verify each complete procedure before asking the user to operate it.
Each receipt is reused by every dependent finding/batch. A failed check pauses
only dependent actions; successful evidence is retained.

| Package | Consolidated work | Execution and exit condition |
| --- | --- | --- |
| A: account and API boundaries | Attribution restart and campaign-linked/default-model acceptance; remaining notification/persistent-state transitions; legacy Meta positive limit; connector-spend positive/downstream acceptance. Global/Trends reads, ordinary ownership checks, transfers and actual Reports owner/foreign visibility are already complete. | Trace/rehearse only the remaining paths before one grouped manual account session. Reuse passed results and do not recreate the removed account/source fixtures. No production saturation test or new legacy tables. |
| B: provider and retained whitelist lifecycle | Renewal/reconnect and invalid-session/replay boundaries for configured providers; exact disposable resource-grant denial/revocation; retained whitelist edit/reload and sender boundary, with automatic email imports still disabled. Conversion and multipart/public-URL ingestion are complete. | Reuse established test mappings; do not repeat initial consent/imports. A shared provider grant must not be revoked merely because the app campaign is disposable. Prepare exact cleanup and expected outcomes before one grouped provider session. |
| C: historical security and recovery | Historical log exposure/retention and any justified rotation; remaining incompatible-ciphertext disposition; recovery with the saved key on another machine. Startup key/verified-TLS enforcement now has deployed-code, production-health and successful-write evidence; exact orphan disposition is recorded as retained/unassigned. | Retain the completed backup/key-custody/same-machine restore results. Prepare any data change after exact inventory/rehearsal; the 223-record approval does not authorize another deletion. Independent-machine recovery cannot be replaced by another same-machine restore. Reuse the evidence for Batch 8. |

Order: prepare A first, reuse its fixtures in B, and perform safe read-only C work
while awaiting the user's session results. No user action is requested on an
untraced route or untested mutation. The API write/cleanup bundle and production
operations bundle are not yet certified for execution merely by this plan.

**Subsequent October 31 preparation:** [The executable combined account procedure](ACCOUNT_API_PROCEDURE_2026-10-31.md)
now covers global/attribution positive and foreign-row cases, remaining Trends
access, bounded quota-header checks and the Reports cache boundary in one three-pass
session. Its corrected local rehearsal passes 81 API assertions, two fixture guards,
nine transactional cleanup cases and final scheduled-list selection cases. All
three API passes and exact cleanup now pass; positive report-card reappearance is
unverified. Transfer, retained LinkedIn/Meta child-edit and positive connector-spend
fixtures remain separate and explicitly unverified; this is not full package A closure.

**Subsequent packet complete:** [transfer, source-edit and Reports procedure](SOURCE_ACCESS_PROCEDURE_2026-10-31.md)
records all 16 user-operated assertions passing. Independent database checks
verified the stored edit/transfer, rehearsed cleanup, removed the five exact
fixtures and reread their absence. V1-034 is closed. The real Reports component,
current route/storage bodies and 10 cleanup safeguards also pass locally. Legacy
Meta tables are absent in production, so their retained local tests are not
represented as deployed acceptance. This packet does not close remaining
notification, legacy Meta or connector-spend acceptance by inference.

Historical preparation: [the read-only Trends procedure](validation-2026-10-31/manual-remaining-trends.js)
and its [13 safety cases](validation-2026-10-31/manual-trends-validation.json)
preceded the completed live combined account packet. Its owned no-keywords and
foreign denial checks now pass; V1-003 is CLOSED. Do not request that test again.

## All 20 findings and exact outstanding acceptance

| Finding | Status | Package | Remaining acceptance; existing proof carried forward |
| --- | --- | --- | --- |
| V1-001 | CLOSED | B, C | Live valid zero/retry, anonymous/wrong-token denial, currency/date rejection and persisted count/total/average pass. Exact orphan is retained unassigned and excluded by missing campaign; no historical rewrite. See ingestion acceptance. |
| V1-002 | CLOSED | A | Positive owner writes, ignored supplied owner, real foreign-row exclusion, encrypted/redacted disconnected integration, persisted-state verification and exact cleanup pass. Legacy unowned rows remain excluded and unassigned. |
| V1-003 | CLOSED | A | Remaining Trends foreign 404 / owner no-keywords 400 passed in the combined live procedure; prior campaign reads and anonymous denials are retained. Provider query/formula correctness is separate. |
| V1-004 | CLOSED | — | Approved automatic email-import exclusion is enforced and verified; no more acceptance for this disabled feature. |
| V1-005 | CLOSED | — | Production test-email transport disabled and denial verified. |
| V1-006 | OPEN | A | Owned detached create/read/edit, reload/account-switch persistence and actual foreign parent/row denials now pass live. Actual process-restart persistence and broader campaign-linked/default-model acceptance remain separate. No current Attribution page is invented. |
| V1-008 | OPEN | C | Remaining incompatible ciphertext disposition and independent-machine recovery. Explicit-key/verified-TLS startup enforcement now has deployed-code, production-health and successful-write evidence; private environment was not inspected. Existing linked-field decrypt, key custody and same-machine restore remain complete. |
| V1-026 | CLOSED | B | Live supported multipart CSV and public HTTPS URL import pass; current local destination/DNS/redirect/size/deadline/parent controls pass. Missing client identifier corrected in deployed 3c304f97; exact fixtures removed. |
| V1-027 | CLOSED | — | Callback rendering guards plus configured real OAuth successes meet this finding's recorded gate; exact limits above. |
| V1-030 | OPEN | B | Deployed supported whitelist edit/save/reload and accepted/removed-sender behavior. Existing PostgreSQL clear/omission controls retained; no automatic email re-enablement. |
| V1-034 | CLOSED | A | Actual owned draft creation, owned transfer, foreign source/destination and magic-ID denial pass. Independent stored-scope verification and exact cleanup pass. Connect remains release-disabled. Batch 4 transfer-copy correctness stays separate. |
| V1-052 | OPEN | A | Actual owner report-card visibility and settled foreign absence pass in the second packet. The first fixture's reappearance was not confirmed. Notification transition and remaining persistent-state surfaces remain. Ordinary sign-out/Back already passed; local query/cache/toast and delayed-callback tests retained. |
| V1-053 | CLOSED | A | User-operated bounded requests prove caller test flags still receive configured OAuth/LinkedIn/import limits and counted requests. Original bypass is closed; distributed load/capacity is not inferred. No saturation test performed. |
| V1-054 | OPEN | A | LinkedIn valid owned edit preserves ID/parent despite replacement payload; foreign edit denied and stored state verified. Legacy Meta positive deployed acceptance is unavailable because its tables are absent; retained local cases pass. Owner 400/foreign 404 invalid campaign edit is complete and will not be repeated. |
| V1-057 | OPEN | C | Historical hosting/provider log access and retention disposition; rotate only if evidence and exact scope require it. Forward logging regressions pass; database cleanup does not erase logs. |
| V1-063 | CLOSED | — | Production mock-write routes disabled and denial verified. |
| V1-075 | OPEN | A, C | Owned deployed connector-spend alias acceptance and historical orphan/downstream disposition. Local atomic owner/currency/date controls pass; current inventory has no connector-derived sources. No current frontend caller: do not invent UI steps. |
| V1-078 | OPEN | B | Configured real callback successes are complete. Invalid session/state/replay and deferred shared signing boundaries remain; stateless nonce checks are not proof of single-use replay prevention. |
| V1-088 | OPEN | B, C | Actual renewal/reconnect and remaining old incompatible ciphertext disposition. Ten local migration/renewal interleavings and the approved 223-record plaintext cleanup are complete. |
| V1-123 | OPEN | B | Deployed exact-resource denial/revocation and worker behavior on disposable scope. Actual GA4 AND Sheets consent/imports passed; reviewed Promo grant and scheduled continuity evidence retained. |

## Scope and protection

- Test campaign: `36631f9f-5f32-4ae6-8d20-d8430abb364c`, **Batch 1 Provider Check**,
  under **Batch 1 Validation**, second app account, EUR / Europe/Amsterdam.
- Promo and V1 Batch 5 Test remain protected. A provider account may be shared:
  disposable app campaign scope alone is not proof that global token revocation
  is safe. Destructive scope must be proved before any instruction is issued.
- Whole-source analytics add/edit/delete/scheduled refresh/report certification
  belongs to its existing cross-batch matrix. Reuse the relevant B1 evidence;
  do not invent new Batch 1 prerequisites or infer full certification from imports.
- Scheduled report delivery is Batch 7/shared release work. Production Clerk
  cutover and Google Ads acceptance remain postponed by the user. None is silently
  waived, moved into B1 as new work, or presented as a completed requirement.
- No full test rerun, deployment or production mutation is needed for this
  documentation-only reconciliation. New code changes, if any, require their own
  focused/adjacent checks and the existing release gate.
