# Real HTTP/database pilot and import throttling

Candidate `777aae6f6353e998d60b635d3e66b413093117c2`. [Runner](http-database-pilot.test.ts), [configuration](http-database-pilot.vitest.config.ts), [four-test result](http-database-pilot-results.json), [measured observations](http-database-pilot-observations.json).

Actual current registerRoutes, Express JSON/multipart processing, rate-limit middleware, storage and PostgreSQL18 execute on loopback. Five synthetic Clerk identities, five clients,25 campaigns and45 dates of Revenue/Spend records per campaign. The fixture supplies identity verification; it does not bypass route authorization or mock storage. It does not boot index.ts, production jobs, frontend or providers. All fetches outside its ephemeral loopback server are rejected; none were attempted.

## Results and value boundary

| Check | Result |
|---|---|
| Owner/anonymous/foreign campaign |200/401/404; actual HTTP+DB. Foreign client filter404; owner's client list contains exactly its own client. |
| Bounded concurrent read/preview workload | Five users;200 GETs across eight families plus five5,000-row multipart previews.205 expected responses, no unexpected failures.1.20seconds; p95≈52.99ms; maximum≈205.96ms; event-loop p95≈26.92ms. |
| Read families | Clients, client-filtered campaigns, individual campaign, read-only GA4 connections, Revenue sources, Spend sources, platform KPIs and Benchmarks. Lists/empty target fixtures only; not all analytics/PDF/query costs. Campaign counts/owner/client identity asserted, not merely HTTP200. |
| Upload boundary | Each5,000-row file parsed to exactly5,000 rows. Current UI AddRevenueWizardModal2313 explicitly states5,000 data rows/10MB. A fresh-window10,000-row request correctly returns413 before save. Preview does not persist source facts. |
| Shared-IP continuation | After those five successful previews, every user's subsequent save returns429/retryAfter300. No new source is created. **Release failure for five simultaneous onboarding users sharing an IP**, despite passing defect-reproduction assertions. |
| Isolation cleanup | Random fixture schema removed, catalog verified0 matching schemas; local HTTP server and disposable PostgreSQL stopped. No Ptomo, production or external messages. |

The unchanged application full suite remains182 failures. These four audit assertions do not replace it. Workstation p95 does not establish Render capacity, sustained throughput, memory stability, authenticated browser latency, provider quotas, scheduler coexistence or saved-import/publication performance.

## V1-126 — preview and save share a five-request IP quota

**P1, actual HTTP and database reproduction.** `server/middleware/rateLimiter.ts:44–59` limits imports to five requests per IP per five minutes. Both Revenue CSV preview4698 and process4735 use the same limiter before ownership/parser; Spend preview6480/process6506 and other source-save/refresh calls share it. `AddRevenueWizardModal.tsx:1507,1604` requires preview before process. Production index29 trusts one proxy hop, so users behind the same corporate public IP share the bucket.

Five ordinary users can finish their preview requests, exhaust the shared bucket, then all fail to save for the remaining window. This is a rate-policy/workflow mismatch at a modest tester envelope; it is not a database throughput failure. A single user with several preview/edit attempts can also consume the bucket; that implication follows from the same current request budget, not an additional deployed measurement.

Required agreed fix: preserve abuse/resource limits while giving authenticated tenants/users a workable preview+save budget in the existing middleware pattern; prove same-IP independent owners, one abusive owner, unauthenticated limits, failed uploads and correct Retry-After behavior. No test-mode bypass was used. Provider quota policies remain separate.

## Every attempt classified

1. [Initial10,000-row run](http-database-pilot-10000-results.json), [observations](http-database-pilot-10000-observations.json): owner checks passed; all200 reads succeeded; all five previews413. The audit's provisional10,000-row target exceeded the explicit current UI limit. This is an audit target mismatch, not a parser defect. Earlier10,000-row component timings do not certify upload capacity.
2. [Mixed5,000/10,000-row run](http-database-pilot-rate-limit-results.json), [observations](http-database-pilot-rate-limit-observations.json): interleaved expected oversized-file rejections consumed the same IP bucket and later valid preview was429. This exposed shared budgeting and required an isolated positive-flow reproduction, not a waiver.
3. Final run separates five valid previews, five subsequent saves and one oversized-file control. The five saves all429 prove V1-126 without oversized traffic. Only then was the **local fixture limiter** explicitly reset to represent a fresh window for the oversized-file control. The reset is not part of the measured load or production behavior.

Keep the supported Revenue CSV UI boundary at5,000 rows unless separately changed and validated. The larger parser/process boundaries in other families remain independent. All full saved-import, selected-source publication, competing-job, PDF and hosted performance gates remain open; this run narrows the HTTP/storage/authorization/load gap with concrete evidence.
