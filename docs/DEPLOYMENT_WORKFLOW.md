# Deployment workflow

## Required release checks

GitHub runs `Tests / unit-tests` on each pushed commit and on manual workflow dispatch. Opening or updating a pull request does not launch another copy of the same job. The check from the pushed head commit is used by the pull request.

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

The CI production build and Render production build remain intentional checks in different environments. This change removes duplicate event-triggered jobs; it does not skip the required build or reuse an unverified runtime artifact. Monitor-branch promotion may still start a same-commit CI run; only promote/deploy a monitor revision with already-passed checks for that exact SHA.

References: [GitHub required checks](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches#require-status-checks-before-merging), [setup-node caching](https://github.com/actions/setup-node/blob/v4/README.md#caching-global-packages-data), [Render deployment controls](https://render.com/docs/deploys#skipping-an-auto-deploy).
