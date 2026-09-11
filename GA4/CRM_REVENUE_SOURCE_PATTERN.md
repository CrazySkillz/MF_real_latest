# GA4 CRM Revenue Source Pattern

## Status And Purpose

This document is the implementation handoff for GA4 child revenue sources backed by a CRM. It describes the code behavior introduced through Salesforce code commit `5987024a` and the HubSpot automation work committed in `f4a3e8d7`.

It is a behavior and parity reference, not a production-readiness certificate. Salesforce is the current reference implementation. HubSpot is only partially aligned and remains **UNVERIFIED for the current implementation** until the gaps and validation gates below are closed. Historical source-family certificates remain bounded to their recorded runtime, source IDs, campaign, and configuration.

Read this with:

1. `GA4/FINANCIAL_SOURCES.md`
2. `GA4/OVERVIEW.md`
3. `GA4/REFRESH_AND_PROCESSING.md`
4. `GA4-MANUAL-TEST-PLAN.md`
5. `GA4/OVERVIEW_REVENUE_HUBSPOT_PRODUCTION_READINESS.md` when changing HubSpot

## Product Meaning

- Salesforce and HubSpot are GA4 campaign-level financial child sources. They are not main entries in the campaign `Connected Platforms` section.
- The Salesforce flow reads Opportunity records. It does not read Salesforce Campaign objects.
- The HubSpot flow reads Deal records.
- The selected CRM attribution field supplies the values used to associate CRM records with the MimoSaaS campaign. When the selected field is Opportunity Name or Deal Name, each selected value normally identifies one opportunity or deal; another field can group multiple records under one selected value.
- `campaignMappings` map each selected CRM value to a selected GA4 campaign value. They do not change the CRM record's stage or amount.
- Confirmed revenue and Pipeline Proxy are different measures. Confirmed Closed Won records feed Total Revenue. Records in the chosen open stage feed Pipeline Proxy only.
- Pipeline Proxy never feeds Total Revenue, Profit, ROI, ROAS, CPA, revenue-dependent KPIs or Benchmarks, Ad Comparison, Insights, Reports, or Campaign DeepDive confirmed financial totals.

## Canonical Wizard Flow

The reference flow is:

`Source -> Campaign field -> Pipeline (only when enabled) -> Crosswalk -> Revenue -> Review Settings`

The Source step offers:

- `Total Revenue + Pipeline (Proxy)`
- `Total Revenue only (no Pipeline card)`

`Total Revenue + Pipeline (Proxy)` requires an active, open CRM stage. Closed, inactive, or missing stages must fail validation and must not be selectable as proxy stages. The selected stage filters the already selected CRM attribution values; it is not a second campaign-selection mechanism.

`Total Revenue only (no Pipeline card)` disables only Pipeline Proxy computation and configuration. It must not disable confirmed-revenue refresh. The persistent Overview Pipeline Proxy card then shows `Not configured` unless another eligible CRM provider configures it.

Crosswalk behavior:

- at least two search characters are required before a provider search
- search is prefix-based and results narrow as additional characters are typed
- saved selections remain visible in edit mode, but unrelated saved rows must not be presented as search matches
- Pipeline mode may show confirmed/Closed Won values plus values backed by the selected open stage
- revenue-only mode shows only values backed by confirmed/Closed Won records

Review Settings must show:

- confirmed `Total Revenue (to date)` separately from Pipeline Proxy
- selected CRM values and their confirmed amounts
- a two-column CRM-to-GA4 mapping, with the selected opportunity/deal on the left, a directional arrow, and its GA4 campaign on the right
- `Not mapped` when a selected value has no GA4 campaign mapping

## Add, Edit, And Delete Contract

Initial setup starts from `Total Revenue -> + -> Add revenue source`.

Salesforce currently enforces one active GA4 Salesforce source per campaign/platform context in this UI:

- before a Salesforce source exists, the Salesforce card starts setup
- after an active Salesforce source exists, the card is non-actionable and says `Already added. Edit opportunities from Revenue Sources.`
- the source inventory must finish resolving before first-time setup is allowed, so a failed or pending lookup cannot accidentally enter additive mode

Editing starts from the provider-level pencil beside `Salesforce (Opportunities)` in `Total Revenue -> Sources`. It opens the first Source step with all saved settings and selections. The save request must retain the exact stable revenue `sourceId`; it replaces that source rather than adding another source.

The Revenue Sources modal keeps the provider as the top-level source and itemizes confirmed CRM values from `campaignValueRevenueTotals`. For Salesforce:

- the provider subtotal is the sum of the itemized confirmed values
- the provider-level pencil edits the shared source configuration
- each item row has its own exact remove control
- removing one value keeps the same source ID and all other selections, then atomically rematerializes confirmed revenue and Pipeline Proxy
- name, amount, and action columns remain aligned with Shopify and other itemized CRM entries

HubSpot uses the same exact-item removal pattern: the provider pencil edits the shared source configuration, each item row removes only that saved HubSpot value, and removing the final value deletes that exact source. The compact provider subtitle is `HubSpot`; saved GA4 campaign mapping names are not repeated in the source list, and itemized rows do not add a redundant confirmed-deal count heading.

Deleting or deactivating the last eligible CRM source removes that provider's contribution and configuration. The Overview Pipeline Proxy card itself remains visible and shows `Not configured` when no other eligible CRM source exists.

## Save And Refresh Contract

The persisted source mapping is the scheduler source of truth. It includes the selected values, revenue/date fields, campaign mappings, Pipeline Proxy enablement and stage, confirmed value totals, and proxy metadata where applicable.

CRM writes must:

- remain campaign-, owner-, and `platformContext=ga4` scoped
- update the existing stable source ID
- replace source metadata and materialized revenue records atomically
- pass the persisted mapping as `expectedSourceMappingConfig` during scheduler or exact-item mutation, so a concurrent user edit fails closed rather than being overwritten
- replace prior materialized rows instead of appending duplicates

Salesforce's five-minute path processes every active exact GA4 Salesforce source that has saved selected values. `pipelineEnabled` controls whether Pipeline Proxy is calculated; it does not control confirmed-revenue refresh eligibility. Therefore:

- Pipeline enabled: refresh confirmed Total Revenue and Pipeline Proxy
- Pipeline disabled: refresh confirmed Total Revenue only and retain Pipeline Proxy as unconfigured for that source

HubSpot's current five-minute path processes only sources with `pipelineEnabled=true`, a saved pipeline stage ID, and selected values. HubSpot revenue-only sources currently wait for the full daily external-source run. This is the main scheduler parity gap for the HubSpot follow-up.

The five-minute interval is controlled by `SALESFORCE_PIPELINE_REFRESH_INTERVAL_MINUTES`, default `5`, bounded to `1..60`. The full external-source scheduler remains a separate daily run controlled by `AUTO_REFRESH_DAILY_HOUR`, `AUTO_REFRESH_DAILY_MINUTE`, and `AUTO_REFRESH_TIME_ZONE`. These paths share overlap guards.

An open GA4 Overview checks saved HubSpot/Salesforce Pipeline timestamps every minute. When a provider refresh timestamp changes, it refetches Total Revenue, Revenue Sources, and Revenue Breakdown. The revenue queries also keep their normal focus/reconnect and periodic refresh behavior.

## Stage-Transition Invariant

For a selected CRM record whose amount and mapping do not change:

1. while it is in the selected open stage, its amount appears in Pipeline Proxy and not in confirmed Total Revenue
2. after the provider changes it to Closed Won, the next successful atomic provider refresh removes the amount from Pipeline Proxy
3. the same refresh adds that amount once to confirmed Total Revenue and itemized Revenue Sources provenance
4. repeated refreshes keep the source count and total stable; they must not duplicate the record

A zero proxy after the transition is a valid configured `$0.00`, not `Unavailable`. `Not configured` means no eligible Pipeline Proxy configuration exists.

## Salesforce Reference Versus HubSpot Current State

| Behavior | Salesforce reference | HubSpot current state |
| --- | --- | --- |
| Initial GA4 source setup | Visible chooser card | Visible chooser card |
| Chooser after an active source exists | Disabled; directs user to Revenue Sources pencil | Still permits the connected entry flow; parity decision/implementation remains |
| Edit entry | Provider-level pencil; starts at Source with stable source ID | Existing source edit is supported; re-trace before changing shared UI |
| Review mapping layout | Two aligned columns with directional arrows | Mapping is shown, but exact Salesforce layout parity is not established |
| Confirmed source breakdown | Itemized from `campaignValueRevenueTotals` | Itemized from `campaignValueRevenueTotals` |
| Remove one selected record/value | Exact Salesforce item removal | Exact HubSpot item removal is implemented locally through the same stable-source replacement contract; deployed validation remains pending |
| Five-minute refresh with Pipeline enabled | Yes | Implemented locally in `f4a3e8d7`; deployed natural-timer/provider transition proof remains pending |
| Five-minute refresh with Pipeline disabled | Yes | No; currently waits for the daily external-source run |
| Open-stage to Closed Won automation | User-validated for the exercised Salesforce source; local regression covered | Local regression covered; deployed provider-authoritative transition remains pending |
| Full daily external-source run | Code path exists; final current-cycle validation was intentionally deferred | Code path exists; must be validated after HubSpot parity work |
| Current production-readiness status | Scoped exercised behavior only; no whole-source or whole-Overview certification claim | Unverified for current implementation; historical exact-source evidence remains historical |

## HubSpot Parity Work Order

The next HubSpot session should continue on the current branch and preserve certified sections. It should:

1. trace the existing HubSpot wizard, save/materialization route, source modal, and `runHubSpotPipelineAutoRefreshOnce()` end to end before editing
2. preserve HubSpot source IDs, campaign/platform ownership checks, currency/date semantics, atomic replacement, and optimistic mapping concurrency
3. make HubSpot five-minute eligibility depend on an active exact GA4 mapping with selected values, as Salesforce does; require the pipeline stage only when `pipelineEnabled=true`
4. prove that revenue-only HubSpot sources refresh confirmed revenue without configuring Pipeline Proxy
5. prove that a selected deal moving from the chosen open stage to Closed Won atomically decreases Pipeline Proxy and increases confirmed Total Revenue/provenance exactly once
6. address chooser, review-layout, or exact-row-delete parity only when explicitly in scope; do not bundle those UX changes into the scheduler correction
7. run focused HubSpot and shared scheduler tests, TypeScript checks, and current deployed manual validation without broadening any historical certificate

Primary implementation files:

- `client/src/components/HubSpotRevenueWizard.tsx`
- `client/src/components/SalesforceRevenueWizard.tsx`
- `client/src/components/AddRevenueWizardModal.tsx`
- `client/src/pages/ga4-metrics.tsx`
- `server/routes-oauth.ts`
- `server/storage.ts`
- `server/auto-refresh-scheduler.ts`
- `shared/schema.ts`

Primary focused regressions include:

- `server/hubspot-pipeline-automation-ui.test.ts`
- `server/hubspot-revenue-transaction.test.ts`
- `server/hubspot-revenue-ga4-overview-regression.test.ts`
- `server/salesforce-pipeline-automation-ui.test.ts`
- `server/salesforce-pipeline-stage-safety.test.ts`
- `server/salesforce-revenue-item-transaction.test.ts`
- `server/ga4-auto-refresh-regression.test.ts`
- `server/ga4-daily-scheduler-regression.test.ts`
- `server/ga4-scheduler-observability-regression.test.ts`

## Copy-Ready Prompt For The HubSpot Session

> Continue on the current branch and preserve certified sections. Read `AGENTS.md`, `ARCHITECTURE_USER_JOURNEY.md`, `PRODUCTION_READINESS.md`, `GA4/README.md`, `GA4_DEVELOPMENT_WORKFLOW.md`, and `GA4/CRM_REVENUE_SOURCE_PATTERN.md` before editing. Reconcile HubSpot against the implemented Salesforce CRM revenue reference through `5987024a`, while retaining the HubSpot work in `f4a3e8d7`. Trace the HubSpot wizard, save/materialization route, stable source identity, source modal, five-minute scheduler, full daily scheduler, and Overview refetch path end to end. Make the smallest safe fix so every active exact GA4 HubSpot mapping with selected values refreshes confirmed revenue on the five-minute CRM loop even when Pipeline Proxy is disabled; require a pipeline stage only when Pipeline Proxy is enabled. Preserve campaign/platform ownership, currency/date semantics, atomic replacement, optimistic concurrency, and response contracts. Prove that a selected deal moving from the chosen open stage to Closed Won leaves Pipeline Proxy and enters Total Revenue plus itemized Revenue Sources provenance exactly once without a wizard resave or duplicate source. Do not bundle chooser, review-layout, or deal-row-delete UX parity unless explicitly requested. Run the focused HubSpot and shared scheduler regressions, `npm run check`, and give a separate deployed validation plan for the five-minute transition and the full daily scheduler. Do not call HubSpot or Overview production-ready unless the current required evidence is complete.

## Validation Boundary At This Handoff

Current Salesforce evidence includes focused local regressions and TypeScript validation, plus user-observed deployed add/edit/delete, itemized provenance, open-stage-to-Closed-Won movement, and five-minute revenue-only amount refresh. The exercised transition moved `$200` from Pipeline Proxy into confirmed revenue; a later revenue-only amount edit from `$50` to `$51` refreshed without a wizard resave.

Not proven by that evidence:

- the full daily external-source scheduler at the current CRM code boundary
- every Salesforce org, stage configuration, attribution field, mapping, currency, or date-field variant
- current HubSpot deployed five-minute natural timer behavior
- a current provider-authoritative HubSpot open-stage-to-Closed-Won transition
- HubSpot revenue-only five-minute refresh, which is not yet implemented
- whole GA4 Overview or whole CRM source production readiness
