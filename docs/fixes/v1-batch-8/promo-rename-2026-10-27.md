# Promo rename warning and revenue rounding

Historical rename-only checkpoint. The user subsequently requested fixing the displayed cent difference; [the follow-up checkpoint](promo-display-cents-2026-10-27.md) supersedes this document's statements that row displays remain unchanged. The rename runtime correction and its database validation remain unchanged.

Status: localized rename correction validated locally; not committed or deployed. No production data was modified. This is not a whole-app or whole-source certification.

## Confirmed cause and path

All Campaigns pencil -> `client/src/pages/campaigns.tsx` full edit payload -> campaign-access-guarded `PATCH /api/campaigns/:id` -> `DatabaseStorage.updateCampaign` -> `writeGA4RefreshInputChange` -> invalidated refresh work and cleared `executive_summary_daily.notes` -> `ga4-daily?statusOnly=1` -> Overview's `GA4 update is overdue` subtitle.

The ordinary update path invalidated publication even for a name-only change. Promo's database-enforced repeatable-read, read-only inspection on October 27 confirmed its completed work was invalidated at `21:23:58 UTC`, its October 26 aligned marker was absent, and its saved native and financial values remained present. The latest work had completed at `19:13:33 UTC`. This explains the overdue warning alongside the successful import timestamp. The read also verified the exact active campaign, owning client relationship, primary property `542352127`, EUR currency and selected `yesop_brand_search`/`yesop_retargeting` scope. Local evidence is in `audit-temp/promo-demo-readonly.{mjs,json,log}`; credentials are not included in that output.

## Bounded correction

Only `server/storage.ts` changes runtime behavior: 12 added lines. A name edit with no internal worker options is compared with the current campaign inside a transaction holding its row lock. Publication is preserved only if all submitted non-name fields are unchanged, including dates supplied through the existing validation schema. A changed currency, filter, timezone, budget, conversion value, spend, status or client still takes the existing invalidation path. Unknown or differing inputs fail back to that path. Missing campaigns return no updated row. Owned-worker calls retain their ownership checks.

No API shape, metric calculation, source record, refresh cadence, report preflight or frontend presentation changed. Names already excluded from the scheduler's analytics scope remain excluded. The existing financial, native daily and Overview values are not rewritten by renaming.

## One-cent finding

Persisted raw native campaign amounts are `66625.346347` and `13808.508329999999`. Their combined value rounds once to `80433.85`. Independently rounded rows are `66625.35` and `13808.51`, summing to `80433.86`. Both row displays round their own source amounts correctly; the existing aggregate correctly retains full precision until the final rounding.

The active CSV has EUR 200 and EUR 50 records and no exact campaign mappings. It contributes EUR 250 to the financial total, not to the two campaign rows. The saved financial input is `80683.85`; Spend is unavailable and Conversions are 316. No residual is allocated into a campaign to force the displayed rows to reconcile. No new financial calculation change was made.

## Validation

- Before the runtime fix: 73 local database checks passed and three new cases failed, reproducing lost completion after a direct rename, the full edit form, and cancellation of a valid running worker.
- Final packet: **439 passed, zero failed, zero skipped** across seven files. Real isolated PostgreSQL tests cover completed and running work, exact full-form values, neighboring input changes, missing readiness, waiting behind deletion, other-campaign isolation, expired and foreign worker ownership, source lifecycle ownership and bounded database waits.
- Browser publication tests retain the read/synchronization/failure guards. Scheduler tests cover missing-marker recovery through the existing scoped pipeline and preservation of completed scheduled work.
- Promo's exact revenue fixture executes the production frontend aggregation and comparison renderer. It checks `80433.85` native/chart subtotal, `80683.85` overall total, unchanged rounded rows and unchanged input arrays. The scheduled PDF test checks the same exact EUR totals with an unmapped CSV.
- TypeScript and server production build passed. `git diff --check` passed. No client runtime changed; a new client bundle build was unnecessary.
- Compact receipt: [promo-rename-summary.json](validation-2026-10-27-report-incident/promo-rename-summary.json). Raw before/final test and build logs remain in that directory.

## Existing state and remaining verification

The forward fix does not fabricate or restore Promo's already cleared readiness marker. The existing scoped startup/scheduled recovery must complete its normal source, GA4 and downstream checks to publish a new valid marker. No direct production repair or source refresh was performed. Local missing-marker recovery tests pass; an actual successful deployed recovery and disappearance of the warning remain to be verified after deployment.

The live UI and downloadable/emailed production PDFs were not exercised in this task. The exact saved values were read from production; the rendering/PDF checks use isolated fixtures. No browser access, email sending, production mutation or broad readiness certification was performed.
