# V1-075 security acceptance and historical spend disposition

V1-075 is **CLOSED for its original unauthorized connector-spend mutation,
currency overwrite and undated materialization defects**. This completes the
historical inventory/reader boundary that remained after the deployed API packet.
It does not certify every financial formula, deferred platform, cached historical
report or downstream analytics section. Those broader release gates remain open.

## Evidence carried forward

The [final API packet](FINAL_API_ACCEPTANCE_2026-10-31.md) proves both live aliases
accept the owner's dated EUR 0.02 fixture, preserve campaign currency, replace one
exact source, and return the scoped source and total. Anonymous/foreign denials,
invalid dates/amounts/currency, missing parents, foreign source IDs and atomic
rollback have current handler/PostgreSQL coverage. Independent production reads
confirmed the saved state and the exact nine-row cleanup. The
[runtime follow-up](CONNECTOR_CONTEXT_FOLLOWUP_2026-10-31.md) records the deployed
context correction, 6,935 passing tests and successful hosted workflow.

## Historical boundary

The new [READ ONLY production inventory](validation-2026-10-31-remaining/inventory-2026-10-31T13-59-59-620Z.json)
uses the pinned production database, verified TLS and a repeatable-read read-only
transaction. It finds **zero `connector_derived` sources or records** after exact
fixture cleanup. No surviving record is identifiable as a damaged connector
source. No campaign amount or currency was guessed, rewritten or reassigned.

The same inventory identifies 3,267,568 `linkedin_api` and 375,096 `meta_api`
records with no matching spend source. All 3,642,664 have zero eligible joined
parents; 2,101,503 LinkedIn and 281,604 Meta rows also lack their campaign.
These are the previously identified scheduler pseudo-source records, not evidence
that the connector aliases created them. Their disposition is **retained,
unassigned and excluded from current source-backed calculations**. There are no
records with an existing source attached to the wrong campaign in this inventory.

Absence of a connector source does not prove an old unauthorized campaign-field
overwrite never occurred. Historical values cannot be reconstructed from this
inventory; no destructive or speculative repair is authorized by this closure.

## Complete current normalized-record reader inventory

| Reader/path | Exclusion and propagation boundary |
| --- | --- |
| `storage.getSpendTotalForRange` | Inner join to an active source; both source and record campaign match; selected platform and date bounds; currency check. Returns exact source IDs alongside the total. |
| `storage.getSpendBreakdownBySource` | Same parent/activity/platform/date boundary; groups only included source IDs. Source details cannot invent an orphan source. |
| Spend totals/to-date/breakdown/daily, GA4 financial/KPI/Insights and executive reads | Existing callers consume those storage totals/breakdowns. This proves the orphan boundary, not each consumer's complete formula/fallback correctness. |
| `recalcCampaignSpend` | Sums the guarded breakdown plus mapping amounts on active existing sources without records. An orphan record has neither a breakdown entry nor a source mapping. |
| `daily-financials` route, direct SQL | Inner join to active sources before daily grouping. Retained orphan records cannot enter the subsequent date merge or derived values. The route's other legacy formula/currency behavior is not recertified. |
| Trends route, direct SQL | Reads only source IDs supplied by the guarded total, applies date/campaign bounds and reconciles the sum. |
| Scheduler aggregate/Trend snapshot, direct SQL | Inner join to active GA4-context sources before grouping. Subsequent saved snapshots cannot acquire these orphan records from this reader. Existing historical snapshots are not rewritten or certified. |
| Overview source inventory and retained-source publication | Builds entries by iterating existing eligible sources, then matches their record IDs. Its broad campaign-record fetch cannot create an entry for a missing source. |
| Sheets cleanup-state reader | Starts from exact campaign/Sheets sources, then reads their IDs to detect corruption. It is an operator validation input, not an analytics total. |
| `countSpendRecordsBySource` | Counts records only for a supplied source ID; no monetary aggregation. Other direct record references are schema declarations or scoped write/delete operations. |

The [executable reader checks](validation-2026-10-31-remaining/spend-readers.cjs)
extract the **current** storage method bodies and all three direct analytics SQL
expressions, then execute them with real PostgreSQL in a newly created isolated
schema on loopback. Twelve assertions pass: orphan/inactive/foreign/out-of-window
fixtures stay excluded, while a valid EUR 0.02 source is preserved in total,
provenance, breakdown and each SQL reader. The script asserts there are exactly
three direct SQL expressions; a new reader requires review. It removes only its
own schema. [Result and source hashes](validation-2026-10-31-remaining/spend-readers.json).
The initial local connection used a nonexistent role and stopped before schema
creation; [that failure is retained](validation-2026-10-31-remaining/spend-readers-role-failure.json).

No runtime code, live records, source configuration or refresh cadence changed
in this close-out. Whole-app readiness and Batch 1's five other open findings
remain unproven; the original security finding is not a whole-analytics certificate.
