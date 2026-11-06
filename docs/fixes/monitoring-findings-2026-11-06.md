# PDF spend availability and ROAS findings — 6 November 2026

## Requested scope

Correct the four missing-spend PDF findings and the test-campaign ROAS discrepancy. Resolve the ten provider-access comparisons using existing evidence; retain honest limits for thirty historical comparisons. Do not change customer inputs, report history, date windows, source selection, schema, scheduler timing or unrelated calculations.

## Root causes and corrections

1. The PDF builders treated a successful spend query as proof that spend data exists, even when it returned no contributing records. `getSpendTotalForRange` already returns `sourceIds` for qualifying records, including explicit zero amounts. Expose that distinction as an internal `spendRecordsAvailable` flag and require it in the affected PDFs. Preserve the existing `spendAvailable` read-success contract used by publication readers and refresh jobs: an empty successful query must not make a campaign fail to load. The Executive Summary PDF also fell back to a stale aggregate when authoritative spend was unavailable; its Spend/ROAS/ROI/CPA branches now preserve that unavailable state. Genuine recorded zero remains zero; unavailable or zero-denominator ratios remain unavailable.
2. `toFixed(2)` rounded the binary representation of `285.015` to `285.01`, while the established GA4 Overview decimal display correctly produced `285.02`. Reuse that decimal display rule through the existing shared metric-math module. Apply it to the ROAS aggregate/current-value calculation and the traced GA4 Insights, Diagnostic card, narrative and PDF consumers. Revenue, spend, source precision, other metric formulas and availability guards remain unchanged.

The traced paths are source records -> existing storage range totals -> campaign-current-values -> actual Performance/Executive PDF builders; and authoritative revenue/spend -> performance-summary-aggregate/current-value ROAS -> existing APIs -> GA4/Diagnostic displays and actual browser/server PDF formatters. Generation and downloads share the corrected builders; saved immutable PDF history is not rewritten. Source add/edit/delete and refresh continue through their existing totals queries, whose campaign/platform/date filters are unchanged.

## Validation

The exact defects failed regression tests before correction. The focused packet passes 108 tests: empty versus explicit-zero spend, stale aggregate fallback in both affected PDF builders, decimal half-way/adjacent/negative ROAS cases, executed expressions from the actual affected screen/PDF code, existing Overview rounding and neighboring financial/Insights/report contracts. Full release-gate and hosted verification receipts belong in the release PR; local passing tests alone are not a deployment or whole-section certification.

## The forty unverified comparisons

The natural scheduled monitor at 19:25 UTC on 6 November passed all ten previously inaccessible provider comparisons: HubSpot confirmed revenue and Pipeline Proxy for three campaigns, Salesforce confirmed revenue for two campaigns plus Pipeline Proxy for one, and Shopify revenue for one. The earlier off-slot run used expired credentials. Current targeted access verification also passed Salesforce/Shopify; HubSpot had expired again between scheduled slots. No credentials were rotated by the monitor, no reconnect was performed, and no source data was rewritten. Evidence: Render monitor `crn-dbm6oql6e07s73bar4eg`, scheduled log records 19:25:21 UTC.

Thirty historical comparisons remain unprovable from the retained records: ten missing original report source settings; seven missing financial CPA conversion bases; seven missing session-key-event conversion-rate bases; three retired report definitions; and three legacy Performance Summary snapshots without exact reporting windows. These are missing evidence, not thirty established wrong values. Current settings cannot prove past settings. Original artifacts are preserved and the monitor continues to report these as unverified. The user was asked whether original inputs exist outside the database. No exceptions or fabricated passing results were added.

The stored historical artifacts and old derived snapshots require their original evidence for retrospective source certification. New/current output correctness can be verified independently; this correction does not retroactively certify old reports or claim complete production readiness.
