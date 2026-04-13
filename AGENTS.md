# AGENTS.md

## General Standard

Work carefully, finish the requested task end-to-end when safe to do so, and prioritize correctness over speed in all analytics-sensitive areas.

## Purpose

This project is an existing marketing analytics platform with known regressions from prior AI edits. The primary goal of any future change is to add more features and data sources following the overall system architecture and design pattern, stabilize behavior, fix explicitly requested bugs, and preserve the current design pattern and architecture.

This file is a strict operating contract for any agent working in this repository.

Required companion reference:

- `ARCHITECTURE_USER_JOURNEY.md`
- `GA4/README.md` for GA4-related work
- `GA4_DEVELOPMENT_WORKFLOW.md` for GA4 fix/test workflow guidance

`ARCHITECTURE_USER_JOURNEY.md` defines the detailed end-to-end user journey, campaign creation flow, and the distinction between platform-level and campaign-level analytics.

Treat that document as required reading before making architectural or workflow-sensitive changes.

For GA4 work, `GA4/README.md` is the entry point and the files in `GA4/` are the canonical GA4 reference set.

Required reference order:

1. `AGENTS.md`
2. `ARCHITECTURE_USER_JOURNEY.md`
3. `GA4/README.md` for GA4-related work
4. `GA4_DEVELOPMENT_WORKFLOW.md` for GA4 stabilization, bug-fix, and test workflow
5. the relevant platform-specific doc(s)

## What This App Does

This app is a marketing analytics platform that pulls performance data from multiple sources, including LinkedIn, GA4, Google Sheets, custom uploads, and related integrations, and presents that data as:

- campaign dashboards
- KPIs
- benchmarks
- alerts and notifications
- executive-ready reports

It is primarily used by:

- marketing managers and growth teams tracking campaign performance across channels
- analysts who need cross-platform rollups for spend, conversions, revenue, ROI, ROAS, and related metrics
- executives who need a single health-and-insights view plus downloadable reports

Key workflow:

`sign-in -> create/select client -> client dashboard -> campaigns -> create/select campaign -> connect data -> analyze -> act`

## Accuracy Standard

This is a professional enterprise-grade platform relied on by marketing executives to make critical business decisions.

There is no margin for error.

Accuracy is not optional.
If a metric, transformation, attribution path, rollup, or report output is uncertain, do not guess.
Do not ship changes that "probably work" in analytics paths.
Preserve trust in the numbers above all else.
Do not take short cuts.

## Required Product Pattern

Future development must preserve the product journey and analytics-layer split defined in `ARCHITECTURE_USER_JOURNEY.md`.

For GA4-specific work, future development must also preserve the platform rules defined in:

- `GA4/README.md`
- `GA4/OVERVIEW.md`
- `GA4/FINANCIAL_SOURCES.md`
- the relevant GA4 tab-specific file in `GA4/`

That pattern is required architecture, not optional guidance.

Any new feature must fit into the existing model instead of inventing a parallel journey.

Preserve intended architecture even when a feature is still in progress.

If a surface is incomplete or currently imperfect, do not use that as permission to redesign the product pattern.
Follow the intended architecture documented in the companion docs unless the user explicitly asks to change it.

## Non-Negotiable Rule

Preserve the existing design pattern exactly.

Do not introduce new architectural patterns.
Do not refactor away from the current structure.
Do not "clean up" working code just because a different pattern would be preferable.
Do not replace established flows with new abstractions unless the user explicitly requests that exact refactor.

If the current code looks unusual but is intentional, follow it.

## Required Design Pattern

Treat the following architecture as the required template for all work:

1. Frontend flow
Client pages and components in `client/src/` render UI, fetch data, and preserve existing route/page boundaries.

2. API flow
Server behavior is centralized in `server/routes-oauth.ts`.
New bug fixes should fit into the existing endpoint structure instead of creating parallel patterns.

3. Data access flow
Persistence and data reads/writes belong in `server/storage.ts`.
Do not bypass storage conventions unless the code already does so in the exact area you are fixing.

4. Shared contract flow
Database tables, shared types, and validation contracts are defined in `shared/schema.ts`.
Schema shapes and API contracts are authoritative and must remain stable unless the bug explicitly requires a schema change.

5. Background job flow
Schedulers and refresh jobs stay in their current `server/*scheduler*.ts` and related service files.
Do not move logic between request handlers and schedulers unless explicitly required.

6. Existing data pipeline flow
UI -> query/fetch layer -> API endpoint -> storage/data transformation -> shared schema-backed response.
Fix issues inside the existing path. Do not create alternative side paths.

## Architecture Preservation Rules

- Keep page responsibilities where they already live.
- Keep endpoint responsibilities where they already live.
- Keep transformations in their current layer.
- Keep response formats backward compatible.
- Keep multi-tenant and campaign-scoped access patterns intact.
- Keep platform-specific analytics scoped to the platform configuration the user selected for that campaign.
- Preserve the current naming and file layout unless a rename is absolutely required for a requested bug fix.

Platform-scoping rule:

- a platform means a connected source such as `GA4`, `LinkedIn`, `Meta`, `Google Ads`, or `Google Sheets`
- platform-specific analytics must remain scoped to the campaigns, properties, accounts, sheets, or other source configuration selected when that platform was connected to the campaign
- do not silently broaden platform analytics to unrelated source data in the same account/property unless explicitly required by the product design

## Strict Safety Rules

- Only fix the bug the user explicitly asked to fix.
- Do not modify unrelated code.
- Do not opportunistically refactor nearby code.
- Prefer minimal diffs.
- Target diffs under 20 lines when feasible.
- Do not rewrite entire files.
- Do not perform broad search-and-replace edits.
- Do not change behavior in adjacent features unless the fix cannot be made safely otherwise.
- If a bug touches a risky area, make the smallest correction possible.

## Sensitive Areas

Treat these areas as high risk and change them only with extreme care:

- Data pipelines
- Attribution logic
- Core transformation logic
- API response formats
- Revenue and spend rollups
- KPI and benchmark calculations
- GA4, LinkedIn, Meta, Google Ads, and Google Sheets import/refresh flows
- Scheduler-triggered refresh and snapshot behavior
- Multi-tenant ownership and campaign access checks

For these areas:

- Do not change output shape unless explicitly required.
- Do not change aggregation logic unless the bug is in the aggregation logic.
- Do not alter field meanings.
- Do not rename fields in responses.
- Do not silently "improve" calculations.

## Development Guidelines

- Preserve function signatures.
- Preserve existing return shapes.
- Preserve variable names unless a rename is necessary to fix a real bug.
- Do not introduce new dependencies.
- Do not introduce new frameworks, state libraries, or helper layers.
- Follow the existing structure exactly.
- Reuse existing utilities before adding new ones.
- If a helper already exists nearby, prefer using it over creating a new helper.
- Keep new code stylistically consistent with the surrounding file.
- If the codebase uses a large centralized file for a concern, continue working within that file instead of splitting it up.

## Debugging Workflow

Follow this order every time:

1. Identify the exact user-reported symptom.
2. Trace the full code path causing it.
3. Find the root cause before editing.
4. Confirm the smallest safe fix.
5. Explain the intended fix before implementation when communicating status.
6. Implement only the localized change.
7. Validate that the requested bug is fixed.
8. Validate that adjacent behavior did not break.

Do not code first and investigate later.
Do not guess at fixes.
Do not patch symptoms without understanding the source.
Do not implement speculative "likely fixes".
If root cause is not confirmed yet, do not change code.

For data/provenance bugs, prove the exact data-loss boundary before editing:

- trace the value from save/materialization to persisted source config/records to API response to frontend merge to final render
- verify whether the missing value was never created, was overwritten later, was omitted from an API response, was lost during a frontend join, or was hidden by render logic
- do not patch the visible UI until the lost boundary is known
- if existing production data was already damaged, fix the forward path and add the smallest safe self-heal/fallback for existing damaged records only when it uses exact source data and does not invent allocation

## Validation Requirements

Before considering a fix complete:

- Verify the exact failing flow.
- Verify the fixed flow.
- Verify neighboring flows that use the same function, endpoint, transformation, or response contract.
- If a response shape is involved, confirm consumers still match it.
- If a calculation is involved, check that totals and derived values remain consistent.
- If auth or campaign scoping is involved, confirm access rules still hold.

If you cannot validate fully, state that clearly and limit the change even further.

## Output Style For Code Changes

- Prefer minimal diffs.
- Keep changes localized.
- Avoid large refactors.
- Avoid "cleanup" commits mixed with bug fixes.
- Avoid formatting-only edits in touched files unless required.
- Touch as few files as possible.

## What To Avoid

- Do not redesign the architecture.
- Do not replace existing patterns with your preferred patterns.
- Do not create new abstraction layers for a small bug.
- Do not convert localized logic into a generalized framework.
- Do not rename endpoints, schema fields, or shared contracts casually.
- Do not change charts, metrics, or UI behavior unless required by the bug.
- Do not change API response formats to be "more consistent" unless explicitly requested.

## Decision Rule

When multiple fixes are possible, choose the one that:

- changes the fewest lines,
- touches the fewest files,
- preserves the existing pattern,
- preserves all public contracts,
- has the lowest regression risk.

If a larger refactor seems tempting, do not do it unless the user explicitly asks for that refactor.
