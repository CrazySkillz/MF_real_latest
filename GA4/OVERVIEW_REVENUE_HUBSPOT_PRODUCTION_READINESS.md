# GA4 Overview HubSpot Revenue Production Readiness

## Mandatory status

**Current status: not clean-certified.**

This is the canonical readiness document for the GA4 Overview HubSpot Revenue
source. It supersedes HubSpot status summaries in broader GA4 documents when
those summaries conflict with this source-specific audit.

Audit baseline:

- audit date: 2026-07-12
- audited commit: `d9fb4b155ee051ace0660625f0e61dce7286e4dd`
- audit type: fresh local code and evidence audit; no prior readiness statement
  was accepted as proof
- initial documentation audit runtime changes: none; local H1 implementation is
  recorded below and remains uncommitted/deployment-unverified
- production data changes or cleanup in this audit: none

The recorded Current Commit 4.16 runner pass remains useful bounded evidence.
It does not establish clean certification for the complete lifecycle and
downstream propagation scope required by `AGENTS.md` and
`PRODUCTION_READINESS.md`.

## Authority and evidence rules

This audit applies, in order:

1. `AGENTS.md`
2. `ARCHITECTURE_USER_JOURNEY.md`
3. `PRODUCTION_READINESS.md`
4. `GA4/README.md`
5. `GA4_DEVELOPMENT_WORKFLOW.md`
6. `GA4/OVERVIEW.md`
7. `GA4/FINANCIAL_SOURCES.md`
8. `GA4/REFRESH_AND_PROCESSING.md`
9. this document and the source-specific code and evidence cited here

The following distinctions are mandatory throughout this document:

- **Proven**: the exact path is supported by current code trace plus a focused
  test or a bounded recorded packet appropriate to the claim.
- **Partially proven**: important portions are traced or validated, but a
  lifecycle branch, negative case, variant, or downstream consumer is missing.
- **Unproven**: the required path has not been exercised or fully traced.
- **Broken**: current code proves an unsafe or contradictory path.
- **Excluded**: outside this audit boundary; no readiness inference is allowed.
- **Not locally verifiable**: depends on deployed configuration, provider state,
  production data, or delivery infrastructure unavailable to this local audit.

A passing runner or test file is never promoted beyond the exact behaviors it
checks. Static regression assertions do not prove database rollback, provider
pagination completeness, production data integrity, or inbox delivery.

## Scope

Included:

- GA4 campaign-scoped HubSpot authentication and ownership
- HubSpot Revenue add, import, edit, delete, disconnect, refresh, scheduler, and
  reprocess paths
- field mapping, filtering, dates, daily revenue records, confirmed revenue,
  Pipeline Proxy, and proxy-to-confirmed transition
- transaction and failure retention
- GA4 Overview source modal and financial cards
- Campaign Breakdown and Ad Comparison
- live and persisted KPI and Benchmark values
- Reports, snapshots, PDFs, scheduled/test emails, and notifications
- Campaign DeepDive/outcome consumers required by the documented architecture
- multi-campaign isolation
- damaged-data detection and cleanup assessment

Excluded:

- Google Sheets Revenue, which remains on hold
- Upload CSV Revenue, whose separate validated scope is complete
- spend-source certification
- Salesforce, Shopify, and non-GA4 HubSpot contexts
- semantic deduplication between HubSpot deals and revenue already represented
  by GA4 native revenue; the product warns about overlap but current code cannot
  prove that the selected business records are non-overlapping
- changes after the audited commit

## Executive result

HubSpot Revenue is **not clean-certified** at the audited commit. The existing
evidence proves several important happy paths for two controlled campaigns, but
it does not cover the complete lifecycle or negative-case matrix. Current code
also establishes blockers that invalidate a blanket production-ready claim:

1. At the audited baseline, HubSpot save/edit/reprocess persistence was not
   atomic. Local H1 now addresses this exact path; deployed evidence remains
   pending and the other blockers below remain open.
2. At the audited baseline, confirmed-deal and Pipeline Proxy searches could
   stop at the 25-page cap while more pages remained. Local H3 now rejects that
   continuation and repeated cursors before mutation; deployed evidence remains
   pending.
3. At the audited baseline, a numeric confirmed deal with an invalid or missing
   mapped date could contribute to totals without a daily record. Local H2 now
   rejects that input and reconciles all materialized totals before mutation;
   deployed evidence remains pending.
4. the source modal can fall back to configuration `lastTotalRevenue` when
   records are absent, so it can display a value that the record-backed Total
   Revenue card does not contain after a damaged write.
5. full HubSpot disconnect deletes active sources one request at a time and then
   deletes the connection. The cross-source destructive operation is not
   atomic and can stop in a partially disconnected state.
6. Campaign DeepDive/outcome totals and campaign-level KPI/Benchmark current
   values do not consistently use the GA4 Overview native-revenue selector.
   HubSpot imported revenue may be the same while Total Revenue, Profit, ROAS,
   ROI, and CPA still drift across surfaces.
7. outcome totals can fall back to connection `lastTotalRevenue` when active
   source records are unavailable, recreating revenue outside the canonical
   active-source record path.
8. positive Pipeline Proxy is explicitly added to browser report output and the
   scheduled GA4 PDF, while the financial-source contract says Pipeline Proxy
   must not feed Reports. The historical report packet had a zero proxy and did
   not test this contradiction.

These are present-code findings, not hypothetical missing evidence. Clean
certification must remain blocked until they are corrected and the resulting
negative cases and downstream paths are validated.

## Canonical data and source-of-truth trace

The intended HubSpot GA4 Revenue flow is:

`campaign access -> HubSpot OAuth connection -> selected property/value/stage/date mappings -> provider deal search -> validated confirmed deal amounts -> daily revenue_records linked to one active GA4 revenue_source -> source-backed totals -> GA4 Overview and downstream consumers`

Current persistence and ownership:

- `shared/schema.ts` stores campaign-owned `hubspot_connections`,
  `revenue_sources`, and `revenue_records`.
- `revenue_sources.platformContext` scopes the source to GA4; legacy null context
  is included by the GA4 storage convention.
- `revenue_records.revenueSourceId` links materialized daily values to the
  source. Totals join only active sources.
- `server/storage.ts` owns active source reads, record-backed totals and
  breakdowns, and the transactional single-source delete.
- `server/routes-oauth.ts` owns OAuth, HubSpot provider queries, mapping save,
  materialization, proxy endpoints, damage inventory, and downstream routes.
- `client/src/components/HubSpotRevenueWizard.tsx` owns mapping selection,
  preview, add/edit submission, and the fixed ten-year lookback request.
- `client/src/pages/ga4-metrics.tsx` combines the selected native GA4 revenue
  candidate with imported active-source revenue for Overview financial values.

The `mappingConfig.lastTotalRevenue` field is provenance/cache metadata. It is
not a safe substitute for the materialized active-source records. Current code
does use it as a fallback on some surfaces, which is a blocker documented below.

## Authentication and campaign ownership

### Proven locally

- HubSpot connect begins from a campaign-scoped route and requires campaign
  access.
- OAuth state is signed, time-limited, and carries the campaign identity.
- mapping save requires campaign access and separately verifies the campaign.
- edit by `sourceId` verifies campaign ID, source type `hubspot`, and GA4
  platform context.
- revenue reads and the individual delete path are campaign/context scoped.
- HubSpot access and refresh tokens use the storage encryption path; legacy
  plaintext token migration is present.

### Partially proven or not locally verifiable

- the callback relies on the signed OAuth state rather than a live browser
  session. Its provider redirect behavior is not locally exercised here.
- state includes a nonce but no local single-use nonce store was identified.
- the state secret can fall back through application secrets and ultimately a
  development fallback. Production environment configuration is not locally
  verifiable.
- real token refresh, expiry, revocation, portal authorization, scope behavior,
  and provider availability require deployed HubSpot evidence.

Result: campaign ownership is locally proven for the application routes.
Provider authentication durability is not clean-certified from local code.

## Add/import and edit/update

The wizard selects:

- a HubSpot campaign property
- one or more exact property values
- the amount property
- a date field (`closedate`, `createdate`, or `hs_lastmodifieddate`)
- optional Pipeline Proxy pipeline and stage
- exact GA4 campaign mappings for downstream attribution

The server independently derives effective closed-won stages. It queries
confirmed revenue using the selected property values, closed-won stages, and
selected date window. Mixed currencies fail before normal persistence.

### Bounded evidence

The recorded 4.5 packet proves one controlled add/edit/delete lifecycle for
campaign `8aa735ee-c02f-41e2-bb1f-7c3f43bb9458` and property `542352127`:

- add: one source, two records, HubSpot revenue `$10,600`
- edit with stable source identity: one source, four records, `$16,600`
- delete: no active HubSpot source/records and the non-HubSpot `$600` baseline
  remained

The 4.7b packet adds bounded provenance for source
`658...`, property `dealname`, selected value `LI_B2B...Deal3`, amount, date,
and `$14,000`. These packets do not prove other mappings or failure branches.

### Current gaps and broken branches

- Add without `sourceId` may reuse an active source with an identical mapping
  signature. Distinct mappings are additive, but the documentation claiming
  every new HubSpot add creates another source is not exact for identical
  mappings. The intended duplicate behavior must be made explicit and tested.
- preview calls the save route with `previewOnly`. Preview failures are silently
  swallowed in the client, and edit review can show the saved
  `lastTotalRevenue`; this does not prove a fresh provider preview.
- the connection mapping is updated before source/record replacement completes.
- source create/update, old-record deletion, and new-record inserts are separate
  writes without one database transaction.
- the route's fail-closed `500` response does not roll back earlier writes.
- no dynamic forced-failure evidence proves preservation of the previous active
  source and records.

Result: controlled happy-path add/edit is partially proven. Atomic update and
failure retention are broken.

## Mapping, filtering, dates, and daily materialization

### Confirmed behavior

- exact selected HubSpot property values are sent through provider `IN` filters.
- confirmed revenue additionally uses the effective closed-won stage set and a
  lower date bound.
- Pipeline Proxy uses the selected open stage and remains a separate query.
- numeric confirmed amounts are aggregated by normalized selected date into
  daily `revenue_records`.
- exact campaign-value totals are stored in
  `campaignValueRevenueTotals`; downstream campaign allocation is exact rather
  than proportional.
- empty/missing campaign mappings do not invent allocation.
- the wizard currently requests 3,650 days. This is a configured ten-year
  window, not an all-history guarantee.

### Broken completeness checks

- the confirmed total is incremented before the selected deal date is proven
  materializable. A numeric deal with an invalid/missing date remains in
  `lastTotalRevenue` and campaign totals but is absent from daily records.
- the date normalizer accepts `YYYY-MM-DD` shape without proving the calendar
  date is valid.
- there is no invariant requiring `sum(daily records) == confirmed total` before
  persistence or success response.
- searches use 100 rows per page and a maximum of 25 pages. The nominal
  `MAX_HUBSPOT_RESULTS` is 5,000, but only 2,500 rows can be traversed. When the
  25th page still contains a continuation cursor, the confirmed search can
  silently accept the partial result.
- Pipeline Proxy preview/materialization has the same bounded-page problem; one
  branch breaks rather than returning an overflow error.
- Pipeline Proxy query errors can be caught while confirmed revenue still saves,
  so a pipeline-enabled mapping can be persisted without proving a complete
  proxy result.

### Timezone boundary

HubSpot daily materialization stores normalized `YYYY-MM-DD` keys. Campaign
reporting timezone controls GA4 completed-day cutoff and UI/report freshness,
but the HubSpot date field is normalized from the provider value rather than
rebucketed through campaign reporting timezone. No variant packet proves
timezone-offset timestamps around local midnight or DST for all three supported
date fields.

Result: the basic aggregation path is traced. Completeness, invalid-date, page
overflow, and timezone-boundary cases are not certified; the first three have
confirmed unsafe code branches.

## Pipeline Proxy and proxy-to-confirmed transition

Intended contract:

- open-stage value contributes only to Pipeline Proxy
- confirmed closed-won value contributes to Total Revenue and derived financials
- the same business value must not be counted in both at the same time
- proxy is excluded from Profit, ROAS, ROI, CPA, confirmed campaign revenue,
  KPI/Benchmark financial inputs, and notification financial inputs

Bounded evidence:

- 4.9b recorded one `$5,000` Contract Sent proxy and `$7,600` confirmed revenue;
  the proxy was excluded from confirmed revenue.
- 4.10b recorded a transition of proxy `-$5,000`, confirmed `+$5,000`, combined
  flat, with spend unchanged.

Current trace:

- Overview financial formulas, configured KPI/Benchmark job inputs, outcome
  aggregate inputs, and notification financial resolver exclude the proxy.
- the source modal exposes Pipeline Proxy as a separate source/value.
- browser and scheduled report generation add a positive `Pipeline Proxy` card.
  This contradicts the documented report exclusion contract and is explicitly
  expected by a current regression assertion.

Result: the controlled transition packet is proven at its exact boundary.
Positive-proxy report exclusion is broken, and other stage/pipeline/date/mapping
variants remain unproven.

## Provider refresh, scheduler, and reprocessing

Current trace:

- the external-value scheduler includes the GA4 HubSpot source family.
- it reads active source mapping as the refresh source of truth and supplies the
  stable source ID to the same mapping save route.
- the scheduler has configured daily time/timezone and overlap controls.
- a stale/deleted source returns or is treated as unavailable rather than being
  broadened to another campaign.
- no user-facing HubSpot Run Now path is part of the current contract.

Bounded evidence:

- 4.8b recorded controlled same-source provider propagation: HubSpot and Total
  Revenue changed by `-$100` while spend remained unchanged.

Gaps:

- the save route's non-atomic replacement also affects scheduler reprocessing;
  a logged refresh failure can already have removed last-good records.
- normal wall-clock firing, token refresh during the scheduled run, provider
  retry behavior, timeout recovery, page overflow, concurrency, and last-good
  retention are not established by 4.8b.
- a deployed scheduler configuration and future HubSpot provider behavior are
  not locally verifiable.

Result: stable-source wiring and one controlled propagation packet are proven.
Scheduler safety and failure retention are not clean-certified.

## Delete, deactivate, and disconnect

### Individual source delete

`server/storage.ts` transactionally deactivates the exact campaign/context
source and deletes only that source's records. The route verifies campaign
access and source ownership. The 4.5 packet confirms the target source was
removed without changing the non-HubSpot baseline.

The post-delete connection/proxy metadata adjustment and recompute are outside
that storage transaction. The active source/record boundary remains the
financial source of truth, but metadata/recompute failure variants are not
dynamically proven.

### Full disconnect

The current modal enumerates active HubSpot sources, calls the individual delete
route sequentially for each, then deletes the HubSpot connection. This is not a
single destructive transaction. A middle request failure can leave only some
sources deleted; connection deletion can also fail after all sources were
removed.

A legacy bulk deletion route exists but no current UI caller was established in
this audit. It is excluded from current UI validation and must not be removed or
declared safe without a separate caller, scheduler, storage, schema, and
production-data reachability audit.

Result: exact single-source deletion is proven at a bounded level. Multi-source
disconnect is broken as an all-or-nothing lifecycle action.

## Transaction and failure retention

Required invariant: a failed add/edit/refresh must leave either the complete new
state or the complete previous state. It must not erase the last good financial
value or publish contradictory provenance.

The audited baseline ordering could produce:

1. updated connection mapping metadata
2. updated or newly created revenue source
3. deleted previous daily records
4. failure before all replacement records are written
5. `500` response with partial persisted state

Consequences:

- Total Revenue and derived record-backed values can drop or become partial.
- the source modal can still display configuration `lastTotalRevenue`.
- outcome totals can use a connection fallback even when canonical records are
  missing.
- scheduler logging can say refresh failed without preserving the old value.
- subsequent damage inventory does not currently compare all these totals.

No cleanup is safe until the affected source/record/config boundary is
identified. Runtime repair and data cleanup must be separate commits.

Local H1 result: the GA4 path now performs connection mapping, source
create/update, campaign-scoped old-record deletion, and replacement insertion in
one storage-owned transaction after provider calculation. Forced source,
delete, insert, and connection failures preserve the complete prior state in
focused tests. Deployment behavior remains not locally verifiable.

## Source modal and provenance

Proven/traced:

- active GA4 revenue sources are campaign scoped.
- record-backed breakdown provides source totals.
- property, selected values, amount/date fields, pipeline fields, source ID, and
  campaign mapping metadata are available in source configuration.
- 4.7b proves one exact displayed provenance packet.

Gaps:

- `revenueDisplaySources` can use configuration `lastTotalRevenue` when the
  record breakdown lacks the source, masking damaged materialization.
- the latest connection mapping is one connection-level object while multiple
  active additive sources can have different source-level mappings. Connection
  provenance cannot certify every active source.
- preview failure can leave edit review based on cached metadata.
- no fresh packet proves every supported mapping/date/pipeline combination,
  inactive state, or damaged-state presentation.

Result: normal provenance is partially proven; damaged-state truthfulness is
not certified.

## Financial cards

The GA4 Overview implementation chooses the native GA4 financial candidate with
the largest supported native revenue value and keeps its associated spend and
conversions together. It then adds record-backed active imported revenue:

- `Total Revenue = selected native GA4 revenue + imported revenue`
- `Profit = Total Revenue - Total Spend`
- `ROAS = Total Revenue / Total Spend`
- `ROI = (Total Revenue - Total Spend) / Total Spend * 100`
- `CPA = Total Spend / selected native GA4 conversions`

Pipeline Proxy is excluded from these formulas. Zero-denominator display
behavior follows the existing Overview contract.

Local formula wiring is proven. The displayed HubSpot component remains subject
to the materialization and failure-retention blockers above. The implementation
does not deduplicate business revenue already represented in native GA4; correct
offsite selection is a user/provider data responsibility disclosed by the
wizard.

Result: formula contract proven; HubSpot input integrity not clean-certified.

## Campaign Breakdown and Ad Comparison

Current behavior:

- exact normalized HubSpot campaign mapping names are joined through
  `campaignValueRevenueTotals` and `campaignMappings`.
- imported-only mapped campaigns may produce a zero-GA4 row rather than losing
  the exact imported revenue.
- unmatched values are not proportionally allocated.
- Campaign Breakdown and Ad Comparison consume the same exact mapping totals.

Bounded evidence:

- 4.11 proves one target row increased by `$100` while one named non-target row
  remained unchanged.

Missing evidence:

- multiple selected values mapped to one GA4 campaign
- one selected value mapped to multiple campaigns, if allowed by the UI shape
- unmatched, renamed, duplicate-normalized, blank, and zero-GA4 variants
- edit/remap/delete propagation through both tables
- invalid-date and truncated-provider results
- multi-source overlapping mappings

Result: one exact row-level propagation packet is proven. Complete Campaign
Breakdown and Ad Comparison certification is unproven.

## KPI and Benchmark values

There are two materially different paths:

1. GA4-page live KPI/Benchmark evaluation uses the Overview financial inputs.
2. persisted refresh jobs and campaign-level current-value helpers calculate
   values for history, alerts, and cross-platform consumers.

Bounded evidence:

- 4.13 proves configured Revenue, ROAS, ROI, and CPA KPI/Benchmark rows for the
  exact controlled campaign after the relevant job fix.
- the configured GA4 job path locally adds active imported revenue and excludes
  Pipeline Proxy.

Current gap:

- `server/utils/campaign-current-values.ts` uses persisted GA4 daily rows plus
  imported revenue and does not use the full Overview largest-native-revenue
  selector. When to-date, daily, and breakdown native candidates differ,
  campaign-level KPI/Benchmark values can drift from GA4 Overview even though
  the HubSpot imported component is identical.

The broader KPI/Benchmark documents that still call the 4.13 deployed packet
pending are stale relative to the recorded packet. Conversely, the packet does
not prove all formula, negative, update/delete, refresh, alert, and campaign-level
consumer variants.

Result: exact configured rows are partially proven; cross-surface source parity
is broken/unproven.

## Campaign DeepDive and outcome propagation

The architecture requires Campaign DeepDive to roll up connected-platform
source-of-truth values. HubSpot imported revenue is read from the active GA4
revenue breakdown, but current outcome totals then use GA4 native to-date values
rather than necessarily using the Overview largest-native-revenue candidate.

Consequences can affect:

- Total Revenue
- Profit, ROAS, ROI, and CPA
- Performance Summary
- Budget & Financial
- Platform Comparison
- Executive Summary and trend/report aggregates consuming outcome totals

Additionally, when record-backed revenue breakdown is empty, an outcome path can
fall back to active CRM connection `lastTotalRevenue`. That fallback can publish
HubSpot revenue after a partial failed write even when Overview's canonical
record-backed imported total is zero.

Result: broken source-of-truth parity. Historical HubSpot Overview packets do not
certify Campaign DeepDive.

## Reports, snapshots, PDFs, and emails

### Proven or bounded

- browser report generation and the shared scheduled GA4 PDF calculate Overview
  financial formulas from active source-backed imported revenue.
- source provenance and exact campaign mapping totals are included in the
  report-building path.
- 4.12 proves one saved GA4 Overview report packet: financial revenue
  `$44,864.15`, imported `$16,700`, HubSpot `$16,100`, proxy `$0`, and target-row
  HubSpot `$16,100`; PDF response type/bytes were observed.
- 4.14 is user-confirmed evidence that one attached PDF was received, opened,
  and matched the validated values.
- scheduler code builds the PDF before sending and creates a snapshot only after
  the send/delivery-confirmation path returns success. Failed sends update the
  send event rather than creating a sent snapshot.

### Gaps and contradiction

- neither 4.12 nor 4.14 proves PDF text/pixel parity through automated extraction.
- provider event identifiers were not recorded for 4.14; it is bounded inbox
  evidence, not proof of future delivery.
- positive Pipeline Proxy is added to both browser report output and scheduled
  PDF output, contradicting the documented exclusion from Reports.
- snapshot JSON is scheduling metadata; source-backed PDF is the financial
  artifact. All report types, schedules, timezones, retries, update/delete paths,
  and future provider variants were not exercised for HubSpot.
- report output after edit/delete/failed refresh and multi-source HubSpot mappings
  is unproven.

Result: one zero-proxy report/email packet is proven. Positive-proxy exclusion
is broken and the complete report lifecycle is not certified.

## Notifications

The notification financial resolver locally selects the supported GA4 native
financial candidate, adds active imported revenue, and excludes Pipeline Proxy.
It fails closed when the native GA4 source cannot be verified.

No dedicated HubSpot packet in the reviewed evidence proves the full alert
lifecycle after add, edit, delete, refresh, proxy transition, partial provider
failure, multi-campaign isolation, dismissal, and recreation. General
notification regression coverage is not HubSpot lifecycle evidence.

Result: local value wiring is traced; HubSpot-specific notification behavior is
partially proven at best and deployed lifecycle evidence is unproven.

## Multi-campaign isolation

Locally proven controls:

- access middleware and source edit/delete guards bind operations to the target
  campaign.
- revenue source and record reads filter campaign and GA4 context.
- scheduler refresh uses each active source's stable ID and campaign mapping.

Bounded evidence:

- 4.15 records two campaigns/properties with different HubSpot totals (`$16,100`
  and `$8,000`) and no source ID overlap.

Missing cases:

- unauthorized owner/client access in the deployed packet
- simultaneous refresh of both campaigns
- same portal and same mapping signature in two campaigns
- delete/disconnect in one campaign while the other is refreshed
- provider/token failure isolated to one campaign
- downstream report/KPI/notification isolation for both campaigns

Result: storage/route scoping and one portability packet are proven. The full
multi-campaign lifecycle matrix is unproven.

## Damaged-data inventory and cleanup assessment

The read-only campaign inventory currently checks HubSpot candidates for:

- active sources with zero records
- orphan HubSpot records
- duplicate active HubSpot mapping signatures
- source/mapping platform-context mismatch
- Pipeline Proxy scope mismatch

It reports non-secret provenance and does not mutate data. Historical 4.6
evidence found no target-campaign candidates at that time.

Coverage gaps:

- stored `lastTotalRevenue` versus active record sum
- `campaignValueRevenueTotals` versus materialized daily sum
- missing, blank, malformed, or impossible daily dates
- duplicate daily grains or source/type mismatches
- partial replacement records after an interrupted save
- connection mapping versus each active additive source
- stale connection fallback values after source deletion/failure
- current global production inventory rather than the two historical fixtures

No fresh production inventory was run during this local audit, and local code
cannot establish current production data state. No candidate cleanup boundary is
therefore proven.

Cleanup rule:

1. fix the forward write/failure path first
2. expand the read-only inventory to detect the exact damaged invariants
3. capture source IDs, record IDs, connection IDs, campaign IDs, dates, and sums
4. propose a separate targeted cleanup
5. never infer or allocate missing deal revenue and never silently bulk-delete

Result: inventory is useful but incomplete. Cleanup is not authorized or ready.

## Existing-claim reconciliation

| Existing claim/evidence | Fresh determination |
|---|---|
| `GA4/OVERVIEW_VALIDATION_RUNNER.md` says deployed Current Commit 4.16 passed | Accepted only for runner `2026-07-05.2`, timestamp `2026-07-05T06:53:32.454Z`, one configured variant, `overallPass: true`. The recorded summary does not expand the variant or prove the complete lifecycle. |
| `GA4/OVERVIEW_PRODUCTION_READINESS.md` says 4.16 evidence is pending | Stale relative to the recorded bounded runner packet. Its broader warning against blanket certification remains correct. |
| `GA4/README.md`, `GA4/OVERVIEW.md`, and `GA4/FINANCIAL_SOURCES.md` call HubSpot production-ready after 4.16 | Overbroad for the strict scope. They are status leads, not evidence, and are superseded by this audit for HubSpot readiness. |
| KPI/Benchmark docs say 4.13 deployed row evidence is pending | Stale for the exact recorded 4.13 configured packet; not stale for untested variants and campaign-level consumers. |
| 4.5 add/edit/delete packet | Valid exact-campaign happy-path evidence; not transaction rollback, multi-source disconnect, or all-mapping proof. |
| 4.7b provenance packet | Valid for one source/mapping/value; not all mappings or damaged states. |
| 4.8b scheduler propagation packet | Valid for one controlled `-$100` same-source propagation; not normal firing or failure retention. |
| 4.9b and 4.10b proxy packets | Valid for one proxy exclusion and transition; do not cover report output with positive proxy. |
| 4.11 Campaign Breakdown packet | Valid for one target and one non-target row; not the complete mapping matrix or Ad Comparison lifecycle. |
| 4.12 report packet | Valid for one report with proxy zero and PDF availability; not positive-proxy exclusion or PDF text parity. |
| 4.13 KPI/Benchmark packet | Valid for the exact configured rows; not every formula, job, campaign-level helper, or notification consumer. |
| 4.14 email packet | Valid user-confirmed receipt/open/value match for one email; provider-event and future-delivery proof absent. |
| 4.15 portability packet | Valid for two controlled campaigns/source IDs; not the full isolation matrix. |
| Static HubSpot regression suite | Useful wiring/contract guard. It cannot prove transactional rollback, provider pagination, production data, or delivery. One assertion currently preserves the report/proxy contradiction. |

## Evidence packet boundaries

The historical sequence 4.5 through 4.16 is retained. It must be read as a set
of bounded packets, not an accumulating blanket certificate. Later packets do
not retroactively close negative cases absent from earlier packets. In
particular:

- `overallPass` means the invoked runner assertions passed for the supplied
  fixture and options.
- `variantCount: 1` proves one configured variant, not all HubSpot field/date/
  stage/pipeline combinations.
- a zero Pipeline Proxy report packet cannot prove positive-proxy exclusion.
- a successful write cannot prove last-good retention after a failed write.
- two campaigns with distinct IDs cannot prove all concurrent or unauthorized
  cross-campaign operations.
- a read-only target inventory at one timestamp cannot prove current production
  data is undamaged.

## Status by requested lifecycle

| Requested path | Status | Reason |
|---|---|---|
| authentication and campaign ownership | Partially proven | Local campaign guards and signed state are traced; deployed secrets/provider/token lifecycle are not locally verifiable. |
| add/import | Locally guarded/traced through H8; deployed dynamic evidence pending | H1-H3 guard rollback/date/pagination; H8 explicitly traces identical-signature reuse, distinct additive selection, and source-ID edit/refresh semantics. |
| edit/update | Locally fixed by H1; deployed evidence pending | Stable ID and transaction rollback are locally guarded; deployed provider/write failure evidence remains pending. |
| single-source delete/deactivate | Partially proven | Exact transactional storage delete and one packet; metadata/recompute failures not fully exercised. |
| full disconnect | Broken | Sequential multi-source deletion plus connection deletion is not atomic. |
| mapping and filtering | Locally guarded through H8; deployed dynamic evidence pending | One shared normalized key and unique-row guard cover multi-value/source accumulation plus blank, zero, unmatched, punctuation, and ambiguous variants without guessed allocation. |
| date handling and daily materialization | Locally fixed by H2/H3; deployed evidence pending | Strict calendar validation, total reconciliation, and incomplete-page rejection run before mutation. |
| Pipeline Proxy exclusion and transition | Locally fixed by H7; deployed evidence pending | One transition packet passed; H7 removes proxy data/rendering from browser and scheduled report artifacts while preserving operational surfaces. |
| provider refresh/scheduler/reprocess | Partially proven | H1 protects rollback and H3 rejects incomplete pages locally; normal deployed scheduler/provider evidence remains pending. |
| transaction and failure retention | Locally proven by H1; deployed evidence pending | One GA4-only transaction now covers connection, source, delete, and insert with forced rollback tests. |
| source modal and provenance | Partially proven | One provenance packet; configuration fallback can mask missing records. |
| Total Revenue, Profit, ROAS, ROI, CPA | Partially proven | Overview formulas traced; input integrity and cross-surface parity are not certified. |
| Campaign Breakdown | Locally guarded through H8; deployed dynamic evidence pending | Mapping lifecycle and unique-row fail-closed allocation are guarded across Overview and browser/scheduled report paths. |
| Ad Comparison | Locally guarded through H8; deployed dynamic evidence pending | Ad Comparison uses the shared allocation key, unique-row guard, multi-source accumulation, and residual/unallocated contract. |
| KPI and Benchmark values | Locally guarded/traced through H6/H8; deployed evidence pending | Native/imported formula parity is locally guarded and H8 traces HubSpot save/delete/refresh to the shared GA4 recompute path. |
| Reports/snapshots/PDFs/emails | Locally fixed by H7; deployed evidence pending | Browser and scheduled PDF branches no longer consume/render proxy; positive deployed artifacts, delivery, and report variants remain unproven. |
| notifications | Locally traced through H8; deployed evidence pending | HubSpot save/delete/refresh schedules the shared GA4 KPI/Benchmark recompute and subsequent performance-alert evaluation. |
| multi-campaign isolation | Partially proven | Route/storage scoping plus two-campaign packet; concurrency and full downstream matrix absent. |
| damaged-data inventory and cleanup | H9 read-only inventory expanded locally; current production unproven | Totals, dates, grains, partial replacements, connection/source, campaign, type, context, and currency candidates are now guarded; no fresh production scan or cleanup authority exists. |

## Proven, partial, unproven, excluded, and external summary

### Proven within exact boundaries

- campaign/context guards on primary application routes
- stable source identity on guarded edit and scheduler wiring
- active-source record-backed total/breakdown storage semantics
- transactional single-source delete boundary
- strict GA4 HubSpot calendar-date validation and pre-mutation reconciliation in
  local H2 tests
- fail-closed confirmed/proxy continuation and repeated-cursor handling in local
  H3 tests
- Overview formula definitions and proxy exclusion from those formulas
- exact campaign mapping rather than proportional allocation
- bounded packets 4.5, 4.7b, 4.8b, 4.9b, 4.10b, 4.11, 4.12,
  4.13, 4.14, 4.15, and the single configured 4.16 runner variant only as
  described above

### Partially proven

- OAuth and token lifecycle
- add/import and edit happy paths
- source-modal provenance
- scheduler propagation
- Pipeline Proxy transition variants
- Campaign Breakdown, Ad Comparison, KPI/Benchmark, Reports, and notifications
- multi-campaign isolation

### Remaining broken in current code after local H1, H2, and H3

- multi-source disconnect atomicity
- source-modal truthfulness after missing materialization
- Campaign DeepDive/outcome and campaign-current-value parity
- connection-total fallback outside canonical records
- positive Pipeline Proxy exclusion from Reports

### Unproven

- all mapping/date/stage/pipeline variants and negative cases
- concurrent updates and refresh/delete races
- complete report/snapshot/email variants
- HubSpot-specific notification lifecycle
- current production damaged-data boundary and cleanup

### Not locally verifiable

- production OAuth/state/encryption secret configuration
- HubSpot API availability, ordering, completeness, token refresh/revocation, and
  future schema/data behavior
- deployed scheduler wall-clock execution
- current production database contents
- provider-confirmed email delivery outside the recorded one-email packet

### Excluded

- Google Sheets Revenue
- Upload CSV Revenue
- spend sources and other revenue providers
- non-GA4 HubSpot contexts
- semantic HubSpot-versus-GA4 revenue deduplication

## Isolated Current Commit queue

Each item is a separate, smallest-safe packet. Do not combine cleanup with the
forward fix, and do not claim certification after only the first item.

### Current Commit H1 — atomic HubSpot source replacement and last-good retention

Status: implemented locally on 2026-07-12; focused validation passed; deployment
evidence pending.

Scope:

- precompute and validate the complete provider result before mutation
- persist connection mapping, source create/update, old-record deletion, and all
  new records in one storage-owned database transaction
- on any injected write failure, preserve the exact prior active source,
  mapping, and records
- apply the same atomic path to user edit and scheduler reprocessing
- add dynamic database tests for failure before delete, after delete, during
  insert, and during connection/source update

Files should remain limited to the existing route/storage/test pattern. No
response shape or architecture change is implied.

This was the first runtime commit because the baseline path could damage
persisted financial data while reporting failure. H1 does not close H2-H10 and
does not clean-certify HubSpot Revenue.

### Current Commit H2 — confirmed-date materialization invariant

Status: implemented locally on 2026-07-12; focused validation passed; deployment
evidence pending.

- require every included numeric confirmed deal to have a valid supported date
- reject impossible calendar dates
- require confirmed total, campaign-value totals, and daily record sum to
  reconcile before persistence
- prove all three supported date fields, offset timestamps, local-midnight/DST
  boundaries, missing dates, and invalid dates

H2 uses one strict parser for all three allowed HubSpot date fields, retains UTC
day-key behavior for offset timestamps, rejects impossible calendar dates, and
requires confirmed, daily, and campaign-value totals to reconcile before the H1
transaction. H2 does not close provider pagination or certify production data.

### Current Commit H3 — fail-closed provider pagination

Status: implemented locally on 2026-07-12; focused validation passed; deployment
evidence pending.

- detect a continuation cursor after the allowed last page
- fail before mutation rather than accept confirmed or proxy partial totals
- cover exactly-at-limit, one-over-limit, and repeated-cursor cases for
  confirmed and Pipeline Proxy searches

For GA4, H3 applies one cursor contract to confirmed revenue, Pipeline Proxy
preview, Pipeline Proxy save, and on-demand Pipeline Proxy recompute. Exactly 25
complete pages are accepted. A continuation after page 25 or a repeated cursor returns
`HUBSPOT_PAGINATION_INCOMPLETE` before publishing source, record, connection, or
proxy metadata. Non-GA4 HubSpot contexts retain their prior behavior.
Non-pagination provider retry/fallback behavior remains outside this
pagination-only fix and is not certified by H3.

### Current Commit H4 — atomic/fail-safe full disconnect

Status: implemented locally on 2026-07-12; focused validation passed; deployment
evidence pending.

- preserve campaign/source ownership
- make deletion of all targeted active HubSpot GA4 sources and the connection an
  all-or-nothing storage operation, or provide an equivalently proven resumable
  state machine within the current architecture
- prove failure at every source and connection boundary and isolation from other
  campaigns/providers

H4 replaces the GA4 modal's source-by-source requests followed by a separate
connection request with one campaign-guarded endpoint and one storage
transaction. It deactivates every active GA4 HubSpot source (including legacy
null-context rows), deletes only those sources' campaign-scoped records, and
deactivates the selected active campaign connection together. A failed source
update, record delete, or connection update rolls the complete unit back.

Because the OAuth connection is campaign-shared, H4 returns `409` without
mutation when an active non-GA4 HubSpot revenue source exists in the campaign.
It also retains active sources and returns `404` when there is no active campaign
connection. Non-GA4 modal paths and the existing individual-source endpoint are
unchanged.

### Current Commit H5 — remove stale display/fallback authority

Status: implemented locally on 2026-07-12; focused validation passed; deployment
evidence pending.

- prevent source modal and outcome consumers from treating connection/source
  `lastTotalRevenue` as confirmed materialized revenue when active records are
  missing
- retain provenance without presenting it as a current financial value
- define a stable damaged/unavailable state without modal layout jumps

H5 makes active GA4 HubSpot records the sole current-revenue authority on the
source-list and outcome fallback paths. A source with a materialized breakdown
publishes its record total, including a legitimate zero. A source without a
materialized breakdown publishes `lastTotalRevenue: null` and
`materializedRevenueStatus: "unavailable"`; its mapping remains available as
provenance and for repair. Non-GA4 HubSpot contexts and non-HubSpot providers
retain their prior fallback behavior.

### Current Commit H6 — downstream native-source parity

Status: implemented locally on 2026-07-12; focused validation passed; deployment
evidence pending.

- make Campaign DeepDive/outcome totals and campaign-level KPI/Benchmark current
  values use the same native GA4 financial candidate contract as Overview
- preserve imported active-source revenue and proxy exclusion
- add parity tests for daily/to-date/breakdown disagreement and all five
  financial values

H6 centralizes the native GA4 financial selector used by Overview, outcome
totals, and campaign current values. Candidate order is to-date, persisted daily,
then breakdown; the candidate with the greatest native revenue wins, and ties
retain the earlier candidate. Conversions remain attached to the selected
candidate for CPA rather than being independently maximized. Materialized
imported revenue and spend use the complete persisted-source window, and Pipeline
Proxy is not an input.

### Current Commit H7 — Reports Pipeline Proxy contract

Status: implemented locally on 2026-07-12; focused validation passed; deployment
evidence pending.

- reconcile the implementation/test contradiction in favor of the documented
  confirmed-financial contract unless product requirements explicitly change
- prove positive proxy appears only on allowed operational surfaces and is
  absent from browser/scheduled financial reports, snapshots, PDFs, and emails
- repeat report value parity with a deliberately positive proxy

H7 resolves the contradiction in favor of the confirmed-financial contract.
The root cause was not a Total Revenue formula error: both report builders
already calculated Total Revenue, Profit, ROAS, ROI, and CPA without Pipeline
Proxy. The contract violation was two explicit report-only presentation
branches that appended positive Pipeline Proxy as a separate Revenue card in
the browser PDF and scheduled PDF.

The browser report branch no longer reads `pipelineProxyData`. The scheduled
report payload no longer carries `pipelineTotalToDate` or
`pipelineValueRevenueTotals`, and its PDF renderer no longer creates a Pipeline
Proxy card. The operational GA4 Overview Pipeline Proxy card, source modal,
provider endpoint, persisted proxy metadata, and confirmed-revenue formulas are
unchanged.

Scheduled/test emails attach the scheduled PDF builder output. Manual and
scheduled snapshot JSON contains report identity/window metadata rather than
financial values, and snapshot PDF downloads rebuild through that same
scheduled PDF path. The local trace therefore closes the known runtime branches
for browser PDF, scheduled/test email attachment, and snapshot PDF generation;
it does not prove deployed bytes, inbox receipt, or a production snapshot.

### Current Commit H8 — mapping and downstream variant matrix

Status: implemented locally on 2026-07-12; focused validation passed; deployment
evidence pending.

- test distinct and identical add semantics explicitly
- cover mapping edit/remap/delete, unmatched values, multiple values, multiple
  active sources, Campaign Breakdown, and Ad Comparison
- prove KPI/Benchmark and notification add/edit/delete/refresh propagation

H8 makes the campaign-allocation boundary deterministic across Overview,
browser PDF, Ad Comparison, and scheduled PDF. The confirmed root cause was
duplicated downstream allocation code using two different campaign-key
normalizers, while Overview Campaign Breakdown and scheduled PDF lacked the
ambiguity guard already present in Ad Comparison/browser PDF. Punctuation or
spacing variants could therefore match differently by surface, and two rows
with the same normalized key could receive revenue on an arbitrary row.

All four consumers now use one shared allocation-key normalizer. Overview and
scheduled PDF now count normalized rows and allocate imported revenue only when
exactly one row owns the key. Multiple CRM values and multiple active sources
still add to that unique row; blank, zero, unmatched, and ambiguous normalized
rows remain unallocated rather than guessed.

The H8 matrix also records the existing source lifecycle contract without
changing it: add without `sourceId` reuses an identical saved signature and a
distinct signature creates an additive source; edit and scheduler refresh carry
the exact source ID; mapping config is replaced from the current selected
values/mappings; transactional delete removes only the selected source; and
save/delete call the same GA4 recompute path that refreshes financial current
values and schedules KPI/Benchmark plus alert evaluation.

### Current Commit H9 — damaged-data inventory expansion

Status: read-only implementation completed locally on 2026-07-12; focused
validation passed; deployed production inventory pending.

- add read-only invariants for config totals, campaign totals, record sums,
  dates, duplicate grains, partial replacements, connection/source mismatch, and
  source/type/context mismatch
- run a fresh authorized production inventory and record exact candidates
- keep cleanup in a later separately approved commit

H9 adds a pure GA4 HubSpot Revenue integrity inspector to the existing
campaign-access-guarded source-damage endpoint. The prior HubSpot inventory
could pass after checking source counts/orphans/duplicate signatures/context,
without reconciling source mapping totals to records or validating the retained
record grains. A partial replacement or contradictory source could therefore
remain invisible to `hubspotInventoryPass`.

The expanded inventory now reports exact candidates for configured
`lastTotalRevenue` versus effective materialized record totals,
`campaignValueRevenueTotals` versus configured totals, impossible/noncanonical
dates, duplicate `source + date + subCampaignUrn` grains, cross-campaign record
ownership, source/record type mismatches, source/record currency mismatches,
partial-replacement signatures, and connection/source mapping mismatch. It
also lowers the HubSpot inventory result for a missing active account or missing
active-source mapping provenance, and retains the existing zero-record, orphan,
duplicate-source, context, and proxy scope checks.

The endpoint and runner expose the complete sanitized finding object plus a
cleanup assessment with `automaticCleanupAllowed: false`. No cleanup, delete,
update, insert, provider call, refresh, or recompute path is added. A fresh
authorized deployed inventory is still required before describing current
production data as clean or proposing any cleanup boundary.

### Current Commit H10 — deployed clean-certification evidence

After H1-H9 pass locally, capture exact deployed packets for:

- OAuth connect/token refresh and campaign authorization rejection
- add/edit/delete/disconnect and forced provider/write failures
- every supported date and representative mapping/pipeline variants
- scheduler normal firing, same-source reprocess, timeout/retry, and last-good
  retention
- positive proxy transition and report exclusion
- Overview, Campaign Breakdown, Ad Comparison, Campaign DeepDive,
  KPI/Benchmark, Reports/PDF/snapshot/email, and notifications
- two-campaign concurrent isolation
- read-only production damage inventory and any separately authorized cleanup

Only after this matrix has no broken, partial, or unproven in-scope value path
may HubSpot Revenue be considered for strict clean certification.

## Validation performed for this audit

This first audit is a documentation and root-cause baseline. It included:

- required architecture, production-readiness, GA4 Overview, financial-source,
  refresh/workflow, timezone, automated validation, runner, and HubSpot-related
  documentation review
- current route, storage, schema, wizard, source-modal, Overview, downstream
  KPI/Benchmark, outcome, report scheduler/PDF, notification, and inventory trace
- reconciliation of historical HubSpot packets 4.5 through 4.16
- worktree preservation review

No runtime fix, provider call, production write, destructive cleanup, snapshot,
or email send was performed. A fresh production database scan was not possible
from the local repository and is not implied.

Focused validation result on the audited worktree:

- `git diff --check -- GA4/OVERVIEW_REVENUE_HUBSPOT_PRODUCTION_READINESS.md`:
  passed
- `server/outcome-totals-ga4-fallback-regression.test.ts`: 8/8 passed
- `server/report-email-regression.test.ts`: 20/20 passed
- `server/hubspot-revenue-ga4-overview-regression.test.ts`: 14/25 passed,
  11 failed
- combined result: 42/53 assertions passed; the focused baseline is not green

The HubSpot suite failures are current evidence gaps and were not edited away in
this audit. Nine failed cases assert runner version `2026-07-05.2`, while the
audited runner declares `2026-07-12.1`; those static guards are stale relative to
the current runner and still require deliberate reconciliation. The stable-ID
case includes an LF-sensitive multiline source assertion against CRLF source in
this Windows worktree. The remaining Pipeline Proxy source-text guard also
failed and has not been promoted to passing evidence. These failures do not
negate the separately traced code findings, but they prevent any claim that the
current HubSpot regression suite passes.

### H1 local implementation validation

Root cause fixed:

- the GA4 route previously committed connection metadata, source metadata,
  record deletion, and replacement inserts separately
- the GA4 route now computes the provider-derived mapping and records first,
  then calls one GA4-HubSpot-specific storage transaction
- the transaction scopes an existing source by campaign, active state, HubSpot
  type, and GA4 context; scopes the connection by campaign and active state; and
  scopes record deletion by campaign and source
- non-GA4 HubSpot persistence retains its previous route and storage behavior

Files changed for H1:

- `server/routes-oauth.ts`
- `server/storage.ts`
- `server/hubspot-revenue-transaction.test.ts`
- `server/hubspot-revenue-ga4-overview-regression.test.ts`
- this canonical readiness document

Local evidence:

- six transaction tests cover successful commit plus forced source update,
  record delete, record insert, connection update, and new-source insert failure
- every forced failure retains the prior connection mapping, source metadata,
  and records; failed new-source insertion leaves no new source
- `npm run check` passed
- the adjacent scheduler, CSV transaction, source-delete transaction, outcome
  totals, and report-email suites passed
- the H1 route guard now passes; the unrelated stale runner-version and Pipeline
  Proxy assertions remain outside H1 and remain unresolved

Not proven by local H1:

- deployed PostgreSQL failure injection or production data state
- HubSpot provider, pagination, date, scheduler wall-clock, concurrency, or
  downstream clean-certification paths
- any H2-H10 item

### H2 local implementation validation

Root cause fixed:

- numeric confirmed revenue was accumulated before the mapped date was proven
  materializable
- shape-only date parsing accepted impossible calendar keys
- no pre-mutation invariant reconciled confirmed, daily, and campaign-value
  totals

Local H2 behavior:

- all GA4 HubSpot numeric confirmed deals use a strict UTC date-key parser
- missing and impossible dates return `422` before connection, source, or record
  mutation
- confirmed revenue, daily materialization, and campaign-value materialization
  are rounded consistently and must match before persistence
- non-GA4 HubSpot contexts retain the previous date parser and persistence path

Files changed for H2:

- `server/routes-oauth.ts`
- `server/utils/data-transformation.ts`
- `server/hubspot-revenue-date-integrity.test.ts`
- `server/latest-day-revenue-regression.test.ts`
- this canonical readiness document

Local evidence:

- strict valid dates, leap days, invalid dates, epoch seconds/milliseconds,
  offset day rollover, and DST-boundary-like offsets are covered
- route guards prove both error branches precede the H1 transaction and the
  non-GA4 connection update
- `npm run check` passed
- H2, H1 rollback, scheduler, source-delete, outcome-total, and report-email
  suites passed: 53/53 tests

Not proven by local H2:

- current production HubSpot data quality
- every future provider timestamp representation
- provider pagination completeness
- deployed scheduler and UI error presentation
- any H3-H10 item

### H3 local implementation validation

Root cause fixed:

- four HubSpot publishing loops stopped at 25 pages without distinguishing a
  complete last page from a response that still advertised another page
- two Pipeline Proxy branches could silently swallow the incomplete result
- repeated provider cursors were not detected

Local H3 behavior:

- GA4 confirmed revenue, Pipeline Proxy preview, Pipeline Proxy save, and
  on-demand Pipeline Proxy recompute share one bounded cursor contract
- a last page without a continuation is accepted at the exact limit
- a continuation after the last safe page or a repeated cursor throws the typed
  `HUBSPOT_PAGINATION_INCOMPLETE` error
- save/preview returns `413`, and on-demand proxy recompute returns `413`, before
  any affected financial/proxy metadata write
- H1 therefore retains the last complete persisted source and records
- non-GA4 HubSpot contexts retain their prior pagination behavior

Files changed for H3:

- `server/routes-oauth.ts`
- `server/utils/hubspot-pagination.ts`
- `server/hubspot-pagination.test.ts`
- this canonical readiness document

Local evidence:

- exactly-at-limit completion, next-page overflow, and repeated-cursor cases are
  covered by focused unit tests
- route guards cover all four publishing loops and prove their guards precede
  the relevant source/connection mutation
- `npm run check` passed
- H3, H2, H1 rollback, latest-day, scheduler, source-delete, outcome-total, and
  report-email suites passed: 77/77 tests

Not proven by local H3:

- a live HubSpot account with more than 2,500 matching deals
- future provider cursor formats
- non-pagination provider retry/fallback behavior
- deployed scheduler/UI error presentation
- any H4-H10 item

### H4 local implementation validation

Root cause fixed:

- the shared revenue modal issued one committed delete per matching source and
  only then issued an independent HubSpot connection delete
- any request failure could therefore leave a subset of sources removed, retain
  or remove the connection inconsistently, and report only a generic failure
- the connection is shared at campaign scope, so unconditional GA4 connection
  removal could also break an active non-GA4 HubSpot source

Local H4 behavior:

- only the GA4 HubSpot modal path uses the new atomic endpoint
- campaign access is checked before the transaction
- source selection/deactivation is restricted to active `hubspot` rows in the
  exact campaign and GA4/null platform context
- record deletion is restricted by both campaign and selected source IDs
- connection deactivation is restricted to the exact active campaign connection
- active non-GA4 HubSpot use and missing-connection damage states fail before
  mutation
- derived-value recomputation runs after a successful disconnect; its failure is
  logged without misreporting the already-committed disconnect as rolled back

Files changed for H4:

- `client/src/components/AddRevenueWizardModal.tsx`
- `server/routes-oauth.ts`
- `server/storage.ts`
- `server/hubspot-ga4-disconnect-transaction.test.ts`
- this canonical readiness document

Local evidence:

- eight focused tests cover success, source failure, record failure, connection
  failure, shared-connection conflict, missing connection, OAuth-only
  disconnect, route ownership, and GA4 UI routing
- forced failures retain every source, record, and connection
- success isolates another provider in the same campaign and HubSpot data in
  another campaign
- `npm run check` passed
- H1-H4, source-delete, scheduler, outcome-total, and report-email suites passed:
  57/57 tests
- the broader HubSpot Overview regression file has 10 unrelated pre-existing
  dirty-tree failures, including stale runner-version expectations
  (`2026-07-05.2` expected versus `2026-07-12.1` present); H4 did not
  modify those runner or mapped-label paths

Not proven by local H4:

- deployed PostgreSQL failure injection, transaction isolation under concurrent
  save/disconnect requests, or production damaged-data state
- deployed UI handling of the `409` shared-connection conflict
- successful post-disconnect derived-value recomputation in production
- any H5-H10 item

### H5 local implementation validation

Root cause fixed:

- the GA4 revenue-source route used `recordTotal || cfgTotal`, so a missing
  HubSpot breakdown and a legitimate materialized zero could both publish stale
  configuration revenue
- when the outcome breakdown produced no positive source rows, the outcome route
  read HubSpot connection `lastTotalRevenue` and added it to offsite and total
  revenue
- the GA4 source modal and HubSpot edit prefill then treated those fallback
  values as current confirmed revenue

Local H5 behavior:

- the GA4 revenue-source response distinguishes record presence from record
  value and publishes an additive `available`/`unavailable` status for
  HubSpot only
- record-backed zero remains available and displays as `$0.00`
- missing HubSpot records display `Unavailable` in the existing stable source
  row while mapping/provenance and edit/remove actions remain present
- HubSpot edit review receives no stored current revenue for an unavailable GA4
  source; live preview or a successful save can establish a current value
- outcome fallback retains HubSpot connection provenance but cannot add its
  cached configuration total to financial revenue
- Salesforce, Shopify, other providers, and non-GA4 HubSpot contexts are
  unchanged

Files changed for H5:

- `server/routes-oauth.ts`
- `client/src/pages/ga4-metrics.tsx`
- `client/src/components/AddRevenueWizardModal.tsx`
- `server/hubspot-stale-revenue-authority.test.ts`
- `server/latest-day-revenue-regression.test.ts`
- this canonical readiness document

Local evidence:

- four focused guards cover source response authority, outcome exclusion, stable
  unavailable display/provenance, and edit prefill
- H1-H5, source-delete, outcome-total, latest-day, and report-email suites
  passed: 76/76 tests
- `npm run check` passed

Not proven by local H5:

- current deployed damaged-data inventory or the count of unavailable HubSpot
  sources
- deployed source-modal and outcome responses
- production scheduler repair of an unavailable source
- downstream Campaign DeepDive, KPI/Benchmark, Campaign Breakdown, Ad
  Comparison, and report parity reserved for H6-H8
- any H6-H10 item

### H6 local implementation validation

Root cause fixed:

- Overview selected the greatest-revenue GA4 candidate while outcome totals
  unconditionally replaced their existing GA4 result with to-date totals
- campaign current values used persisted daily GA4 rows only, narrowed imported
  financial sources to campaign start, and resolved an explicitly selected
  `ga4` revenue input as zero
- Campaign DeepDive financial formulas could combine selected lifetime revenue
  with date-range/fallback spend or conversions from a different GA4 candidate

Local H6 behavior:

- one pure selector now preserves complete candidate objects and deterministic
  to-date/daily/breakdown tie ordering
- Overview, outcome totals, and campaign financial current values use that
  selector
- campaign provider reads occur only when a Revenue, Profit, ROAS, ROI, or CPA
  calculation requires the full financial candidate; financial/base cache
  entries are isolated
- `ga4` revenue means selected native GA4 revenue, while `total_revenue`
  remains selected native plus active materialized imported revenue
- CPA uses conversions attached to the selected financial candidate without
  changing the base conversions value used by nonfinancial campaign metrics
- outcome totals expose one additive `financials` object for Total Revenue,
  spend, conversions, Profit, ROAS, ROI, and CPA; existing date-range response
  fields remain backward compatible
- Campaign DeepDive and campaign KPI/Benchmark live values prefer that financial
  object and retain the previous reads as compatibility fallback
- Pipeline Proxy remains excluded

Files changed for H6:

- `shared/ga4-financial-source.ts`
- `client/src/pages/ga4-metrics.tsx`
- `client/src/pages/campaign-detail.tsx`
- `server/routes-oauth.ts`
- `server/utils/campaign-current-values.ts`
- `server/ga4-financial-source-parity.test.ts`
- `server/campaign-current-financial-formulas.test.ts`
- related GA4 UI, outcome, and HubSpot parity regression guards
- this canonical readiness document

Local evidence:

- pure tests prove greatest-revenue selection, whole-candidate conversion
  retention, and deterministic tie handling
- formula tests prove native GA4 plus exact materialized HubSpot revenue without
  duplication and aligned Revenue, Profit, ROAS, ROI, and CPA outputs
- H1-H6, GA4 UI, outcome, Campaign DeepDive KPI/Benchmark, performance-summary,
  source-delete, latest-day, and report-email suites passed: 149/149 tests
- the exact HubSpot Overview/KPI parity guard passed separately
- `npm run check` passed
- two broader pre-existing guards retain unrelated stale assertions: the
  campaign scheduler guard expects an obsolete no-argument job call, and the
  campaign financial-analysis guard expects platform fallback spend to omit the
  already-present Custom Integration value

Not proven by local H6:

- live provider disagreement across all three candidates in production
- deployed Campaign DeepDive, campaign KPI/Benchmark refresh, alert, and email
  values
- current production damaged-data state
- report Pipeline Proxy behavior reserved for H7
- any H7-H10 item

### H7 local implementation validation

Root cause fixed:

- browser PDF generation explicitly appended a positive Pipeline Proxy card to
  its Revenue section
- scheduled PDF generation built proxy entries from active CRM mapping config
  and explicitly appended their positive total as a Pipeline Proxy card
- scheduled/test email attachments and snapshot PDF downloads reuse the
  scheduled PDF builder, so that presentation branch propagated to those
  artifacts even though confirmed financial formulas remained correct

Files changed for H7:

- `client/src/pages/ga4-metrics.tsx`
- `server/ga4-scheduled-report-pdf.ts`
- `server/hubspot-revenue-ga4-overview-regression.test.ts`
- `server/report-email-regression.test.ts`
- this canonical readiness document

Local evidence:

- the focused H7 guard proves the browser report and scheduled report payload/
  renderer do not consume or render Pipeline Proxy while the operational
  Overview card still consumes and renders it: 1/1 passed
- the adjacent scheduled report formula and scheduled/test attachment path
  guards passed: 2/2
- the report email regression suite passed: 20/20
- the complete HubSpot guard still has 10 unrelated pre-existing failures from
  stale runner-version and mapped-label expectations; H7 does not edit those
  unrelated baselines

Not proven by local H7:

- deployed browser, scheduled, test-email, or snapshot PDF bytes with a
  deliberately positive production proxy
- provider acceptance, delivery events, or inbox receipt for an H7 artifact
- historical PDFs already generated before H7
- mapping/downstream variants, damaged-data expansion, or deployed
  clean-certification evidence reserved for H8-H10

### H8 local implementation validation

Root cause fixed:

- Overview/browser report/scheduled report campaign allocation normalized
  punctuation away, while Ad Comparison normalized whitespace only
- Overview Campaign Breakdown and scheduled PDF stored one row name per
  normalized key without counting collisions, so duplicate-normalized rows
  could receive imported revenue on whichever row was stored last
- this could make the same HubSpot mapping display differently by downstream
  surface even though Total Revenue remained unchanged

Local H8 behavior:

- one shared campaign-allocation normalizer is used by Overview, browser PDF,
  Ad Comparison, and scheduled PDF
- Overview and scheduled PDF now match the existing fail-closed ambiguity
  contract: imported revenue is allocated only when exactly one normalized row
  owns the key
- multiple positive campaign-value totals and multiple active sources still
  accumulate on a unique row; zero, blank, unmatched, and ambiguous values are
  not guessed
- source add/edit/scheduler identity, mapping replacement, transactional delete,
  KPI/Benchmark recompute, and alert-evaluation call paths are regression-traced
  without changing those runtime paths

Files changed for H8:

- `shared/ga4-financial-source.ts`
- `client/src/pages/ga4-metrics.tsx`
- `client/src/pages/ga4-ad-comparison.tsx`
- `server/ga4-scheduled-report-pdf.ts`
- `server/hubspot-mapping-downstream-matrix.test.ts`
- this canonical readiness document

Local evidence:

- H8 mapping/downstream matrix: 4/4 passed
- GA4 UI, Ad Comparison card, and report-email regressions: 59/59 passed
- H1-H4 transaction/date/pagination/disconnect plus financial-source parity:
  27/27 passed
- `npm run check` passed

Not proven by local H8:

- live HubSpot add/edit/remap/delete/refresh outcomes for every matrix variant
- deployed rendered Campaign Breakdown, Ad Comparison, KPI/Benchmark, alert,
  notification, report, PDF, or email parity for those variants
- simultaneous provider mutations or complete multi-campaign concurrency
- current damaged production data, H9 inventory expansion, or H10 deployed
  clean-certification evidence

### H9 local implementation validation

Root cause fixed:

- the existing HubSpot inventory could return a clean result without comparing
  saved source totals, campaign-value totals, and effective materialized rows
- retained record dates, duplicate daily/subcampaign grains, record source
  type/currency, cross-campaign ownership, and partial-replacement signatures
  were absent from the HubSpot-specific pass/fail boundary
- connection/source mapping mismatches were provenance findings but did not
  lower `hubspotInventoryPass`

Local H9 behavior:

- a pure inspector scopes strict checks to GA4/null-context HubSpot sources and
  uses the same aggregate-versus-attributed total rule as the revenue reads
- every finding returns bounded source IDs, record IDs, counts, totals, dates,
  grains, currencies, types, and issue codes as applicable
- connection/source mapping mismatch now participates in the HubSpot inventory
  pass/fail result
- non-GA4 HubSpot sources are excluded from GA4 daily-materialization checks
- the endpoint remains GET-only/read-only and explicitly forbids automatic
  cleanup
- runner `2026-07-12.2` exposes the complete sanitized finding object and
  cleanup assessment

Files changed for H9:

- `server/utils/hubspot-revenue-damage-inventory.ts`
- `server/routes-oauth.ts`
- `client/public/ga4-overview-validation-runner.js`
- `server/hubspot-revenue-damaged-data-inventory.test.ts`
- this canonical readiness document

Local evidence:

- clean reconciliation, contradictory totals, impossible date, duplicate
  grain, cross-campaign, type/currency mismatch, partial-replacement,
  non-GA4 exclusion, endpoint read-only, and no-cleanup guards: 4/4 passed
- combined HubSpot H8, H9, and adjacent CSV inventory suites: 12/12 passed
- broader H1-H9 transaction/date/pagination/disconnect, financial-source, GA4
  UI, Ad Comparison, report-email, and inventory regression set: 98/98 passed
- validation runner syntax passed
- `npm run check` passed

Not proven by local H9:

- current production candidate counts or IDs; no deployed inventory was run
- whether any reported candidate is safe to repair or delete
- historical damage outside the authorized campaign passed to the endpoint
- provider lifecycle behavior, deployed H8 variants, or H10 certification

## Certification gate

At committed H7 baseline `56f57c773f185dbd2efc322de9d5315d560a6004`
plus the local H8 and H9 working-tree changes, GA4 Overview HubSpot Revenue is
**not clean-certified**. H1-H9 have local evidence within their documented
bounds, but deployed inventory and lifecycle evidence remain pending. Current
Commit H10 is the next certification phase; it must not certify HubSpot until
the complete deployed matrix is closed.
