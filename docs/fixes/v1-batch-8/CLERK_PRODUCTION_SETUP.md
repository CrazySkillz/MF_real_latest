# Clerk production setup boundary, October 27

The user confirms that only a Clerk test instance exists. The deployed public bundle independently uses test mode. No Clerk instance, Render key, domain, account, owner mapping or database record has been changed. The user prohibits access to their personal browser.

Clerk production setup requires an owned domain, DNS configuration, activation of a production instance and matching live frontend/backend keys. Production social sign-in requires its own provider credentials. These are deployment settings, not another analytics-code fix. [Official deployment instructions](https://clerk.com/docs/guides/development/deployment/production).

The requested input is the intended owned domain and whether the user can edit DNS. Keys/passwords must not be pasted into chat. Once those prerequisites are known, setup can be performed in the user's Clerk/hosting dashboards without granting the agent browser access.

## Application-specific preparation

- Frontend: `client/src/main.tsx` reads `VITE_CLERK_PUBLISHABLE_KEY` at build time.
- Backend: `server/index.ts` fills `CLERK_PUBLISHABLE_KEY` from that value only when the former is absent. Any explicit backend value must therefore be changed consistently with the frontend; the matching `CLERK_SECRET_KEY` must belong to the same production instance. A deployment/rebuild is required for the frontend change.
- Existing authenticated API checks and database ownership use the Clerk user ID. Production and development users are separate; cloning instance settings does not transfer development users. Therefore a key-only change does not prove that a new production login can access the existing test campaigns. [Official instance boundaries](https://clerk.com/docs/guides/development/managing-environments).
- Preserve the present test workspace until the intended production account and test-data retention are decided. If any existing workspace must remain accessible, inventory and explicitly map its owner references to the corresponding ordinary production account in a separately reviewed migration. Do not assign every row to the first new login, broaden access or remove ownership checks.
- Configure the existing sign-in/sign-up paths and any selected social-provider callback settings in the new instance; settings do not all clone automatically. The Clerk dashboard supplies the exact DNS records. Verify domain/certificates before changing the running app's keys.

## Required acceptance after setup

Use ordinary customer accounts: sign up/sign in/sign out and return; recover an existing account; verify the intended owner's clients/campaigns; verify a second owner cannot read or mutate those records; switch accounts and prove prior cached data disappears. Then verify the relevant real provider consent/reconnect and resource grants. The existing isolated tests and public 401 checks remain valid but cannot replace these live identity checks.

The production configuration is not ready yet. No privileged login impersonation, authentication bypass or automatic owner rewrite is part of this plan.
