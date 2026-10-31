# Batch 1 consolidated close-out, October 31

This is the current execution ledger. It supersedes pending statements in the
October 30 acceptance record where later evidence is listed here. Historical
receipts keep their original date, scope and result.

**20 original code corrections implemented; 14 findings CLOSED and 6 OPEN for
acceptance.** Whole-app totals are **130 findings:
105 OPEN, 10 DEFERRED, 15 CLOSED** (V1-001/002/003/004/005/006/012/026/027/030/034/052/053/057/063).
Whole-app release remains NO-GO. The [conversion/file packet](INGESTION_ACCEPTANCE_2026-10-31.md)
closes V1-001/026, including the deployed one-line download compatibility correction
`3c304f97`. All account/source/ingestion fixtures were removed with independent
readback. Existing campaign figures and refresh schedules were not changed.

The [final consolidated API packet](FINAL_API_ACCEPTANCE_2026-10-31.md) is complete:
18 deployed assertions pass, independently checked against saved state. Nine
exact disposable rows were removed after rollback rehearsal and their absence
verified using a fresh READ ONLY connection. V1-006/030 are CLOSED within their
original boundaries; V1-075 retains historical/downstream acceptance. Its
[connector save/readback follow-up](CONNECTOR_CONTEXT_FOLLOWUP_2026-10-31.md)
is pushed and confirmed deployed as `adc5a6fe`, after all 6,935 tests, typecheck,
build and KPI gate pass. Hosted run 41204006137 also passes. No repeat manual
account/API packet or cleanup is required.

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
fixture and closes V1-034. The later [account-session close-out](ACCOUNT_SESSION_CLOSEOUT_2026-10-31.md)
adds actual Notifications/Navigation switch, late-response and reload coverage,
traces persistent-state readers, and closes V1-052 within its original boundary.
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
| Approved historical ciphertext cleanup | [Completed disposition](LEGACY_CIPHERTEXT_DISPOSITION_2026-10-31.md): separate approval, 21 restored-copy checks, exact 126-record commit and independent readback. Fresh eleven-store inventory finds zero plaintext rows and zero public-fallback fields; all 361 records remain. Current campaign connections are unchanged. Historical logs and independent recovery remain separate. |
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
| A: account and API boundaries | Legacy Meta positive limit and connector-spend historical/downstream disposition remain. Attribution linked/default acceptance, separate-process persistence, notification/persistent-state acceptance, owned connector saves, global/Trends reads, ownership, transfers and actual Reports visibility are complete. | Reuse completed packets; do not request another account/API run or recreate their removed fixtures. Trace remaining historical/consumer boundaries without production saturation or creating legacy tables. |
| B: provider lifecycle | Renewal/reconnect and invalid-session/replay boundaries for configured providers; exact disposable resource-grant denial/revocation. Whitelist edit/reload is closed for the enabled scope; automatic email imports stay disabled. Conversion and multipart/public-URL ingestion are complete. | Reuse established test mappings; do not repeat initial consent/imports. A shared provider grant must not be revoked merely because the app campaign is disposable. Prepare exact cleanup and expected outcomes before one grouped provider session. |
| C: historical security and recovery | Shared independent recovery under Batch 8 V1-016. Historical-log custody/retention disposition and both approved historical credential cleanups are complete. Startup key/verified-TLS enforcement has deployed-code, production-health and successful-write evidence; exact orphan event disposition is retained/unassigned. | Retain completed backup/key-custody/same-machine restore and 223-plaintext / 126-ciphertext cleanup evidence. Do not repeat those cleanups or the completed log questions. Independent-machine recovery cannot be replaced by another same-machine restore; no paid database is authorized or required to continue Batch 1. |

Next: finish the provider lifecycle procedure while tracing remaining historical
spend/consumer and legacy Meta limits. The completed A fixtures are removed and
must not be reused. No user action is requested on an untraced route or untested
mutation. The production operations/provider bundle is not certified for execution
merely by this plan. Independent recovery retains its existing external constraint.

**Recovery scope correction, October 31:** the user has no second computer and
questions the need for an additional paid Render database. No paid creation was
approved or performed. Remove that proposal from the immediate Batch 1 execution
path; do not request another computer or repeat the completed local restore.
The original [V1-008 finding](README.md#v1-008) concerns unsafe production-key
fallback, verified database TLS and existing ciphertext compatibility. The
original [V1-016 finding in Batch 8](../v1-batch-8/README.md#v1-016) owns production
backup/key recovery and application rollback. The original
[operations matrix](../../audits/v1-2026-10-19/OPERATIONS_AND_TEMPLATE.md) also links
key restoration to token protection: that dependency is retained, not waived.
An additional paid database was one proposed verification method, not a required
product purchase or a prerequisite to continuing the remaining Batch 1 checks.
Independent recovery remains unverified and recorded once under V1-016, with
cross-references here; no finding is closed and all counts remain unchanged.

Preserve the supplied hosting settings for that later recovery work: compute
`0.5c-1g` ($19/month, 0.5 CPU, 1 GB RAM), 5 GB storage, autoscaling enabled,
HA disabled. Do not ask for these again or alter the live settings. The October 29
export's local restoration of 71 tables / 5,903,996 rows and reported saved-key
custody remain valid within their documented limits. Neither proves independent
key retrieval or hosted recovery. No application code, production data, schedule,
credential or hosting configuration changed during this scope correction.

**Historical ciphertext completed, October 31:** the remaining 218 unreadable
historical fields authenticated with the former public development fallback.
Separate user approval, an encrypted backup and 21 restored-copy checks preceded
the exact 126-record live cleanup at 11:55 UTC. Independent readback confirms that
only those `encrypted_tokens` fields changed. The fresh eleven-store inventory
retains all 361 records, twelve current containers and thirty other-key fields;
zero public-fallback fields or nonempty plaintext credential rows remain. All
three protected campaigns and their connections are unchanged. The
[complete disposition packet](LEGACY_CIPHERTEXT_DISPOSITION_2026-10-31.md) records
the pre-lock timing safeguard, receipts and limits. Historical logs, actual
renewal/reconnect and independent recovery remain separate; finding counts do
not change from completion of this sub-requirement.

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
| V1-006 | CLOSED | A | Actual owned/foreign checks, deployed linked calculation/default save/readback, independently verified persisted state and [two-process PostgreSQL durability](validation-2026-10-31-final/attribution-process-restart.json) close the original access/in-memory/sample-data defects. Not a Render restart or certification of attribution formulas/configuration/downstream analytics. Exact nine-row cleanup passes. |
| V1-008 | OPEN | C | Historical public-fallback ciphertext disposition is complete and independently verified. Shared independent recovery dependency remains under Batch 8 V1-016; it does not mandate purchasing another database. Explicit-key/verified-TLS startup enforcement has deployed-code, production-health and successful-write evidence; private environment was not inspected. Existing linked-field decrypt, key custody and same-machine restore remain complete. |
| V1-026 | CLOSED | B | Live supported multipart CSV and public HTTPS URL import pass; current local destination/DNS/redirect/size/deadline/parent controls pass. Missing client identifier corrected in deployed 3c304f97; exact fixtures removed. |
| V1-027 | CLOSED | — | Callback rendering guards plus configured real OAuth successes meet this finding's recorded gate; exact limits above. |
| V1-030 | CLOSED | B | Deployed whitelist replacement/clear/replacement/reload and independent saved-state check pass. Actual PostgreSQL publication tests prove allowed/removed-sender and omission behavior. Automatic email import remains user-excluded; real signed-sender acceptance is required before re-enablement, not claimed by this closure. |
| V1-034 | CLOSED | A | Actual owned draft creation, owned transfer, foreign source/destination and magic-ID denial pass. Independent stored-scope verification and exact cleanup pass. Connect remains release-disabled. Batch 4 transfer-copy correctness stays separate. |
| V1-052 | CLOSED | A | Actual Clerk sign-out/switch/return and owner/foreign Reports evidence combined with real Notifications/Navigation switch, cancellation, late-response, return/reload and persistent-state trace. See account-session close-out; no repeat login test or runtime change. |
| V1-053 | CLOSED | A | User-operated bounded requests prove caller test flags still receive configured OAuth/LinkedIn/import limits and counted requests. Original bypass is closed; distributed load/capacity is not inferred. No saturation test performed. |
| V1-054 | OPEN | A | LinkedIn valid owned edit preserves ID/parent despite replacement payload; foreign edit denied and stored state verified. Legacy Meta positive deployed acceptance is unavailable because its tables are absent; retained local cases pass. Owner 400/foreign 404 invalid campaign edit is complete and will not be repeated. |
| V1-057 | CLOSED | C | [Historical disposition](HISTORICAL_LOG_DISPOSITION_2026-10-31.md): corrected deployment October 20, user-supplied Hobby recovery screen October 29 and documented retention, user-confirmed sole access/no sharing/no stream/no saved copies. No identified unauthorized recipient or external copy requiring rotation. Not proof that old logs never contained secrets. |
| V1-063 | CLOSED | — | Production mock-write routes disabled and denial verified. |
| V1-075 | OPEN | A, C | Both owned deployed aliases, replacement, dated persistence, scoped source/total and currency preservation pass; exact cleanup independently verified. Historical orphan/downstream disposition remains. Prior inventory has no historical connector-derived sources; no current frontend caller is invented. |
| V1-078 | OPEN | B | Configured real callback successes are complete. Invalid session/state/replay and deferred shared signing boundaries remain; stateless nonce checks are not proof of single-use replay prevention. |
| V1-088 | OPEN | B | Actual renewal/reconnect remains. Ten local migration/renewal interleavings, the approved 223-record plaintext cleanup and the separately approved 126-record historical ciphertext cleanup are complete. |
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
