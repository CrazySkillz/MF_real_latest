# Batch 8: Release checks and deployed operational acceptance

[Release index](../../V1_RELEASE_READINESS.md) · [Finding checklist](../../audits/v1-2026-10-19/FIX_QUEUE_ASSIGNMENTS.md)

This is the detailed home for this batch's assigned findings. Read the required repository references first, then the release index, checklist and this record. Documentation records evidence; verify actual current code before changing behavior. Original audit paths and line numbers describe the recorded baseline, not an assertion that the defect remains unchanged.

## Current Batch 8 status

**OPEN. V1 remains NO-GO.** All eight assigned release-gate findings remain open. Some bounded checks pass; none certifies the full application.

## Latest validation and release gates

**Latest local Batch 4 checkpoint, October 23 - retained CSV Revenue:** [V1-072](../v1-batch-4/README.md#retained-csv-revenue-correction-checkpoint-october-23) is verified locally, uncommitted and undeployed. All 29 new tests pass, including 12 actual PostgreSQL cases. Wider packet: 516 passed / 18 classified failures / zero skipped; no new failing identity remains. The final compatibility-only loop correction passed all 29 new cases again plus TypeScript/server build. All 18 failures, the historical whole-suite/CI gates and complete release acceptance remain OPEN. The isolated localhost fixture was cleaned and stopped; production/Ptomo/provider data was untouched.

**Earlier local Batch 4 checkpoint, October 23 - Sheets Spend:** [V1-041/070](../v1-batch-4/README.md#sheets-spend-correction-checkpoint-october-23) is verified locally and committed in `b650b631` and deployed in `eb3fca00`; public deployment checks pass, with source/provider acceptance still open. All 37 new tests pass (nine real PostgreSQL cases); the targeted packet records 530 passed, 14 classified existing failures, zero skipped and no new failing identity or changed failure boundary. TypeScript/server build pass. All 14 failures, the historical 179 whole-suite failures, CI and complete acceptance remain open. The test-only localhost cluster was cleaned and stopped. No production/Ptomo/provider mutation occurred.

**Earlier local Batch 4 checkpoint, October 23 - Sheets Revenue:** Sheets Revenue V1-065/066/067 is verified locally, committed in `ace32e7b` and deployed in `e635fe50`; public deployment checks pass, while authenticated import/provider acceptance remains open. [Exact evidence and limits](../v1-batch-4/README.md#sheets-revenue-correction-checkpoint-october-23): 29 new tests pass, including actual PostgreSQL handler/storage lifecycle and source-total reconciliation. The targeted packet has 398 passes, nine classified existing failures and zero skips; no new failing identity remains. TypeScript/server build pass. The nine failures, previous 179 whole-suite failures, CI gate and all release acceptances remain open. A fresh isolated localhost fixture was used and stopped; no production/Ptomo/provider mutation occurred.

**Latest local Batch 4 checkpoint, October 22:** Four forward corrections are verified locally, with 430 focused checks and the final TypeScript/server build passing. A full-run cancellation/update return-contract regression was corrected and its original tests retained. Twenty Batch 4 implementations and all release gates remain open. [Batch 4 evidence and limits](../v1-batch-4/README.md#first-correction-checkpoint--october-22). Runtime fixes are committed in `c3806282`; [committed-file verification](../v1-batch-4/validation-2026-10-22/commit-checkpoint.json) matches the validated manifest. Public deployment checks pass on `44132830`; authenticated import/provider acceptance remains pending. No production/provider/Ptomo data cleanup was performed. The [full regression result](../v1-batch-4/validation-2026-10-22/failure-reconciliation.json) has 4,488 tests: 4,309 passed, 179 failed, zero skipped; no new failing identity remains. The subsequent CSV response-code preservation passed its 73-check packet and TypeScript/server build. Both candidate snapshots are recorded in Batch 4. All 179 failures and the separate CI-only gate remain open; local fixture cleanup passed and its PostgreSQL cluster was stopped.

**Latest deployed check, October 23 at 04:05 Europe/Amsterdam:** `eb3fca00` is live with the latest Sheets Spend fixes `b650b631` and all earlier deployed corrections. Three expected-SHA/readiness checks, homepage availability, signed-out campaign-list denial and scheduler registration pass. The next GA4 refresh is October 23 at 08:00 Amsterdam, through October 22; no natural refresh has completed since this deployment. [Exact evidence and remaining limits](../v1-batch-4/README.md#sheets-spend-deployment-verification-october-23). Authenticated/provider, hosted-load, failure/recovery and whole-V1 gates remain open. No production mutation was performed.

**Latest local Batch 3 completion, October 22: V1 remains NO-GO.** All ten Batch 3 forward corrections are locally verified; the final four and provider-timeout continuation are committed as `e7aebef8` and now live in `ff3c5115`, within the public-check boundary above. The [commit checkpoint](../v1-batch-3/validation-2026-10-22-completion/commit-checkpoint.json) confirms unchanged validated files; no full suite was repeated for this documentation-only commit update. [Assessment](../v1-batch-3/validation-2026-10-22-completion/assessment.json) and [failure reconciliation](../v1-batch-3/validation-2026-10-22-completion/failure-reconciliation.json) record 4,458 tests: 4,278 passed, 180 failed, zero skipped; no new failing identity or failed suite without assertions remains. Every runtime/test edit preceded the final full run. The earlier 731-check focused packet and 15-check process packet are supporting checkpoints. TypeScript and server build pass; unchanged client code retains its earlier build evidence. All 180 failures and the separate CI-only failure remain open. No release gate closes, and no production data/configuration was touched. The [Batch 3 completion record](../v1-batch-3/README.md#completion-checkpoint-october-22) owns the exact local proof, cleanup, future-source safeguards and deployed/provider limitations.

**Earlier October 22 precision deployment verified within scope:** Main `5f251e0e` was live with Batch 3 runtime content `001ddfa8`; recovery branch `d259bab9` is pushed. Hosted precision migrations, readiness, unauthenticated data denial, deployed client formatter and pre-refresh Ptomo saved-state preservation pass. A single transition 503 was observed before stable readiness. The [user-supplied post-08:00 screenshots](../v1-batch-3/README.md#ptomo-morning-refresh-october-22) now pass the bounded Ptomo Overview freshness check: both updates at 08:10, through October 21. Provider reconciliation/fractional publication and complete scheduler acceptance remain open. [Batch 3 deployed verification](../v1-batch-3/README.md#deployed-verification-october-22) owns the exact evidence. This does not close V1-016 or certify V1.

**Historical Batch 3 preflight, October 21: push was on HOLD; V1 remains NO-GO.** Candidate `001ddfa8` passed the read-only production column/finite-input checks and fresh encrypted backup/local restore. Eight clone checks preserve 71 tables / 5,909,681 rows, including injected migration failure, lock contention, repeat boot and precision probes. The old deployed runtime demonstrably loses fractional values; a startup-only patch does not correct its provider/read/write rounding. The October 22 fallback validation below supersedes this bounded pre-push hold. [Batch 3 preflight](../v1-batch-3/README.md#deployment-preflight-october-21) owns the exact evidence and local PostgreSQL 18 versus hosted PostgreSQL 17 limits. No live migration, push or deployment occurred.

**Batch 3 local commit checkpoint:** The completed corrections, migrations and evidence are recorded locally with unchanged validated runtime/test files. No push or deployment occurred. The later preflight above satisfies the bounded production-schema and local backup/restore checks; the October 22 fallback validation below satisfies the bounded local recovery check. No release gate is closed.

**Historical local Batch 3 timeout checkpoint, October 22: V1 remains NO-GO.** [Assessment](../v1-batch-3/validation-2026-10-22-timeouts/assessment.json) and [failure reconciliation](../v1-batch-3/validation-2026-10-22-timeouts/failure-reconciliation.json) record 4,338 tests: 4,158 passed, 180 failed, zero skipped, with no new failing identity. The subsequent 591-check packet covers the final HubSpot guard and six added PostgreSQL preservation cases; it is not a second full-suite run. TypeScript and production builds pass. `TEST-992002bd4c` now passes with its validation-before-credentials requirement retained. These V1-025 corrections are uncommitted and undeployed; the remaining shared-job/provider cancellation, all 180 failures and wider release gates stay open. No production write occurred.

**Earlier Batch 3 downstream-precision checkpoint:** 4,300 tests; 4,119 passed, 181 failed, zero skipped. [Precision assessment](../v1-batch-3/validation-2026-10-21-goal-precision/assessment.json) retains the exact historical boundary: V1-079 forward paths verified locally, 588 passing precision checks and 11 startup scenarios. Later bounded deployment and timeout evidence above supersedes only the checks it proves; no whole-app certification follows.

**Subsequent local Batch 3 checkpoint, October 21: V1 remains NO-GO.** The uncommitted candidate on `aee04e50` ran **4,240 tests: 4,059 passed, 181 failed, zero skipped**, with no newly failing identities. [Batch 3 validation](../v1-batch-3/README.md#current-validation-boundary) owns the exact changes, manifest, builds, cleanup and [current failure reconciliation](../v1-batch-3/validation-2026-10-21/failure-reconciliation.json). `TEST-65b981daca` now passes locally after correcting its obsolete writer/scheduler assertions and checking behavior. Every other local failure remains open, and the separate CI-only browser failure still needs CI evidence. No deployment or new CI run occurred; no whole-app acceptance gate closes.

**Earlier deployed checkpoint, October 21, after Batch 2: NO-GO for V1.** The [Batch 2 validation assessment](../v1-batch-2/acceptance-2026-10-21/assessment.json) binds the unchanged 35 candidate files to deployed runtime `839bf508`; validation ran against repository HEAD `8c43334b` (documentation-only). Its [full suite](../v1-batch-2/acceptance-2026-10-21/completed/full-suite.json) executed **4,154 tests: 3,972 passed, 182 failed, 0 skipped**. All 182 failed identities matched the existing open audit ledger and remained release blockers; no failure was waived. The earlier OAuth signing-fixture correction passed in that complete run. The 114 tests in the Batch 1 test files and 65 in the Batch 2 test files all passed. Combined local/CI open identities at that checkpoint were 183 because the separately documented CI-only browser failure remained unresolved.

**Latest verified CI remains failed, with no newly failing identities introduced by Batch 2:** the [saved GitHub run](https://github.com/CrazySkillz/MF_real_latest/actions/runs/39562151735/job/119095712385) reports4154tests,3285passed,172failed and697not run. It has exactly the same172failed identities as the [pre-Batch-2 run](https://github.com/CrazySkillz/MF_real_latest/actions/runs/39503645580/job/118907048176). The [reconciliation](../v1-batch-2/github-ci-reconciliation.json) preserves every identity and its release impact.171match the182 original local audit failures; the other, `TEST-f323e48c9f` / `server/ga4-publication-browser.test.ts`, failed in both CI runs while passing locally. It is explicitly tracked under V1-012/Batch8. Missing CI browser installation is plausible from the workflow, but the assertion details were discarded by its temporary JSON runner, so the exact CI cause remains unverified. That checkpoint's combined local/CI inventory contained183 open test identities, not183 additional code fixes. CI's697 opt-in PostgreSQL omissions do not replace the completed local PostgreSQL checks. No failure is waived, and the legacy runner's deferred labels do not change agreed V1 scope.

**Additional deployment evidence for the existing release gates:** the rendered Clerk form visibly says `Development mode`; production authentication configuration remains unverified under V1-013/Batch8. No Clerk keys or settings were changed. The existing GitHub `npm ci` output reports74 dependency advisories (3low,32moderate,33high,6critical), now retained as partial V1-019 evidence. That aggregate includes all installed dependencies and does not identify production reachability or provide an advisory-by-advisory resolution. No new manual npm advisory request or dependency update was performed.

[Batch 2](../v1-batch-2/README.md#latest-validation-and-live-acceptance) contains the isolated onboarding, live schema/Ptomo and public navigation evidence, including the remaining real-customer/provider gates. [Batch 1](../v1-batch-1/README.md#current-batch-1-status) contains the confirmed morning refresh. No further Ptomo freshness wait is required for those completed checks. Hosted capacity, monitoring, managed backup/key restoration, application rollback, natural report/inbox acceptance and full value/lifecycle/downstream acceptance remain unproven.

**October 22 recovery validation:** [Batch 3 fallback evidence](../v1-batch-3/README.md#fallback-validation-october-22) establishes recovery commit `d259bab9`, with 586 passing precision checks, 11 startup scenarios and successful production builds. Startup and precision migrations match the restored-data rehearsal. This resolves the bounded pre-push hold; hosted recovery execution and the broader V1-016 operational gates remain OPEN. Main candidate failures and the whole-app NO-GO are unchanged.

**October 22 Ptomo clarification:** Reconstructing old rounded Ptomo test figures is not a deployment prerequisite. Operational recovery must still preserve correct fractional values in future processing; the unmodified old runtime fails that requirement. The [Batch 3 policy](../v1-batch-3/README.md#ptomo-test-data-policy-october-22) owns this boundary.

## Scope and acceptance

Resolve every current failing assertion without waivers; close unproven field/lifecycle/propagation acceptance cells; verify current host/config/schema and effective exclusions; natural jobs/provider/inbox acceptance, realistic load, monitoring, backup restoration/rollback and dependency check. Re-run applicable checks after fixes, then full release gates at the final SHA.

For each included source, cover create/edit/delete/reconnect/refresh/list/totals, negative cases and downstream propagation. Preserve the existing architecture. Historical-data cleanup requires its own read-only inventory and separately reviewed scope. A locally passing fix does not close required deployed/provider acceptance.

## Dependencies

This batch consumes the implementation and acceptance records for [Batch 1](../v1-batch-1/README.md), [Batch 2](../v1-batch-2/README.md), [Batch 3](../v1-batch-3/README.md), [Batch 4](../v1-batch-4/README.md), [Batch 5](../v1-batch-5/README.md), [Batch 6](../v1-batch-6/README.md) and [Batch 7](../v1-batch-7/README.md). It does not absorb their unresolved defects or close them by a passing aggregate check.

## Reference and evidence entry points

These records retain their own dates and verification limits. Use the current fix evidence above and below when it supersedes an original finding.

- [Release gate disposition](../../audits/v1-2026-10-19/RELEASE_GATE_DISPOSITION.md)
- [Original validation and failure ledger](../../audits/v1-2026-10-19/VALIDATION.md)
- [Configuration and recovery](../../audits/v1-2026-10-19/CONFIGURATION_AND_RECOVERY.md)
- [Latest complete validation assessment](../v1-batch-2/acceptance-2026-10-21/assessment.json)

## Finding checklist

| Finding | Severity | Fix status | Release acceptance |
|---|---|---|---|
| [V1-010](#v1-010) | P1 | OPEN | OPEN |
| [V1-012](#v1-012) | P1 | OPEN | OPEN |
| [V1-013](#v1-013) | P1 | OPEN | OPEN |
| [V1-014](#v1-014) | P1 | OPEN | OPEN |
| [V1-016](#v1-016) | P1 | OPEN | OPEN |
| [V1-018](#v1-018) | P2 | OPEN | OPEN |
| [V1-019](#v1-019) | P1 | OPEN | OPEN |
| [V1-020](#v1-020) | P2 | OPEN | OPEN |

## Findings

Original evidence below is retained verbatim except relative link destinations. For implemented findings, use the correction and current-status sections to distinguish fixed forward paths from remaining release acceptance.

### V1-010

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: repeated deployed failure):

On exact HEAD, `/health/scheduler` reports healthy/200 while latest GA4 daily and auto-refresh runs fail. October19 observed14provider jobs/9succeeded; October20 at09:00 observed14/8. [Final16:48UTC observation](../../audits/v1-2026-10-19/deployed-public-final-2026-10-20.json) observes14/9 and failed12:00–12:17 cycles. [Ptomo read-only evidence](../../audits/v1-2026-10-19/PTOMO_READ_ONLY_EVIDENCE.md) separately finds completed native work in the repository-configured DB; deployment binding unknown. Identify/recover failures without assuming redundant campaigns caused them; no other campaign was inspected.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-012

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: automated validation not clean):

Full controlled suite: 3,789 passed /182 failed /zero skipped. [Each failure](../../audits/v1-2026-10-19/VALIDATION.md) retains a stable ID and OPEN status. All37 incomplete-fixture behavior failures now map to missing publication-version setup;108 audit-copy assertions pass after exact fixture/guard-expectation repair, with runtime unchanged. [Root causes and mapping](../../audits/v1-2026-10-19/GA4_FAILED_TEST_ROOT_CAUSES.md). Original tests still require agreed corrections and complete rerun. Deferred CI tests remain safety obligations where routes/jobs exist.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-013

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: required external gate):

No current signed-in end-to-end owner/new-account, client/campaign, real provider selection/import/reconnect/cancel/retry/delete journey has been completed in this audit. Browser control exposes no connected user session. Public signed-out smoke and fixture browser tests are supporting evidence only.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-014

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: required analytics gate):

No complete current semantic value/source/fallback/propagation certificate covers every included financial family and retained surface. Row labels and route extraction are not that proof. The source/value matrix must retain all unverified cells and test failures until closed.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-016

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: required operational gate):

Five-user/25-campaign component and actual HTTP/DB checks are recorded; the latter reproduces blocked import saves despite acceptable local read latency. Synthetic DB/key/PDF-byte restore passes. Deployed capacity, actual provider quotas, multi-instance recovery, monitoring receipt, production backup/key recovery and application/schema rollback remain unverified. [HTTP boundary](../../audits/v1-2026-10-19/HTTP_DATABASE_PILOT.md), [restore boundary](../../audits/v1-2026-10-19/CONFIGURATION_AND_RECOVERY.md).

**Additional bounded evidence, October 21:** [Batch 3 preflight](../v1-batch-3/README.md#deployment-preflight-october-21) verifies an actual fresh production backup restored locally, all-table preservation through candidate migrations, failed-migration rollback, lock timeout and fractional-value restart. It also reproduces unsafe old-application rollback. Managed/PITR retention, off-machine key recovery, hosted restore/lock behavior and a validated whole-application rollback remain OPEN; this is not full operational acceptance.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-018

**Severity:** P2. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed configuration):

`playwright.config.ts:17` defaults to a suspended old host and its e2e suite shares a campaign. Do not run destructive deployed tests through this default. Use explicit current target and isolated fixtures.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-019

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: partial advisory evidence; detailed assessment open):

The earlier manual npm advisory request was rejected by automatic approval review. The existing October21 GitHub npm-ci log now reports74 all-dependency advisories (3low/32moderate/33high/6critical); no new manual advisory request was made. Advisory identities, production dependency reachability, fixes and resolution verification remain unproven. See the [CI evidence](../v1-batch-2/github-ci-job.log).

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-020

**Severity:** P2. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: contradictory historical guidance):

`GA4/REFRESH_AND_PROCESSING.md` retains descriptions saying durable recovery is not integrated, while current scheduler/storage and backlog implement native-only recovery. Older “current deployed” SHAs and section certificates refer to their historical boundaries. Resolve status navigation through this index without rewriting protected historical evidence.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

## Original audit disposition (October 19–20)

This is the pre-fix assessment at `777aae6f`, retained as historical evidence. Its statements about unchanged runtime, pending schema/grants and failing jobs are not current deployment claims. Later Batch 1/2 evidence supersedes only the exact checks it proves.

The [final assessment](../../audits/v1-2026-10-19/FINAL_AUDIT_DISPOSITION.md) reconciles the inventory, six audit groups, source/lifecycle/downstream requirements, findings and remaining acceptance gates. All130 findings have stable IDs, severity, exact paths, evidence, release impact and one primary fix batch. Ten findings are exclusively deferred-provider functionality.

The final additional checks executed284 authenticated foreign-parent route cases and22 owner/child/payload/recompute cases. The [349-registration evidence overlay](../../audits/v1-2026-10-19/route-audit-disposition.json) accounts for every endpoint without treating a guard marker or denial fixture as whole-route certification. Original test failures and unexecuted source/output combinations remain release blockers.

The six groups now have explicit assessment outcomes:

| V1 group | Assessment outcome | Evidence and required next phase |
|---|---|---|
| Access and isolation | FAIL: confirmed unauthorized read/write and credential boundaries;283 foreign-parent denials and one production-disabled control add bounded positive evidence. | Exact route/final-write fixes and payload regressions; deployed Clerk/session acceptance. |
| Customer journey | FAIL / external gates: current create/edit/cancel/reconnect/delete/recovery assessed; wizard and deletion defects remain. | Current browser/storage records; fresh-customer and Ptomo authenticated acceptance. |
| GA4 and offered financial inputs | FAIL / partial acceptance: each family has current query, mapping, currency/date, fallback and lifecycle disposition. | Native/CSV/Sheets/CRM/Shopify/Ads fixes and independent provider reconciliation. |
| Values through downstream outputs | FAIL / unverified combinations: current field records identify incorrect values and propagation gaps. | Exact source×mutation×consumer acceptance; V1-014 stays open. |
| Alerts and reports | FAIL: visibility races, value disagreement, retry/delivery/artifact defects. | Current contention/PDF/snapshot evidence; post-fix artifact parity and actual receipt. |
| Live operation | FAIL / external gates: local configuration, migrations, restart, restore and load assessed; latest live jobs still fail. | Operational fixes, authoritative tests, deployed logs/monitoring/backup/rollback proof. |

LinkedIn, Instagram, Meta and TikTok functional work remains deferred. Only their access, job, simulation and shared-data effects on V1 require current review. Use Ptomo for safe live campaign observation; keep destructive and failure cases isolated. Other currently offered sources remain included unless the user explicitly agrees a smaller feature set. Retained pages can be proposed for exclusion; neither hidden navigation nor missing provider configuration proves an effective exclusion.

The [final U/E list](../../audits/v1-2026-10-19/FINAL_AUDIT_DISPOSITION.md#unreviewed-acceptance-work-remains-explicitly-u) explicitly retains unexecuted local payload/lifecycle/output combinations separately from unavailable live checks. An assessment can conclude NO-GO with these gaps; it cannot certify safety or claim every branch was proven.

### Original revision boundary

- Local HEAD: `777aae6f6353e998d60b635d3e66b413093117c2`. Local `origin/main` also points here; this is a local tracking ref, not an independently fetched remote assertion.
- Tracked working tree was clean at entry. Pre-existing untracked `.worktrees/`, `assets/`, `audit-temp/`, seed logs, `scripts/__pycache__/`, and five diagnostics/report validation scripts are preserved. They are not silently included in the candidate commit.
- Confirmed deployment: `https://marketforensics.onrender.com`, independently returned the exact HEAD above, `nodeEnv=production`, at `2026-10-19T19:15:16.557Z`. User confirmed the URL. See [health evidence](../../audits/v1-2026-10-19/deployed-health.json).
- Final recheck `2026-10-20T16:48:30.491Z` again reports that SHA and production. [Read-only packet](../../audits/v1-2026-10-19/deployed-public-final-2026-10-20.json): the12:00 GA4 cycle and auto-refresh failed;14provider jobs attempted/9succeeded; public status still healthy. Report totalSent2 is an aggregate counter, not artifact/recipient/delivery proof. The [09:00 observation](../../audits/v1-2026-10-19/deployed-public-recheck-2026-10-20.json), with8/14 and totalSent1, is preserved.
- `playwright.config.ts` defaults to the obsolete `https://mforensics.onrender.com`, which returned Service Suspended. That is a test-target defect, not evidence of outage at the current deployment.
- Public health proves a runtime's self-reported SHA, not its database schema, secrets, replica count, provider permissions, backup recoverability, or analytics correctness.
- Audit changes are documentation, inventory tooling and isolated reproduction tooling only. No production mutation, provider refresh, campaign cleanup, email, dependency update, migration or deployment is authorized by this record.

### Original evidence status

- **Proven at stated boundaries:** local/deployed SHA match at captured observation; tracked code unchanged; typecheck/build pass; signed-out deployed authentication rendering/redirect. Inventory:349 endpoint registrations,37 React routes,62 tables,926 controls,64 job/timer sites and119 observed setting names. [Generated evidence counts](../../audits/v1-2026-10-19/audit-record-check.json) separate reproduction packets,11 real PostgreSQL scenarios,296 anonymous and284 authenticated foreign-parent entry cases,108 diagnostic test-copy assertions and four HTTP/database audit tests. The final22 owner/child/recompute cases are included in the reproduction packets. The HTTP pilot returned205 correct read/preview responses but reproduced five shared-IP import-save failures. These are bounded observations, not complete journeys or runtime fixes.
- **Automated checks:** controlled full run **3,789 passed, 182 failed, zero skipped (3,971 tests / 319 files)**. All failures have stable IDs and mechanism classifications; none waived as baseline/deferred/test-campaign noise. All98 fixture/binding failures now have bounded passing diagnostic evidence;84 structural/extraction failures remain. Original tests are unchanged and still failing. Five section certification integrity commands pass because their records consistently say **UNVERIFIED**, not because the sections are certified.
- **Partially reviewed:** every source family has current-code contract/lifecycle findings or explicit unsupported behavior recorded. Detailed supplements cover native GA4, CSV/Sheets Revenue and Spend, HubSpot/Salesforce/Shopify, Google Ads/LinkedIn/Meta/Instagram/TikTok, Custom Integration, manual/retained paths, account/campaign lifecycle, diagnostics, KPIs/Benchmarks, alerts and reports. End-to-end certification remains open; neither a family trace nor its negative fixtures certify all its values/branches.
- **Remaining unreviewed/partially verified depth:** remaining authenticated payload/child/platform branches and source-mutation-to-every-output combinations, including full rendered/browser/server artifacts and source-specific refresh/recovery. Declared current GA4/diagnostic, Custom/Sheets, retained Dashboard and Ads value records narrow this work; they do not prove every composition. Configuration names/defaults, all27 retained SQL files and repeated/concurrent startup now have explicit local review; production historical-upgrade/configuration/log-retention evidence remains external. V1-014/016 stay open.
- **Externally blocked:** authenticated fresh-customer/Ptomo/provider acceptance, full deployed configuration/schema/database binding, causes/recovery of failed live jobs, natural scheduled report/inbox proof, hosted workload/monitoring acceptance, production backup/key recovery/rollback and the unapproved dependency advisory lookup. Local/inherited configuration lacks the service-account settings required for Ptomo's current method; [presence-only evidence](../../audits/v1-2026-10-19/provider-access-boundary.json). The synthetic restore and bounded HTTP pilot do not close deployed gates.
- **Runtime changes:** none. No fix, commit, deployment, customer-data cleanup or email was performed. Audit artifacts are new untracked documentation/tooling files; the candidate commit remains unchanged.

## Original audit evidence catalog

The original inventory, value/lifecycle/propagation records, failure ledgers, manifests and source records stay in their existing locations. Dates and runtime boundaries still apply; a linked historical record is not current certification.

| Record | Purpose and limit |
|---|---|
| [Final audit assessment](../../audits/v1-2026-10-19/FINAL_AUDIT_DISPOSITION.md) / [all349 route dispositions](../../audits/v1-2026-10-19/route-audit-disposition.json) | Completed NO-GO assessment, source/lifecycle/output allocation,22 final boundary cases and284 authenticated route probes; exact unreviewed local and externally blocked acceptance obligations retained. |
| [Release gate disposition](../../audits/v1-2026-10-19/RELEASE_GATE_DISPOSITION.md) / [every finding assigned](../../audits/v1-2026-10-19/FIX_QUEUE_ASSIGNMENTS.md) | Required gates, exact remaining acceptance and all130 findings assigned once to eight practical batches; ten pure deferred-provider functional findings separated. Batches 1 and 2 are implemented/deployed with acceptance boundaries above; Batches 3-8 remain queued. |
| [Shared service-account customer boundary](../../audits/v1-2026-10-19/SERVICE_ACCOUNT_CUSTOMER_BOUNDARY.md) | Fifteen current-route cases establish V1-123 and denied controls; no real cross-customer request. |
| [Registered entry coverage](../../audits/v1-2026-10-19/ROUTE_ENTRY_COVERAGE.md) |296 exact registration probes:295 anonymous401 and one production404;45 no-marker routes and eight callbacks accounted separately. Entry denial is not whole-route authorization certification. |
| [Configuration and recovery](../../audits/v1-2026-10-19/CONFIGURATION_AND_RECOVERY.md) / [119-name catalog](../../audits/v1-2026-10-19/CONFIGURATION_CATALOG.md) | Current defaults/bounds, SDK configuration, scheduler hazards, provider credential logging and successful synthetic backup/key/PDF-byte recovery, with deployed gates explicit. |
| [GA4 failing-test root causes](../../audits/v1-2026-10-19/GA4_FAILED_TEST_ROOT_CAUSES.md) | All37 incomplete-fixture behavior failures resolved diagnostically;108 audit-copy assertions pass with unchanged runtime. Original182 failures remain open pending test repairs/full rerun. |
| [Additional test diagnoses](../../audits/v1-2026-10-19/ADDITIONAL_TEST_ROOT_CAUSES.md) | All remaining binding/fixture failures now have bounded passing diagnostics:98 original failures in total.84 source-structure/extraction assertions remain unresolved; original suite unchanged. |
| [Retained Comparison, Audiences and KPIs](../../audits/v1-2026-10-19/RETAINED_COMPARISON_AUDIENCE_KPI_VALUES.md) | Current fields/actions/formulas/fallbacks and11 exact cases: fabricated audience/revenue values, KPI form/API mismatch and cost-target scoring. |
| [Entry pages and retained Dashboard](../../audits/v1-2026-10-19/ENTRY_PAGES_AND_DASHBOARD_VALUES.md) | Complete current entry/Dashboard field/action inventory; nine component/route/storage fixtures, plaintext credential exposure and mixed-scope/value states. |
| [Actual HTTP/database pilot](../../audits/v1-2026-10-19/HTTP_DATABASE_PILOT.md) | Five synthetic users/25 campaigns,205 successful reads/previews; four assertions also reproduce shared-IP save failures.5,000-row UI limit established. No hosted capacity certificate. |
| [Google Ads current values and Insights](../../audits/v1-2026-10-19/GOOGLE_ADS_CURRENT_VALUES.md) |15 goal metrics,11 chart choices, additional native/attributed values and all22 narrative rules; seven exact cases prove calendar and goal-state gaps. Separate from GA4 child Spend and deferred providers. |
| [Source inventory](../../audits/v1-2026-10-19/INVENTORY.md) / [machine inventory](../../audits/v1-2026-10-19/inventory.json) | Tracked route declarations, tables, client request/query/mutation sites, job/timer sites and candidate labels. This is not a semantic value-path certification. |
| [Isolated reproductions](../../audits/v1-2026-10-19/reproductions.json) / [runner](../../audits/v1-2026-10-19/reproduce.cjs) | Executes extracted current handlers against fixture storage. Proves the listed handler defects; does not simulate the complete application or provider. |
| [Deployed public checks](../../audits/v1-2026-10-19/public-smoke.json) | GET-only anonymous checks, response headers/status/counts; no customer metric values recorded. |
| [Deployed browser checks](../../audits/v1-2026-10-19/browser-smoke.json) | Fresh signed-out Chromium, sign-in/sign-up/privacy/protected-route redirect. All mutating network methods blocked. No authenticated onboarding certificate. |
| [Scope, journey, source/value/lifecycle and propagation matrices](../../audits/v1-2026-10-19/SCOPE_AND_VALUES.md) | All registered page families, included/retained sources, actions, value domains and downstream consumers; explicit partial/unreviewed/external cells and code/document contradictions. |
| [Validation and every failing assertion](../../audits/v1-2026-10-19/VALIDATION.md) | Current build/typecheck, all 319 test files, 182 stable failure IDs/classifications, isolated PostgreSQL and browser boundaries. |
| [Operations and future-source template](../../audits/v1-2026-10-19/OPERATIONS_AND_TEMPLATE.md) | Security/configuration/jobs/restore/rollback/load, required external acceptance and bounded reusable GA4 patterns. |
| [Deployed scheduler summary](../../audits/v1-2026-10-19/deployed-scheduler-summary.json) | Sanitized current failure/count/configuration evidence; no customer metric values or secrets. |
| [Client deletion race](../../audits/v1-2026-10-19/client-delete-race.json) / [runner](../../audits/v1-2026-10-19/client-delete-race.cjs) | Exact current storage method against a disposable PostgreSQL schema reproduces an orphan after a concurrent creation. |
| [Custom imports and public entry points](../../audits/v1-2026-10-19/CUSTOM_IMPORT_AND_PUBLIC_ENTRYPOINTS.md) | Current parser, all 28 imported metric keys, lifecycle, publication and consumer traces; [seven supplemental cases](../../audits/v1-2026-10-19/extended-reproductions.json) and [five lifecycle/fallback cases](../../audits/v1-2026-10-19/custom-lifecycle-reproductions.json). |
| [GA4 query and value trace](../../audits/v1-2026-10-19/GA4_QUERY_AND_VALUE_TRACE.md) | Native provider query/fallback/pagination, row keys, daily publication and Insights consumer guards; [three exact-service fixture cases](../../audits/v1-2026-10-19/ga4-query-reproductions.json). |
| [Financial contracts and GA4 onboarding](../../audits/v1-2026-10-19/FINANCIAL_CONTRACT_AND_ONBOARDING_TRACE.md) | Record/source/window/currency and negative-value contracts; CSV lifecycle; OAuth property discovery, reconnect/cancel/restart/status. [Three financial fixtures](../../audits/v1-2026-10-19/financial-contract-reproductions.json), [three onboarding fixtures](../../audits/v1-2026-10-19/ga4-onboarding-reproductions.json). |
| [Spend import cases](../../audits/v1-2026-10-19/spend-import-reproductions.json) | Five current-handler fixtures: CSV row-cap/numeric corruption, Sheets fixed-range/numeric/invalid-to-zero behavior; no provider or database mutation. |
| [CRM and Shopify trace](../../audits/v1-2026-10-19/CRM_AND_SHOPIFY_TRACE.md) | Provider selection, pagination, dates, currency, transactions, retained paths and remaining lifecycle gates; [ten provider-contract fixtures](../../audits/v1-2026-10-19/provider-contract-reproductions.json). |
| [Paid-media trace](../../audits/v1-2026-10-19/PAID_MEDIA_TRACE.md) | Google Ads, Meta/Instagram, TikTok, LinkedIn and shared GA4 enrichment contracts, with [six exact-function fixtures](../../audits/v1-2026-10-19/paid-media-reproductions.json). |
| [Account, standalone Sheets and retained writes](../../audits/v1-2026-10-19/ACCOUNT_SHEETS_AND_RETAINED_WRITES.md) | Identity/cache/limiter and Sheets selection/range/side effects; [three boundary cases](../../audits/v1-2026-10-19/cache-sheets-limiter-reproductions.json), [four mutation cases](../../audits/v1-2026-10-19/retained-mutation-reproductions.json). |
| [KPI/Benchmark and diagnostic values](../../audits/v1-2026-10-19/KPI_AND_DIAGNOSTIC_VALUE_TRACE.md) | Ten standard GA4 metric identities, formulas/states/history, aggregate/financial/pacing/Trend/executive contracts; [two diagnostic fixtures](../../audits/v1-2026-10-19/diagnostic-reproductions.json). |
| [Operations, alerts and report recovery](../../audits/v1-2026-10-19/OPERATIONS_ALERTS_REPORTS_TRACE.md) | Startup/migration/credentials, visibility and independent email claim contracts, historical PDF paths; [four report confirmation fixtures](../../audits/v1-2026-10-19/report-delivery-reproductions.json). |
| [Campaign lifecycle, retained pages and Sheets Revenue](../../audits/v1-2026-10-19/JOURNEY_RETAINED_SURFACES_AND_SHEETS.md) | Create/edit/cancel/delete/recovery trace; [six retained UI/configuration cases](../../audits/v1-2026-10-19/retained-ui-reproductions.json), [three Revenue import cases](../../audits/v1-2026-10-19/sheets-revenue-reproductions.json). |
| [GA4 Ad Comparison and consumers](../../audits/v1-2026-10-19/GA4_AD_COMPARISON_AND_CONSUMERS.md) | Separate row/formula contracts, exact imported attribution, leader policy, freshness/provenance and browser report input gates; remaining rendered/provider/narrative checks are explicit. |
| [CSV Revenue and final-write parent boundary](../../audits/v1-2026-10-19/CSV_REVENUE_AND_PARENT_WRITE_TRACE.md) | Six current-handler cases and two real PostgreSQL cases: strict controls, signed adjustments, retained-context loss/truncation and missing-parent ordinary writes. |
| [Authorization boundaries](../../audits/v1-2026-10-19/AUTHORIZATION_BOUNDARY_TRACE.md) | All45 endpoint declarations without heuristic guard markers classified;17 helper/handler controls; critical anonymous connector-derived Spend aliases and bounded legacy report mutation results. Guard markers on other routes remain insufficient proof. |
| [Insights calendar and findings](../../audits/v1-2026-10-19/GA4_INSIGHTS_CALENDAR_AND_FINDINGS.md) | Current rule/threshold/category/coverage and downstream trace; three exact-code fixtures prove failed or unfetched dates becoming complete zero history. |
| [OAuth and credential boundaries](../../audits/v1-2026-10-19/OAUTH_AND_CREDENTIAL_BOUNDARIES.md) | Six local browser output cases and twelve state-verifier/configuration cases; real callback error injection, production signing fallbacks and explicit replay/session/logging limits. |
| [GA4 precision and provider scope](../../audits/v1-2026-10-19/GA4_PROVIDER_PRECISION_AND_SCOPE.md) | Four service/merge cases, provider definitions and downstream reconciliation boundary; fractional conversion truncation does not imply successful publication. |
| [Startup schema and migrations](../../audits/v1-2026-10-19/STARTUP_SCHEMA_AND_MIGRATIONS.md) | Generated current62-table schema; three real PostgreSQL scenarios for failed startup, missing upsert constraints and retained backfill replay/currency. |
| [Provider version support](../../audits/v1-2026-10-19/PROVIDER_VERSION_SUPPORT.md) | Current version pins versus official support dates; retired LinkedIn pin/accepted Shopify override, supported Ads/default Shopify, and explicit Meta/other verification gaps. |
| [Rendered reports and finding parity](../../audits/v1-2026-10-19/REPORT_PDF_RENDER_AND_FINDINGS.md) | Four current-module cases, three actual PDF fixtures/eight inspected pages; server finding mismatch, long-label overlap and a successful Benchmark read-failure guard. |
| [Campaign currency edit](../../audits/v1-2026-10-19/CAMPAIGN_CURRENCY_EDIT.md) | Three route/storage/read/formatting cases; currency edit retains old native monetary history while filter/timezone controls select invalidation. |
| [Campaign wizard browser lifecycle](../../audits/v1-2026-10-19/CAMPAIGN_WIZARD_BROWSER.md) | Five isolated current-page cases: unsaved Back edits, Cancel cleanup, duplicate/lost-response drafts and positive navigation/Ready controls. Actual APIs and authentication remain separate gates. |
| [Current Financial Analysis values](../../audits/v1-2026-10-19/FINANCIAL_ANALYSIS_VALUE_INVENTORY.md) | Active-render field/formula/window/availability inventory,13 boundary cases and current UI/server equality wording defects. Source lifecycle and full artifact acceptance remain explicit. |
| [Pilot load characterization](../../audits/v1-2026-10-19/PILOT_LOAD_CHARACTERIZATION.md) | Five users/25campaigns;100 correct component read batches and five10k-row parser computations. The actual Revenue UI limit is5k; the later HTTP packet tests that supported size and10k rejection separately. Hosted capacity remains unverified. |
| [Current Performance Summary values](../../audits/v1-2026-10-19/PERFORMANCE_SUMMARY_VALUE_INVENTORY.md) | Active-render value/state/priority/comparison inventory, ten boundary cases, stale-financial-advice inconsistency and daily-user grain label gap. |
| [Current Trend Analysis values](../../audits/v1-2026-10-19/TREND_ANALYSIS_VALUE_INVENTORY.md) | Active overview/cards/charts/funnels/recommendation inventory,14 boundary cases, low-rate headline normalization and zero-denominator display defects; retained aggregate mode remains separately scoped. |
| [Current Executive Summary values](../../audits/v1-2026-10-19/EXECUTIVE_SUMMARY_VALUE_INVENTORY.md) | Active funnel/risk/trajectory/targets/action inventory,13 boundary cases, separate API scope/value defects, CVR-label mismatch and fractional-conversion formatting loss. |
| [Retained paid-source value boundaries](../../audits/v1-2026-10-19/RETAINED_PAID_VALUE_BOUNDARIES.md) | Fourteen exact page/API cases for financial windows, currency fallback/labels, DB-failure states, ratio aggregation and zero Revenue, with separately stated remaining value/lifecycle gates. |
| [Current GA4 Overview values and source dialogs](../../audits/v1-2026-10-19/GA4_OVERVIEW_VALUE_INVENTORY.md) | Current active render/producer inventory, publication coordination and14 exact boundary cases, including useful source/zero controls and a Pipeline Proxy fallback defect. |
| [Notification visibility lifecycle](../../audits/v1-2026-10-19/NOTIFICATION_VISIBILITY_LIFECYCLE.md) | Fifteen owner/negative/race cases; retained API versus current rendered controls and email-episode boundary. |
| [Sheets/Custom value propagation](../../audits/v1-2026-10-19/SHEETS_CUSTOM_VALUE_PROPAGATION.md) | Query/zero/error/financial state, summary/goals/report inconsistencies and two inspected PDF artifacts. |
| [Snapshot access lifecycle](../../audits/v1-2026-10-19/REPORT_SNAPSHOT_ACCESS_LIFECYCLE.md) | Twenty exact route/access/artifact cases, including report-type edit invalidation and caller limits. |
| [Unconfigured providers and Ptomo](../../audits/v1-2026-10-19/UNCONFIGURED_SOURCES_AND_PTOMO.md) | User's four-provider functional deferral, shared safety boundary and Ptomo-only live campaign selection. |
| [Ptomo read-only saved state](../../audits/v1-2026-10-19/PTOMO_READ_ONLY_EVIDENCE.md) | Exact campaign/client/connection metadata,45-date native coverage, persisted detail-to-daily reconciliation and completed work observed in the repository-configured database. Deployment binding, provider truth and authenticated UI remain unverified. |
| [Evidence manifest](../../audits/v1-2026-10-19/evidence-manifest.json) | SHA-256 hashes of 278 tracked runtime source files and audit artifacts bind these observations to the audited bytes. The temporary local PostgreSQL instance was stopped. |
| [Processing/alignment backlog](../../GA4_PROCESSING_AND_ALIGNMENT_BACKLOG.md) | P1–P7 historical and scoped implementation acceptance, including native-only recovery exclusions. Does not certify external-source campaigns or V1. |
| [Governing checklist](../../../PRODUCTION_READINESS.md) | Required value, lifecycle, fallback, negative-case and downstream matrices. An unknown required cell blocks GO. |

## Future-source template

The [Batch 4 correction checkpoint](../v1-batch-4/README.md#first-correction-checkpoint--october-22) adds locally verified strict-input, parent-survival and authenticated import-budget safeguards, with explicit CSV-only assumptions and regression cases. Its live/provider acceptance remains open.

Use [Operations and future-source template](../../audits/v1-2026-10-19/OPERATIONS_AND_TEMPLATE.md) with the verified safeguards and regression evidence in each batch. GA4 is a bounded reference, not whole-app or future-provider certification. Each source independently needs permissions, metrics, attribution, dates/timezones/currency, pagination, quotas, lifecycle and downstream validation. No new provider or framework is implemented by this reorganization.
