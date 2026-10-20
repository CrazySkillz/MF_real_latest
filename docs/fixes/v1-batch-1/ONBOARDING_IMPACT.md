# V1-123: operational impact of shared-service-account grants

Reviewed on 2026-10-20 after the user asked whether each user would need a Render entry, then explicitly required removal of that operational burden. This remains under existing finding **V1-123**, not a new finding count or release certification. The initial clarification changed no runtime code; the subsequent localized correction and its evidence are recorded below.

## Pre-correction implementation, verified at 11d30cab

- [Campaign creation](../../../client/src/pages/campaigns.tsx:1437) mounts `IntegratedGA4Auth` without a `connectionMode` override.
- [IntegratedGA4Auth](../../../client/src/components/IntegratedGA4Auth.tsx:18) defaults to `service-account`. Its OAuth button is only rendered for `connectionMode="oauth"`; its default screen asks for the shared service account to be added as a GA4 Viewer and for a property ID. This default is unchanged from baseline commit `777aae6f`; Batch 1 did not introduce that wizard mode.
- The existing GA4 shared-credential path already has an application-level property allowlist in [ga4-service-account.ts](../../../server/utils/ga4-service-account.ts:40). Batch 1 adds a distinct owner/client/provider/resource boundary through [storage.ts](../../../server/storage.ts:676).
- Each grant must exactly match `ownerId`, `clientId`, `provider` and `resourceId`. A different customer owner, client or resource needs another approved entry. The same tuple can cover multiple owned campaigns for that client/resource. This is not a per-login operation, but it is **not one configuration entry for every future customer**.
- The shared GA4 connect route checks the grant before provider access at [routes-oauth.ts](../../../server/routes-oauth.ts:16191); create/update and saved-connection credential hydration enforce it again.
- A separate [GA4ConnectionFlow](../../../client/src/components/GA4ConnectionFlow.tsx:235) starts the existing customer Google OAuth endpoint, [routes-oauth.ts](../../../server/routes-oauth.ts:16427). It is used from campaign detail and GA4 analytics. The grant checks are conditional on `service_account`, so this environment grant is not required for the customer's own OAuth connection. This code trace does **not** certify successful deployed OAuth onboarding, provider setup, discovery, renewal or reconnect.

## User impact and release boundary

**Before the correction below, the default new-campaign flow required operator configuration for another customer/client/property using shared credentials.** Preparing one Ptomo grant would preserve that particular connection after deploying Batch 1; it would not provide self-service onboarding for all future users.

The earlier chat description of a "one-time setup" omitted this per-customer/client/resource scope and was incomplete. The original audit already identified the default shared-service-account reachability in [SERVICE_ACCOUNT_CUSTOMER_BOUNDARY.md](../../audits/v1-2026-10-19/SERVICE_ACCOUNT_CUSTOMER_BOUNDARY.md). The Batch 1 handoff needed to connect that evidence explicitly to the operational burden introduced by customer-specific grants.

The original 15 route checks and storage/hydration checks prove the stated authorization boundary, including denial when grants are missing. They did not prove that a legitimate fresh customer could finish the default creation wizard without an operator editing Render. The follow-up below corrects that default; full deployed onboarding acceptance remains open.

## Localized correction and validation

The user explicitly required normal customer onboarding without per-customer Render edits. [IntegratedGA4Auth.tsx](../../../client/src/components/IntegratedGA4Auth.tsx:18) now defaults to the existing `oauth` mode. Its shared-account status request only runs when the component is explicitly placed in `service-account` mode. These are **three changed runtime lines in one existing component**. No endpoint, storage contract, shared-resource guard, formula, existing connection, credential or production campaign was changed. Campaign creation retains its current draft, property-selection and subsequent workflow.

Normal customer creation now uses `/api/auth/ga4/connect`, Google consent and the customer's own `access_token`/refresh-token connection. This branch does not require `SERVICE_ACCOUNT_RESOURCE_GRANTS` or per-customer property allowlist entries. Shared-service-account API/hydration paths remain explicitly guarded. Existing Ptomo still uses that older shared method; preserving it through deployment still requires its single grant or a separately authorized customer Google reconnect. Do not silently trust every legacy shared-resource binding or remove the cross-customer guard.

The [regression runner](../../../server/v1-batch1-ga4-onboarding-regression.cjs) executes the actual campaign creation JSX, `loadWizardGA4Properties`, component, API request utility, current OAuth initiation/callback handlers, ownership guard, and state signing/verification helpers. Google replies, Clerk identities, storage and status replies are synthetic; browser traffic is restricted to the loopback fixture.

- [Before](onboarding-before.json): seven backend controls passed; the actual creation screen failed to offer Google sign-in, reproducing the default-mode problem.
- [After](onboarding-after.json): **13/13 checks pass**. Two different customer identities reach Google sign-in and their property-selection step with zero shared-account requests; customer OAuth credentials are saved through the exact callback; anonymous/foreign initiation, foreign callback, denied exchange and missing refresh token are controlled. Browser checks cover foreign-origin messages, blocked popup/retry, cancelled incomplete consent, OAuth errors, and retained explicit shared-account mode.
- [Focused regression packet](onboarding-targeted.json): **138/138 pass, zero skipped** across the eight original Batch 1 test files, including the added OAuth-without-shared-configuration hydration check. Existing shared-grant rejection tests still pass.
- [TypeScript](onboarding-typecheck.log) and [production build](onboarding-build.log) exit **0**. The production build retains its existing chunk/import warnings. The runtime source whitespace check passes.
- [Candidate hashes](onboarding-candidate.json) bind the component and changed/new regression files. The verification manifest distinguishes this follow-up from the initial 4,088-test suite and PostgreSQL packet; those larger runs were not repeated for these three frontend lines. All 182 original full-suite failures remain open.

**Proven locally:** customer Google sign-in is the creation default, does not depend on shared-grant configuration, and retains the stated ownership/error/cancellation controls. **Not proven:** live Google application configuration/consent, full initial import and downstream values, discovery pagination, successful reconnect/cancellation history preservation, and whole V1 onboarding. The separate V1-037/038/039 findings remain open. The user has been asked whether Render's app-wide `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` exist; local `.env` has neither, which does not establish Render's configuration. App-wide Google configuration is distinct from a per-customer environment entry.

## Required follow-up within the existing architecture

Track this under primary Batch 1 finding V1-123, with the customer-onboarding acceptance work in Batch 2. Preserve the security boundary. Establish and validate the existing customer-owned Google authorization path through new campaign creation, while retaining any shared-credential option only with an explicit, supported operator-managed scope. Do not silently grant resources based only on a submitted property ID or a shared service account's ability to read it.

Required acceptance includes a fresh customer connecting only their authorized property without a per-customer Render change; foreign-resource denial; draft ownership; property selection and discovery completeness; cancellation/retry; refresh/reconnect; and preservation of Ptomo's current connection and selected scope. Existing V1-037 reconnect/cancellation and other onboarding findings remain open. Switching a UI prop alone does not prove this acceptance.

The user has not confirmed saving the Ptomo grant. The push remains held pending deployment configuration and preservation of that existing connection. The correction above changes only the local onboarding component; production connections, credentials and schema were not changed by this follow-up.
