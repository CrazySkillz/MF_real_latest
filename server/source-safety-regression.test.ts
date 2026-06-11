import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

function readRoutesSource(): string {
  return fs.readFileSync(path.join(process.cwd(), "server", "routes-oauth.ts"), "utf8");
}

function readStorageSource(): string {
  return fs.readFileSync(path.join(process.cwd(), "server", "storage.ts"), "utf8");
}

function readRevenueWizardSource(): string {
  return fs.readFileSync(path.join(process.cwd(), "client", "src", "components", "AddRevenueWizardModal.tsx"), "utf8");
}

describe("source safety regression guards", () => {
  it("Shopify OAuth requires an explicitly whitelisted Shopify redirect URI", () => {
    const source = readRoutesSource();
    const helperStart = source.indexOf("const getShopifyRedirectUri = (): string | null => {");
    const helperEnd = source.indexOf("  // Build a Sheets A1 range prefix", helperStart);
    const routeStart = source.indexOf('app.post("/api/auth/shopify/connect"', helperStart);
    const callbackStart = source.indexOf("// Salesforce OAuth callback", routeStart);
    const helper = source.slice(helperStart, helperEnd);
    const shopifyConnectRoute = source.slice(routeStart, callbackStart);

    expect(helperStart).toBeGreaterThan(-1);
    expect(helper).toContain("const explicit = String(process.env.SHOPIFY_REDIRECT_URI || \"\").trim();");
    expect(helper).toContain("if (explicit) return explicit;");
    expect(helper).toContain("const appBase = toOrigin(process.env.APP_BASE_URL || process.env.RENDER_EXTERNAL_URL);");
    expect(helper).toContain('if (appBase) return `${appBase.replace(/\\/+$/, "")}/api/auth/shopify/callback`;');
    expect(helper).toContain("const shopifyBase = toOrigin(process.env.SHOPIFY_APP_BASE_URL);");
    expect(helper).not.toContain("req.get(\"origin\")");
    expect(helper).not.toContain("x-forwarded-host");
    expect(shopifyConnectRoute).toContain("const { campaignId, shopDomain } = req.body || {};");
    expect(shopifyConnectRoute.match(/getShopifyRedirectUri\(\)/g)?.length).toBe(1);
    expect(shopifyConnectRoute).toContain("Shopify OAuth requires SHOPIFY_REDIRECT_URI, SHOPIFY_APP_BASE_URL, or APP_BASE_URL");
    expect(shopifyConnectRoute).toContain('code: "SHOPIFY_OAUTH_REDIRECT_NOT_CONFIGURED"');
    expect(shopifyConnectRoute).toContain('requiredCallbackPath: "/api/auth/shopify/callback"');
    expect(shopifyConnectRoute).toContain('console.log(`[Shopify OAuth] Using redirect URI: ${redirectUri}`);');
    expect(shopifyConnectRoute).toContain('res.json({ authUrl, redirectUri, message: "Shopify OAuth flow initiated" });');
    expect(shopifyConnectRoute).not.toContain("process.env.APP_BASE_URL ||\n        process.env.RENDER_EXTERNAL_URL");
  });

  it("CSV revenue process refuses to update non-CSV revenue sources", () => {
    const source = readRoutesSource();
    const routeStart = source.indexOf('"/api/campaigns/:id/revenue/csv/process"');
    const routeEnd = source.indexOf('app.post("/api/campaigns/:id/revenue/sheets/preview"', routeStart);
    const route = source.slice(routeStart, routeEnd);

    expect(route).toContain('sourceType || "").trim().toLowerCase() !== "csv"');
    expect(route).toContain('Revenue source not found');
  });

  it("CSV spend process refuses to update non-CSV spend sources", () => {
    const source = readRoutesSource();
    const routeStart = source.indexOf('app.post("/api/campaigns/:id/spend/csv/process"');
    const routeEnd = source.indexOf('app.post("/api/campaigns/:id/spend/sheets/preview"', routeStart);
    const route = source.slice(routeStart, routeEnd);

    expect(route).toContain('sourceType || "").trim().toLowerCase() !== "csv"');
    expect(route).toContain('Spend source not found');
  });

  it("HubSpot revenue save refuses stale or wrong source IDs", () => {
    const source = readRoutesSource();
    const routeStart = source.indexOf('app.post("/api/campaigns/:id/hubspot/save-mappings"');
    const routeEnd = source.indexOf('app.post("/api/campaigns/:id/salesforce/save-mappings"', routeStart);
    const route = source.slice(routeStart, routeEnd);

    expect(route).toContain('storage.getRevenueSource(campaignId, requestedSourceId)');
    expect(route).toContain('sourceType || "").toLowerCase() !== "hubspot"');
    expect(route).toContain('HubSpot revenue source not found');
  });

  it("Salesforce revenue save refuses stale or wrong source IDs before updating", () => {
    const source = readRoutesSource();
    const routeStart = source.indexOf('app.post("/api/campaigns/:id/salesforce/save-mappings"');
    const routeEnd = source.indexOf('app.get("/api/salesforce/:campaignId/pipeline-proxy"', routeStart);
    const route = source.slice(routeStart, routeEnd);

    expect(route).toContain('storage.getRevenueSource(campaignId, existingSourceIdOrNull)');
    expect(route).toContain('sourceType || "").toLowerCase() !== "salesforce"');
    expect(route).toContain('Salesforce revenue source not found');
  });

  it("Shopify revenue save refuses stale or wrong source IDs", () => {
    const source = readRoutesSource();
    const routeStart = source.indexOf('app.post("/api/campaigns/:id/shopify/save-mappings"');
    const routeEnd = source.indexOf('app.post("/api/campaigns/:id/chat"', routeStart);
    const route = source.slice(routeStart, routeEnd);

    expect(route).toContain('storage.getRevenueSource(campaignId, requestedSourceId)');
    expect(route).toContain('sourceType || "").toLowerCase() !== "shopify"');
    expect(route).toContain('Shopify revenue source not found');
  });

  it("CRM and ecommerce connection deletes verify the connection belongs to the campaign", () => {
    const source = readRoutesSource();
    const hubspotStart = source.indexOf('app.delete("/api/hubspot/:campaignId/connection"');
    const salesforceStart = source.indexOf('app.delete("/api/salesforce/:campaignId/connection"', hubspotStart);
    const shopifyStart = source.indexOf('app.delete("/api/shopify/:campaignId/connection"', salesforceStart);
    const routeEnd = source.indexOf('app.post("/api/google-sheets/:campaignId/select-spreadsheet"', shopifyStart);
    const hubspotRoute = source.slice(hubspotStart, salesforceStart);
    const salesforceRoute = source.slice(salesforceStart, shopifyStart);
    const shopifyRoute = source.slice(shopifyStart, routeEnd);

    expect(hubspotRoute).toContain('storage.getHubspotConnections(campaignId)');
    expect(hubspotRoute).toContain("HubSpot connection not found");
    expect(salesforceRoute).toContain('storage.getSalesforceConnections(campaignId)');
    expect(salesforceRoute).toContain("Salesforce connection not found");
    expect(shopifyRoute).toContain('storage.getShopifyConnections(campaignId)');
    expect(shopifyRoute).toContain("Shopify connection not found");
  });

  it("individual revenue source delete proves campaign ownership before deleting source records", () => {
    const routesSource = readRoutesSource();
    const routeStart = routesSource.indexOf('app.delete("/api/campaigns/:id/revenue-sources/:sourceId"');
    const routeEnd = routesSource.indexOf('// Individual spend source delete', routeStart);
    const route = routesSource.slice(routeStart, routeEnd);

    expect(route).toContain("storage.getRevenueSource(campaignId, sourceId)");
    expect(route.indexOf("storage.deleteRevenueSource(sourceId)")).toBeGreaterThan(route.indexOf("storage.getRevenueSource(campaignId, sourceId)"));
    expect(route.indexOf("storage.deleteRevenueRecordsBySource(sourceId)")).toBeGreaterThan(route.indexOf("storage.getRevenueSource(campaignId, sourceId)"));
    expect(route).toContain("Revenue source not found");

    const storageSource = readStorageSource();
    const methodStart = storageSource.indexOf("async getRevenueSource(campaignId: string, sourceId: string)");
    const methodEnd = storageSource.indexOf("async createRevenueSource", methodStart);
    const method = storageSource.slice(methodStart, methodEnd);

    expect(method).toContain("eq(revenueSources.campaignId, campaignId)");
    expect(method).toContain("eq(revenueSources.isActive, true)");
  });

  it("individual spend source delete proves campaign ownership before deleting source records", () => {
    const routesSource = readRoutesSource();
    const routeStart = routesSource.indexOf('app.delete("/api/campaigns/:id/spend-sources/:sourceId"');
    const routeEnd = routesSource.indexOf('app.get("/api/campaigns/:id/revenue-totals"', routeStart);
    const route = routesSource.slice(routeStart, routeEnd);

    expect(route).toContain("storage.getSpendSources(campaignId)");
    expect(route.indexOf("storage.deleteSpendSource(sourceId)")).toBeGreaterThan(route.indexOf("storage.getSpendSources(campaignId)"));
    expect(route.indexOf("storage.deleteSpendRecordsBySource(sourceId)")).toBeGreaterThan(route.indexOf("storage.getSpendSources(campaignId)"));
    expect(route).toContain("Spend source not found");

    const storageSource = readStorageSource();
    const methodStart = storageSource.indexOf("async getSpendSource(campaignId: string, sourceId: string)");
    const methodEnd = storageSource.indexOf("async createSpendSource", methodStart);
    const method = storageSource.slice(methodStart, methodEnd);

    expect(method).toContain("eq(spendSources.campaignId, campaignId)");
    expect(method).toContain("eq(spendSources.isActive, true)");
  });

  it("CSV preview routes require campaign access before parsing uploaded files", () => {
    const routesSource = readRoutesSource();
    const revenueStart = routesSource.indexOf('"/api/campaigns/:id/revenue/csv/preview"');
    const revenueEnd = routesSource.indexOf('"/api/campaigns/:id/revenue/csv/process"', revenueStart);
    const spendStart = routesSource.indexOf('app.post("/api/campaigns/:id/spend/csv/preview"');
    const spendEnd = routesSource.indexOf('app.post("/api/campaigns/:id/spend/csv/process"', spendStart);
    const routes = [routesSource.slice(revenueStart, revenueEnd), routesSource.slice(spendStart, spendEnd)];

    for (const route of routes) {
      expect(route).toContain("requireCampaignAccessParamId");
      expect(route).toContain('uploadCsv.single("file")');
      expect(route.indexOf("requireCampaignAccessParamId")).toBeLessThan(route.indexOf('uploadCsv.single("file")'));
    }
  });

  it("connected data source list and preview routes require campaign access", () => {
    const routesSource = readRoutesSource();
    const listStart = routesSource.indexOf('app.get("/api/campaigns/:id/connected-data-sources"');
    const listEnd = routesSource.indexOf('app.get("/api/campaigns/:id/connected-data-sources/:sourceId/preview"', listStart);
    const previewStart = listEnd;
    const previewEnd = routesSource.indexOf('// Set primary Google Sheets connection', previewStart);
    const routes = [routesSource.slice(listStart, listEnd), routesSource.slice(previewStart, previewEnd)];

    for (const route of routes) {
      expect(route).toContain("requireCampaignAccessParamId");
      expect(route.indexOf("requireCampaignAccessParamId")).toBeLessThan(route.indexOf("async (req, res)"));
    }
  });

  it("Google Sheets connection list and primary-selection routes require campaign access", () => {
    const routesSource = readRoutesSource();
    const listStart = routesSource.indexOf('app.get("/api/campaigns/:id/google-sheets-connections"');
    const listEnd = routesSource.indexOf('app.get("/api/campaigns/:id/connected-data-sources"', listStart);
    const primaryStart = routesSource.indexOf('app.post("/api/campaigns/:id/google-sheets-connections/:connectionId/set-primary"');
    const primaryEnd = routesSource.indexOf('app.get("/api/google-sheets/check-connection/:campaignId"', primaryStart);
    const routes = [routesSource.slice(listStart, listEnd), routesSource.slice(primaryStart, primaryEnd)];

    for (const route of routes) {
      expect(route).toContain("requireCampaignAccessParamId");
      expect(route.indexOf("requireCampaignAccessParamId")).toBeLessThan(route.indexOf("async (req, res)"));
    }
  });

  it("Google Sheets primary selection proves the target connection before clearing existing primary flags", () => {
    const storageSource = readStorageSource();
    const methodStart = storageSource.indexOf("async setPrimaryGoogleSheetsConnection(campaignId: string, connectionId: string)");
    const methodEnd = storageSource.indexOf("async deleteGoogleSheetsConnection", methodStart);
    const method = storageSource.slice(methodStart, methodEnd);

    expect(method).toContain("const [targetConnection]");
    expect(method).toContain("if (!targetConnection) return false");
    expect(method.indexOf("if (!targetConnection) return false")).toBeLessThan(method.indexOf(".set({ isPrimary: false })"));
  });

  it("Connected Platforms does not expose child-only Google Sheets sources as a main platform", () => {
    const routesSource = readRoutesSource();
    const routeStart = routesSource.indexOf('app.get("/api/campaigns/:id/connected-platforms"');
    const routeEnd = routesSource.indexOf('app.get("/api/campaigns/:id/all-data-sources"', routeStart);
    const route = routesSource.slice(routeStart, routeEnd);

    expect(route).toContain("const mainGoogleSheetsConnected");
    expect(route).toContain("!!campaignWantsGoogleSheets");
    expect(route).toContain("connected: mainGoogleSheetsConnected");
    expect(route).toContain("connectedCampaignLevel: mainGoogleSheetsConnected");
    expect(route).toContain("analyticsPath: mainGoogleSheetsConnected");
    expect(route).toContain("lastConnectedAt: mainGoogleSheetsConnected ? googleSheetsConnection?.connectedAt : null");
  });

  it("Google Sheets spreadsheet picker can reuse campaign tokens across revenue purposes", () => {
    const routesSource = readRoutesSource();
    const routeStart = routesSource.indexOf('app.get("/api/google-sheets/:campaignId/spreadsheets"');
    const routeEnd = routesSource.indexOf("// Delete/reset Google Sheets connection", routeStart);
    const route = routesSource.slice(routeStart, routeEnd);

    expect(route).toContain("resolveSheetsTokenConnection");
    expect(route).toContain("storage.getGoogleSheetsConnections(campaignId, purpose)");
    expect(route).toContain("if ((!connection || !connection.accessToken) && purpose)");
    expect(route).toContain("storage.getGoogleSheetsConnections(campaignId)");
  });

  it("Google Sheets tab picker can reuse campaign tokens across revenue purposes", () => {
    const routesSource = readRoutesSource();
    const routeStart = routesSource.indexOf('app.get("/api/google-sheets/:spreadsheetId/sheets"');
    const routeEnd = routesSource.indexOf("// Select specific spreadsheet and sheet/tab", routeStart);
    const route = routesSource.slice(routeStart, routeEnd);

    expect(route).toContain("resolveSheetsTokenConnection");
    expect(route).toContain("storage.getGoogleSheetsConnections(String(campaignId), purpose ? String(purpose) : undefined)");
    expect(route).toContain("if ((!connection || !connection.accessToken) && purpose)");
    expect(route).toContain("storage.getGoogleSheetsConnections(String(campaignId))");
  });

  it("Google Sheets revenue connector waits for Next after tab selection", () => {
    const source = readRevenueWizardSource();
    const handlerStart = source.indexOf("const handleSheetsConnectionSuccess = async");
    const handlerEnd = source.indexOf("// If opened in edit mode for Sheets", handlerStart);
    const handler = source.slice(handlerStart, handlerEnd);

    expect(handler).toContain("setShowSheetsConnect(false);");
    expect(handler).toContain("setSheetsConnectionId(preferredId);");
    expect(handler).toContain("setSheetsConnections((prev) => {");
    expect(handler).toContain("Click Next to preview the sheet.");
    expect(handler).not.toContain("handleSheetsPreview(preferredId)");
    expect(handler).not.toContain('setStep("sheets_map");');
    expect(source.match(/onSuccess=\{handleSheetsConnectionSuccess\}/g)?.length).toBe(2);
  });

  it("Google Sheets revenue chooser labels selected tabs without spreadsheet IDs", () => {
    const source = readRevenueWizardSource();
    const helperStart = source.indexOf("const getSheetTabLabel = (connection: any) => {");
    const helperEnd = source.indexOf("  const [sheetsRevenueCol", helperStart);
    const helper = source.slice(helperStart, helperEnd);

    expect(helper).toContain("if (sheetName) return sheetName;");
    expect(source).toContain("{getSheetTabLabel(c)}");
    expect(source).not.toContain('{String(c.spreadsheetName || c.spreadsheetId || "Google Sheet")}');
  });

  it("legacy platform transfer routes require access to both campaigns", () => {
    const routesSource = readRoutesSource();
    const ga4Start = routesSource.indexOf('app.post("/api/ga4/transfer-connection"');
    const ga4End = routesSource.indexOf("// Transfer Google Sheets connection", ga4Start);
    const metaStart = routesSource.indexOf('app.post("/api/meta/transfer-connection"');
    const metaEnd = routesSource.indexOf("/**\n   * Get Meta analytics data", metaStart);
    const sheetsStart = routesSource.indexOf('app.post("/api/google-sheets/transfer-connection"');
    const sheetsEnd = routesSource.indexOf("// Transfer LinkedIn connection", sheetsStart);
    const linkedInStart = routesSource.indexOf('app.post("/api/linkedin/transfer-connection"');
    const linkedInEnd = routesSource.indexOf("// ============================================================================\n  // CUSTOM INTEGRATION", linkedInStart);
    const routes = [
      routesSource.slice(ga4Start, ga4End),
      routesSource.slice(metaStart, metaEnd),
      routesSource.slice(sheetsStart, sheetsEnd),
      routesSource.slice(linkedInStart, linkedInEnd),
    ];

    for (const route of routes) {
      expect(route).toContain("ensureCampaignAccess(req as any, res as any, fromCampaignId)");
      expect(route).toContain("ensureCampaignAccess(req as any, res as any, toCampaignId)");
      expect(route.indexOf("ensureCampaignAccess(req as any, res as any, fromCampaignId)")).toBeLessThan(route.indexOf("storage.create"));
      expect(route.indexOf("ensureCampaignAccess(req as any, res as any, toCampaignId)")).toBeLessThan(route.indexOf("storage.create"));
    }
  });

  it("legacy Google Sheets transfer deletes the source connection by connection ID, not campaign ID", () => {
    const routesSource = readRoutesSource();
    const routeStart = routesSource.indexOf('app.post("/api/google-sheets/transfer-connection"');
    const routeEnd = routesSource.indexOf("// Transfer LinkedIn connection", routeStart);
    const route = routesSource.slice(routeStart, routeEnd);

    expect(route).toContain("storage.deleteGoogleSheetsConnection(existingConnection.id)");
    expect(route).not.toContain("storage.deleteGoogleSheetsConnection(fromCampaignId)");
  });

  it("LinkedIn revenue cleanup only clears HubSpot pipeline config for LinkedIn-scoped HubSpot mappings", () => {
    const routesSource = readRoutesSource();
    const bulkStart = routesSource.indexOf("// 2b) If HubSpot pipeline proxy was configured for LinkedIn");
    const bulkEnd = routesSource.indexOf("// 3) Clear LinkedIn conversion value", bulkStart);
    const bulkCleanup = routesSource.slice(bulkStart, bulkEnd);
    const individualStart = routesSource.indexOf("// Clear HubSpot pipeline proxy if configured for LinkedIn");
    const individualEnd = routesSource.indexOf("} catch { /* ignore */ }", individualStart);
    const individualCleanup = routesSource.slice(individualStart, individualEnd);

    for (const cleanup of [bulkCleanup, individualCleanup]) {
      expect(cleanup).toContain('String(cfg?.platformContext || "").trim().toLowerCase()');
      expect(cleanup).toContain('hubspotContext === "linkedin"');
      expect(cleanup.indexOf('hubspotContext === "linkedin"')).toBeLessThan(cleanup.indexOf("storage.updateHubspotConnection"));
    }
  });

  it("LinkedIn disconnect routes are campaign-scoped and fail closed when no row is deleted", () => {
    const routesSource = readRoutesSource();
    const centralizedStart = routesSource.indexOf('app.delete("/api/linkedin/:campaignId/connection"');
    const centralizedEnd = routesSource.indexOf("// ============================================================================\n  // END CENTRALIZED LINKEDIN OAUTH", centralizedStart);
    const currentStart = routesSource.indexOf('app.delete("/api/linkedin/disconnect/:campaignId"');
    const currentEnd = routesSource.indexOf("// PATCH /api/linkedin/update/:campaignId", currentStart);
    const routes = [
      routesSource.slice(centralizedStart, centralizedEnd),
      routesSource.slice(currentStart, currentEnd),
    ];

    for (const route of routes) {
      expect(route).toContain("ensureCampaignAccess");
      expect(route.indexOf("ensureCampaignAccess")).toBeLessThan(route.indexOf("storage.deleteLinkedInConnection(campaignId)"));
      expect(route).toContain("LinkedIn connection not found");
    }

    const storageSource = readStorageSource();
    const methodStart = storageSource.indexOf("async deleteLinkedInConnection(campaignId: string)");
    const methodEnd = storageSource.indexOf("// Meta Connection methods", methodStart);
    const method = storageSource.slice(methodStart, methodEnd);

    expect(method).toContain("eq(linkedinConnections.campaignId, campaignId)");
  });

  it("LinkedIn spend refresh and edit mode preserve the existing source ID", () => {
    const routesSource = readRoutesSource();
    const routeStart = routesSource.indexOf('app.post("/api/campaigns/:id/spend/linkedin/process"');
    const routeEnd = routesSource.indexOf("// ============================================================================", routeStart + 1);
    const route = routesSource.slice(routeStart, routeEnd);

    expect(route).toContain("const existingSourceId");
    expect(route).toContain("storage.getSpendSource(campaignId, existingSourceId)");
    expect(route).toContain('sourceType || "").trim() !== "linkedin_api"');
    expect(route).toContain("LinkedIn spend source not found");
    expect(route.indexOf("storage.updateSpendSource(existingSourceId")).toBeGreaterThan(route.indexOf("storage.getSpendSource(campaignId, existingSourceId)"));

    const schedulerSource = fs.readFileSync(path.join(process.cwd(), "server", "auto-refresh-scheduler.ts"), "utf8");
    expect(schedulerSource).toContain("sourceId: String(source?.id || \"\")");
    expect(schedulerSource).toContain("reprocessLinkedInSpend(campaignId, linkedInSpend, liCfg)");
  });

  it("Meta disconnect routes are campaign-scoped and fail closed when no row is deleted", () => {
    const routesSource = readRoutesSource();
    const centralizedStart = routesSource.indexOf('app.delete("/api/campaigns/:campaignId/meta/connection"');
    const centralizedEnd = routesSource.indexOf("// ============================================================================\n  // END CENTRALIZED META/FACEBOOK OAUTH", centralizedStart);
    const currentStart = routesSource.indexOf('app.delete("/api/meta/:campaignId/connection"');
    const currentEnd = routesSource.indexOf("/**\n   * Transfer Meta connection", currentStart);
    const routes = [
      routesSource.slice(centralizedStart, centralizedEnd),
      routesSource.slice(currentStart, currentEnd),
    ];

    for (const route of routes) {
      expect(route).toContain("ensureCampaignAccess");
      expect(route.indexOf("ensureCampaignAccess")).toBeLessThan(route.indexOf("storage.deleteMetaConnection"));
      expect(route).toContain("Meta connection not found");
    }
  });

  it("Instagram connection status is campaign-scoped, read-only, and token-safe", () => {
    const routesSource = readRoutesSource();
    const routeStart = routesSource.indexOf('app.get("/api/instagram/:campaignId/connection"');
    const routeEnd = routesSource.indexOf("/**\n   * Connect Instagram in test mode", routeStart);
    const route = routesSource.slice(routeStart, routeEnd);

    expect(routeStart).toBeGreaterThanOrEqual(0);
    expect(route).toContain("ensureCampaignAccess");
    expect(route.indexOf("ensureCampaignAccess")).toBeLessThan(route.indexOf("storage.getInstagramConnection"));
    expect(route).toContain("selectedCampaignIds");
    expect(route).not.toContain("storage.createInstagramConnection");
    expect(route).not.toContain("storage.updateInstagramConnection");
    expect(route).not.toContain("storage.deleteInstagramConnection");
    expect(route).not.toContain("accessToken:");
    expect(route).not.toContain("refreshToken:");
    expect(route).not.toContain("encryptedTokens:");
  });

  it("Instagram test connection requires selected campaigns before replacing the campaign-scoped source", () => {
    const routesSource = readRoutesSource();
    const routeStart = routesSource.indexOf('app.post("/api/instagram/:campaignId/connect-test"');
    const routeEnd = routesSource.indexOf("/**\n   * Update selected Instagram campaigns", routeStart);
    const route = routesSource.slice(routeStart, routeEnd);

    expect(routeStart).toBeGreaterThanOrEqual(0);
    expect(route).toContain("ensureCampaignAccess");
    expect(route.indexOf("ensureCampaignAccess")).toBeLessThan(route.indexOf("storage.deleteInstagramConnection"));
    expect(route).toContain("selectedCampaignIds.length === 0");
    expect(route.indexOf("selectedCampaignIds.length === 0")).toBeLessThan(route.indexOf("storage.deleteInstagramConnection"));
    expect(route.indexOf("storage.deleteInstagramConnection")).toBeLessThan(route.indexOf("storage.createInstagramConnection"));
    expect(route).toContain("selectedCampaignIds: JSON.stringify(selectedCampaignIds)");
    expect(route).toContain('publisherPlatformFilter: "instagram"');
    expect(route).toContain('sourceContractVersion: "instagram_publisher_platform_v1"');
    expect(route).toContain("if (!(req.body as any)?.spendOnly)");
    expect(route).toContain('publisherPlatform: "instagram"');
    expect(route).toContain("storage.upsertInstagramDailyMetrics(rows as any)");
    expect(route.indexOf("storage.createInstagramConnection")).toBeLessThan(route.indexOf("storage.upsertInstagramDailyMetrics"));
    expect(route).not.toContain("refreshInstagram");
  });

  it("Instagram selected-campaign updates fail closed and clear stale rows only after selection changes", () => {
    const routesSource = readRoutesSource();
    const routeStart = routesSource.indexOf('app.patch("/api/instagram/:campaignId/selected-campaigns"');
    const routeEnd = routesSource.indexOf("/**\n   * Delete Instagram connection", routeStart);
    const route = routesSource.slice(routeStart, routeEnd);

    expect(routeStart).toBeGreaterThanOrEqual(0);
    expect(route).toContain("ensureCampaignAccess");
    expect(route.indexOf("ensureCampaignAccess")).toBeLessThan(route.indexOf("storage.getInstagramConnection"));
    expect(route).toContain("Instagram connection not found");
    expect(route).toContain("selectedCampaignIds.length === 0");
    expect(route.indexOf("selectedCampaignIds.length === 0")).toBeLessThan(route.indexOf("storage.deleteInstagramDailyMetrics"));
    expect(route).toContain("const selectionChanged = previousSelectedCampaignIds.join(\"\\n\") !== selectedCampaignIds.join(\"\\n\");");
    expect(route.indexOf("if (selectionChanged)")).toBeLessThan(route.indexOf("storage.updateInstagramConnection"));
    expect(route).toContain("storage.deleteInstagramDailyMetrics(parsedId.data)");
    expect(route).toContain("storage.deleteInstagramFinancialData(parsedId.data)");
    expect(route.indexOf("storage.deleteInstagramDailyMetrics")).toBeLessThan(route.indexOf("storage.deleteInstagramFinancialData"));
    expect(route.indexOf("storage.deleteInstagramFinancialData")).toBeLessThan(route.indexOf("storage.updateInstagramConnection"));
    expect(route).toContain("selectedCampaignIds: JSON.stringify(selectedCampaignIds)");
    expect(route).not.toContain("storage.createInstagramConnection");
    expect(route).not.toContain("upsertInstagramDailyMetrics");
    expect(route).not.toContain("refreshInstagram");
  });

  it("Instagram disconnect route is campaign-scoped and fails closed when no row is deleted", () => {
    const routesSource = readRoutesSource();
    const routeStart = routesSource.indexOf('app.delete("/api/instagram/:campaignId/connection"');
    const routeEnd = routesSource.indexOf("/**\n   * List Instagram campaigns", routeStart);
    const route = routesSource.slice(routeStart, routeEnd);

    expect(routeStart).toBeGreaterThanOrEqual(0);
    expect(route).toContain("ensureCampaignAccess");
    expect(route.indexOf("ensureCampaignAccess")).toBeLessThan(route.indexOf("storage.getInstagramConnection"));
    expect(route.indexOf("storage.getInstagramConnection")).toBeLessThan(route.indexOf("storage.deleteInstagramConnection"));
    expect(route).toContain("Instagram connection not found");
    expect(route).toContain("const deleted = await storage.deleteInstagramConnection(parsedId.data);");
    expect(route).not.toContain("storage.deleteInstagramDailyMetrics");
    expect(route).not.toContain("upsertInstagramDailyMetrics");
    expect(route).not.toContain("refreshInstagram");

    const storageSource = readStorageSource();
    const methodStart = storageSource.indexOf("async deleteInstagramConnection(campaignId: string)");
    const methodEnd = storageSource.indexOf("async deleteInstagramDailyMetrics", methodStart);
    const method = storageSource.slice(methodStart, methodEnd);

    expect(method).toContain("db.transaction");
    expect(method).toContain("eq(instagramConnections.campaignId, campaignId)");
    expect(method).toContain("deleteInstagramFinancialDataForCampaign(tx, campaignId)");
    expect(method.indexOf("deleteInstagramFinancialDataForCampaign(tx, campaignId)")).toBeLessThan(method.indexOf(".delete(instagramConnections)"));
    expect(method).toContain("tx.delete(instagramDailyMetrics).where(eq(instagramDailyMetrics.campaignId, campaignId))");

    const helperStart = storageSource.indexOf("const deleteInstagramFinancialDataForCampaign");
    const helperEnd = storageSource.indexOf("function hydrateDecryptedTokens", helperStart);
    const helper = storageSource.slice(helperStart, helperEnd);

    expect(helperStart).toBeGreaterThanOrEqual(0);
    expect(helper).toContain("eq(spendSources.campaignId, campaignId)");
    expect(helper).toContain('eq(spendSources.sourceType, "instagram_api")');
    expect(helper).toContain('eq(spendSources.platformContext, "instagram")');
    expect(helper).toContain("inArray(spendRecords.spendSourceId, instagramSpendSourceIds)");
    expect(helper).toContain('eq(spendRecords.sourceType, "instagram_api")');
    expect(helper).toContain("eq(revenueSources.campaignId, campaignId)");
    expect(helper).toContain('eq(revenueSources.platformContext, "instagram")');
    expect(helper).toContain("inArray(revenueRecords.revenueSourceId, instagramRevenueSourceIds)");
    expect(storageSource).toContain("async deleteInstagramFinancialData(campaignId: string)");
  });

  it("Instagram campaign list route is campaign-scoped, read-only, and selector-contract only", () => {
    const routesSource = readRoutesSource();
    const routeStart = routesSource.indexOf('app.get("/api/instagram/:campaignId/campaigns"');
    const routeEnd = routesSource.indexOf("/**\n   * Get TikTok connection status", routeStart);
    const route = routesSource.slice(routeStart, routeEnd);

    expect(routeStart).toBeGreaterThanOrEqual(0);
    expect(route).toContain("ensureCampaignAccess");
    expect(route.indexOf("ensureCampaignAccess")).toBeLessThan(route.indexOf("storage.getInstagramConnection"));
    expect(route).toContain("Instagram connection not found");
    expect(route).toContain("selectedCampaignIds");
    expect(route).toContain('publisherPlatform: "instagram"');
    expect(route).not.toContain("storage.createInstagramConnection");
    expect(route).not.toContain("storage.updateInstagramConnection");
    expect(route).not.toContain("storage.deleteInstagramConnection");
    expect(route).not.toContain("upsertInstagramDailyMetrics");
    expect(route).not.toContain("refreshInstagram");
    expect(route).not.toContain("accessToken:");
    expect(route).not.toContain("refreshToken:");
    expect(route).not.toContain("encryptedTokens:");
  });

  it("TikTok backend source-contract routes are campaign-scoped and do not seed analytics", () => {
    const routesSource = readRoutesSource();
    const connectStart = routesSource.indexOf('app.post("/api/tiktok/:campaignId/connect-test"');
    const updateStart = routesSource.indexOf('app.patch("/api/tiktok/:campaignId/selected-campaigns"', connectStart);
    const deleteStart = routesSource.indexOf('app.delete("/api/tiktok/:campaignId/connection"', updateStart);
    const listStart = routesSource.indexOf('app.get("/api/tiktok/:campaignId/campaigns"', deleteStart);
    const nextRoute = routesSource.indexOf("/**\n   * Read Instagram Campaign Overview metrics", listStart);
    const connectRoute = routesSource.slice(connectStart, updateStart);
    const updateRoute = routesSource.slice(updateStart, deleteStart);
    const deleteRoute = routesSource.slice(deleteStart, listStart);
    const listRoute = routesSource.slice(listStart, nextRoute);

    expect(connectStart).toBeGreaterThanOrEqual(0);
    expect(connectRoute).toContain("ensureCampaignAccess");
    expect(connectRoute).toContain("At least one TikTok campaign must be selected");
    expect(connectRoute).toContain("storage.deleteTikTokConnection(parsedId.data)");
    expect(connectRoute).toContain("storage.createTikTokConnection");
    expect(connectRoute).toContain('sourceContractVersion: "tiktok_campaign_daily_v1"');
    expect(connectRoute).not.toContain("upsertTikTokDailyMetrics");
    expect(connectRoute).not.toContain("refreshTikTok");

    expect(updateRoute).toContain("ensureCampaignAccess");
    expect(updateRoute.indexOf("storage.getTikTokConnection")).toBeLessThan(updateRoute.indexOf("storage.updateTikTokConnection"));
    expect(updateRoute).toContain("At least one TikTok campaign must be selected");
    expect(updateRoute).toContain("await storage.deleteTikTokDailyMetrics(parsedId.data)");
    expect(updateRoute).toContain("await storage.deleteTikTokFinancialData(parsedId.data)");
    expect(updateRoute.indexOf("storage.deleteTikTokDailyMetrics")).toBeLessThan(updateRoute.indexOf("storage.updateTikTokConnection"));
    expect(updateRoute.indexOf("storage.deleteTikTokFinancialData")).toBeLessThan(updateRoute.indexOf("storage.updateTikTokConnection"));
    expect(updateRoute).not.toContain("storage.createTikTokConnection");
    expect(updateRoute).not.toContain("upsertTikTokDailyMetrics");

    expect(deleteRoute).toContain("ensureCampaignAccess");
    expect(deleteRoute.indexOf("storage.getTikTokConnection")).toBeLessThan(deleteRoute.indexOf("storage.deleteTikTokConnection"));
    expect(deleteRoute).toContain("TikTok connection not found");
    expect(deleteRoute).toContain("const deleted = await storage.deleteTikTokConnection(parsedId.data);");
    expect(deleteRoute).not.toContain("upsertTikTokDailyMetrics");
    expect(deleteRoute).not.toContain("refreshTikTok");

    expect(listRoute).toContain("ensureCampaignAccess");
    expect(listRoute).toContain("storage.getTikTokConnection");
    expect(listRoute).toContain("selectedCampaignIds");

    const storageSource = readStorageSource();
    const methodStart = storageSource.indexOf("async deleteTikTokConnection(campaignId: string)");
    const methodEnd = storageSource.indexOf("async deleteTikTokDailyMetrics", methodStart);
    const method = storageSource.slice(methodStart, methodEnd);

    expect(method).toContain("db.transaction");
    expect(method).toContain("eq(tiktokConnections.campaignId, campaignId)");
    expect(method).toContain("tx.delete(tiktokDailyMetrics).where(eq(tiktokDailyMetrics.campaignId, campaignId))");
    expect(method).toContain("deleteTikTokFinancialDataForCampaign(tx, campaignId)");

    expect(storageSource).toContain("const deleteTikTokFinancialDataForCampaign = async");
    expect(storageSource).toContain('or(eq(spendSources.sourceType, "tiktok_api"), eq(spendSources.platformContext, "tiktok"))');
    expect(storageSource).toContain('and(eq(spendRecords.campaignId, campaignId), eq(spendRecords.sourceType, "tiktok_api"))');
    expect(storageSource).toContain('eq(revenueSources.platformContext, "tiktok")');
    expect(storageSource).toContain("await tx.delete(revenueRecords).where(inArray(revenueRecords.revenueSourceId, tiktokRevenueSourceIds))");
    expect(storageSource).toContain("async deleteTikTokFinancialData(campaignId: string)");
  });

  it("Instagram test refresh route is campaign-scoped, test-mode-only, and selected-source-only", () => {
    const routesSource = readRoutesSource();
    const routeStart = routesSource.indexOf('app.post("/api/instagram/:campaignId/refresh-test"');
    const routeEnd = routesSource.indexOf("/**\n   * Manually refresh live Instagram daily metrics", routeStart);
    const route = routesSource.slice(routeStart, routeEnd);

    expect(routeStart).toBeGreaterThanOrEqual(0);
    expect(route).toContain("ensureCampaignAccess");
    expect(route.indexOf("ensureCampaignAccess")).toBeLessThan(route.indexOf("storage.getInstagramConnection"));
    expect(route).toContain("Instagram connection not found");
    expect(route).toContain('String((connection as any).method || "") !== "test_mode"');
    expect(route).toContain("selectedCampaignIds.length === 0");
    expect(route.indexOf("selectedCampaignIds.length === 0")).toBeLessThan(route.indexOf("storage.upsertInstagramDailyMetrics"));
    expect(route).toContain('publisherPlatform: "instagram"');
    expect(route).toContain("storage.updateInstagramConnection");
    expect(route).not.toContain("MetaGraphAPIClient");
    expect(route).not.toContain("getMetaDailyMetrics");
    expect(route).not.toContain("accessToken:");
    expect(route).not.toContain("refreshToken:");
    expect(route).not.toContain("encryptedTokens:");
    expect(route).not.toContain("refreshInstagram");
  });

  it("Instagram manual refresh route imports only selected Instagram publisher-platform rows", () => {
    const routesSource = readRoutesSource();
    const routeStart = routesSource.indexOf('app.post("/api/instagram/:campaignId/refresh"');
    const routeEnd = routesSource.indexOf("/**\n   * Get Meta analytics data for a campaign", routeStart);
    const route = routesSource.slice(routeStart, routeEnd);

    expect(routeStart).toBeGreaterThanOrEqual(0);
    expect(route).toContain("ensureCampaignAccess");
    expect(route.indexOf("ensureCampaignAccess")).toBeLessThan(route.indexOf("storage.getInstagramConnection"));
    expect(route).toContain("Instagram connection not found");
    expect(route).toContain('String((connection as any).method || "") === "test_mode"');
    expect(route).toContain("Instagram connection requires reauthorization");
    expect(route).toContain("selectedCampaignIds.length === 0");
    expect(route.indexOf("selectedCampaignIds.length === 0")).toBeLessThan(route.indexOf("getCampaignDailyPlacementInsights"));
    expect(route).toContain("getCampaignDailyPlacementInsights(instagramCampaignId");
    expect(route).toContain('String(placement.publisherPlatform || "").trim().toLowerCase() !== "instagram"');
    expect(route).toContain('publisherPlatform: "instagram"');
    expect(route.indexOf('publisherPlatform: "instagram"')).toBeLessThan(route.indexOf("storage.upsertInstagramDailyMetrics"));
    expect(route).toContain("rows.length > 0 ? await storage.upsertInstagramDailyMetrics");
    expect(route).toContain("storage.updateInstagramConnection");
    expect(route).not.toContain("getMetaDailyMetrics");
    expect(route).not.toContain("storage.upsertMetaDailyMetrics");
    expect(route).not.toContain("accessToken:");
    expect(route).not.toContain("refreshToken:");
    expect(route).not.toContain("encryptedTokens:");
    expect(route).not.toContain("refreshInstagram");
  });

  it("ad-platform spend routes preserve source identity for Meta and Google Ads edits", () => {
    const routesSource = readRoutesSource();
    const manualStart = routesSource.indexOf('app.post("/api/campaigns/:id/spend/process/manual"');
    const manualEnd = routesSource.indexOf("const processConnectorDerivedSpend", manualStart);
    const manualRoute = routesSource.slice(manualStart, manualEnd);
    const importStart = routesSource.indexOf('app.post("/api/campaigns/:id/spend/ad-platform/import"');
    const importEnd = routesSource.indexOf("/**\n   * Get LinkedIn daily metrics", importStart);
    const importRoute = routesSource.slice(importStart, importEnd);

    expect(manualRoute).toContain("ensureCampaignAccess");
    expect(manualRoute).toContain('sourceType || "").trim() !== effectiveSourceType');
    expect(manualRoute).toContain('displayName || "").trim() !== effectiveDisplayName');
    expect(importRoute).toContain("const requestedSourceId");
    expect(importRoute).toContain('platformSourceType = "tiktok_api"');
    expect(importRoute).toContain('platformContext = "tiktok"');
    expect(importRoute).toContain("storage.getTikTokConnection(campaignId)");
    expect(importRoute).toContain("selectedCampaignIds.length === 0");
    expect(importRoute).toContain("storage.getTikTokDailyMetrics(campaignId, startDate, endDate)");
    expect(importRoute).toContain('selectedSet.has(String(row?.tiktokCampaignId || ""))');
    expect(importRoute).toContain("sourceType: platformSourceType");
    expect(importRoute).toContain("platformContext,");
    expect(importRoute).toContain("`${platformLabel} spend source not found`");
    expect(importRoute.indexOf("storage.deleteSpendRecordsBySource")).toBeGreaterThan(importRoute.indexOf("requestedSourceId"));
  });

  it("TikTok attributed revenue maps only exact selected TikTok campaign IDs", () => {
    const routesSource = readRoutesSource();
    const storageSource = readStorageSource();
    const schemaSource = fs.readFileSync(path.join(process.cwd(), "shared", "schema.ts"), "utf-8");

    expect(storageSource).toContain("export type RevenuePlatformContext = 'ga4' | 'linkedin' | 'meta' | 'google_ads' | 'instagram' | 'tiktok';");
    expect(schemaSource).toContain("export const insertRevenueSourceSchema");
    expect(schemaSource).toContain("platformContext: true,");
    expect(routesSource).toContain('const zCsvRevenuePlatformContext = z.enum(["ga4", "linkedin", "meta", "google_ads", "instagram", "tiktok"]);');
    expect(routesSource).toContain('const zSheetsRevenuePlatformContext = z.enum(["ga4", "linkedin", "meta", "google_ads", "instagram", "tiktok"]);');
    expect(routesSource).toContain('const zHubSpotRevenuePlatformContext = z.enum(["ga4", "linkedin", "meta", "google_ads", "instagram", "tiktok"]);');
    expect(routesSource).toContain('const zSalesforceRevenuePlatformContext = z.enum(["ga4", "linkedin", "meta", "google_ads", "instagram", "tiktok"]);');
    expect(routesSource).toContain('const zShopifyRevenuePlatformContext = z.enum(["ga4", "linkedin", "meta", "google_ads", "instagram", "tiktok"]);');
    expect(routesSource).toContain("sourcePlatformContext === 'tiktok' ? 'tiktok_revenue' : 'revenue'");
    expect(routesSource).toContain("platformContext === 'tiktok' ? 'tiktok_revenue' : 'revenue'");
    expect(routesSource).toContain("const getActiveTikTokCampaignIdSet = async (campaignId: string): Promise<Set<string>> => {");
    expect(routesSource).toContain('platformContext !== "tiktok"');
    expect(routesSource).toContain("mapping?.tiktokCampaignId");
    expect(routesSource).toContain('platformContext === "tiktok"');
    expect(routesSource).toContain('platformCtx === "tiktok"');
    expect(routesSource).toContain("await getActiveTikTokCampaignIdSet(campaignId)");
    expect(routesSource).not.toContain("tiktok spend weight");
    expect(routesSource).not.toContain("generic TikTok split");
  });

  it("Google Ads disconnect route is campaign-scoped and fails closed when no row is deleted", () => {
    const routesSource = readRoutesSource();
    const routeStart = routesSource.indexOf('app.delete("/api/google-ads/:campaignId/connection"');
    const routeEnd = routesSource.indexOf("/**\n   * Get Google Ads daily metrics", routeStart);
    const route = routesSource.slice(routeStart, routeEnd);
    const dailyStart = routesSource.indexOf('app.get("/api/google-ads/:campaignId/daily-metrics"');
    const dailyEnd = routesSource.indexOf('app.post("/api/google-ads/:campaignId/refresh"', dailyStart);
    const dailyRoute = routesSource.slice(dailyStart, dailyEnd);
    const selectStart = routesSource.indexOf('app.post("/api/google-ads/:campaignId/select-customer"');
    const selectEnd = routesSource.indexOf('app.post("/api/google-ads/:campaignId/connect-test"', selectStart);
    const selectRoute = routesSource.slice(selectStart, selectEnd);
    const testStart = selectEnd;
    const testEnd = routesSource.indexOf('app.get("/api/google-ads/:campaignId/connection"', testStart);
    const testRoute = routesSource.slice(testStart, testEnd);
    const selectedStart = routesSource.indexOf('app.patch("/api/google-ads/:campaignId/selected-campaigns"');
    const selectedEnd = routesSource.indexOf('app.post("/api/google-ads/:campaignId/enrich-ga4-revenue"', selectedStart);
    const selectedRoute = routesSource.slice(selectedStart, selectedEnd);

    expect(route).toContain("ensureCampaignAccess");
    expect(route.indexOf("ensureCampaignAccess")).toBeLessThan(route.indexOf("storage.deleteGoogleAdsConnection(campaignId)"));
    expect(route).toContain("clearGoogleAdsAttributedRevenueSourcesForCampaign(campaignId)");
    expect(route).toContain("Google Ads connection not found");
    expect(routesSource).toContain("const clearGoogleAdsAttributedRevenueSourcesForCampaign = async (campaignId: string) => {");
    expect(routesSource).toContain("const existing = await storage.getRevenueSources(campaignId, 'google_ads');");
    expect(routesSource).toContain("await storage.deleteRevenueRecordsBySource(sid);");
    expect(selectRoute).toContain("ensureCampaignAccess");
    expect(selectRoute).toContain("clearGoogleAdsAttributedRevenueSourcesForCampaign(campaignId)");
    expect(selectRoute).toContain("storage.deleteGoogleAdsDailyMetrics(campaignId)");
    expect(selectRoute.indexOf("clearGoogleAdsAttributedRevenueSourcesForCampaign(campaignId)")).toBeLessThan(selectRoute.indexOf("storage.createGoogleAdsConnection"));
    expect(selectRoute.indexOf("storage.deleteGoogleAdsDailyMetrics(campaignId)")).toBeLessThan(selectRoute.indexOf("storage.createGoogleAdsConnection"));
    expect(testRoute).toContain("ensureCampaignAccess");
    expect(testRoute).toContain("clearGoogleAdsAttributedRevenueSourcesForCampaign(campaignId)");
    expect(testRoute).toContain("storage.deleteGoogleAdsDailyMetrics(campaignId)");
    expect(testRoute.indexOf("clearGoogleAdsAttributedRevenueSourcesForCampaign(campaignId)")).toBeLessThan(testRoute.indexOf("storage.createGoogleAdsConnection"));
    expect(testRoute.indexOf("storage.deleteGoogleAdsDailyMetrics(campaignId)")).toBeLessThan(testRoute.indexOf("storage.createGoogleAdsConnection"));
    expect(selectedRoute).toContain("const selectionChanged = previousSelectedCampaignIds.join(\"\\n\") !== nextSelectedCampaignIds.join(\"\\n\");");
    expect(selectedRoute).toContain("clearGoogleAdsAttributedRevenueSourcesForCampaign(campaignId)");
    expect(selectedRoute.indexOf("clearGoogleAdsAttributedRevenueSourcesForCampaign(campaignId)")).toBeLessThan(selectedRoute.indexOf("storage.updateGoogleAdsConnection"));
    expect(dailyRoute).toContain("ensureCampaignAccess");
    expect(dailyRoute).toContain("const connection = await storage.getGoogleAdsConnection(campaignId);");
    expect(dailyRoute.indexOf("storage.getGoogleAdsConnection(campaignId)")).toBeLessThan(dailyRoute.indexOf("storage.getGoogleAdsDailyMetrics"));
    expect(dailyRoute).toContain("const selectedCampaignIds = (() => {");
    expect(dailyRoute).toContain("const selectedSet = new Set(selectedCampaignIds);");
    expect(dailyRoute.indexOf("const selectedSet = new Set(selectedCampaignIds);")).toBeLessThan(dailyRoute.indexOf("res.json({ success: true, metrics })"));
    expect(dailyRoute).toContain('selectedSet.size === 0 || selectedSet.has(String(row?.googleCampaignId || ""))');
    expect(dailyRoute).toContain("return res.json({ success: true, metrics: [] });");

    const storageSource = readStorageSource();
    const methodStart = storageSource.indexOf("async deleteGoogleAdsConnection(campaignId: string)");
    const methodEnd = storageSource.indexOf("async getGoogleAdsDailyMetrics", methodStart);
    const method = storageSource.slice(methodStart, methodEnd);

    expect(method).toContain("db.transaction");
    expect(method).toContain("eq(googleAdsConnections.campaignId, campaignId)");
    expect(method).toContain("tx.delete(googleAdsDailyMetrics).where(eq(googleAdsDailyMetrics.campaignId, campaignId))");
    expect(method.indexOf("tx.delete(googleAdsConnections)")).toBeLessThan(method.indexOf("tx.delete(googleAdsDailyMetrics)"));
  });

  it("Google Ads scheduler fails closed before refreshing stale or spend-only connections", () => {
    const schedulerSource = fs.readFileSync(path.join(process.cwd(), "server", "google-ads-scheduler.ts"), "utf8");
    const refreshStart = schedulerSource.indexOf("export async function refreshGoogleAdsForCampaign");
    const refreshEnd = schedulerSource.indexOf("/**\n * Start the Google Ads scheduler", refreshStart);
    const refreshRoute = schedulerSource.slice(refreshStart, refreshEnd);

    expect(refreshRoute).toContain("if ((connection as any).spendOnly) return;");
    expect(refreshRoute).toContain("const campaign = await storage.getCampaign(campaignId).catch(() => null);");
    expect(refreshRoute).toContain("Skipping refresh for missing campaign");
    expect(refreshRoute.indexOf("if ((connection as any).spendOnly) return;")).toBeLessThan(refreshRoute.indexOf("generateMockGoogleAdsData"));
    expect(refreshRoute.indexOf("storage.getCampaign(campaignId)")).toBeLessThan(refreshRoute.indexOf("generateMockGoogleAdsData"));
    expect(refreshRoute.indexOf("storage.getCampaign(campaignId)")).toBeLessThan(refreshRoute.indexOf("fetchRealGoogleAdsData"));
  });

  it("Instagram scheduler fails closed before refreshing stale, spend-only, test-mode, or unselected connections", () => {
    const schedulerSource = fs.readFileSync(path.join(process.cwd(), "server", "instagram-scheduler.ts"), "utf8");
    const refreshStart = schedulerSource.indexOf("export async function refreshInstagramForCampaign");
    const refreshEnd = schedulerSource.indexOf("export async function refreshAllInstagramMetrics", refreshStart);
    const refreshFn = schedulerSource.slice(refreshStart, refreshEnd);
    const indexSource = fs.readFileSync(path.join(process.cwd(), "server", "index.ts"), "utf8");

    expect(refreshStart).toBeGreaterThanOrEqual(0);
    expect(refreshFn).toContain("if ((connection as any).spendOnly) return");
    expect(refreshFn).toContain('String((connection as any).method || "") === "test_mode"');
    expect(refreshFn).toContain('String((connection as any).publisherPlatformFilter || "instagram") !== "instagram"');
    expect(refreshFn).toContain("const campaign = await storage.getCampaign(campaignId).catch(() => null);");
    expect(refreshFn).toContain("Skipping refresh for missing campaign");
    expect(refreshFn).toContain("if (!(connection as any).accessToken) return");
    expect(refreshFn).toContain("selectedCampaignIds.length === 0");
    expect(refreshFn.indexOf("selectedCampaignIds.length === 0")).toBeLessThan(refreshFn.indexOf("new MetaGraphAPIClient"));
    expect(refreshFn).toContain("getCampaignDailyPlacementInsights(instagramCampaignId");
    expect(refreshFn).toContain('String(placement.publisherPlatform || "").trim().toLowerCase() !== "instagram"');
    expect(refreshFn).toContain('publisherPlatform: "instagram"');
    expect(refreshFn).not.toContain("storage.deleteInstagramDailyMetrics");
    expect(refreshFn).not.toContain("storage.upsertMetaDailyMetrics");
    expect(indexSource).toContain('import { startInstagramScheduler } from "./instagram-scheduler";');
    expect(indexSource).toContain("startInstagramScheduler();");
  });

  it("TikTok scheduler fails closed before refreshing missing, spend-only, unselected, or live-deferred sources", () => {
    const schedulerSource = fs.readFileSync(path.join(process.cwd(), "server", "tiktok-scheduler.ts"), "utf8");
    const refreshStart = schedulerSource.indexOf("export async function refreshTikTokForCampaign");
    const refreshEnd = schedulerSource.indexOf("export async function refreshAllTikTokMetrics", refreshStart);
    const refreshFn = schedulerSource.slice(refreshStart, refreshEnd);
    const indexSource = fs.readFileSync(path.join(process.cwd(), "server", "index.ts"), "utf8");
    const routesSource = readRoutesSource();
    const manualRouteStart = routesSource.indexOf('app.post("/api/tiktok/:campaignId/refresh"');
    const manualRouteEnd = routesSource.indexOf('/**\n   * Read TikTok analytics daily rows', manualRouteStart);
    const manualRoute = routesSource.slice(manualRouteStart, manualRouteEnd);

    expect(refreshStart).toBeGreaterThanOrEqual(0);
    expect(refreshFn).toContain("if ((connection as any).spendOnly) return");
    expect(refreshFn).toContain("const campaign = await storage.getCampaign(campaignId).catch(() => null);");
    expect(refreshFn).toContain('markTikTokRefreshFailure(campaignId, "missing_campaign")');
    expect(refreshFn).toContain('markTikTokRefreshFailure(campaignId, "missing_advertiser")');
    expect(refreshFn).toContain("selectedCampaignIds.length === 0");
    expect(refreshFn).toContain('markTikTokRefreshFailure(campaignId, "missing_selected_campaigns")');
    expect(refreshFn).toContain('String((connection as any).method || "") !== "test_mode"');
    expect(refreshFn).toContain('markTikTokRefreshFailure(campaignId, "missing_access_token")');
    expect(refreshFn).toContain('markTikTokRefreshFailure(campaignId, "live_provider_refresh_deferred")');
    expect(refreshFn).toContain("storage.upsertTikTokDailyMetrics(rows as any)");
    expect(refreshFn).toContain("lastRefreshAt: new Date(), lastError: null");
    expect(refreshFn).not.toContain("storage.deleteTikTokDailyMetrics");
    expect(refreshFn.indexOf("selectedCampaignIds.length === 0")).toBeLessThan(refreshFn.indexOf("storage.upsertTikTokDailyMetrics"));
    expect(refreshFn.indexOf('String((connection as any).method || "") !== "test_mode"')).toBeLessThan(refreshFn.indexOf("storage.upsertTikTokDailyMetrics"));
    expect(manualRoute).toContain("ensureCampaignAccess(req as any, res as any, parsedId.data)");
    expect(manualRoute).toContain("refreshTikTokForCampaign(parsedId.data, connection)");
    expect(indexSource).toContain('import { startTikTokScheduler } from "./tiktok-scheduler";');
    expect(indexSource).toContain("startTikTokScheduler();");
  });

  it("Google Ads analytics reports do not fall back to Campaign DeepDive report types", () => {
    const pageSource = fs.readFileSync(path.join(process.cwd(), "client", "src", "pages", "google-ads-analytics.tsx"), "utf8");

    expect(pageSource).toContain("const normalizeGoogleAdsReportType = (type: any) => {");
    expect(pageSource).toContain("['overview', 'kpis', 'benchmarks', 'ads', 'insights', 'custom']");
    expect(pageSource).not.toContain("'performance_summary'");
    expect(pageSource).not.toContain('"performance_summary"');
  });

  it("Custom Integration UI routes require campaign access before read or mutation", () => {
    const routesSource = readRoutesSource();
    const bodyConnectStart = routesSource.indexOf('app.post("/api/custom-integration/connect"');
    const bodyConnectEnd = routesSource.indexOf('app.get("/api/custom-integration/:campaignId"', bodyConnectStart);
    const readStart = bodyConnectEnd;
    const readEnd = routesSource.indexOf('app.post("/api/webhook/custom-integration/:token"', readStart);
    const paramConnectStart = routesSource.indexOf('app.post("/api/custom-integration/:campaignId/connect"', readEnd);
    const paramConnectEnd = routesSource.indexOf('/**\n   * Disconnect (delete) custom integration', paramConnectStart);
    const transferStart = routesSource.indexOf('app.post("/api/custom-integration/transfer"', paramConnectEnd);
    const transferEnd = routesSource.indexOf('// Conversion Value Webhook', transferStart);

    const bodyConnectRoute = routesSource.slice(bodyConnectStart, bodyConnectEnd);
    const readRoutes = routesSource.slice(readStart, readEnd);
    const paramConnectRoute = routesSource.slice(paramConnectStart, paramConnectEnd);
    const transferRoute = routesSource.slice(transferStart, transferEnd);

    expect(bodyConnectRoute.indexOf("ensureCampaignAccess")).toBeGreaterThan(-1);
    expect(bodyConnectRoute.indexOf("ensureCampaignAccess")).toBeLessThan(bodyConnectRoute.indexOf("storage.createCustomIntegration"));
    expect(readRoutes).toContain("ensureCampaignAccess");
    expect(readRoutes.indexOf("requireCampaignAccessCampaignIdParam")).toBeLessThan(readRoutes.indexOf("upload.single('pdf')"));
    expect(paramConnectRoute.indexOf("ensureCampaignAccess")).toBeGreaterThan(-1);
    expect(paramConnectRoute.indexOf("ensureCampaignAccess")).toBeLessThan(paramConnectRoute.indexOf("storage.createCustomIntegration"));
    expect(transferRoute).toContain("fromCampaignId !== 'temp-campaign-setup'");
    expect(transferRoute.indexOf("ensureCampaignAccess")).toBeLessThan(transferRoute.indexOf("storage.getCustomIntegration(fromCampaignId)"));
    expect(transferRoute.indexOf("storage.createCustomIntegration")).toBeGreaterThan(transferRoute.indexOf("ensureCampaignAccess"));
  });
});
