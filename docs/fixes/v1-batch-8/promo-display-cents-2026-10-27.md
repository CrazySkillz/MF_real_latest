# Promo campaign revenue display cents

Status: localized display correction validated locally; not committed or deployed. This is not a source, tab or whole-app production-readiness certification. The preceding [rename correction](promo-rename-2026-10-27.md) is preserved as a separate pending change.

## Confirmed root cause and boundary

Promo's exact selected native campaign amounts are `66625.346347` and `13808.508329999999`. Their sum rounds once to `80433.85`; independently rounding each row produces `66625.35 + 13808.51 = 80433.86`. The saved native and financial totals are already correct. The unmapped CSV contributes `250` only to Total Revenue `80683.85`.

The earlier subtotal correction retained raw precision until the final aggregate rounding but deliberately left row displays alone. The user has now explicitly requested reconciling those row displays. New checks reproduced two failures before this correction, in the production frontend aggregation and scheduled PDF rendering.

Traced paths:

- Saved Overview `campaignBreakdown.rows` -> `getGA4OverviewSnapshot` -> synchronized `/api/campaigns/:id/ga4-breakdown` Overview/comparison variants -> frontend selected campaign aggregation -> exact imported mapping resolver -> Overview table and Campaign Comparison -> browser PDF handler.
- Scheduled PDF payload -> same compatible saved native breakdown -> existing traffic/native merge -> exact imported mapping resolver -> scheduled Overview/comparison/custom PDF rendering. The merge previously rounded native rows, so the display calculation now also retains their original exact native amounts keyed exactly as that merge does.

## Smallest bounded correction

`shared/ga4-campaign-breakdown.ts` adds a pure display-rounding function. It starts with normal two-decimal row amounts and reconciles their sum to the once-rounded sum of those same selected exact amounts. Each affected row changes by at most one cent, choosing the largest applicable rounding error first, with a deterministic campaign-name tie break. It preserves input objects, other metrics and row order. Invalid/unsafe amounts are not converted into a valid reconciled total, and the function adds no report preflight condition or exception.

`client/src/pages/ga4-metrics.tsx` retains raw native precision in its local aggregation and shares the reconciled display rows between Overview, Comparison and downloaded PDFs. `server/ga4-scheduled-report-pdf.ts` applies the same rule using the original native rows plus existing exact-mapped imports. Native-only comparison detail rows use the rule within their own native scope.

Promo now displays `66625.34 + 13808.51 = 80433.85`. The previous `7653.95` row-display case now displays `3400.44 + 4253.52 = 7653.96`. This is cent presentation of already attributed revenue, not a new attribution or allocation of imported revenue. No unrelated card total is supplied as a reconciliation target.

Source amounts, database records, API response contracts, query selection, provider calls, publication gates, refresh jobs, overall financial values and CSV mappings are unchanged by this cent fix. There is no persisted-data cleanup. Displayed revenue order/leader ties and derived presentation ratios can reflect the corrected cent; their existing selection algorithms are unchanged.

## Validation and limits

The final counts, exact source hashes, fixture names and build results are recorded in [promo-display-summary.json](validation-2026-10-27-report-incident/promo-display-summary.json).

Final bounded packet: **283 passed, zero failed, zero skipped across 11 files**. The additional Promo-only browser rerun passes separately; its 11 deliberately unselected scenarios are covered by the complete browser-file run and are not counted as extra tests.

- Focused tests execute production aggregation/rendering with Promo's exact raw values, duplicate rows, unselected campaigns, zero/refund values, mapped/unmapped imports and separate pipeline. Unit checks also cover mixed signs, multi-cent differences, stable ties, exact-cent rows and input nonmutation.
- Actual browser PDF handlers and scheduled PDF builders cover Overview, Comparison and custom output, with Promo row values and the separate CSV contribution. Adjacent artifact checks retain other report types, empty/unavailable states and source provenance.
- All 12 isolated browser journeys pass, exercising 67 successful comparison PDF downloads across valid, delayed, failed, recovered and mismatched refresh states. Promo also passes a dedicated rerun with both Overview and Comparison requests executing the actual saved-snapshot route. The expired provider stub is never invoked. Real missing/alignment failures still prevent output; recovery enables downloads without the transient report-error toast.
- TypeScript, client production build, final server production build and whitespace checks pass. Test environments use intercepted requests and sanitized local-only credentials; no personal browser or production mutation is involved.

Deployment, the live Promo page and newly generated production PDFs remain unverified. Source create/edit/delete, actual provider refresh, scheduler execution, email delivery and other campaign lifecycles were not re-certified by this display correction. The earlier rename warning still requires the normal deployed scoped recovery to publish a valid completion marker; this rounding change does not restore that marker or hide its status.
