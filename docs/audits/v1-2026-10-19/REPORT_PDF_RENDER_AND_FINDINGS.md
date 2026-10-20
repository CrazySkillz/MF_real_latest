# Current server PDF rendering and Insights findings

Candidate `777aae6f6353e998d60b635d3e66b413093117c2`. [Four executed cases](report-pdf-reproductions.json), [runner](report-pdf-reproductions.cjs), [renderer](render-pdf-fixtures.py) and [page text/bounds evidence](pdf-render-check.json). Three actual jsPDF documents, eight rendered pages, all visually inspected. No database, provider request, email or customer data was used. This does not certify browser artifacts, all report sections, actual delivery or provider reconciliation.

## V1-085: scheduled Insights can contradict the current finding rules

The current `server/ga4-scheduled-report-pdf.ts:289–451` uses its own rollups and finding builder. `report-scheduler.ts:3727–3728` invokes this PDF generator for GA4 artifacts. The payload at467–1015 verifies the saved Overview identity/window/currency, complete cumulative daily publication and matching financial publication. Those guards passed for both synthetic Insights scenarios below. The issue is after those checks, in report finding derivation.

| Complete saved input | Actual server report | Exact client trend branch, same daily rows |
|---|---|---|
| Oct13–18: first three days each100 sessions/10 conversions/EUR100; final three days each verified0 | Computes the three-day declines as−100% but emits only “No major anomalies detected” and “Recent GA4 trends are stable relative to the prior comparison window.” Its intro says short-window checks are active. | Current `ga4-metrics.tsx:5757–5989` three-day branch generates decline findings. |
| Oct5–18: first seven days100 sessions/10 conversions daily; last seven200 sessions/10 conversions; revenue unchanged | Conversion rate changes10%→5%, but report again emits only the neutral finding. | Current seven-day branch generates the50% conversion-rate decline and the positive traffic finding. |

Root cause: server finding rules360–402 only implement selected seven-day volume/revenue tests. They omit the calculated three-day fallback, conversion-rate and engagement-depth checks, and other client rules. The neutral fallback441–449 treats absence of its limited findings as stability. Client rules5756 onward use complete adjacent windows and broader thresholds. The runner executes the current client trend `if/else` block with actual shared rollups and source threshold constants; surrounding React readiness/financial/target gates are outside that extracted comparison. The complete current server module, payload builder and real PDF renderer execute, with storage replaced by explicit fixture responses and provider calls rejected.

The six-day output is visible in [page1](pdf-insights-six-days-fixture-page-1.png) and [page2](pdf-insights-six-days-fixture-page-2.png). The fourteen-day report has [page1](pdf-insights-rate-fixture-page-1.png), [page2](pdf-insights-rate-fixture-page-2.png) and [page3](pdf-insights-rate-fixture-page-3.png). These are audit fixtures, not customer reports.

Positive control: an Insights Benchmark storage failure rejects the payload. `reportIncludesBenchmarkSection:149–154` explicitly includes Insights, so the catch fallback at538 does **not** swallow that required read. No such defect is claimed. Missing KPI finding rules and differences in calendar/lookback behavior are additional static parity gaps, not separately reproduced full target scenarios here.

`GA4/REPORTS.md:132,159` intends corresponding-tab substance and aligned investigation findings. `GA4/INSIGHTS.md:160` specifies seven-day comparisons with a three-day fallback and explicitly separates Reports certification at180. Current server behavior conflicts with the report alignment intent; historical Insights certification does not cover it.

Acceptance before release: preserve the existing renderer architecture, align the agreed finding/value/availability contract across live, browser and server output, and add complete6/14-day, missing-date, short-history, rate/volume, target, read-failure and source-mix parity cases. A passing phrase-presence test is insufficient.

## V1-086: report text overlaps with valid long labels

The [Overview first page](pdf-overview-long-fixture-page-1.png) visibly prints the long campaign name across the generated timestamp. `ga4-scheduled-report-pdf.ts:1219–1229` draws an unwrapped campaign string and timestamp on the same line at fixed column positions. The [Landing Pages page](pdf-overview-long-fixture-page-2.png) also lets the first label and Source/Medium value overlap. `addSimpleTable:1104–1147` truncates the first cell by character count, independent of measured text width, then right-aligns the next cell at a fixed boundary. The [Conversion Events page](pdf-overview-long-fixture-page-3.png) is legible but long event names become indistinguishable after truncation; no complete-label export claim is made.

All eight pages had zero off-page characters according to pdfplumber, yet the visible overlap remained. Therefore page bounds and mocked text assertions cannot replace rendering. Existing `ga4-overview-conversion-events-scheduled-pdf.test.ts` substitutes jsPDF with a text collector; its passing value assertions do not test layout. The14-day artifact also leaves the investigation heading/intro on page2 and the informational group/card on page3; the category heading does stay with its first card, as intended.

Acceptance: measure/wrap text within current column bounds, preserve numeric values and row meaning, and visually exercise long campaign/source/event labels and page transitions for the existing supported report sections. No runtime or design changes were made.

## Execution limits and harness corrections

The first esbuild-based loader could not spawn under the sandbox (`EPERM`), so the final runner uses installed TypeScript transpilation without subprocesses. An initial fixture omitted required `sessionKeyEventRate`; the current guard rejected it, and the fixture was corrected. The initial client-branch extractor looked for the expanded condition instead of its actual `sevenDayComparisonReady` variable; it was corrected. A proposed Benchmark-failure scenario disproved the suspected swallowed-error behavior and is retained as a successful fail-closed control. All four final assertions pass; none of these harness corrections alter the182 full-suite failures.

The current module receives a deterministic Date and an equivalent `import.meta.dirname` host binding; a fixture-only export exposes the unchanged internal payload builder. Native/financial totals and complete daily rows agree in the two finding scenarios. The Overview stress case uses synthetic detail rows for layout only; it is not a provider-detail reconciliation certificate. Installed pypdfium2 rendered the pages because Poppler is absent. No dependency was installed. PDF/PNG files are evidence of existing defects and intentionally remain unfixed audit outputs.
