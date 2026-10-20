# Conservative pilot load: isolated component evidence

Candidate `777aae6f6353e998d60b635d3e66b413093117c2`; run at `2026-10-19T22:32:07.951Z`. The user delegated realistic test figures and requested avoiding performance impact. The provisional pilot envelope is **five simultaneous users,25 campaigns and10,000-row imports**. It is a test target, not a guaranteed supported capacity or an agreed production SLA. No traffic was sent to the deployment or a provider.

[Runner](pilot-load-local.cjs), [measured result](pilot-load-local.json). The runner refuses any database except the disposable `127.0.0.1:55442/notifications_test` and requires the application `DATABASE_URL` to be empty. It creates a random schema, uses the four current declared table definitions, and removes that schema in `finally`. The post-run namespace query returned0; PostgreSQL was stopped. No customer data, app server, background scheduler or email code ran.

## Workload and results

The fixture has five synthetic owners/clients,25 campaigns, four Spend sources per campaign,90 days and9,000 normalized daily Spend records. A10,000-row CSV coalesces to90 daily rows in the actual parser/aggregator; the raw row count is not misrepresented as10,000 normalized daily records. Five readers each perform20 batches with200ms think time while five CSV computations run. Every batch executes the exact current `DatabaseStorage.getClients`, `getCampaigns`, `getSpendSources`, `getSpendTotalForRange` and `getSpendBreakdownBySource` methods; their `getCampaign` dependency is also extracted unchanged. Drizzle and PostgreSQL execute real queries. Owner filtering in the harness is an assertion, not proof of API authorization.

| Measurement | Observed |
|---|---|
| Runtime | Node22.17.1 / PostgreSQL18.0 on the local workstation; pool max10 |
| Duration / query count |4.64seconds /700 queries across100 read batches |
| Correctness / errors |100 batches returned expected USD360 per campaign, four sources and exact owner fixture counts;0 errors |
| Read-batch latency |p50=16.90ms; p95=64.66ms; maximum171.09ms |
| First five batches |116.90–171.09ms; these are first queries in this run, not a deployed cold-start measurement |
| CSV parser + Spend aggregation |Five10,000-row runs;20.14–39.51ms; each preserves10,000 total and90 dated aggregates |
| Event-loop delay |p95=22.48ms; maximum55.28ms |
| Pool observation |10 connections; up to13 pending requests sampled at5ms intervals |
| Node process resources |CPU user1,422ms/system171ms; RSS154,988,544→160,571,392 bytes; these exclude PostgreSQL/browser resources |

Predeclared local thresholds were zero incorrect totals/errors, p95 read-batch latency below1,000ms and each parser/aggregation run below1,000ms. Those component thresholds passed. The observed queue is bounded evidence of contention during this short run, not a demonstrated capacity limit or a reason to change the production pool.

## Remaining release gate

**V1-016 remains externally blocked/partially reviewed.** This run does not execute HTTP middleware, Clerk, React navigation, Revenue/native GA4 reads, actual import persistence/publication/recomputation, provider work, PDF generation, report delivery or competing jobs. It is too short to establish sustained throughput, memory growth, saturation, restart recovery or timeout behavior. Workstation timings cannot be translated to Render capacity.

The subsequent [actual HTTP/database pilot](HTTP_DATABASE_PILOT.md) verified the current Revenue UI maximum is5,000rows;10,000rows is an oversize rejection case. The earlier10,000-row parser computation remains valid component evidence, not a supported Revenue upload claim. That actual pilot used five users/25campaigns and5,000-row previews, and reproduced shared-IP429 failures on all five saves (V1-126). No source was saved.

The remaining deployment-equivalent acceptance workload is five authenticated sessions navigating summaries, supported-size imports completing through saved publication, source preview/refresh and PDF/report generation alongside scheduled work. Record page/API latency, correctness, failures, pool wait, CPU/memory, late writes and429/retry behavior. Use fixture providers or independently budgeted actual quotas. Set hosted latency/resource limits from the verified hosting tier/replica configuration; headroom is not known. No production load test is authorized by the disposable local checks.
