# Clerk production setup boundary, October 27

**Postponed by the user until after the customer demo.** Ownership of
`mimosaas.app` and DNS access are confirmed. The preparation below is recorded
for later; no domain attachment, DNS, Clerk or production key change has been
performed. Current work focuses on the existing app's core-functionality bugs.

The user confirms that only a Clerk test instance exists. The deployed public bundle independently uses test mode. No Clerk instance, Render key, domain, account, owner mapping or database record has been changed. The user prohibits access to their personal browser.

Clerk production setup requires an owned domain, DNS configuration, activation of a production instance and matching live frontend/backend keys. Production social sign-in requires its own provider credentials. These are deployment settings, not another analytics-code fix. [Official deployment instructions](https://clerk.com/docs/guides/development/deployment/production).

The user confirms ownership of `mimosaas.app` and access to edit DNS. Keys/passwords must not be pasted into chat. Setup can be performed in the user's Clerk/hosting dashboards without granting the agent browser access.

## Deployment investigation, October 27 at 17:40 UTC

The user confirms DNS access and identifies the current app address as
`https://marketforensics.onrender.com`. A fresh anonymous read verifies that
`81440a14` is live, the Node runtime reports production mode, and the served
frontend still uses Clerk **test** mode with a development Clerk domain. The
runtime's production mode and Clerk's instance mode are separate settings.

`render.yaml` declares a Node web service, `main`, automatic deployment,
`npm ci --include=dev && npm run build`, `npm run start`, and `/health`.
The build compiles the React frontend into `dist/public` and the Express server
into `dist/index.js`; the server serves both the UI and API. No custom domain is
declared in that file. It is a repository configuration, not a live Render
dashboard export. Available access has no Render API credential or connector,
so domains attached through Render's private settings and domains owned at a
registrar remain unverified. Do not infer that the user owns no domain.

[Read-only receipt](validation-2026-10-27-batches-1-5/deployment-configuration-1793122806977.json).
No DNS, Clerk instance, hosting setting, key, account or application code changed.
The subsequent user reply confirms `mimosaas.app`; domain ownership and DNS
access must not be requested again.

## Owned-domain preparation, October 27

Public DNS reads returned Cloudflare nameservers `newt.ns.cloudflare.com` and
`simone.ns.cloudflare.com`. The apex A and www CNAME queries returned SOA-only
answers; `app.mimosaas.app` returned NXDOMAIN. These observations do not inventory
the private zone or prove that the domain has no other services.

Recommend `app.mimosaas.app` for the application. First add that exact custom
domain to the existing Render service, then add a Cloudflare CNAME named `app`
targeting `marketforensics.onrender.com`, with DNS-only proxy status. Verify the
domain and certificate in Render. These are proposed manual steps; no DNS or
hosting settings have been changed. [Render custom domains](https://render.com/docs/custom-domains),
[Cloudflare DNS instructions](https://render.com/docs/configure-cloudflare-dns).

Before the later production sign-in cutover, two additional boundaries need
verification alongside the account ownership mapping below:

- `server/index.ts` currently limits Clerk script/connect/frame/form origins to
  its existing Clerk host patterns. A custom production Clerk hostname under
  `mimosaas.app` is not covered. Once Clerk supplies the exact instance hostname,
  make and test the smallest corresponding policy change before switching keys.
- Source OAuth routes use `APP_BASE_URL`, `RENDER_EXTERNAL_URL`, or request host
  to construct callbacks. Adding DNS does not change provider allowlists or
  these environment values. Trace each enabled provider's callback and return
  origin before using the new hostname for production source connections.

No application code, key, provider callback, owner ID or database row changed
during this preparation. Domain attachment alone does not complete sign-in or
provider-connection acceptance.

## Application-specific preparation

- Frontend: `client/src/main.tsx` reads `VITE_CLERK_PUBLISHABLE_KEY` at build time.
- Backend: `server/index.ts` fills `CLERK_PUBLISHABLE_KEY` from that value only when the former is absent. Any explicit backend value must therefore be changed consistently with the frontend; the matching `CLERK_SECRET_KEY` must belong to the same production instance. A deployment/rebuild is required for the frontend change.
- Existing authenticated API checks and database ownership use the Clerk user ID. Production and development users are separate; cloning instance settings does not transfer development users. Therefore a key-only change does not prove that a new production login can access the existing test campaigns. [Official instance boundaries](https://clerk.com/docs/guides/development/managing-environments).
- Preserve the present test workspace until the intended production account and test-data retention are decided. If any existing workspace must remain accessible, inventory and explicitly map its owner references to the corresponding ordinary production account in a separately reviewed migration. Do not assign every row to the first new login, broaden access or remove ownership checks.
- Configure the existing sign-in/sign-up paths and any selected social-provider callback settings in the new instance; settings do not all clone automatically. The Clerk dashboard supplies the exact DNS records. Verify domain/certificates before changing the running app's keys.

## Required acceptance after setup

Use ordinary customer accounts: sign up/sign in/sign out and return; recover an existing account; verify the intended owner's clients/campaigns; verify a second owner cannot read or mutate those records; switch accounts and prove prior cached data disappears. Then verify the relevant real provider consent/reconnect and resource grants. The existing isolated tests and public 401 checks remain valid but cannot replace these live identity checks.

The production configuration is not ready yet. No privileged login impersonation, authentication bypass or automatic owner rewrite is part of this plan.
