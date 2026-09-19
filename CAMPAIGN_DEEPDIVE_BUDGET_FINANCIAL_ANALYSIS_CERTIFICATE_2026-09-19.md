# Campaign DeepDive — Budget & Financial Analysis Certificate

Date: 2026-09-19

Decision: **PASS — bounded production certification**

Certified revision: `b36047bbce419df9d606239c340398e69a409211`

Runtime: `https://marketforensics.onrender.com` (`production`)

Revision check: deployed health, local `main`, and `origin/main` all matched the certified revision.

## Certified scope

This certificate covers the deployed Campaign DeepDive `Budget & Financial Analysis` page:

1. Financial Position, including Conversion Efficiency and conditional Paid Media Efficiency.
2. Budget & Pacing, including budget/date add, edit, delete, and final render.
3. Allocation & Sources, including revenue/spend provenance and reconciliation.
4. Executive Action, including return, pacing, and source-mix guidance.
5. The combined page with all four sections rendered from the same aggregate contract.

The result is bounded to the revision, runtime, configurations, and evidence below. It is not a blanket certification of unrelated Campaign DeepDive pages or every external provider.

## Evidence and configuration

### Existing production campaign — financial and hidden paid-media path

- Campaign identifier hash: `fc734ddaf728`
- Currency: `USD`
- Reporting timezone: `Europe/Amsterdam`
- Campaign-to-date window: `2026-07-02` through `2026-09-18`
- Total spend: `$2,759.75`
- Total revenue: `$121,017.20`
- Profit: `$118,257.45`
- ROAS: `43.85x`
- ROI: `4285.08%`
- CPA: `$6.17`
- CVR: `12.9032%`
- Budget: `$150,000.00`
- Pacing period: `2026-08-03` through `2026-12-31`
- Calendar result: `48` elapsed days of `151`; status `behind`
- Provenance: `6` revenue inputs and `4` spend inputs; both groups reconciled exactly to their displayed totals.
- Executive actions: positive financial return, pacing below target, and spend-source-mix review.
- Paid Media Efficiency: correctly hidden because no compatible certified campaign-to-date paid-media metric set was available.

This was read-only production validation. No mutation was attempted against the existing campaign.

### Temporary isolated campaign — visible paid-media and pacing lifecycle path

- Temporary campaign hash: `63edb9bea1a0`
- Currency: `USD`
- Reporting timezone: `Europe/Amsterdam`
- Aggregate contract: `performance_summary_aggregate_v3`
- Campaign-to-date window: `2026-08-20` through `2026-09-18`; data-through date `2026-09-18`
- Configuration: non-provider GA4 window marker plus isolated Instagram `test_mode` row for `2026-09-18`
- Paid Media Efficiency displayed: `CTR 3.6%`
- Displayed paid source: `Instagram Ads`
- CPC and CPM: correctly withheld because campaign-to-date spend was not authoritative in this configuration.
- Budget lifecycle through the deployed page:
  - add: `$10,000`, `2026-09-09` through `2026-10-09`
  - edit: `$12,000`, `2026-08-30` through `2026-10-29`
  - delete: budget and both pacing dates became `null`
  - final combined-page render: `$15,000`, `2026-08-20` through `2026-11-18`
- Mutation boundary: exact temporary campaign only; no unexpected page mutation occurred.
- Cleanup: campaign and client deletes returned `200`; owner campaign/client inventories were restored; every public `campaign_id` and `client_id` table had zero residual fixture rows.

The temporary configuration proves the deployed conditional aggregate-to-UI path. It does not represent a live Instagram OAuth/provider certification.

## Subsection results

### 1. Financial Position — PASS

- Spend, revenue, profit, ROAS, ROI, and CPA use the connected-source performance aggregate; the page does not fall back to unrelated legacy totals when that aggregate is absent.
- Profit is revenue minus spend. ROAS, ROI, and CPA are computed only when their required inputs are available and denominators are valid.
- Conversion Efficiency uses the aggregate CVR and its compatible source provenance.
- A valid numeric zero remains available and renders as zero; a missing, stale-without-last-good, incompatible, or currency-invalid input renders unavailable rather than zero.
- A failed refetch retains the last successful values with an explicit stale warning.

Paid Media Efficiency rules were proven as follows:

- The section appears only when at least one compatible CPC, CPM, or CTR metric survives the campaign-to-date and contributor checks.
- CPC requires every spend contributor to provide clicks.
- CPM requires every spend contributor to provide impressions.
- CTR requires the non-empty click and impression contributor sets to match exactly.
- Only the sources contributing to displayed metrics are named.
- The compatible production fixture displayed CTR with Instagram provenance while withholding CPC/CPM.
- The incompatible existing campaign hid the entire section.

### 2. Budget & Pacing — PASS

- Add, edit, and delete were exercised through the deployed UI and verified through the campaign API.
- Campaign ownership remained enforced by the existing guarded campaign route.
- Budget metadata affects pacing only; it does not filter or rewrite source spend or revenue.
- Date-only pacing boundaries are evaluated in the campaign reporting timezone with calendar ordinals, avoiding DST millisecond drift.
- Daily burn rate uses displayed aggregate spend divided by elapsed pacing days; target daily spend uses budget divided by total pacing days.
- Missing budget, dates, spend, or a valid date range yields explicit unavailable states.

### 3. Allocation & Sources — PASS

- Revenue and spend provenance originate from authoritative financial inputs returned with the same outcome aggregate.
- The displayed source rows reconcile exactly to the displayed revenue and spend totals, including valid zero-value inputs.
- Currency is campaign-scoped; incompatible currency inputs fail closed.
- Source labels and values flow through the same API contract used by Financial Position and Executive Action.
- Budget metadata does not alter connected-source totals or source allocation.

### 4. Executive Action — PASS

- Return guidance is derived from the displayed ROAS and ROI, with an unavailable alternative when return cannot be assessed.
- `Positive financial return` means ROAS is at least `1.00x` and ROI is non-negative; `Return below break-even` appears when either value is below that boundary.
- Pacing guidance is derived from the same displayed budget, spend, pacing dates, and pacing status.
- Pacing is a linear V1 comparison: average daily spend below `85%` of target is behind, above `115%` is ahead, and the inclusive range between those thresholds is on track.
- Source-mix guidance is derived from the same reconciled spend inputs and identifies the largest source without inventing allocation.
- Source mix is shown only when positive source rows reconcile to authoritative Total Spend within `$0.01`; it describes concentration and does not automatically recommend moving budget.
- Guidance fails closed when required inputs are unavailable and does not overstate missing data.

This is deterministic V1 decision support, not causal attribution or an automatic budget optimizer. It assumes configured revenue sources are additive and non-overlapping and that tracked spend is complete. The displayed Profit is revenue minus tracked marketing spend, not accounting profit; the rules do not model incrementality, gross margin, COGS, agency costs, LTV, seasonality, planned non-linear flighting, or campaign-specific return targets.

## Combined-page result — PASS

The deployed page rendered Financial Position, Budget & Pacing, Allocation & Sources, and Executive Action together from one campaign-scoped aggregate path. Conversion Efficiency was verified on the existing production campaign. Paid Media Efficiency was verified both hidden and visible under its exact conditional rules. Budget lifecycle changes propagated consistently to the combined page without changing financial source totals.

## Trace and dependency impact

Verified flow:

`connected/persisted source rows -> guarded campaign APIs -> performance_summary_aggregate_v3 -> financial calculations and compatibility checks -> page sections and executive actions`

The dependency-impact review found no shared schema or public response-shape change. The revision changed the financial page, aggregate availability/zero handling, executive-action helpers, and scheduled financial rendering while preserving upstream collectors and source ownership. Existing GA4 and Performance Summary certification evidence was reused only after this check; their complete audits were not repeated.

## Validation gates

- Focused regression run: `19` test files, `151` tests passed.
- TypeScript check: passed.
- Production build: passed once for the certified code.
- Exact deployed revision health check: passed.
- Read-only existing-campaign validation: passed.
- Isolated deployed add/edit/delete and conditional paid-media validation: passed with complete cleanup.
- Repository after validation: only the pre-existing untracked `.worktrees/`, `assets/`, `logs/`, and `scripts/__pycache__/` remained.

## Downstream and exclusions

- Scheduled financial rendering is regression-covered for the same aggregate values, source provenance, and valid-zero behavior at this revision.
- Live email transport/delivery and a newly generated production PDF artifact were not exercised; they are not part of this page certificate.
- Live Instagram OAuth/provider accuracy was not asserted by the temporary test-mode fixture.
- No complete GA4 or Performance Summary re-audit was performed; unchanged certified upstream evidence was reused after the dependency-impact check.
- Executive Action is certified as bounded V1 decision support only. Its arithmetic and fail-closed rules are covered; causal, accounting-profit, source-deduplication, and automatic-reallocation claims are excluded.
- The app-wide readiness ledger records this bounded certificate separately from the certified application revision.

No remaining gate blocks this bounded page certification. Any later code, source-contract, provider, currency, ownership, or deployment change requires impact review and, where affected, recertification.
