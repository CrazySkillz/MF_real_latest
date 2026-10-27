# Deployed verification of 997f1c39 - October 27, 2026

**Hosted CI and the active report campaign's natural scheduled refresh pass on the deployed revision. V1-012 (automated validation) is CLOSED for this revision; overall scheduler acceptance and V1 release remain OPEN / NO-GO.** This is a bounded verification of the two checks requested after the [CI/scheduler correction](CI_AND_SCHEDULER_CHECKPOINT.md), not whole-application certification.

## Exact revision and automated checks

The public health response identifies `997f1c39ba2904ff0805ddb154715a75b4267578` in production. GitHub [run 40462063667](https://github.com/CrazySkillz/MF_real_latest/actions/runs/40462063667), job `122048741484`, completed successfully on that exact revision. Browser installation, PostgreSQL setup, fixture database creation and the existing certification check all passed.

The actual blocking current-version command reports **6,497/6,497 tests passed across 383 files**, zero failed, with complete execution and no waived failures. The separate retained-deferred command reports **52/52 passed**; these are not added to the full-suite count. See [hosted summary](validation-2026-10-27-deployed/hosted-summary.json) and [complete job log](validation-2026-10-27-deployed/hosted-997f1c39.log). This supersedes the prior packet's hosted-CI-pending statement for this revision and validates the final four-line runtime correction in the hosted suite.

## Saved publication before the natural scheduled run

The exact active report campaign is `36493a43-accd-4360-8ff2-de62f5a19b6e`, hashed as `de4775c3b435`. Its [read-only saved-state observation](validation-2026-10-27-deployed/active-2026-10-27T06-52-37-695Z.json) proves:

- Both financial and Executive Summary daily snapshots cover **September 23 through October 26, 2026**, currency **EUR**, timezone **Europe/Amsterdam**.
- Both snapshots contain **EUR 8,003.96** revenue. Spend and spend-derived ROI/ROAS/CPA remain unavailable, matching the saved absence of spend.
- The Executive Summary has the authoritative aligned marker completed at **07:45:27 Amsterdam / 06:45:27 UTC**. The matching revenue-change work completed at that time.
- Native GA4 Overview revenue is **EUR 7,653.96**. Its native snapshot was last refreshed before this deployment, so the successful later revenue publication alone does not prove a full native/provider refresh under this revision.

The read uses verified TLS, the previously confirmed database fingerprint and an enforced `REPEATABLE READ READ ONLY` transaction, then rolls back. It imports no application services and contacts no providers. Work rows show subsequent source-driven invalidations; a historical completed work row alone is not treated as proof that later inputs were processed.

The initial post-deployment public status retained failed bootstrap attempts for both the active report campaign and redundant Campaign3. The later aligned revenue publication does not erase those failures or identify their exact cause. The remaining natural run must be assessed from its own completion, persisted native/financial/executive outputs and failure evidence.

## Natural scheduled-run observation

The deployed schedule is **08:00, 14:00 and 20:00 Europe/Amsterdam**. The [bounded observer](validation-2026-10-27-deployed/observe-natural-run.cjs) performed anonymous status GETs every 45 seconds and neither triggered nor retried a refresh. Its [observations](validation-2026-10-27-deployed/natural-run-observations.json) cover the **October 27, 08:00 Amsterdam / 07:00 UTC** slot through completion. The batch deferred while recovery was active, then started at **08:01:00 Amsterdam**.

The active report campaign's owned work started at **08:09:20** and completed on its first attempt at **08:11:49 Amsterdam**, without a recorded work error or invalidation. The [final enforced read-only observation](validation-2026-10-27-deployed/active-2026-10-27T07-13-03-104Z.json) and [11 explicit verification checks](validation-2026-10-27-deployed/natural-run-verification.json) confirm:

- Native GA4 Overview was refreshed at **08:10:48**, financial snapshot at **08:11:11**, and Executive Summary snapshot at **08:11:34**; all cover the same completed-day window through October 26.
- Financial and Executive Summary revenue both remain **EUR 8,003.96**, with native GA4 revenue **EUR 7,653.96**. Currency, window, spend unavailability and 40 conversions remain consistent at the inspected boundaries.
- The authoritative Executive Summary aligned marker exactly matches the completed scheduled work's **08:11:49.861** timestamp. Its due slot is 08:00, work is completed, and its scope is not invalidated.
- The active campaign is absent from the batch's failure list. This proves a natural full publication for this campaign on this revision, beyond the earlier saved-revenue-only completion.

The overall batch finished at **08:11:56** with failures for **six other campaign hashes**: redundant Campaign3 (`6caf32c94dbe`) and `57141d52e81b`, `b0f65e7c7bfb`, `4ba3d83a9f51`, `d9920c47fecf`, `518aea3dc6ff`. All six were already represented in pre-existing failure evidence. Earlier discovery recorded provider-resource approval denials for the latter five; this observation does not prove the exact new attempt's underlying exception. Campaign3's saved Shopify renewal failure remains separate. Therefore the whole scheduler is not certified, and neither the earlier startup ownership errors nor monitoring correctness is declared fixed merely because this campaign succeeded.

## Remaining campaign identification

The [bounded read-only identity check](validation-2026-10-27-deployed/failed-campaigns-2026-10-27T07-25-24-694Z.json) identifies all six other failed campaigns. It selects ownership/connection metadata only, without credentials, provider calls or application service imports.

| Campaign | Client | Campaign hash | Current GA4 method |
|---|---|---|---|
| Campaign3 (user-confirmed redundant) | Client2 | `6caf32c94dbe` | OAuth access token |
| ads_test | Client2 | `b0f65e7c7bfb` | Service account |
| fgh | Client2 | `57141d52e81b` | Service account |
| ghj | new_client | `4ba3d83a9f51` | Service account |
| tfc | new_client | `518aea3dc6ff` | Service account |
| tyr | new_client | `d9920c47fecf` | Service account |

All six campaigns and their GA4 connections remain active. Each campaign has an existing client with a matching owner, so a missing/mismatched campaign-client owner is not present at this inspected boundary. The five service-account campaigns have no exact owner/client/GA4-property grant in `service_account_resource_grants`. Their earlier recorded discovery denials are consistent with that state; Render environment grants were not inspected, so database absence alone is not represented as proof about every grant source or the latest attempt's underlying exception. `storage.assertServiceAccountResourceAccess` accepts an exact environment or database grant only after validating the campaign/client ownership boundary; that guard remains unchanged.

The active report campaign, **V1 Batch 5 Test / ABN**, uses OAuth and has an exact database grant. Its owner/client scope differs from these six campaigns. The same GA4 property hash is not permission to transfer grants, source configuration or data between those scopes.

On October 27 the user confirmed **all five additional campaigns are redundant**, in addition to the earlier Campaign3 confirmation. All six recorded failures therefore belong to user-confirmed redundant campaigns; reconnecting those providers is not required for active-campaign provider acceptance. They remain active in saved state, so their operational refresh failures are not marked fixed or silently waived. No deletion, pause, disconnection, resource grant or other production mutation has been performed.

Retirement trace: `filterActiveSchedulerCampaigns` admits active campaigns (plus an explicitly targeted draft), and is used by GA4 daily/discovery and financial/CRM interval jobs. The existing campaign PATCH route validates access and supports a status-only update through storage. However, All Campaigns currently renders Edit/Delete controls without a Pause control; the unused status-toggle helper is not a visible UI path. Do not instruct the user to click a nonexistent Pause button. A complete retirement action must also address any queued/running work and separate report/alert schedules; a campaign status-only change has not been certified as stopping all background activity. No retirement change was made during this read-only trace.

### Prepared retirement scope (not applied)

The [October 27 08:37 Amsterdam read-only inventory](validation-2026-10-27-deployed/retirement-inventory-2026-10-27T07-37-37-087Z.json) confirms the exact six campaign/client/owner boundaries above. There are **no report rows** for them in either `linkedin_reports` (shared platform storage) or `kpi_reports`, and no open report-send events joined to their shared reports. Campaign3 has five GA4 KPIs and two GA4 Benchmarks; all seven already have alerts and email notifications disabled. The other five have no KPI or Benchmark rows. No report or alert setting needs changing for this inspected state.

Campaign3 has one running revenue-change work item and retained invalidated work history. The five service-account campaigns have nonretryable pending daily items. Proposed action: use the existing campaign status-only update to set precisely these six from `active` to `paused`, revalidating their exact identities/ownership and current schedules first. `storage.updateCampaign` uses `writeGA4RefreshInputChange`, which locks the campaign and invalidates its work identities/leases; `readGA4RefreshWorkScope` and native recovery reject paused campaigns. Do not bypass that mechanism with a raw status UPDATE, delete historical work, or alter credentials/grants. Preserve source records, monetary values, campaigns, and report/notification history. Leave V1 Batch 5 Test / ABN and every other campaign outside the six-row scope unchanged.

This is a concrete proposal, not a completed pause or an exhaustive guarantee about already-dispatched external requests. Apply-time concurrency/scope checks and subsequent read-only status/queue verification remain required. The user has confirmed redundancy but has not yet requested this saved-status mutation. No production mutation, runtime change or deployment was made while preparing it.

### User considering client deletion

The user subsequently asked about deleting Client2 and new_client instead. The [08:45 Amsterdam complete two-client inventory](validation-2026-10-27-deployed/client-scope-2026-10-27T07-45-00-811Z.json), in an enforced READ ONLY transaction, found **seven** campaign rows: the six confirmed redundant campaigns plus **GA4_campaign**, a draft under Client2 (`f15d247e7a62`). Every returned campaign matches its client's owner. This additional draft is not covered by the earlier six-campaign redundancy confirmation. Client deletion would also remove it; the user must account for that extra scope when choosing whether to delete Client2. The current Clients UI explicitly warns that client deletion permanently removes its campaigns and campaign-scoped analytics children. The route calls the owner-guarded transactional `deleteClientCascade`; no deletion or pause was performed for this advice.

## Safety and release limits

### User-completed deletion verification, October 27

After confirming all eight screenshot clients and their campaigns were redundant, the user reported deleting them. The [09:05 Amsterdam read-only verification](validation-2026-10-27-deployed/deletion-verification-2026-10-27T08-05-16-795Z.json) confirms:

- All eight client names are absent: Insta, Google, GA4 single, new_testersw, tert, client1, Client2 and new_client. The two previously captured exact client hashes are also absent.
- All seven previously identified campaign hashes (the six failed campaigns plus GA4_campaign) are absent. Across all **48 deployed base tables with a campaign_id column**, they have zero operational child rows. Six GA4 lifecycle audit records and one hidden notification remain, matching the intentional retention policy; no visible notification remains for these seven.
- There is **no GA4 refresh-work row anywhere referencing a missing campaign**. The six failed campaigns therefore have no saved refresh work left to retry. Their earlier provider failures are retired by the user's deletion, not repaired by changing authorization or providers.
- **ABN / V1 Batch 5 Test remains active**, with its original owner/client hashes. The [separate saved-state read](validation-2026-10-27-deployed/active-2026-10-27T08-03-03-637Z.json) confirms financial and Executive Summary revenue **EUR 8,003.96**, native GA4 **EUR 7,653.96**, and the existing completed-day window through October 26. This is saved-output preservation, not a new full refresh. Later source activity has invalidated historical work identities; the earlier natural-run proof remains timestamped evidence, not proof that all subsequent work is aligned.

The broader count-only check also found **14 active GA4 connection rows and six shared report rows referencing other missing campaign IDs**. All six report schedules are disabled. None belongs to the seven captured campaign hashes; there was no pre-deletion ID inventory for the other screenshot clients, so their age/origin and relation to those other deletions are unproven. Do not claim every deleted client's child cleanup was independently verified or call those records newly caused by this deletion. No speculative cleanup was performed. GA4 automatic campaign discovery begins from existing eligible campaigns, and no orphan refresh work exists, but full access/recovery/cleanup disposition of these additional records remains open.

The [09:04 Amsterdam anonymous scheduler observation](validation-2026-10-27-deployed/post-deletion-scheduler-2026-10-27T08-04-07-667Z.json) still displays the historical 08:11 scheduled failure list and a later ownership-loss error; it does not prove new attempts for deleted campaigns. Another refresh was in progress, without public per-current-campaign detail. The constant top-level healthy label is not used as acceptance. The next natural full batch and monitoring correctness remain unverified; V1-010 and whole-release status remain open.

No runtime, UI, schema or production data was edited **by the agent** for these checks; deletion was performed by the user. No manual refresh, provider operation, report generation or email send was triggered by the verification. Existing browser-access restrictions remain respected.

### Bounded orphan-record disposition review, October 27

The [09:19 Amsterdam metadata-only READ ONLY inventory](validation-2026-10-27-deployed/orphan-disposition-2026-10-27T08-19-15-755Z.json) resolves the next operational question without deleting records or exposing credentials:

- The 14 GA4 connection rows were created between November 14, 2025 and May 9, 2026. They reference 14 absent campaigns, retain `is_active=true`, and have no GA4 refresh work, GA4 daily metrics or Overview snapshots for their missing-parent scope. Creation dates do **not** establish when their parents were deleted or which UI deletion caused the orphan state.
- The six LinkedIn report rows were created December 3, 2025 and all reference one other absent campaign (`39fcf4c6a2ec`). All schedules remain disabled. Their 136 send-event rows comprise 63 sent, 68 failed and five skipped; none is pending or pending_delivery. They retain 134 report snapshots and 268 email audit rows labeled pending. A legacy pending audit label is not a queued report send: current report recovery selects `report_send_events.status=pending_delivery`, and alert retries require `kind=alert`, `delivery_status=retry_scheduled` and KPI/Benchmark entity identity.
- The combined 15 missing campaign IDs also have seven KPIs, one Benchmark, 459 metric snapshots and one HubSpot connection. There are no revenue/spend source rows or Sheets/Salesforce/Shopify connections for that exact set. These references are why a broad 20-row purge would not be a complete or justified history cleanup. Exact original owner/client provenance and retention disposition remain unproven.

Code paths inspected on unchanged `997f1c39`:

| Path | Current boundary and evidence limit |
|---|---|
| GA4 daily discovery, full native refresh, auto financial refresh, snapshot creation, KPI/Benchmark recompute | Enumerate existing campaigns through `filterActiveSchedulerCampaigns`; `storage.readGA4RefreshWorkScope` and native recovery additionally require a current eligible parent. The missing parents do not qualify. A raw storage helper by itself is not an authorization boundary. |
| Campaign GA4 connection list and direct connection deletion | `routes-oauth.ts` requires `ensureCampaignAccess` before returning hydrated connections or invoking delete. Missing parent returns 404; the owner-scoped source inventory starts from owned existing campaign IDs. |
| Report list, direct report update/delete/test-send/history and snapshot creation | Shared list requires a campaign and campaign access; direct report helper resolves the report and then requires campaign access. Scheduled selection requires enabled/active reports. Missing-campaign test-send/scheduled-send guards prevent PDF generation/send, and delivery recovery checks parent/report consistency. Current orphan rows have no eligible scheduled or recovery event. |
| KPI/Benchmark email alerts and retries | `getExistingCampaignName` requires a current named/owned campaign before claims/sends. Retry paths repeat that check. KPI notification creation also rejects a missing parent. This trace does not certify every historical notification or all period-processing paths. |

Existing full hosted validation includes the report missing-campaign/schedule-disable and notification orphan guards (`report-email-regression.test.ts`, `notification-visibility-regression.test.ts`). No tests were rerun or invented for an unchanged read-only review; some guards are static regression assertions, not live authenticated proof. No personal browser or provider was accessed.

**Disposition:** no immediate scheduling/UI correction is justified by these 20 orphan records in the paths inspected. Preserve the records and historical artifacts while exact retention/ownership cleanup remains separately open. Do not reconnect them, transfer them to ABN, or hard-delete history to make an audit count zero. This does not certify the entire app or all orphan lifecycle paths. The next confirmed application issue remains truthful scheduler health reporting: the public endpoint still returns a constant `healthy` despite recorded failures. That code has not been changed in this packet.

The user-completed deletion supersedes the earlier active-campaign and proposed-pause statements above. The six failed campaigns are retired, while historical failure evidence, additional orphan-record retention and the constant top-level scheduler `healthy` label remain tracked. Hosted test success and these bounded checks do not close the full scheduler gate.

V1-012's original automated-validation failure is now closed by the documented regression reconciliation plus the complete passing hosted execution on this final runtime revision, including retained deferred tests. This does not certify paths absent from tests. Current counts are **130 findings: 119 OPEN, 10 DEFERRED, one CLOSED**. The other seven Batch 8 findings remain open.

Other authenticated lifecycle, semantic/downstream, backup/restore/rollback, approved live-browser target and dependency/runtime-image acceptance remains governed by the [complete gate inventory](GA4_FIRST_REGRESSION_CHECKPOINT.md#complete-batch-8-release-disposition), with V1-012 superseded by this result. The natural emailed Ad Comparison attachment and postponed live Google Ads acceptance remain separate open checks. No complete release or zero-side-effect guarantee is issued. These checks require no further runtime correction or deployment; only evidence/documentation has been added locally.
