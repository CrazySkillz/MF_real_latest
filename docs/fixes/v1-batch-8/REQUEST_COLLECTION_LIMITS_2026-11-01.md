# Request collection limits — early typed-validation boundary

Status: locally validated; deployment verification pending. This is a narrow
availability correction, not whole-app production certification.

## Confirmed cause and smallest correction

The installed Zod 3 array validator records a maximum-length failure and then
still validates every element. Four request collections already have explicit
maximums but therefore accumulate unnecessary per-item errors for rejected lists.
The connector-derived spend handler is an enabled authenticated entry point;
its two public aliases share the same function. A local, isolated 100,000-byte
invalid records specimen produced 66,667 issues before the correction. It fits
inside the existing JSON ingress limit. No live crash was attempted or observed.

`server/routes-oauth.ts` changes exactly four expressions to run the existing
maximum against an unknown-item array before piping into typed item validation:

| Collection | Existing maximum retained | Consumers |
| --- | ---: | --- |
| `zRevenueMapping.campaignValues` | 500 | Google Sheets and uploaded CSV revenue mapping |
| `zSelectedValues` | 200 | Salesforce, HubSpot and Shopify revenue processing, including refresh requests |
| `processConnectorDerivedSpend.records` | 5,000 | `/api/campaigns/:id/spend/process/connectors` and retained `/ad-platforms` alias |
| HubSpot `stageIds` | 100 | HubSpot revenue processing |

The lightweight outer array pass still copies bounded request items. Rejected
oversized lists no longer reach typed item parsing or generate one error per
item. This does not claim constant-time parsing of arbitrary inputs.

The same limits, minimums, trimming, optional/null handling, numeric/string spend,
row-field stripping and successful output shapes remain. Oversized invalid
lists retain rejection and the maximum-length error; their redundant item-error
details are intentionally omitted. No response field or financial formula changes.
No dependency upgrade, schema/storage edit, source cleanup, provider query,
scheduler cadence, date rule or UI change is included.

## Traced path and propagation

The existing routes perform campaign access checks before these schema reads.
Invalid collections return through their existing 400 response paths before
provider calls or source writes. Accepted data proceeds through the unchanged
source replacement/materialization and recomputation functions. The spend test
executes the current handler and proves exact dated amounts, campaign/source IDs,
total reconciliation and recompute calls. Existing source lifecycle regressions
cover adjacent transaction, ownership and publication behavior.

Source modals, totals, KPIs, benchmarks, reports, alerts and snapshots have no new
value path: accepted validated values and subsequent code are unchanged. Delete
and stored-data read paths do not use the changed expressions and are not being
recertified. Existing out-of-limit stored configurations were already rejected by
the same maximums; no data repair or automatic truncation is introduced.

## Validation

- Before correction: 19 controls passed and all four early-rejection cases failed
  in `collection-baseline.json`.
- New tests execute actual schema expressions and the actual spend handler from
  the route file; app startup, database and provider access are excluded/mocked.
- Final focused packet: **258/258 pass**, recorded in `collection-final.json`; includes new
  collection tests plus Batch 1 access, source safety, source lifecycle recompute,
  HubSpot transaction, Salesforce item transaction and Shopify transaction tests.
- `npm run check`, `npm run build`, and `git diff --check` pass.
- A new test initially expected an extra response field that this route has never
  returned. Only that test expectation was corrected; the API contract was retained.

Manual UI validation, repeat imports and test emails are unnecessary for this
server-side rejection boundary. Existing manual valid-source evidence remains
applicable. No malformed requests are sent to the live service. Hosted CI and
anonymous public release checks are the deployment gate.

## Scope limits and rollback

This addresses the four bounded request collections, not every use of Zod or a
general memory/load certification. Unconstrained arrays, server-created financial
snapshots and database-resident values are not assigned new limits. The remaining
dependency review and other minimal launch gates retain their separate status.

Rollback is the prior runtime `9848ef9c` with the existing environment and database;
there is no migration to reverse. That would restore the older rejection cost.
Prefer reverting only these four expressions if this correction causes a regression.

Upstream reference: [Zod's early collection-bound change](https://github.com/colinhacks/zod/pull/6652).
Its upstream correction targets v4; this project keeps its existing v3 contract
and uses its supported pipeline API at the four confirmed application boundaries.
