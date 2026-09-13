# GA4 Overview Salesforce Revenue Production Readiness

## Mandatory status

**Current status: CLEAN-CERTIFIED for the one exact active GA4 Salesforce
Revenue source and exercised lifecycle/configuration boundary recorded below at
deployed runtime `d4f1ec0ea24caea3d7d565da0be773d219f68b32`.** This is not
whole-provider, whole-GA4-Overview, or global scheduler certification.

This is the canonical readiness document for the bounded Salesforce Revenue
source. Broader documents must not expand this claim beyond the exact source,
campaign, currency, fields, mappings, and exercised modes recorded here.

## Exact certified boundary

- campaign: `eee3e654-b736-4e8e-86ec-1050e4d905c0`
- active source: `72ca7970-c6fd-4a67-af12-339897b2cb9f`
- platform context: `ga4`
- campaign/source currency: `USD`
- Salesforce object: Opportunity
- campaign identifier field: `Name` (Opportunity Name)
- revenue field: `Amount`
- date field: `CloseDate`
- current saved mode: Total Revenue only (`pipelineEnabled=false`)
- current confirmed values:
  - `Acme Annual Subscription` -> `yesop_retargeti` -> `$100`
  - `Acme Expansion` -> `yesop_retargeti` -> `$51`
  - `SF Test A` -> `yesop_email_nurture` -> `$100`
- current Salesforce subtotal: `$251`

The earlier exercised Pipeline-enabled configuration used the open
`Prospecting` stage. Its provider transition moved a selected `$200`
Opportunity from Pipeline Proxy into confirmed Total Revenue exactly once and
left Pipeline Proxy at `$0.00`. The current persisted source is revenue-only;
the earlier Pipeline-enabled state is retained as bounded lifecycle evidence,
not represented as the current saved configuration.

## Current production evidence

Deployment and configuration:

- `/api/health` returned the exact deployed runtime above
- the temporary daily test schedule was restored successfully to `22:30 UTC`
- the scheduler is enabled, timer-backed, and uses a five-minute Salesforce CRM
  interval

Natural full external-source run:

- the scheduled run emitted `Salesforce reprocess complete` for the exact source
  ID above
- result: `totalRevenue=251`, `materializedRecordCount=6`,
  `dateField=CloseDate`, dates `2026-09-02`, `2026-09-05`, and `2026-09-10`
- `unmatchedSelectedValues=none`
- the six materialized rows are three aggregate daily rows plus three attributed
  campaign rows; they do not represent six Opportunities
- the global run reported unrelated provider/campaign failures, so no global
  scheduler-success claim is made

Rendered Revenue Sources evidence:

- exactly one active Salesforce provider block was visible
- provider subtotal was `$251`
- itemized values were `$100`, `$51`, and `$100`, reconciling exactly to `$251`
- no second active Salesforce source was visible

Read-only database integrity evidence:

- reusable command: `scripts/salesforce-revenue-certification-readonly.ts`
- transaction mode: `BEGIN TRANSACTION READ ONLY`, always rolled back
- exactly one active and zero inactive GA4 Salesforce sources for the exact
  campaign
- active source ID matched the scheduler log
- campaign, source, and all record currencies were USD
- 6 materialized records: 3 aggregate and 3 attributed
- aggregate, attributed, itemized, and saved totals each reconciled to `$251`
- zero duplicate date/campaign materialization grains
- zero orphan or cross-campaign Salesforce records
- no production data was created, changed, deactivated, repaired, or deleted by
  the inventory

## Lifecycle evidence

| Path | Status | Bounded evidence |
| --- | --- | --- |
| Add/import | Proven for exercised source | User completed Salesforce setup and imported selected Opportunities. |
| Edit/update | Proven for exercised source | Provider-level pencil retained the stable source and saved selection/configuration changes. |
| Exact item delete | Proven for exercised source | Removing one item preserved the source and remaining Opportunities. |
| Revenue Sources display | Proven at current runtime | One `$251` source reconciled to three exact items. |
| Five-minute Pipeline-enabled refresh | Proven for exercised configuration | Open-stage amount moved to confirmed revenue after Closed Won. |
| Five-minute revenue-only refresh | Proven for exercised configuration | `$50` changed to `$51` without a wizard resave. |
| Full daily external-source refresh | Proven for exact source | Exact stable source completed with `$251`, 6 rows, and no unmatched values. |
| Stable identity/idempotency | Proven locally and in current inventory | One active source; scheduler ID matched storage; no duplicate grains. |
| Currency/date materialization | Proven for exact configuration | USD parity and three valid CloseDate grains reconciled. |
| Ownership/isolation | Proven locally and in current inventory | Campaign/source guards passed; zero cross-campaign records. |
| Pipeline exclusion from confirmed revenue | Proven for exercised configuration and locally guarded | Proxy moved out as confirmed revenue moved in; no double count. |

## Exact-current local evidence

- focused Salesforce and shared financial packet: 16 files, **111/111 tests
  passed**
- Salesforce-specific source ownership and destructive-path guards: **3/3
  passed**
- `npm run check`: passed
- `npm run build`: passed
- two obsolete source-modal assertions were updated to the established shared
  `hasSingleSourceBreakdown` layout; application behavior was not changed

Covered local negative cases include currency mismatch/unavailability,
pagination and result limits, invalid/repeated/cross-host locators, closed or
inactive Pipeline stages, invalid amounts/dates, valid zero revenue,
transaction rollback, concurrent scheduler/edit conflicts, stable-source
replacement, token rotation, and campaign/source ownership.

## Exclusions and revalidation triggers

Not certified by this document:

- any other Salesforce org, campaign, source ID, currency, attribution field,
  revenue field, date field, stage, or mapping
- Salesforce Campaign objects; this integration reads Opportunities
- non-GA4 Salesforce revenue contexts
- the global full-scheduler result or its unrelated failed provider jobs
- whole GA4 Overview, Campaign DeepDive, KPI, Benchmark, Insights, Reports,
  notification, or email delivery readiness
- semantic deduplication against revenue already present in native GA4
  ecommerce data
- future provider availability, token revocation, permission changes, or future
  data mutations

Revalidation is required after a relevant Salesforce, shared CRM,
Revenue Sources, materialization, currency, scheduler, storage, schema, or
financial-total change. A new Salesforce configuration is not certified merely
because this exact source passed.

## Certification gate

**Decision: CLEAN-CERTIFIED for the exact source and exercised boundary stated
above at runtime `d4f1ec0e`.** Add/edit/delete, itemized provenance,
Pipeline-to-confirmed movement, revenue-only automatic refresh, stable-source
daily refresh, production storage integrity, currency, ownership, and subtotal
reconciliation are supported by the recorded evidence. No broader Salesforce,
GA4 Overview, or global scheduler claim is made.
