# GA4 Overview Performance — exact-runtime recertification, 2026-09-17

## Decision and boundary

**CLEAN-CERTIFIED / PRODUCTION_READY for the four GA4 Overview Performance cards on the exact existing Campaign2/property/USD boundary at deployed application commit `5232f8978a4f70e05652d23459aeb9c964e7a83d`.** Required steps remaining for this exact boundary: **0**.

This is an independent consumer certification of **Profit, ROAS, ROI, and CPA**, not certification of source add/edit/delete, Summary Conversions, Campaign DeepDive, Reports, the Revenue & Financials parent, or the whole Overview tab. Existing Revenue, Spend, Performance, and Insights Executive Financials certificates remain untouched. The native GA4 financial-conversions value is a selected-property input, not a substitute from Summary.

## Inputs, formulas, and rendered parity

Read-only authenticated APIs on Campaign2 (`d9c8a3b7c4d0`, property `542352127`, Europe/Amsterdam reporting timezone) returned native GA4 Revenue `$8,862.30` and **48** financial conversions for 2026-09-08–2026-09-16, imported Revenue `$57,676.90` through 2026-09-17, and source-backed Spend `$338.00` through the completed 2026-09-16 day. The Revenue breakdown summed to its total, the Spend breakdown matched its total, and the rendered cards matched these exact calculations:

| Card | Formula | Rendered value |
| --- | --- | ---: |
| Profit | `$66,539.20 − $338.00` | `$66,201.20` |
| ROAS | `$66,539.20 ÷ $338.00` | `196.86x` |
| ROI | `($66,539.20 − $338.00) ÷ $338.00` | `19586.2%` |
| CPA | `$338.00 ÷ 48` | `$7.04` |

The 2026-09-16 `financial_daily` snapshot for this campaign was written at **10:06:19 UTC** after the scheduled financial and GA4 refreshes, with available Revenue, Spend, and conversion inputs at the reconciled values. Its GA4 daily rows were updated at 10:05. The read-only UI check blocked all application writes and passed all four card assertions. The temporary UTC timer settings were financial 09:35 and GA4 10:05; this does not certify global scheduler health or normal-clock timing.

Controlled same-commit browser checks passed valid-zero Revenue and Spend separately; Spend zero withheld divide-by-zero ratios/CPA, while Revenue zero retained mathematically valid negative Profit, zero ROAS, and negative ROI. Initial Revenue or Spend unavailability withheld dependent cards, while CPA remained independent of Revenue. Failed refreshes retained cached last-good card values with a warning. No production source values were mutated to create these states.

Local evidence on this exact commit: prior focused financial/Insights packet **101 passed**; current scheduler/snapshot/Spend packet **52 passed**, `npm run check` passed, and `npm run build` passed. The global daily jobs reported failures for other/unidentified campaigns. This certificate applies only to the named campaign's proven inputs and outputs; it does not classify those global failures as test campaigns or broaden upstream source certificates.
