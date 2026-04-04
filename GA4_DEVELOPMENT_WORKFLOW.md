# GA4 Development Workflow

## Purpose

This file defines the recommended workflow for stabilizing the GA4 section, fixing bugs safely, and testing changes without breaking existing functionality.

Use this as the operating process for future GA4 development and QA.

## Core Principle

The GA4 docs are now the specification.

Future bug fixes and testing should follow the documented behavior in:

- `AGENTS.md`
- `ARCHITECTURE_USER_JOURNEY.md`
- `GA4/README.md`
- the relevant `GA4/*.md` file(s)

Do not treat current buggy behavior as the design.

## Recommended Order Of Work

1. finalize the GA4 docs
2. review and tighten `GA4-MANUAL-TEST-PLAN.md`
3. create a prioritized GA4 bug queue from known Findings
4. fix one bug at a time
5. run targeted regression checks after each fix
6. continue manual testing through the remaining user journeys
7. repeat until the GA4 section is stable

## Why This Order Matters

This order reduces bug churn.

The previous pain point was:

- a bug was fixed
- that fix introduced a new bug elsewhere
- the new bug forced rework in already-touched areas

The safer pattern is:

- define expected behavior first
- tighten the test plan
- fix one issue at a time
- validate immediately before moving on

## Step 1: Treat The Docs As The Spec

Before any GA4 code change:

1. read `AGENTS.md`
2. read `ARCHITECTURE_USER_JOURNEY.md`
3. read `GA4/README.md`
4. read the relevant GA4 tab doc(s)
5. read `GA4/FINANCIAL_SOURCES.md` if the issue touches money, imported values, or derived financial metrics
6. read `GA4/REFRESH_AND_PROCESSING.md` if the issue touches refresh, recomputation, alerts, cross-tab dependencies, or reports

The docs should define:

- expected user journey
- expected tab behavior
- expected calculation behavior
- expected refresh behavior
- intended architecture

## Step 2: Tighten The Manual Test Plan First

Before the next major bug-fix round, review `GA4-MANUAL-TEST-PLAN.md`.

The test plan should be:

- clear
- efficient
- grouped by dependency/risk
- explicit about regression checks
- easy to resume after partial completion

The test plan should especially cover:

- campaign creation and campaign entry
- Connected Platforms -> View Detailed Analytics
- Overview cards and tables
- Total Revenue / Total Spend source flows
- KPI and Benchmark creation/edit/delete
- executive snapshot updates
- Ad Comparison updates
- Insights updates
- Reports create/download/schedule behavior
- refresh/recompute behavior

## Step 3: Create A Prioritized Bug Queue

Turn known Findings into a fix queue.

Each bug item should contain:

- bug title
- affected tab
- expected behavior from docs
- current broken behavior
- likely root cause area
- files involved
- risk level
- regression checks required after the fix

This prevents rediscovering the same issues repeatedly.

## Step 4: Fix One Bug At A Time

For each bug:

1. identify the exact symptom
2. trace the full code path
3. confirm root cause before editing
4. choose the smallest safe fix
5. make a minimal localized change
6. verify the bug is fixed
7. run regression checks before moving on

Do not batch many unrelated fixes together.

Do not refactor while bug fixing.

Do not change adjacent behavior unless the bug cannot be fixed safely otherwise.

## Step 5: Regression-First Validation

After each bug fix, validate:

- the exact bug is fixed
- neighboring behavior in the same tab still works
- shared dependencies still work

High-risk shared dependencies include:

- revenue and spend totals
- latest-day revenue/spend cards
- Profit / ROAS / ROI / CPA
- KPI current values and executive snapshot
- Benchmark current values and executive snapshot
- source rows and edit/delete behavior
- Ad Comparison values
- Insights values and findings
- Reports output
- refresh and recomputation behavior

## Step 5B: Add Automated Regression Coverage For High-Risk Bugs

After a bug is manually verified, add automated regression coverage when the bug is:

- high risk
- easy to reproduce deterministically
- likely to come back later
- tied to a core rule such as activation gating, calculations, refresh, or notification routing

Recommended approach:

- use manual testing for immediate confidence
- add automated tests for long-term protection

Examples of good automation targets:

- campaign activation gating
- latest-day revenue and spend calculations
- KPI and Benchmark recomputation rules
- notification routing
- source add/edit/delete recomputation

## Step 6: Use `Run refresh` As A Fast Validation Tool

The GA4 section has a `Run refresh` link that generates mock data to simulate a new daily update.

This is a good approach.

Use it to validate:

- daily update behavior
- Overview freshness
- KPI recomputation
- Benchmark recomputation
- executive snapshot updates
- Ad Comparison refresh
- Insights refresh
- report freshness after updates

Important caveat:

- `Run refresh` is a simulation/validation tool
- it does not replace testing real setup/import/edit/delete workflows

So the right approach is:

- use `Run refresh` for fast regression validation
- use manual testing for real user journeys and source workflows

## Practical Fix Cycle

For each new GA4 issue, follow this loop:

1. confirm expected behavior from docs
2. trace root cause in code
3. implement the smallest safe fix
4. retest the affected flow manually
5. run a short regression sweep
6. add an automated regression test if the issue is a high-risk repeatable rule
7. use `Run refresh` if the issue touches calculations, freshness, or downstream tabs
8. continue to the next issue only after validation passes

## Production-Readiness Standard

The GA4 section should be treated as production-ready only when:

- the docs are accurate
- the manual test plan is solid and current
- known Findings have been worked through systematically
- fixes are verified one by one
- shared calculations remain stable across tabs
- refresh/recompute behavior is trustworthy
- report outputs reflect the refreshed state correctly

## Non-Negotiable Rules

- preserve existing architecture
- preserve platform scoping
- preserve campaign scoping
- prefer minimal diffs
- do not introduce opportunistic refactors
- do not guess at analytics logic
- do not treat buggy current behavior as the design
- do not move to the next bug before validating the current fix

## Recommended Next Step

The best next step is:

1. review and improve `GA4-MANUAL-TEST-PLAN.md`
2. convert the known GA4 Findings into a prioritized fix queue
3. begin fixing issues one at a time with targeted regression checks
