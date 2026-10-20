# V1-123: operational impact of shared-service-account grants

Reviewed on 2026-10-20 after the user asked whether each user would need a Render entry. This is a clarification and unresolved acceptance requirement under existing finding **V1-123**, not a new finding count or release certification. Runtime code was not changed during this review.

## Current implementation, verified from code

- [Campaign creation](../../../client/src/pages/campaigns.tsx:1437) mounts `IntegratedGA4Auth` without a `connectionMode` override.
- [IntegratedGA4Auth](../../../client/src/components/IntegratedGA4Auth.tsx:18) defaults to `service-account`. Its OAuth button is only rendered for `connectionMode="oauth"`; its default screen asks for the shared service account to be added as a GA4 Viewer and for a property ID. This default is unchanged from baseline commit `777aae6f`; Batch 1 did not introduce that wizard mode.
- The existing GA4 shared-credential path already has an application-level property allowlist in [ga4-service-account.ts](../../../server/utils/ga4-service-account.ts:40). Batch 1 adds a distinct owner/client/provider/resource boundary through [storage.ts](../../../server/storage.ts:676).
- Each grant must exactly match `ownerId`, `clientId`, `provider` and `resourceId`. A different customer owner, client or resource needs another approved entry. The same tuple can cover multiple owned campaigns for that client/resource. This is not a per-login operation, but it is **not one configuration entry for every future customer**.
- The shared GA4 connect route checks the grant before provider access at [routes-oauth.ts](../../../server/routes-oauth.ts:16191); create/update and saved-connection credential hydration enforce it again.
- A separate [GA4ConnectionFlow](../../../client/src/components/GA4ConnectionFlow.tsx:235) starts the existing customer Google OAuth endpoint, [routes-oauth.ts](../../../server/routes-oauth.ts:16427). It is used from campaign detail and GA4 analytics. The grant checks are conditional on `service_account`, so this environment grant is not required for the customer's own OAuth connection. This code trace does **not** certify successful deployed OAuth onboarding, provider setup, discovery, renewal or reconnect.

## User impact and release boundary

**With the current default new-campaign flow, onboarding another customer/client/property through shared credentials requires operator configuration.** Preparing one Ptomo grant would preserve that particular connection after deploying Batch 1; it would not provide self-service onboarding for all future users.

The earlier chat description of a "one-time setup" omitted this per-customer/client/resource scope and was incomplete. The original audit already identified the default shared-service-account reachability in [SERVICE_ACCOUNT_CUSTOMER_BOUNDARY.md](../../audits/v1-2026-10-19/SERVICE_ACCOUNT_CUSTOMER_BOUNDARY.md). The Batch 1 handoff needed to connect that evidence explicitly to the operational burden introduced by customer-specific grants.

The 15 route checks and storage/hydration checks prove the stated authorization boundary, including denial when grants are missing. They do not prove that a legitimate fresh customer can finish the current creation wizard without an operator editing Render. **V1-123 security checks are locally verified; default self-service onboarding remains unproven and unsuitable for the stated V1 goal in this configuration.**

## Required follow-up within the existing architecture

Track this under primary Batch 1 finding V1-123, with the customer-onboarding acceptance work in Batch 2. Preserve the security boundary. Establish and validate the existing customer-owned Google authorization path through new campaign creation, while retaining any shared-credential option only with an explicit, supported operator-managed scope. Do not silently grant resources based only on a submitted property ID or a shared service account's ability to read it.

Required acceptance includes a fresh customer connecting only their authorized property without a per-customer Render change; foreign-resource denial; draft ownership; property selection and discovery completeness; cancellation/retry; refresh/reconnect; and preservation of Ptomo's current connection and selected scope. Existing V1-037 reconnect/cancellation and other onboarding findings remain open. Switching a UI prop alone does not prove this acceptance.

The user has not confirmed saving the Ptomo grant. The push remains held. This review changes no runtime behavior, production connection, credential or schema.
