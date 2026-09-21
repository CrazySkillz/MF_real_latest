# Campaign DeepDive Reports Audit — 2026-09-21

## Decision

**Audit complete. The scoped production certification PASSED.**

Campaign-scoped Campaign DeepDive Reports passed the current GA4-first builder, PDF, saved-library, lifecycle, artifact, scheduler-safety, and delivery-contract gates. The separate standalone Combined Reports surface fails closed for every browser profile by ignoring the legacy unscoped browser-local library without deleting it. The deployed isolation behavior passed with an injected legacy browser record.

`CAMPAIGN_DEEPDIVE_REPORTS_CERTIFICATION_2026-09-21.md` records the exact certified scope, evidence, exclusions, reused evidence, and remaining steps. No existing certificate or master ledger was modified.

## Runtime And Configuration

- Production URL: `https://marketforensics.onrender.com`
- Verified deployed revision: `809227f7aefba97d50d9c7649de8e7d06c022371`
- Local `main`, refreshed `origin/main`, and Render `/api/health` matched that revision before production validation.
- Render environment reported: `production`
- Local validation tooling: Node `v22.17.1`, npm `10.9.2`
- Enabled production fixture: one connected GA4 source, USD campaign currency, `Europe/Amsterdam` reporting time zone
- Current-value contract: `initial_import_to_latest_completed_day`, `2026-07-02` through `2026-09-20`, data through `2026-09-20`, data age `0` days
- Available aggregate metrics: `9`
- Selected Custom Report metrics: `users`, `revenue`
- Campaign-scoped GA4 KPI rows: `8`
- Campaign-scoped GA4 Benchmark rows: `2`

## Dependency-Impact Decision

The final change inventory from the pre-audit documentation revision through `c4fbc498` was limited to the Reports UI, centralized report routes/storage, the existing scheduler/renderer, and focused report tests. The last two deployed changes (`5cb9e7c8`, `c4fbc498`) affected only standalone Reports UI behavior and regression guards. They did not change the API, storage, renderer, snapshot, scheduler, or provider contracts.

Therefore:

- current direct PDF parity was rerun on `c4fbc498`;
- the current authenticated GET-only UI/artifact/isolation validation was rerun on `c4fbc498`;
- unchanged controlled lifecycle evidence from `243a3be1` was reused;
- unchanged scheduler deduplication, immutable scheduled artifact, Mailgun delivery-confirmation, and send-bookkeeping evidence was reused where its dependencies remained unchanged;
- complete GA4 and upstream Campaign DeepDive calculation audits were not repeated.

## 1. Report Builder & Source Selection — PASS (GA4-first Campaign Scope)

- Campaign DeepDive navigation preserves `/reports?campaignId=<campaignId>` and returns to the same campaign.
- Report list/API access is campaign-, client-, and owner-scoped; same-owner campaign separation and other-owner denial were exercised.
- Connected-source metric selection uses the campaign aggregate's available metrics.
- Paid-media-only metrics remain gated when no capable paid-media source is enabled.
- New campaign-scoped types validated: Performance Summary, Budget & Financial Analysis, Trend Analysis, and Executive Summary.
- Legacy Platform Comparison remains recoverable for saved configurations but is not offered for unsupported new GA4-only creation.
- Legacy saved `custom` output recovery was validated with selected metrics plus KPI and Benchmark sections; `custom` is not offered for new Campaign DeepDive report creation.

## 2. Report Content & PDF Parity — PASS (Enabled GA4-first Fixture)

Authenticated non-persisting production validation on `c4fbc498` passed all six outputs with exact expected values, currency, formatting, window, and selected composition:

| Report | PDF bytes | SHA-256 | Exact values checked |
|---|---:|---|---:|
| Performance Summary | 6,956 | `58c9b002450275996f00f9c7137be8ba6f3426809e5a110c369e436efb9f7820` | 5 |
| Budget & Financial Analysis | 9,047 | `32d193abae5a44807c7213189120766f6b4ac82aeda339bb8cb59b6d4af15e98` | 5 |
| Platform Comparison | 5,495 | `13b4f74a466996e69ba439d7367ec4aa50a50d8ff3281e25b5751ea9bb401cbf` | 6 |
| Trend Analysis | 12,682 | `127a1b3c806b4fbc8ddba74f9203b2a286c9bcd1e9e292c8511244bd23bbb6ff` | 7 |
| Executive Summary | 8,903 | `f321871a1d23665c467efa97427ce0e33a5923ca8aeeec20da8499335183aa81` | 7 |
| Custom | 6,083 | `ec297a490edc2329c284ee43aadd0a0e09f01fabaccf51f8a2cfffcee6323d6d` | 2 selected metrics plus KPI/Benchmark composition |

The validation confirmed application report, snapshot, send-event, and email-event counts were unchanged. Direct PDF generation created no stored report or snapshot and invoked no scheduler or email delivery.

Deterministic regressions cover unavailable currency, unavailable metrics, missing freshness, empty KPI/Benchmark rows, deduplicated legacy composition, and Executive Risk Assessment fail-closed states. The production fixture did not contain a source-backed valid-zero metric, so a live valid-zero example was not sampled.

The main Executive Summary page intentionally retains only its top Risk Level and does not restore the former full Risk Assessment card. Executive report PDFs add a report-specific Risk Assessment breakdown derived from the same KPI, Benchmark, freshness, ROI/ROAS, trajectory, and paid-source inputs.

## 3. Scheduled Report Library & Lifecycle — PASS (Campaign Scope)

Controlled production lifecycle evidence proved:

- create and invalid-create fail-closed behavior;
- campaign-scoped list visibility;
- edit and reschedule;
- pause and resume;
- latest-value snapshot generation and exact artifact download;
- cross-owner snapshot denial;
- delete and repeated-delete accurate failure;
- concurrency limits and storage advisory-lock enforcement;
- scheduler report-ID deduplication;
- exact cleanup with no disposable report or orphan snapshot remaining.

The disposable snapshot was `7,086` bytes with SHA-256 `9b8e5aaa961466f2dc13215fee2d66ddd7578b9eacf94b944e3c979457d89f25`. That controlled lifecycle did not trigger a scheduler or email.

## 4. Delivery, Artifacts & Failure Safety — PASS (Reused Unchanged Contracts)

- Direct and saved snapshot routes verify report access plus campaign/platform consistency before returning data.
- Snapshot PDF artifacts are immutable stored bytes; metadata-only legacy snapshots fail closed.
- Failed scheduled sends do not create misleading sent/downloadable snapshots.
- Missing campaign resolution fails closed and disables only the affected schedule where applicable.
- Send reservations and bookkeeping are deduplicated by report and scheduled key.
- Provider acceptance is not represented as delivery. Reused authorized evidence contains a Mailgun API event with `delivery_status=delivered` and non-null `delivered_at`, plus matching sent-event and immutable snapshot evidence.
- Current `c4fbc498` GET-only validation re-read a `7,270` byte immutable PDF with SHA-256 `1c64a9253a05551f2fbac70eaee965dc532220ec7e28b23b8b1d809bba2a42a5` and observed zero application writes.
- No email was sent and no scheduler was triggered during the final validation.

## 5. Combined Reports Surface — PASS (FAIL-CLOSED SURFACE)

Current deployed fresh-browser behavior passed:

- real empty state shown;
- no fabricated demo report history;
- no fake recipients;
- no unsourced `Create Report` action;
- zero application writes.

The deployed correction prevents standalone `/reports` from reading historical `marketpulse_reports` rows at all. It does not delete or rewrite them, and it leaves campaign-scoped backend Reports unchanged. An isolated production browser profile was seeded with a legacy report row; the row remained stored but was absent from the UI, the real empty state rendered, no Create Report action appeared, and the application made zero write requests. This certifies the surface as fail-closed, not as a combined report-authoring lifecycle.

## Final Validation

- Focused regression batch: **6 files, 97 tests passed**
- TypeScript: passed on the deployed product revision
- Production build: passed on the deployed product revision
- Current deployed authenticated GET-only validation: passed
- Current deployed six-report PDF parity: passed
- `git diff --check` for product changes: passed
- Production mutations during final validation: `0`
- Emails sent during final validation: `0`

One stale test assertion was corrected locally after the final batch initially expected Executive Summary to omit the newly required Risk Assessment section. The rerun passed all 97 tests. This was a test-only correction; deployed product code was unchanged.

Post-certification documentation alignment updated the architecture, Campaign DeepDive tracker, and GA4 reporting references to the deployed contract. The directly affected Custom Report and Executive Summary regression suites passed `59/59`; no product runtime code changed in that alignment pass.

## Exclusions And Required Remaining Work

1. No required implementation or deployment step remains for the enabled GA4-first scope.
2. A live source-backed valid-zero fixture may be added if live-environment zero evidence is required beyond deterministic regression coverage.
3. Google Ads, Meta, Instagram, TikTok, and other main-source mixes were not enabled in this fixture and are not certified by this GA4-first evidence.

Campaign-scoped Campaign DeepDive Reports and the fail-closed standalone Combined Reports surface are certified for the exact scope documented above.
