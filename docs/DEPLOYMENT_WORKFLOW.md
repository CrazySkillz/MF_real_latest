# Deployment workflow

## Required release checks

GitHub runs `Tests / unit-tests` on each pushed commit and on manual workflow dispatch, except for the already-tested monitor promotion described below. Opening or updating a pull request does not launch another copy of the same job. The check from the pushed head commit is used by the pull request.

Keep the existing main-branch protection: an up-to-date pull request, successful `unit-tests` from GitHub Actions app 15368, administrator enforcement, and no force pushes or branch deletion. A missing, failed or cancelled head check must not be used for release. Fork contributions must be brought onto a maintainer-controlled branch for this workflow; do not bypass missing checks.

The required job still performs the clean dependency installation, TypeScript check, production build, certification gate, and complete current-version test suite with isolated PostgreSQL and browser tests. The existing deferred-source evidence remains non-blocking. No calculation tests or assertions have been removed.

Dependency downloads are cached by `package-lock.json`; `npm ci` still runs. A newer run on the same feature branch cancels obsolete work. Main-branch runs are not cancelled. The post-merge main check remains required before Render auto-deploys.

## Release sequence

1. Make a focused change and run the relevant local checks.
2. Push the branch and open its pull request. Wait for the single required head check; do not wait for a separate `pull_request` event run.
3. Deploy that exact passed commit to the test app and verify the affected behavior. Do not repeat completed validation for unchanged code.
4. Before merging, ensure the branch includes current main and the required head check passed. For a prepared release, also confirm the merge tree equals the tested tree.
5. Merge when live release is authorized. Render remains configured to deploy only after the main commit's checks pass. Do not also trigger a manual deployment.
6. Verify the deployed commit, app health and affected behavior. Preserve exact-version monitor validation when application runtime changes.

For workflow-, test- or documentation-only commits that require no app deployment, include `[skip render]` in the final merge commit message. Do not use `[skip ci]`. Confirm live/test deployment IDs and health commits remain unchanged. These changes do not require rebuilding or updating the monitoring service when its runtime and expected application commits are unchanged.

The CI production build and Render production build remain intentional checks in different environments. This change removes duplicate event-triggered jobs; it does not skip the required build or reuse an unverified runtime artifact.

## Monitor promotion

1. Prepare a descendant of the current `codex/live-number-checks` commit on a separate `codex/` branch. Preserve the workflow's exact promotion-branch exclusion.
2. Wait for the full `Tests / unit-tests` job from GitHub Actions app 15368 to succeed for that exact SHA. Missing, pending, failed, cancelled or skipped jobs do not qualify. Do not substitute a passing result from a parent commit or a matching tree.
3. Confirm `codex/live-number-checks` still has required `unit-tests` protection from app 15368, strict status checks, administrator enforcement, no force pushes and no deletion. Stop if protection is missing or changed. Confirm the monitor's Render auto-deploy remains off.
4. Fast-forward the monitor branch to the passed SHA without creating another commit. GitHub enforces the required check before accepting the promotion. This branch's push event is excluded, so promotion does not start a second test run. Manual workflow dispatch remains available when a deliberate rerun is needed.
5. For an authorized monitor runtime release, deploy that same passed SHA and verify it. Workflow/documentation-only changes do not require a monitor deployment. Main and ordinary feature-branch checks are unaffected by this exclusion.

References: [GitHub required checks](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches#require-status-checks-before-merging), [setup-node caching](https://github.com/actions/setup-node/blob/v4/README.md#caching-global-packages-data), [Render deployment controls](https://render.com/docs/deploys#skipping-an-auto-deploy).
