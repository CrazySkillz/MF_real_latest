import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getInternalAutoRefreshToken, isInternalAutoRefreshRequest } from "./internal-request-auth";
import { buildGoogleAdsOAuthAuthorization, resolveGoogleAdsOAuthAuthorization } from "./google-ads-oauth-authorization";
import { resolveOAuthStateSigningSecret } from "./utils/tokenVault";

const routes = () => readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf8");

describe("GA4 Insights authentication and tenant scope", () => {
  it("derives stable purpose-separated OAuth state secrets and fails closed without a production base secret", () => {
    const keys = ["NODE_ENV", "SESSION_SECRET", "TOKEN_ENCRYPTION_KEY", "ENCRYPTION_KEY"] as const;
    const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
    const resolve = (purpose: string, specificSecret?: string) => resolveOAuthStateSigningSecret({
      specificSecret,
      purpose,
      label: purpose,
      developmentFallback: `dev-${purpose}`,
    });

    try {
      process.env.NODE_ENV = "production";
      delete process.env.SESSION_SECRET;
      delete process.env.ENCRYPTION_KEY;
      process.env.TOKEN_ENCRYPTION_KEY = "stable-production-token-secret";

      const ga4 = resolve("ga4");
      expect(resolve("ga4")).toBe(ga4);
      expect(resolve("google-sheets")).not.toBe(ga4);

      const explicit = resolve("ga4", "provider-specific-secret");
      process.env.TOKEN_ENCRYPTION_KEY = "rotated-base-secret";
      expect(resolve("ga4", "provider-specific-secret")).toBe(explicit);
      expect(resolve("ga4")).not.toBe(ga4);

      delete process.env.TOKEN_ENCRYPTION_KEY;
      expect(() => resolve("ga4")).toThrow("ga4 OAuth state secret is not configured");
    } finally {
      for (const key of keys) {
        const value = previous[key];
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });

  it("keeps later-release ad connectors outside the current GA4 Insights source chooser", () => {
    const modal = readFileSync(join(process.cwd(), "client", "src", "components", "AddSpendWizardModal.tsx"), "utf8");
    const selectStart = modal.indexOf('{step === "select" && (');
    const selectEnd = modal.indexOf('{step === "ad_platform" && (', selectStart);
    const currentReleaseChooser = modal.slice(selectStart, selectEnd);

    expect(currentReleaseChooser).not.toContain("Google Ads");
    expect(currentReleaseChooser).not.toContain("LinkedIn");
    expect(currentReleaseChooser).not.toContain("Meta");
    expect(currentReleaseChooser).not.toContain("Instagram");
  });

  it("fails closed for ownerless and other-owner campaigns", () => {
    const source = routes();
    const start = source.indexOf("const ensureCampaignAccess = async");
    const end = source.indexOf("async function requireCampaignAccessParamId", start);
    const access = source.slice(start, end);

    expect(access).toContain('if (!ownerId) {');
    expect(access).toContain('res.status(404).json({ success: false, message: "Campaign not found" });');
    expect(access).not.toContain("storage.updateCampaign(campaignId, { ownerId: actorId }");
    expect(access).toContain("if (ownerId !== actorId)");
  });

  it("does not expose or claim ownerless campaigns in the list route", () => {
    const source = routes();
    const start = source.indexOf('app.get("/api/campaigns"');
    const end = source.indexOf('app.post("/api/campaigns"', start);
    const route = source.slice(start, end);

    expect(route).toContain("if (ownerId !== actorId) return false");
    expect(route).not.toContain("const toClaim");
    expect(route).not.toContain("storage.updateCampaign");
    expect(route).toContain("const ownedClients = await storage.getClients(actorId)");
    expect(route).toContain("const ownedClientIds = new Set");
    expect(route).toContain('if (!ownedClientIds.has(String(c?.clientId || ""))) return false');
    expect(route).toContain('message: "Client not found"');
  });

  it("requires an owned client before campaign create or reassignment", () => {
    const source = routes();
    const create = source.slice(source.indexOf('app.post("/api/campaigns"'), source.indexOf("// Update a campaign by ID"));
    const update = source.slice(source.indexOf('app.patch("/api/campaigns/:id"'), source.indexOf("app.delete(", source.indexOf('app.patch("/api/campaigns/:id"')));

    for (const route of [create, update]) {
      expect(route).toContain("await storage.getClients(actorId)");
      expect(route).toContain('message: "Client not found"');
    }
    expect(create.indexOf("await storage.getClients(actorId)")).toBeLessThan(create.indexOf("storage.createCampaign"));
    expect(update.indexOf("await storage.getClients(actorId)")).toBeLessThan(update.indexOf("storage.updateCampaign"));
  });

  it("invalidates campaign-scoped GA4 facts before refreshing a changed filter or reporting timezone", () => {
    const source = routes();
    const start = source.indexOf('app.patch("/api/campaigns/:id"');
    const end = source.indexOf('// Get a single campaign by ID', start);
    const route = source.slice(start, end);

    expect(route).toContain("const ga4DailyScopeChanged =");
    expect(route).toContain("await storage.updateCampaignWithGA4DailyInvalidation(campaignId, validatedData)");
    expect(route).toContain("await runGA4DailyRefreshPipeline({ campaignId, suppressAlerts: true })");
    const storageSource = readFileSync(join(process.cwd(), "server", "storage.ts"), "utf8");
    const methodStart = storageSource.indexOf("async updateCampaignWithGA4DailyInvalidation");
    const methodEnd = storageSource.indexOf("async deleteCampaign", methodStart);
    const method = storageSource.slice(methodStart, methodEnd);
    expect(method).toContain("return db.transaction(async (tx: any) =>");
    expect(method).toContain("await tx.delete(ga4DailyMetrics).where(eq(ga4DailyMetrics.campaignId, id))");
  });

  it("requires an owned campaign property and exact saved-filter scope for Insights history", () => {
    const source = routes();
    for (const routeStart of ['app.get("/api/kpis/:id/analytics"', 'app.get("/api/benchmarks/:id/analytics"']) {
      const start = source.indexOf(routeStart);
      const end = source.indexOf("app.", start + routeStart.length);
      const route = source.slice(start, end);
      expect(route).toContain('String(req.query.ga4Scope || "") === "1"');
      expect(route).toContain('platformType || "").toLowerCase() !== "google_analytics"');
      expect(route).toContain("await storage.getGA4Connections(campaignId)");
      expect(route).toContain("buildGA4InsightsHistoryScopeMarker(");
      expect(route).toContain("propertyId,");
      expect(route).toContain("filterGA4InsightsHistoryByScope");
      expect(route).toContain('return res.status(404).json({ message: "GA4 analytics scope not found" })');
    }
  });

  it("fails financial inputs closed when native or imported currencies do not match the campaign", () => {
    const source = routes();
    expect(source).toContain("assertGA4InsightsFinancialCurrencyScope");
    expect(source).toContain('assertGA4InsightsFinancialCurrencyScope(campaign, sources, totals.currency, "Imported revenue")');
    expect(source).toContain('assertGA4InsightsFinancialCurrencyScope(campaign, sources, scopedTotals?.currency, "Spend")');
    expect(source).toContain('assertGA4InsightsFinancialCurrencyScope(campaign, [], result?.currencyCode, "GA4 native revenue", true)');
    expect(source).toContain('assertGA4InsightsFinancialCurrencyScope(campaign, sourceDefinitions, null, "Imported revenue")');
    expect(source).toContain('assertGA4InsightsFinancialCurrencyScope(campaign, sourceDefinitions, null, "Spend")');
    const helper = readFileSync(join(process.cwd(), "shared", "ga4-insights.ts"), "utf8");
    expect(helper).toContain("currency does not match campaign currency");
  });

  it("fails closed before Google Sheets source OAuth can attach to an ownerless campaign", () => {
    const source = routes();
    const start = source.indexOf('app.get("/api/auth/google-sheets/callback"');
    const end = source.indexOf("app.get(", start + 20);
    const route = source.slice(start, end);
    const sheetsBranch = route.slice(route.indexOf("// ---- Google Sheets OAuth flow ----"));

    expect(sheetsBranch).toContain('if (!ownerId) {');
    expect(sheetsBranch).toContain('return sendPopupError("Campaign not found.");');
    expect(sheetsBranch).not.toContain("storage.updateCampaign(String(campaignId), { ownerId: actorId }");
    expect(sheetsBranch.indexOf("if (!ownerId)")).toBeLessThan(sheetsBranch.indexOf("https://oauth2.googleapis.com/token"));
  });

  it("rechecks GA4 callback ownership before token exchange or connection replacement", () => {
    const source = routes();
    const start = source.indexOf('app.get("/api/auth/google-sheets/callback"');
    const end = source.indexOf("app.get(", start + 20);
    const route = source.slice(start, end);
    const ga4Branch = route.slice(route.indexOf("if (rawState.startsWith('ga4:'))"), route.indexOf("// ---- Google Sheets OAuth flow ----"));

    expect(ga4Branch).toContain("const ga4ActorId = getActorId(req)");
    expect(ga4Branch).toContain("await storage.getCampaign(ga4CampaignId)");
    expect(ga4Branch).toContain("trim() !== ga4ActorId");
    expect(ga4Branch.indexOf("const ga4ActorId")).toBeLessThan(ga4Branch.indexOf("https://oauth2.googleapis.com/token"));
    expect(ga4Branch.indexOf("const ga4ActorId")).toBeLessThan(ga4Branch.indexOf("storage.createGA4Connection"));
  });

  it("guards every retained GA4 OAuth entry and callback before external or persisted work", () => {
    const source = routes();
    const slices = [
      source.slice(source.indexOf('app.post("/api/auth/google/integrated-connect"'), source.indexOf('app.get("/api/auth/google/simulation-auth"')),
      source.slice(source.indexOf('app.get("/api/auth/google/callback"'), source.indexOf('app.get("/api/campaigns/:id/ga4-connection-status"')),
      source.slice(source.indexOf('app.post("/api/auth/google/url"'), source.indexOf('app.post("/api/auth/google/callback"')),
      source.slice(source.indexOf('app.post("/api/auth/google/callback"'), source.indexOf('app.get("/api/ga4/check-connection/:campaignId"')),
    ];

    for (const route of slices) {
      expect(route).toContain("ensureCampaignAccess");
    }
    expect(slices[1].indexOf("ensureCampaignAccess")).toBeLessThan(slices[1].indexOf("realGA4Client.handleCallback"));
    expect(slices[3].indexOf("ensureCampaignAccess")).toBeLessThan(slices[3].indexOf("https://oauth2.googleapis.com/token"));
    expect(slices[0]).toContain("signGA4OAuthState");
    expect(slices[1]).toContain("verifyGA4OAuthState");
    expect(slices[2]).toContain("signGA4OAuthState");
    expect(slices[3]).toContain("verifyGA4OAuthState");
    expect(source).toContain("signGoogleSheetsOAuthState");
    expect(source).toContain("verifyGoogleSheetsOAuthState");
  });

  it("does not expose OAuth secrets or provider-controlled text in callback logs or scripts", () => {
    const source = routes();
    const legacyStart = source.indexOf('app.post("/api/ga4/oauth-exchange"');
    const legacyEnd = source.indexOf('// Google Sheets OAuth endpoints', legacyStart);
    const legacy = source.slice(legacyStart, legacyEnd);
    const sheetsStart = source.indexOf('app.get("/api/auth/google-sheets/callback"');
    const sheetsEnd = source.indexOf('const HUBSPOT_OAUTH_STATE_TTL_MS', sheetsStart);
    const sheets = source.slice(sheetsStart, sheetsEnd);
    const callbackStart = source.indexOf('app.get("/api/auth/google/callback"');
    const callbackEnd = source.indexOf('// Check real GA4 connection status', callbackStart);
    const callback = source.slice(callbackStart, callbackEnd);
    const hubspotStart = source.indexOf('app.get("/api/auth/hubspot/callback"');
    const hubspotEnd = source.indexOf('// Salesforce OAuth callback', hubspotStart);
    const hubspot = source.slice(hubspotStart, hubspotEnd);

    expect(legacy).not.toContain("Request body being sent to Google");
    expect(legacy).not.toContain("client_secret_length");
    expect(legacy).not.toContain("clientSecretLength");
    expect(sheets).not.toContain("<p>Error: ${error}</p>");
    expect(sheets).not.toContain("error: '${error.message}'");
    expect(source).toContain("const serializeOAuthPopupJson");
    expect(source).toContain('.replace(/</g, "\\\\u003c")');
    expect(source).toContain("const escapeOAuthPopupHtml");
    expect(callback).not.toContain("<p>Error: ${error}</p>");
    expect(callback).not.toContain("<p>Error: ${result.error}</p>");
    expect(callback).not.toContain("error: '${result.error}'");
    expect(hubspot).toContain("HubSpot authorization was not completed.");
    expect(hubspot).not.toContain("error: '${String(error)}'");
    expect(hubspot).toContain("serializeOAuthPopupJson(portalName)");
    expect(hubspot).not.toContain("<p>${error?.message");
  });

  it("fails directly consumed HubSpot and Salesforce OAuth paths closed by tenant", () => {
    const source = routes();
    const hubspotSecretStart = source.indexOf("const getHubSpotOAuthStateSecret");
    const hubspotSecretEnd = source.indexOf("const signHubSpotOAuthState", hubspotSecretStart);
    const hubspotSecret = source.slice(hubspotSecretStart, hubspotSecretEnd);
    const hubspotCallbackStart = source.indexOf('app.get("/api/auth/hubspot/callback"');
    const hubspotCallbackEnd = source.indexOf("// Get spreadsheets for campaign", hubspotCallbackStart);
    const hubspotCallback = source.slice(hubspotCallbackStart, hubspotCallbackEnd);
    const salesforceConnectStart = source.indexOf('app.post("/api/auth/salesforce/connect"');
    const salesforceConnectEnd = source.indexOf("// Shopify OAuth - Start connection", salesforceConnectStart);
    const salesforceConnect = source.slice(salesforceConnectStart, salesforceConnectEnd);
    const salesforceCallbackStart = source.indexOf('app.get("/api/auth/salesforce/callback"');
    const salesforceCallbackEnd = source.indexOf("// Shopify OAuth callback", salesforceCallbackStart);
    const salesforceCallback = source.slice(salesforceCallbackStart, salesforceCallbackEnd);

    expect(hubspotSecret).toContain('process.env.NODE_ENV === "production"');
    expect(hubspotSecret).toContain("HubSpot OAuth state secret is not configured");
    expect(hubspotCallback).toContain("ensureCampaignAccess");
    expect(hubspotCallback.indexOf("ensureCampaignAccess")).toBeLessThan(hubspotCallback.indexOf("https://api.hubapi.com/oauth/v1/token"));
    expect(salesforceConnect).toContain("ensureCampaignAccess");
    expect(salesforceConnect.indexOf("ensureCampaignAccess")).toBeLessThan(salesforceConnect.indexOf("salesforcePkceStore.set"));
    expect(salesforceCallback).toContain("ensureCampaignAccess");
    expect(salesforceCallback.indexOf("ensureCampaignAccess")).toBeLessThan(salesforceCallback.indexOf("/services/oauth2/token"));
  });

  it("fails the directly consumed Google Ads OAuth path closed by tenant and production signing configuration", () => {
    const source = routes();
    const secretStart = source.indexOf("const getGoogleAdsOAuthStateSecret");
    const secretEnd = source.indexOf("const signGoogleAdsOAuthState", secretStart);
    const secret = source.slice(secretStart, secretEnd);
    const connectStart = source.indexOf('app.post("/api/auth/google-ads/connect"');
    const callbackStart = source.indexOf('app.get("/api/auth/google-ads/callback"');
    const connect = source.slice(connectStart, callbackStart);
    const callbackEnd = source.indexOf("app.", callbackStart + 20);
    const callback = source.slice(callbackStart, callbackEnd);
    const selectStart = source.indexOf('app.post("/api/google-ads/:campaignId/select-customer"');
    const selectEnd = source.indexOf('app.post("/api/google-ads/:campaignId/connect-test"', selectStart);
    const selectCustomer = source.slice(selectStart, selectEnd);
    const storageSource = readFileSync(join(process.cwd(), "server", "storage.ts"), "utf8");
    const replaceStart = storageSource.indexOf("async replaceGoogleAdsConnection");
    const replaceEnd = storageSource.indexOf("async updateGoogleAdsConnection", replaceStart);
    const replaceConnection = storageSource.slice(replaceStart, replaceEnd);

    expect(secret).toContain('process.env.NODE_ENV === "production"');
    expect(secret).toContain("Google Ads OAuth state secret is not configured");
    expect(connect).toContain("ensureCampaignAccess");
    expect(callback).toContain("ensureCampaignAccess");
    expect(callback.indexOf("ensureCampaignAccess")).toBeLessThan(callback.indexOf("GoogleAdsClient.exchangeCodeForToken"));
    expect(callback).not.toContain("<p>${authError}</p>");
    expect(callback).not.toContain("<p>${error.message");
    expect(source).toContain("serializeOAuthPopupJson(customers)");
    expect(callback).not.toContain("tokens:${tokenData}");
    expect(connect).toContain("GOOGLE_ADS_DEVELOPER_TOKEN");
    expect(selectCustomer).toContain("storage.replaceGoogleAdsConnection");
    expect(selectCustomer.indexOf("provider.getDailyMetrics")).toBeLessThan(selectCustomer.indexOf("storage.replaceGoogleAdsConnection"));
    expect(selectCustomer).not.toContain("storage.deleteGoogleAdsConnection");
    expect(selectCustomer).not.toContain("storage.deleteGoogleAdsDailyMetrics");
    expect(selectCustomer).toContain("if (!spendOnly) await clearGoogleAdsAttributedRevenueSourcesForCampaign(campaignId)");
    expect(replaceConnection).toContain("db.transaction");
    expect(replaceConnection).toContain("tx.delete(googleAdsConnections)");
    expect(replaceConnection).toContain("tx.delete(googleAdsDailyMetrics)");
    expect(replaceConnection).toContain("tx.insert(googleAdsConnections)");
    expect(replaceConnection).toContain("dailyMetrics.length > 0");
  });

  it("keeps Google Ads tokens encrypted and binds customer selection to owner, campaign, account, and expiry", () => {
    const previousKey = process.env.TOKEN_ENCRYPTION_KEY;
    process.env.TOKEN_ENCRYPTION_KEY = "11".repeat(32);
    try {
      const authorization = buildGoogleAdsOAuthAuthorization({
        campaignId: "campaign-a",
        actorId: "owner-a",
        accessToken: "access-secret",
        refreshToken: "refresh-secret",
        customers: [{ id: "123", descriptiveName: "Primary", manager: false, currencyCode: "EUR", timeZone: "Europe/Amsterdam" }],
        spendOnly: true,
        now: 1_000,
      });
      expect(JSON.stringify(authorization)).not.toContain("access-secret");
      expect(resolveGoogleAdsOAuthAuthorization({ authorization, campaignId: "campaign-a", actorId: "owner-a", customerId: "123", now: 1_001 })).toEqual({
        accessToken: "access-secret",
        refreshToken: "refresh-secret",
        expiresIn: 3600,
        customerName: "Primary",
        managerAccountId: undefined,
        customerCurrency: "EUR",
        customerTimeZone: "Europe/Amsterdam",
        spendOnly: true,
      });
      expect(resolveGoogleAdsOAuthAuthorization({ authorization, campaignId: "campaign-b", actorId: "owner-a", customerId: "123", now: 1_001 })).toBeNull();
      expect(resolveGoogleAdsOAuthAuthorization({ authorization, campaignId: "campaign-a", actorId: "owner-b", customerId: "123", now: 1_001 })).toBeNull();
      expect(resolveGoogleAdsOAuthAuthorization({ authorization, campaignId: "campaign-a", actorId: "owner-a", customerId: "999", now: 1_001 })).toBeNull();
      expect(resolveGoogleAdsOAuthAuthorization({ authorization, campaignId: "campaign-a", actorId: "owner-a", customerId: "123", now: 601_001 })).toBeNull();
    } finally {
      if (previousKey === undefined) delete process.env.TOKEN_ENCRYPTION_KEY;
      else process.env.TOKEN_ENCRYPTION_KEY = previousKey;
    }
  });

  it("requires both loopback origin and the process-secret token for internal refresh access", () => {
    const token = getInternalAutoRefreshToken();
    expect(isInternalAutoRefreshRequest({
      socket: { remoteAddress: "127.0.0.1" },
      headers: { "x-internal-auto-refresh-token": token },
    })).toBe(true);
    expect(isInternalAutoRefreshRequest({
      socket: { remoteAddress: "203.0.113.8" },
      headers: { "x-internal-auto-refresh-token": token },
    })).toBe(false);
    expect(isInternalAutoRefreshRequest({
      socket: { remoteAddress: "127.0.0.1" },
      headers: { "x-internal-auto-refresh-token": "wrong" },
    })).toBe(false);
  });
});
