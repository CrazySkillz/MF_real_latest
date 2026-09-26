# Campaign DeepDive Reports Production Certificate — 2026-09-21

> **Current dependency status (2026-09-26): RECERTIFICATION REQUIRED.** The
> certificate below is historical evidence for revision `809227f7...`. The Budget &
> Financial report renderer now consumes the separate `budget_pacing_v1` Spend contract
> introduced at `4298cfda`. Targeted local direct/snapshot/scheduled parity tests passed,
> but no current deployed Budget report artifact or delivery comparison has recertified
> that changed value path. Unaffected historical lifecycle evidence is preserved.

## Certification Status

**CERTIFIED — scoped GA4-first production configuration**

Certified surfaces:

1. Report Builder & Source Selection
2. Report Content & PDF Parity
3. Scheduled Report Library & Lifecycle
4. Delivery, Artifacts & Failure Safety
5. Standalone Combined Reports surface as a fail-closed, non-authoring surface

This certificate does not claim that the standalone Combined Reports surface is a combined report builder or owner-scoped report lifecycle. That unsupported legacy behavior is unavailable and fails closed.

## Exact Runtime

- Production URL: `https://marketforensics.onrender.com`
- Deployed revision: `809227f7aefba97d50d9c7649de8e7d06c022371`
- Local `main`: exact match
- Refreshed `origin/main`: exact match
- Render `/api/health`: exact match, `nodeEnv=production`
- Certification date: `2026-09-21`
- Local verification tooling: Node `v22.17.1`, npm `10.9.2`

## Certified Configuration

- Enabled main source: GA4
- Connected-source count in the production fixture: `1`
- Campaign currency: `USD`
- Reporting time zone: `Europe/Amsterdam`
- Current-value window mode: `initial_import_to_latest_completed_day`
- Window: `2026-07-02` through `2026-09-20`
- Data through: `2026-09-20`
- Data age at parity validation: `0` days
- Available aggregate metrics: `9`
- Custom selected metrics: `users`, `revenue`
- GA4 KPI rows: `8`
- GA4 Benchmark rows: `2`

## Dependency-Impact And Reused Evidence

The final deployed change after the current PDF parity run affected only the standalone Reports client's decision not to read unscoped browser-local records, plus tests and documentation. It did not change API, storage, report renderer, snapshot, scheduler, send-bookkeeping, or provider code.

Accordingly:

- direct six-report production PDF parity from deployed `c4fbc498` is reused for `809227f7` because the only intervening product change is the standalone client-side local-record isolation line;
- controlled create/edit/reschedule/pause/resume/snapshot/download/delete lifecycle evidence from `243a3be1` is reused because lifecycle routes, storage, and contracts are unchanged;
- scheduler deduplication, immutable scheduled artifact, Mailgun delivery-confirmation, and send-bookkeeping evidence is reused because those dependencies are unchanged;
- current authenticated UI, isolation, immutable artifact, and Combined Reports fail-closed behavior were rerun on `809227f7`;
- upstream GA4 and already certified Campaign DeepDive calculations were not re-audited.

## 1. Report Builder & Source Selection

**PASS**

- Campaign context and back-navigation are preserved.
- Campaign, client, owner, and platform boundaries are enforced.
- Source and metric selection derives from connected, available aggregate capabilities.
- Paid-media-only metrics remain unavailable without a capable connected source.
- New creation covers Performance Summary, Budget & Financial Analysis, Trend Analysis, and Executive Summary. Legacy saved Platform Comparison and `custom` configurations remain recoverable during edit; the legacy Custom renderer is covered with metric/KPI/Benchmark composition.

## 2. Report Content & PDF Parity

**PASS**

Current production parity evidence for the unchanged renderer:

| Report | PDF bytes | SHA-256 | Exact values checked |
|---|---:|---|---:|
| Performance Summary | 6,956 | `58c9b002450275996f00f9c7137be8ba6f3426809e5a110c369e436efb9f7820` | 5 |
| Budget & Financial Analysis | 9,047 | `32d193abae5a44807c7213189120766f6b4ac82aeda339bb8cb59b6d4af15e98` | 5 |
| Platform Comparison | 5,495 | `13b4f74a466996e69ba439d7367ec4aa50a50d8ff3281e25b5751ea9bb401cbf` | 6 |
| Trend Analysis | 12,682 | `127a1b3c806b4fbc8ddba74f9203b2a286c9bcd1e9e292c8511244bd23bbb6ff` | 7 |
| Executive Summary | 8,903 | `f321871a1d23665c467efa97427ce0e33a5923ca8aeeec20da8499335183aa81` | 7 |
| Custom | 6,083 | `ec297a490edc2329c284ee43aadd0a0e09f01fabaccf51f8a2cfffcee6323d6d` | 2 selected metrics plus KPI/Benchmark composition |

Report, snapshot, send-event, and email-event counts were unchanged by the parity run. Currency, date window, formatting, latest-value refresh, unavailable states, stale/freshness fail-closed behavior, and selected composition are regression-covered. Direct PDF generation created no stored report or snapshot.

The main Executive Summary page intentionally displays only its top Risk Level. The Executive report composition additionally exports a report-specific Risk Assessment breakdown from the same risk inputs; this certificate does not claim that the removed full Risk Assessment page card was restored.

## 3. Scheduled Report Library & Lifecycle

**PASS**

Controlled production evidence covers create, invalid-create failure, scoped listing, edit, reschedule, pause, resume, latest-value snapshot, exact artifact download, cross-owner denial, delete, repeated-delete failure, concurrency limits, scheduler deduplication, and cleanup.

Disposable artifact: `7,086` bytes, SHA-256 `9b8e5aaa961466f2dc13215fee2d66ddd7578b9eacf94b944e3c979457d89f25`. Cleanup left no disposable report or orphan snapshot.

## 4. Delivery, Artifacts & Failure Safety

**PASS**

- Snapshot reads enforce report access and campaign/platform consistency.
- Stored PDF bytes are immutable; invalid legacy metadata-only artifacts fail closed.
- Failed sends do not create misleading sent snapshots.
- Missing campaigns fail closed before snapshot, recompute, email, or send bookkeeping.
- Send processing is deduplicated.
- Delivery wording requires provider delivery evidence, not API acceptance alone.
- Authorized reused evidence contains `provider=mailgun-api`, `delivery_status=delivered`, non-null `delivered_at`, matching sent bookkeeping, and a stored artifact.
- Current `809227f7` validation re-read the immutable `7,270` byte artifact with SHA-256 `1c64a9253a05551f2fbac70eaee965dc532220ec7e28b23b8b1d809bba2a42a5`.

No email was sent and no scheduler was triggered during final certification validation.

## 5. Combined Reports Surface

**PASS — fail-closed surface contract**

On deployed `809227f7`, an isolated authenticated browser profile was seeded with a legacy `marketpulse_reports` row. Production behavior proved:

- real empty state rendered;
- no unsourced Create Report action;
- no fabricated report history;
- injected legacy report count in the UI: `0`;
- injected legacy record remained stored and was not destructively deleted;
- application write requests: `0`.

Campaign-scoped backend Reports remained visible and functional in the same validation.

## Validation Summary

- Focused regression batch: **6 files, 97 tests passed**
- TypeScript: **passed**
- Production build: **passed**
- Current deployed authenticated GET-only validation: **passed**
- Six-report production PDF parity: **passed and safely reused under unchanged renderer dependencies**
- Controlled production lifecycle: **passed and safely reused under unchanged lifecycle dependencies**
- Final production writes: `0`
- Final emails sent: `0`
- Post-certification documentation/code alignment regressions: **59/59 passed**

## Exclusions

- The production fixture had no source-backed valid-zero metric. Deterministic zero/unavailable regression behavior is covered, but no live valid-zero example is claimed.
- Google Ads, Meta, Instagram, TikTok, and other main-source mixes were not enabled and are not certified by this GA4-first evidence.
- The standalone Combined Reports surface is certified only as fail-closed. No combined report creation, aggregation, scheduling, or browser-local lifecycle is claimed.
- The production Node version is not exposed by the health endpoint and is not claimed.

## Required Steps Remaining

None for the exact enabled GA4-first scope certified here.

Any future source enablement or future Combined Reports authoring capability requires its own dependency-impact review and production evidence before inclusion in this certificate.
