import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

function readRoutesSource(): string {
  return fs.readFileSync(path.join(process.cwd(), "server", "routes-oauth.ts"), "utf8");
}

function readPdfParserSource(): string {
  return fs.readFileSync(path.join(process.cwd(), "server", "services", "pdf-parser.ts"), "utf8");
}

function readStorageSource(): string {
  return fs.readFileSync(path.join(process.cwd(), "server", "storage.ts"), "utf8");
}

function readSharedSchemaSource(): string {
  return fs.readFileSync(path.join(process.cwd(), "shared", "schema.ts"), "utf8");
}

function readMigrationSource(fileName: string): string {
  return fs.readFileSync(path.join(process.cwd(), "migrations", fileName), "utf8");
}

function readSchedulerSource(): string {
  return fs.readFileSync(path.join(process.cwd(), "server", "scheduler.ts"), "utf8");
}

function readAutoRefreshSchedulerSource(): string {
  return fs.readFileSync(path.join(process.cwd(), "server", "auto-refresh-scheduler.ts"), "utf8");
}

function readGoogleSheetsAggregateSource(): string {
  return fs.readFileSync(path.join(process.cwd(), "server", "utils", "google-sheets-aggregate-source.ts"), "utf8");
}

function readRevenueWizardSource(): string {
  return fs.readFileSync(path.join(process.cwd(), "client", "src", "components", "AddRevenueWizardModal.tsx"), "utf8");
}

function readCampaignsPageSource(): string {
  return fs.readFileSync(path.join(process.cwd(), "client", "src", "pages", "campaigns.tsx"), "utf8");
}

function readCampaignDetailSource(): string {
  return fs.readFileSync(path.join(process.cwd(), "client", "src", "pages", "campaign-detail.tsx"), "utf8");
}

function readGoogleSheetsDataPageSource(): string {
  return fs.readFileSync(path.join(process.cwd(), "client", "src", "pages", "google-sheets-data.tsx"), "utf8");
}

function readGoogleSheetsKpiModalSource(): string {
  return fs.readFileSync(path.join(process.cwd(), "client", "src", "pages", "google-sheets-analytics", "GoogleSheetsKpiModal.tsx"), "utf8");
}

function readGoogleSheetsBenchmarkModalSource(): string {
  return fs.readFileSync(path.join(process.cwd(), "client", "src", "pages", "google-sheets-analytics", "GoogleSheetsBenchmarkModal.tsx"), "utf8");
}

function readGoogleSheetsReportModalSource(): string {
  return fs.readFileSync(path.join(process.cwd(), "client", "src", "pages", "google-sheets-analytics", "GoogleSheetsReportModal.tsx"), "utf8");
}

function readCustomIntegrationAnalyticsSource(): string {
  return fs.readFileSync(path.join(process.cwd(), "client", "src", "pages", "custom-integration-analytics.tsx"), "utf8");
}

function readUploadAdditionalDataModalSource(): string {
  return fs.readFileSync(path.join(process.cwd(), "client", "src", "components", "UploadAdditionalDataModal.tsx"), "utf8");
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

  it("Google Sheets main analytics connection list excludes child-purpose sheets", () => {
    const routesSource = readRoutesSource();
    const routeStart = routesSource.indexOf('app.get("/api/campaigns/:id/google-sheets-connections"');
    const routeEnd = routesSource.indexOf('app.get("/api/campaigns/:id/connected-data-sources"', routeStart);
    const route = routesSource.slice(routeStart, routeEnd);

    expect(route).toContain('const scope = (req.query as any)?.scope ? String((req.query as any).scope) : undefined;');
    expect(route).toContain('const campaignWantsGoogleSheets = campaignPlatformRaw.includes(\'google-sheets\') || campaignPlatformRaw.includes(\'google sheets\');');
    expect(route).toContain('if (scope !== "main") return true;');
    expect(route).toContain('return !!campaignWantsGoogleSheets && (!connPurpose || connPurpose === "general");');
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

  it("Google Sheets connection delete proves campaign ownership before deleting a requested connection", () => {
    const routesSource = readRoutesSource();
    const routeStart = routesSource.indexOf('app.delete("/api/google-sheets/:campaignId/connection"');
    const routeEnd = routesSource.indexOf("// Select spreadsheet for campaign", routeStart);
    const route = routesSource.slice(routeStart, routeEnd);

    expect(route).toContain("const before = await storage.getGoogleSheetsConnections(campaignId);");
    expect(route).toContain("targetConnection = (before || []).find");
    expect(route).toContain("Google Sheets connection not found");
    expect(route).toContain("await storage.deleteGoogleSheetsConnection(String(targetConnection.id));");
    expect(route).not.toContain("await storage.deleteGoogleSheetsConnection(connectionId as string);");
    expect(route.indexOf("targetConnection = (before || []).find")).toBeLessThan(route.indexOf("await storage.deleteGoogleSheetsConnection(String(targetConnection.id));"));
  });

  it("Google Sheets lifecycle clears stale cached rows and mappings on reconnect, replacement, and delete", () => {
    const routesSource = readRoutesSource();
    const storageSource = readStorageSource();
    const selectStart = routesSource.indexOf('app.post("/api/google-sheets/select-spreadsheet"');
    const selectEnd = routesSource.indexOf("// Select multiple spreadsheet sheets/tabs in one call", selectStart);
    const selectRoute = routesSource.slice(selectStart, selectEnd);
    const multiStart = routesSource.indexOf('app.post("/api/google-sheets/select-spreadsheet-multiple"');
    const multiEnd = routesSource.indexOf("// Check Google Sheets connection status", multiStart);
    const multiRoute = routesSource.slice(multiStart, multiEnd);
    const revenueDeleteStart = routesSource.indexOf('app.delete("/api/campaigns/:id/revenue-sources/:sourceId"');
    const revenueDeleteEnd = routesSource.indexOf("// Individual spend source delete", revenueDeleteStart);
    const revenueDeleteRoute = routesSource.slice(revenueDeleteStart, revenueDeleteEnd);

    expect(storageSource).toContain("setData.cachedData = (connection as any).cachedData;");
    expect(storageSource).toContain("setData.lastDataRefreshAt = (connection as any).lastDataRefreshAt;");
    expect(storageSource).toContain(".set({ isActive: false, columnMappings: null, cachedData: null, lastDataRefreshAt: null } as any)");
    expect(selectRoute).toContain("columnMappings: null");
    expect(selectRoute).toContain("cachedData: null");
    expect(selectRoute).toContain("lastDataRefreshAt: null");
    expect(multiRoute).toContain("columnMappings: null as any");
    expect(multiRoute).toContain("cachedData: null as any");
    expect(multiRoute).toContain("lastDataRefreshAt: null as any");
    expect(revenueDeleteRoute).toContain("cachedData: null as any");
    expect(revenueDeleteRoute).toContain("lastDataRefreshAt: null as any");
  });

  it("Google Sheets spend source delete proves backing sheet connection ownership before cleanup", () => {
    const routesSource = readRoutesSource();
    const routeStart = routesSource.indexOf('app.delete("/api/campaigns/:id/spend-sources/:sourceId"');
    const routeEnd = routesSource.indexOf('app.get("/api/campaigns/:id/revenue-totals"', routeStart);
    const route = routesSource.slice(routeStart, routeEnd);

    expect(route).toContain("const campaignSheetsConnections = await storage.getGoogleSheetsConnections(campaignId).catch(() => [] as any[]);");
    expect(route).toContain("const ownsConnection = (Array.isArray(campaignSheetsConnections) ? campaignSheetsConnections : [])");
    expect(route).toContain("if (ownsConnection) await storage.deleteGoogleSheetsConnection(deletingSheetsConnectionId);");
    expect(route.indexOf("const ownsConnection")).toBeLessThan(route.indexOf("if (ownsConnection) await storage.deleteGoogleSheetsConnection(deletingSheetsConnectionId);"));
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

  it("Create Campaign Google Sheets setup uses the main-platform purpose", () => {
    const source = readCampaignsPageSource();
    const blockStart = source.indexOf("selectedWizardPlatform === 'google-sheets'");
    const blockEnd = source.indexOf("selectedWizardPlatform === 'linkedin'", blockStart);
    const block = source.slice(blockStart, blockEnd);

    expect(block).toContain("<SimpleGoogleSheetsAuth");
    expect(block).toContain('selectionMode="replace"');
    expect(block).toContain('purpose="general"');
    expect(block).toContain("setConnectedPlatformsInDialog");
    expect(block).toContain("setWizardStep(5)");
  });

  it("Create Campaign exposes Custom Integration through existing campaign-scoped setup routes", () => {
    const source = readCampaignsPageSource();
    const blockStart = source.indexOf("selectedWizardPlatform === 'custom-integration'");
    const block = source.slice(blockStart, blockStart + 2500);

    expect(source).toContain('id: "custom-integration"');
    expect(source).toContain('name: "Custom Integration"');
    expect(blockStart).toBeGreaterThan(-1);
    expect(block).toContain("uploadCustomIntegrationPdf");
    expect(block).toContain("connectCustomIntegrationEmail");
    expect(block.slice(block.lastIndexOf("<Button", block.indexOf("Manual Upload")), block.indexOf("Manual Upload"))).toContain('variant="outline"');
    expect(block.slice(block.lastIndexOf("<Button", block.indexOf("Set Up Email Forwarding")), block.indexOf("Set Up Email Forwarding"))).toContain('variant="outline"');
    expect(source).toContain("fetch(`/api/custom-integration/${draftCampaignId}/upload-pdf`");
    expect(source).toContain('apiRequest("POST", `/api/custom-integration/${draftCampaignId}/connect`');
    expect(source).toContain("setConnectedPlatformsInDialog(prev => prev.includes('custom-integration') ? prev : [...prev, 'custom-integration'])");
    expect(source).toContain("setWizardStep(5)");
  });

  it("Connected Platforms Google Sheets setup persists campaign platform intent", () => {
    const source = readCampaignDetailSource();
    const blockStart = source.indexOf('platform.platform === "Google Sheets" ? (');
    const blockEnd = source.indexOf(') : platform.platform === "LinkedIn Ads"', blockStart);
    const block = source.slice(blockStart, blockEnd);

    expect(block).toContain("<SimpleGoogleSheetsAuth");
    expect(block).toContain('selectionMode="append"');
    expect(block).toContain('purpose="general"');
    expect(block).toContain('normalized === "google-sheets" || normalized === "google sheets"');
    expect(block).toContain('apiRequest("PATCH", `/api/campaigns/${campaign.id}`');
    expect(block).toContain('platform: [...currentPlatforms, "google-sheets"].join(", ")');
    expect(block).toContain('queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "connected-platforms"] });');
  });

  it("Google Sheets analytics exposes the Add Dataset path", () => {
    const source = readGoogleSheetsDataPageSource();
    const headerStart = source.indexOf('<div className="flex items-center justify-between gap-6 mb-6">');
    const headerEnd = source.indexOf('{/* Sheet Selector and Active Sheet Indicator */}', headerStart);
    const header = source.slice(headerStart, headerEnd);

    expect(header).toContain("canAddMoreSheets");
    expect(header).toContain("setShowAddDatasetModal(true)");
    expect(header).toContain("Add Dataset");
    expect(source).toContain("googleSheetsOnly={true}");
  });

  it("Google Sheets analytics page requests main-scope connections", () => {
    const source = readGoogleSheetsDataPageSource();

    expect(source).toContain('queryKey: ["/api/campaigns", campaignId, "google-sheets-connections", "main"]');
    expect(source).toContain('fetch(`/api/campaigns/${campaignId}/google-sheets-connections?scope=main`)');
  });

  it("Google Sheets analytics data route reads only main Google Sheets source rows", () => {
    const routesSource = readRoutesSource();
    const routeStart = routesSource.indexOf('app.get("/api/campaigns/:id/google-sheets-data"');
    const routeEnd = routesSource.indexOf('app.post("/api/campaigns/:id/google-sheets-refresh"', routeStart);
    const route = routesSource.slice(routeStart, routeEnd);

    expect(route).toContain("const isMainGoogleSheetsConnection = (conn: any) => {");
    expect(route).toContain("return !!campaignWantsGoogleSheets &&");
    expect(route).toContain('(!connPurpose || connPurpose === "general")');
    expect(route).toContain("const getMainGoogleSheetsConnections = async () =>");
    expect(route).toContain("const allConnections = await getMainGoogleSheetsConnections();");
    expect(route).not.toContain("const allConnections = await storage.getGoogleSheetsConnections(campaignId);");
  });

  it("Google Sheets raw cache refresh updates only main Google Sheets source rows", () => {
    const source = readAutoRefreshSchedulerSource();
    const functionStart = source.indexOf("export async function refreshGoogleSheetsDataForCampaign");
    const functionEnd = source.indexOf("export async function runDailyAutoRefreshOnce", functionStart);
    const refreshFunction = source.slice(functionStart, functionEnd);

    expect(functionStart).toBeGreaterThan(-1);
    expect(refreshFunction).toContain("const campaign = await storage.getCampaign(campaignId);");
    expect(refreshFunction).toContain('campaignPlatformRaw.includes("google-sheets") || campaignPlatformRaw.includes("google sheets")');
    expect(refreshFunction).toContain("if (!campaignWantsGoogleSheets) return false;");
    expect(refreshFunction).toContain('const purpose = String(c?.purpose || "").trim().toLowerCase();');
    expect(refreshFunction).toContain('&& (!purpose || purpose === "general")');
    expect(refreshFunction).toContain("c.isActive !== false");
    expect(refreshFunction).toContain("c.spreadsheetId !== 'pending'");
    const filterIndex = refreshFunction.indexOf("const activeConnections");
    const cacheWriteIndex = refreshFunction.indexOf("await storage.updateGoogleSheetsConnection(conn.id");
    expect(filterIndex).toBeGreaterThan(-1);
    expect(cacheWriteIndex).toBeGreaterThan(filterIndex);
  });

  it("Google Sheets scheduler reprocess includes Google-Sheets-scoped confirmed financial sources", () => {
    const source = readAutoRefreshSchedulerSource();

    expect(source).toContain('const refreshableRevenueContexts = ["ga4", "linkedin", "meta", "google_ads", "google_sheets"] as const;');
    expect(source).toContain('const crmRevenueContexts = ["ga4", "meta", "google_ads", "google_sheets"] as const;');
    expect(source).toContain("for (const ctx of refreshableRevenueContexts)");
    expect(source).toContain("for (const ctx of crmRevenueContexts)");
    expect(source).toContain("if (await reprocessGoogleSheetsRevenue(campaignId, sheetRevenue, revCfg))");
  });

  it("Google Sheets main platform feeds Campaign DeepDive aggregate without raw sheet revenue/spend rows", () => {
    const routesSource = readRoutesSource();
    const storageSource = readStorageSource();
    const schedulerSource = readSchedulerSource();
    const aggregateSource = readGoogleSheetsAggregateSource();
    const outcomeStart = routesSource.indexOf('app.get("/api/campaigns/:id/outcome-totals"');
    const outcomeEnd = routesSource.indexOf('// New route: Get all GA4 connections for a campaign', outcomeStart);
    const outcomeRoute = routesSource.slice(outcomeStart, outcomeEnd);

    expect(routesSource).toContain('import { buildGoogleSheetsPlatformSourceForAggregate } from "./utils/google-sheets-aggregate-source";');
    expect(outcomeRoute).toContain("storage.getGoogleSheetsConnections(campaignId).catch(() => [] as any[])");
    expect(outcomeRoute).toContain("const googleSheetsFinancials = await getGoogleSheetsConfirmedFinancialsForAggregate(campaignId, startDate, endDate);");
    expect(outcomeRoute).toContain("const googleSheets = buildGoogleSheetsPlatformSourceForAggregate(campaign, googleSheetsConnections as any[], googleSheetsFinancials);");
    expect(outcomeRoute).toContain("mainPlatformSources: { googleAds, instagram, tiktok, googleSheets }");
    expect(routesSource).toContain("const executiveGoogleSheetsConnections = await storage.getGoogleSheetsConnections(id).catch(() => [] as any[]);");
    expect(routesSource).toContain("const executiveGoogleSheetsFinancials = await getGoogleSheetsConfirmedFinancialsForAggregate(id, startDate, endDate);");
    expect(routesSource).toContain("const googleSheets = buildGoogleSheetsPlatformSourceForAggregate(campaign, executiveGoogleSheetsConnections, executiveGoogleSheetsFinancials);");
    expect(schedulerSource).toContain('import { buildGoogleSheetsPlatformSourceForAggregate }');
    expect(schedulerSource).toContain("const googleSheetsConnections = await storage.getGoogleSheetsConnections(campaignId).catch(() => [] as any[]);");
    expect(schedulerSource).toContain("...(googleSheets ? [googleSheets] : [])");
    expect(storageSource).toContain("cachedData: (googleSheetsConnections as any).cachedData");
    expect(storageSource).toContain("lastDataRefreshAt: (googleSheetsConnections as any).lastDataRefreshAt");
    expect(aggregateSource).toContain('&& (!purpose || purpose === "general")');
    expect(routesSource).toContain('storage.getRevenueBreakdownBySource(campaignId, startDate, endDate, "google_sheets")');
    expect(routesSource).toContain('String(source?.platformContext || "").trim().toLowerCase() === "google_sheets"');
    expect(aggregateSource).toContain("const hasConfirmedRevenue = confirmedRevenue > 0 && revenueSourceIds.length > 0;");
    expect(aggregateSource).toContain("const hasConfirmedSpend = confirmedSpend > 0 && spendSourceIds.length > 0;");
    expect(aggregateSource).toContain("metrics.revenue = hasConfirmedRevenue");
    expect(aggregateSource).toContain("metrics.spend = hasConfirmedSpend");
    expect(aggregateSource).toContain('metric: "revenue", reason: "Google Sheets confirmed revenue requires an active google_sheets-scoped revenue source"');
    expect(aggregateSource).toContain('metric: "spend", reason: "Google Sheets spend requires an active google_sheets-scoped spend source"');
    expect(aggregateSource).toContain('includedMetrics.push("revenue")');
    expect(aggregateSource).toContain('includedMetrics.push("spend")');
  });

  it("Google Sheets analytics exposes the strict Total Revenue source flow", () => {
    const page = readGoogleSheetsDataPageSource();
    const modal = readRevenueWizardSource();
    const routesSource = readRoutesSource();
    const loadedStart = page.indexOf(") : sheetsData ? (");
    const loadedOverviewStart = page.indexOf('<TabsContent value="data" className="mt-6 space-y-6">', loadedStart);
    const loadedOverviewEnd = page.indexOf('<TabsContent value="summary"', loadedOverviewStart);
    const loadedOverview = page.slice(loadedOverviewStart, loadedOverviewEnd);

    expect(page).toContain('platformContext="google_sheets"');
    expect(page).toContain('fetch(`/api/campaigns/${campaignId}/revenue-sources?platformContext=google_sheets`)');
    expect(page).toContain('fetch(`/api/campaigns/${campaignId}/revenue-totals?platformContext=google_sheets&dateRange=all`)');
    expect(routesSource).toContain('normalizedDateRange === "all"');
    expect(loadedOverviewStart).toBeGreaterThan(-1);
    expect(loadedOverviewEnd).toBeGreaterThan(loadedOverviewStart);
    expect(loadedOverview).toContain("{renderGoogleSheetsFinancialCards()}");
    expect(page).toContain("const renderGoogleSheetsFinancialCards = () => (");
    expect(page).toContain("Total Revenue");
    expect(loadedOverview.indexOf("renderGoogleSheetsFinancialCards")).toBeLessThan(loadedOverview.indexOf("Spreadsheet Data"));
    expect(page).toContain("Google Sheets Revenue Sources");
    expect(page).toContain("Sources contributing to Google Sheets Total Revenue.");
    expect(page).toContain("This removes only the selected Google Sheets revenue source. Total Revenue will be recalculated.");
    expect(modal).toContain("platformContext === 'google_sheets' ? 'google_sheets_revenue'");
    expect(modal).toContain("Choose the confirmed revenue source for Google Sheets analytics.");
    expect(routesSource).toContain('if (ctx === "google_sheets") return "google_sheets_revenue";');
    expect(routesSource).toContain('storage.getRevenueSources(campaignId, \'google_sheets\')');
    expect(routesSource).toContain('"google_sheets_revenue"');
  });

  it("Google Sheets KPIs use source-backed mapped metrics without blocking explicit sheet financial columns", () => {
    const page = readGoogleSheetsDataPageSource();
    const modal = readGoogleSheetsKpiModalSource();

    expect(page).toContain("const googleSheetsKpiMetricOptions = useMemo<GoogleSheetsKpiMetricOption[]>");
    expect(page).toContain("const googleSheetsConfirmedFinancialMetricOptions = useMemo<GoogleSheetsKpiMetricOption[]>");
    expect(page).toContain('key: "overview.total_revenue"');
    expect(page).toContain('key: "overview.total_spend"');
    expect(page).toContain('key: "overview.roas"');
    expect(page).toContain('key: "overview.roi"');
    expect(page).toContain('sourceKind: "confirmed_financial"');
    expect(page).toContain('sourceKind: "sheet_column"');
    expect(page).toContain('valueSource: "confirmed_financial_overview"');
    expect(page).toContain('source: "google_sheets_overview_financials"');
    expect(page).toContain("return [...googleSheetsConfirmedFinancialMetricOptions, ...sheetOptions];");
    expect(page).toContain("GOOGLE_SHEETS_KPI_NEAR_TARGET_BAND_PCT = 5");
    expect(page).toContain("computeEffectiveDeltaPct");
    expect(page).toContain("classifyKpiBand");
    expect(page).toContain("computeAttainmentFillPct");
    expect(page).toContain("const available = !!key && sourceValue !== null;");
    expect(page).toContain("GOOGLE_SHEETS_KPI_CURRENCY_COLUMN_PATTERN.test(key)");
    expect(page).toContain('/roas|return on/i.test(key)');
    expect(page).toContain('? "ratio"');
    expect(page).toContain('? "$"');
    expect(page).toContain("currentValue: sourceValue");
    expect(page).not.toContain("GOOGLE_SHEETS_KPI_FINANCIAL_PATTERN");
    expect(page).not.toContain("Revenue, spend, ROI, and ROAS require confirmed Google Sheets financial source support");
    expect(page).toContain("const resolved = resolveGoogleSheetsKpiMetric(kpi);");
    expect(page).toContain("more than +5% above target");
    expect(page).toContain("within +/-5% of target");
    expect(page).toContain("more than -5% below target");
    expect(page).toContain("formatGoogleSheetsKpiCardValue(currentVal, displayUnit, col?.type)");
    expect(page).toContain("formatGoogleSheetsKpiCardValue(targetVal, displayUnit, col?.type)");
    expect(page).toContain("getGoogleSheetsKpiIcon(metricLabel)");
    expect(page).not.toContain("pct >= 75");
    expect(page).not.toContain("pct >= 50");
    expect(page).toContain('source: "google_sheets_main"');
    expect(page).toContain('valueSource: "source_backed_summary"');
    expect(page).toContain("emailRecipients: kpiForm.emailRecipients ? kpiForm.emailRecipients.split(',').map((e: string) => e.trim()).filter(Boolean).join(', ') : null");
    expect(page).toContain('alertFrequency: "immediate"');
    expect(page).not.toContain("sheetsData?.summary?.metrics?.[kpi.metric || kpi.metricKey] ?? parseFloat(kpi.currentValue || '0')");
    expect(modal).toContain('data-google-sheets-kpi-source-adapter="source-backed"');
    expect(modal).toContain('metric.sourceKind === "confirmed_financial" ? "Overview metric"');
    expect(modal).toContain('data-source-backed-current-value="google_sheets"');
    expect(modal).toContain("value={formatNumberAsYouType(form.currentValue || \"\")}");
    expect(modal).toContain("targetValue: formatNumberAsYouType(e.target.value)");
    expect(modal).toContain("alertThreshold: cleanNumberAsYouType(e.target.value)");
    expect(modal).toContain("onOpenAutoFocus={(event) => event.preventDefault()}");
    expect(modal).toContain("readOnly");
    expect(modal).not.toContain("Current value: ${metric.currentValue}");
    expect(modal).not.toContain('Label htmlFor="gs-kpi-timeframe">Timeframe</Label>');
    expect(modal).not.toContain('Label htmlFor="gs-kpi-metric">Metric Source</Label>');
    expect(modal).not.toContain('SelectValue placeholder="Select metric to track"');
    expect(modal).not.toContain("metrics?.[value]");
    expect(modal).not.toContain("detectedColumns");
  });

  it("Google Sheets Benchmarks follow the GA4 source-backed Benchmark template", () => {
    const page = readGoogleSheetsDataPageSource();
    const modal = readGoogleSheetsBenchmarkModalSource();

    expect(page).toContain("const resolveGoogleSheetsBenchmarkMetric = useCallback");
    expect(page).toContain("const googleSheetsBenchmarkTracker = useMemo");
    expect(page).toContain("computeGoogleSheetsBenchmarkProgress");
    expect(page).toContain("90% or more of benchmark");
    expect(page).toContain("70% to under 90% of benchmark");
    expect(page).toContain("below 70% of benchmark");
    expect(page).toContain("Performance Benchmarks");
    expect(page).toContain("Create Benchmark");
    expect(page).toContain("formatGoogleSheetsKpiCardValue(currentVal, displayUnit, resolved.option?.type)");
    expect(page).toContain("formatGoogleSheetsKpiCardValue(benchmarkVal, displayUnit, resolved.option?.type)");
    expect(page).toContain("const formatGoogleSheetsBenchmarkInputValue =");
    expect(page).toContain("Number.isInteger(parsed)");
    expect(page).toContain("benchmarkValue: formatGoogleSheetsBenchmarkInputValue(bm.benchmarkValue, editUnit, resolved.option?.type)");
    expect(page).toContain("alertThreshold: bm.alertThreshold ? formatGoogleSheetsBenchmarkInputValue(bm.alertThreshold, editUnit, resolved.option?.type) : \"\"");
    expect(page).toContain("getGoogleSheetsKpiIcon(metricLabel)");
    expect(page).toContain("benchmarkValue: String(benchmarkValue)");
    expect(page).toContain("currentValue: String(metricOption.currentValue)");
    expect(page).toContain("alertThreshold: alertThreshold !== null ? String(alertThreshold) : null");
    expect(page).toContain('benchmarkType: "goal"');
    expect(page).toContain('source: "google_sheets_main"');
    expect(page).toContain('valueSource: "source_backed_summary"');
    expect(page).toContain("emailRecipients: benchmarkForm.emailRecipients ? benchmarkForm.emailRecipients.split(',').map((e: string) => e.trim()).filter(Boolean).join(', ') : null");
    expect(page).toContain('alertFrequency: "immediate"');
    expect(page).not.toContain("sheetsData?.summary?.metrics?.[bm.metric || bm.metricKey] ?? parseFloat(bm.currentValue || '0')");
    expect(page).not.toContain("Above Benchmark");
    expect(page).not.toContain("Below Benchmark");
    expect(page).not.toContain("Variance");
    expect(modal).toContain('data-google-sheets-benchmark-source-adapter="source-backed"');
    expect(modal).toContain('metric.sourceKind === "confirmed_financial" ? "Overview metric"');
    expect(modal).toContain("Select Benchmark Template");
    expect(modal).toContain('data-source-backed-current-value="google_sheets_benchmark"');
    expect(modal).toContain("value={formatNumberAsYouType(form.currentValue || \"\")}");
    expect(modal).toContain("benchmarkValue: formatNumberAsYouType(e.target.value)");
    expect(modal).toContain("onOpenAutoFocus={(event) => event.preventDefault()}");
    expect(modal).toContain("readOnly");
    expect(modal).toContain("disabled={!form.name || !form.metric || !form.benchmarkValue}");
    expect(modal).toContain('alertFrequency: "immediate"');
    expect(modal).not.toContain('Label htmlFor="gs-bm-metric">Metric Source</Label>');
    expect(modal).not.toContain('SelectValue placeholder="Select metric to benchmark"');
    expect(modal).not.toContain("metrics?.[value]");
    expect(modal).not.toContain("detectedColumns");
  });

  it("Google Sheets Reports follow the GA4 Reports template with source-backed output guards", () => {
    const page = readGoogleSheetsDataPageSource();
    const modal = readGoogleSheetsReportModalSource();
    const reportScheduler = fs.readFileSync(path.join(process.cwd(), "server", "report-scheduler.ts"), "utf8");
    const routesSource = readRoutesSource();

    expect(page).toContain("Google Sheets Reports");
    expect(page).toContain("resetGoogleSheetsReportCreateState");
    expect(page).toContain("setReportForm(createEmptyGoogleSheetsReportForm())");
    expect(page).toContain("setCustomReportConfig(createEmptyGoogleSheetsCustomReportConfig())");
    expect(page).toContain("serializeGoogleSheetsReportState(nextForm, nextConfig, nextModalStep)");
    expect(page).toContain("const reportHasChanges = !editingReportId");
    expect(page).toContain("downloadGoogleSheetsReport({");
    expect(page).toContain("const savedGoogleSheetsSourceQueries = useQueries");
    expect(page).toContain("getGoogleSheetsMetricOptionsForSavedScope");
    expect(page).toContain("Saved Google Sheets source is no longer connected");
    expect(page).toContain("Saved Google Sheets source unavailable");
    expect(page).toContain("const reportScopedMetrics = getGoogleSheetsMetricOptionsForSavedScope({ configuration: selectedConfig });");
    expect(page).toContain("payload.scheduleDayOfWeek = reportForm.scheduleFrequency === \"weekly\" ? dayOfWeekKeyToInt(reportForm.scheduleDayOfWeek) : undefined");
    expect(page).toContain("payload.scheduleDayOfMonth = reportForm.scheduleFrequency === \"monthly\" || reportForm.scheduleFrequency === \"quarterly\" ? dayOfMonthToInt(reportForm.scheduleDayOfMonth) : undefined");
    expect(page).toContain("payload.scheduleTime = to24HourHHMM(reportForm.scheduleTime)");
    expect(page).toContain("payload.scheduleTimeZone = userTimeZone");
    expect(page).toContain("<Download className=\"w-4 h-4 mr-2\" />");
    expect(page).toContain("<Pencil className=\"w-4 h-4\" />");
    expect(page).not.toContain("scheduleFrequency: \"weekly\", scheduleDayOfWeek: \"monday\", scheduleDayOfMonth: \"first\"");

    expect(modal).toContain("onOpenAutoFocus={(event) => event.preventDefault()}");
    expect(modal).toContain("Report Type");
    expect(modal).toContain("Standard Templates");
    expect(modal).toContain("Custom Report");
    expect(modal).toContain("Choose Template");
    expect(modal).toContain("Ad Comparison");
    expect(modal).toContain("Unavailable for Google Sheets because this source has sheet rows, not ad-level entities.");
    expect(modal).toContain("disabled={section.key === \"ads\"}");
    expect(modal).toContain("Overview");
    expect(modal).toContain("KPIs");
    expect(modal).toContain("Benchmarks");
    expect(modal).toContain("Insights");
    expect(modal).toContain("expandedSections");
    expect(modal).toContain("setSectionExpanded(section.key)");
    expect(modal).toContain("selectedKpiIds.has(String(kpi.id))");
    expect(modal).toContain("selectedBenchmarkIds.has(String(bm.id))");
    expect(modal).toContain("const submitDisabled =");
    expect(modal).toContain("(modalStep === \"standard\" && (!form.reportType || form.reportType === \"ads\"))");
    expect(modal).toContain("(modalStep === \"custom\" && !hasCustomSelection)");
    expect(modal).toContain("(!!editingId && !hasChanges)");
    expect(modal).toContain("Generate & Download Report");
    expect(modal).toContain("Schedule Report");
    expect(modal).toContain("Update Report");

    expect(reportScheduler).toContain("'google_sheets'");
    expect(reportScheduler).toContain("return normalized === \"instagram\" || normalized === \"tiktok\" || normalized === \"google_sheets\";");
    expect(reportScheduler).toContain("buildGoogleSheetsCachedMetricSummary");
    expect(reportScheduler).toContain("function getGoogleSheetsReportSourceScope");
    expect(reportScheduler).toContain("function isGoogleSheetsConfirmedFinancialMetric");
    expect(reportScheduler).toContain("async function buildGoogleSheetsConfirmedFinancialMetricSummary");
    expect(reportScheduler).toContain('storage.getRevenueTotalForRange(campaignId, startDate, endDate, "google_sheets")');
    expect(reportScheduler).toContain('String(source?.platformContext || "").trim().toLowerCase() === "google_sheets"');
    expect(reportScheduler).toContain("function googleSheetsConnectionMatchesSavedScope");
    expect(reportScheduler).toContain("if (!reportSourceScope) return null;");
    expect(reportScheduler).toContain("buildGoogleSheetsCachedMetricSummary(connections, reportSourceScope)");
    expect(reportScheduler).toContain("const rowScope = getGoogleSheetsReportSourceScope(row?.calculationConfig)");
    expect(reportScheduler).toContain("storage.getGoogleSheetsConnections(campaignId).catch(() => [] as any[])");
    expect(reportScheduler).toContain("storage.getPlatformKPIs(\"google_sheets\", campaignId)");
    expect(reportScheduler).toContain("storage.getPlatformBenchmarks(\"google_sheets\", campaignId)");
    expect(reportScheduler).toContain("return buildGoogleSheetsScheduledPdfAttachment({ report, windowStart, windowEnd, campaignName });");
    expect(reportScheduler).not.toContain("if (String((report as any)?.platformType || \"\") === \"google_sheets\") {\n    const { jsPDF }");

    expect(routesSource).toContain('sourceBackedReportPlatform === "instagram" || sourceBackedReportPlatform === "tiktok" || sourceBackedReportPlatform === "google_sheets"');
    expect(routesSource).toContain('sourceBackedReportPlatform === "google_sheets" ? "Google Sheets" : "Instagram"');
  });

  it("Google Sheets-only Add Dataset connections append instead of replacing existing tabs", () => {
    const source = readUploadAdditionalDataModalSource();

    expect(source).toContain("const googleSheetsSelectionMode: 'replace' | 'append' =");
    expect(source).toContain("googleSheetsOnly || (showGoogleSheetsUseCaseStep && googleSheetsUseCase === 'view') ? 'append' : 'replace'");
    expect(source.match(/selectionMode=\{googleSheetsSelectionMode\}/g)?.length).toBe(2);
    expect(source).not.toContain("selectionMode={showGoogleSheetsUseCaseStep && googleSheetsUseCase === 'view' ? 'append' : 'replace'}");
  });

  it("Google Sheets analytics resets inherited scroll position on route mount", () => {
    const source = readGoogleSheetsDataPageSource();

    expect(source).toContain("useLayoutEffect");
    expect(source).toContain('window.scrollTo({ top: 0, left: 0, behavior: "auto" });');
    expect(source).toContain("}, [campaignId]);");
  });

  it("Google Sheets analytics keeps the top layout stable while loading", () => {
    const source = readGoogleSheetsDataPageSource();
    const loadingStart = source.indexOf(") : isDataLoading ? (");
    const loadingEnd = source.indexOf(") : sheetsData ? (", loadingStart);
    const loadingBlock = source.slice(loadingStart, loadingEnd);

    expect(source).toContain('className="mb-6 space-y-3 min-h-[76px]"');
    expect(source).toContain('<div className="h-5" aria-hidden="true" />');
    expect(loadingBlock).toContain('<Tabs defaultValue="data" className="space-y-6">');
    expect(loadingBlock).not.toContain("grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8");
  });

  it("Google Sheets analytics header keeps final action width reserved", () => {
    const source = readGoogleSheetsDataPageSource();
    const headerStart = source.indexOf('<div className="flex items-center justify-between gap-6 mb-6">');
    const headerEnd = source.indexOf('{/* Sheet Selector and Active Sheet Indicator */}', headerStart);
    const header = source.slice(headerStart, headerEnd);

    expect(header).toContain('<h1 className="text-3xl font-bold text-foreground whitespace-nowrap">Google Sheets Data</h1>');
    expect(header).toContain('<Badge variant="secondary" className="text-xs whitespace-nowrap shrink-0">');
    expect(header).toContain('className={`whitespace-nowrap shrink-0 ${sheetsData?.spreadsheetId ? "" : "invisible"}`}');
    expect(header).not.toContain('{sheetsData?.spreadsheetId && !isCombinedView && (');
  });

  it("Google Sheets analytics main content can shrink inside the sidebar layout", () => {
    const source = readGoogleSheetsDataPageSource();

    expect(source.match(/<main className="flex-1 min-w-0 p-8">/g)?.length).toBe(3);
    expect(source).not.toContain('<main className="flex-1 p-8">');
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

    expect(storageSource).toContain("export type RevenuePlatformContext = 'ga4' | 'linkedin' | 'meta' | 'google_ads' | 'instagram' | 'tiktok' | 'google_sheets';");
    expect(schemaSource).toContain("export const insertRevenueSourceSchema");
    expect(schemaSource).toContain("platformContext: true,");
    expect(routesSource).toContain('const zCsvRevenuePlatformContext = z.enum(["ga4", "linkedin", "meta", "google_ads", "instagram", "tiktok", "google_sheets"]);');
    expect(routesSource).toContain('const zSheetsRevenuePlatformContext = z.enum(["ga4", "linkedin", "meta", "google_ads", "instagram", "tiktok", "google_sheets"]);');
    expect(routesSource).toContain('const zHubSpotRevenuePlatformContext = z.enum(["ga4", "linkedin", "meta", "google_ads", "instagram", "tiktok", "google_sheets"]);');
    expect(routesSource).toContain('const zSalesforceRevenuePlatformContext = z.enum(["ga4", "linkedin", "meta", "google_ads", "instagram", "tiktok", "google_sheets"]);');
    expect(routesSource).toContain('const zShopifyRevenuePlatformContext = z.enum(["ga4", "linkedin", "meta", "google_ads", "instagram", "tiktok", "google_sheets"]);');
    expect(routesSource).toContain("const revenuePurposeForPlatformContext = (platformContext: any): string => {");
    expect(routesSource).toContain('if (ctx === "tiktok") return "tiktok_revenue";');
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

  it("Custom Integration by-ID analytics route resolves source before campaign access and keeps client compatibility", () => {
    const routesSource = readRoutesSource();
    const routeStart = routesSource.indexOf('app.get("/api/custom-integration-by-id/:id"');
    const routeEnd = routesSource.indexOf('app.get("/api/custom-integration/:campaignId"', routeStart);
    const route = routesSource.slice(routeStart, routeEnd);

    expect(routeStart).toBeGreaterThan(-1);
    expect(route).toContain("storage.getCustomIntegrationById(req.params.id)");
    expect(route.indexOf("storage.getCustomIntegrationById")).toBeLessThan(route.indexOf("ensureCampaignAccess"));
    expect(route).toContain("ensureCampaignAccess(req as any, res as any, customIntegration.campaignId)");
    expect(route).toContain("campaign_id: customIntegration.campaignId");
  });

  it("Custom Integration upload path has one canonical campaign-scoped route", () => {
    const routesSource = readRoutesSource();
    const uploadRouteMatches = routesSource.match(/app\.post\("\/api\/custom-integration\/:campaignId\/upload-pdf"/g) || [];
    const routeStart = routesSource.indexOf('app.post("/api/custom-integration/:campaignId/upload-pdf"');
    const routeEnd = routesSource.indexOf('app.post("/api/webhook/custom-integration/:token"', routeStart);
    const route = routesSource.slice(routeStart, routeEnd);

    expect(uploadRouteMatches).toHaveLength(1);
    expect(route).toContain("requireCampaignAccessCampaignIdParam, upload.single('pdf')");
    expect(route).toContain("storage.getCustomIntegration(campaignId)");
    expect(route).toContain("storage.createCustomIntegration({");
    expect(route.indexOf("storage.createCustomIntegration({")).toBeLessThan(route.indexOf("storage.createCustomIntegrationMetrics({"));
  });

  it("Custom Integration public token ingest routes use direct token lookup", () => {
    const routesSource = readRoutesSource();
    const webhookStart = routesSource.indexOf('app.post("/api/webhook/custom-integration/:token"');
    const webhookEnd = routesSource.indexOf('app.post("/api/email/inbound/:token"', webhookStart);
    const emailStart = webhookEnd;
    const emailEnd = routesSource.indexOf("// LinkedIn API routes", emailStart);
    const webhookRoute = routesSource.slice(webhookStart, webhookEnd);
    const emailRoute = routesSource.slice(emailStart, emailEnd);

    expect(webhookRoute).toContain("storage.getCustomIntegrationByToken(token)");
    expect(emailRoute).toContain("storage.getCustomIntegrationByToken(token)");
    expect(webhookRoute).not.toContain("storage.getAllCustomIntegrations()");
    expect(emailRoute).not.toContain("storage.getAllCustomIntegrations()");
  });

  it("Custom Integration disconnect deletes imported metrics with the connection", () => {
    const storageSource = readStorageSource();
    const methodStart = storageSource.indexOf("async deleteCustomIntegration(campaignId: string)");
    const methodEnd = storageSource.indexOf("// Custom Integration Metrics methods", methodStart);
    const method = storageSource.slice(methodStart, methodEnd);

    expect(method).toContain("return await db.transaction");
    expect(method).toContain("if (!existing) return false");
    expect(method.indexOf(".delete(customIntegrationMetrics)")).toBeLessThan(method.indexOf(".delete(customIntegrations)"));
    expect(method).toContain("eq(customIntegrationMetrics.campaignId, campaignId)");
    expect(method).toContain("eq(customIntegrations.campaignId, campaignId)");
  });

  it("Custom Integration parsed PDF imports preserve missing fields as null", () => {
    const routesSource = readRoutesSource();
    const parserSource = readPdfParserSource();
    const schemaSource = readSharedSchemaSource();
    const migrationSource = readMigrationSource("0008_add_custom_integration_parser_metadata.sql");
    const uiSource = readCustomIntegrationAnalyticsSource();
    const normalizerStart = routesSource.indexOf("function normalizeCustomIntegrationMetrics(metrics: ParsedMetrics)");
    const normalizerEnd = routesSource.indexOf("async function buildGoogleAdsPlatformSourceForAggregate", normalizerStart);
    const normalizer = routesSource.slice(normalizerStart, normalizerEnd);
    const noMetricsStart = parserSource.indexOf("if (extractedCount === 0)");
    const noMetricsEnd = parserSource.indexOf("// Sanitize: Convert NaN to undefined", noMetricsStart);
    const noMetricsFallback = parserSource.slice(noMetricsStart, noMetricsEnd);

    expect(normalizer).toContain('if (value === null || typeof value === "undefined") return null;');
    expect(normalizer).toContain('return typeof value === "number" && Number.isNaN(value) ? null : value;');
    expect(normalizer).toContain("users: metric(metrics.users)");
    expect(normalizer).toContain("spend: decimalMetric(metrics.spend)");
    expect(normalizer).toContain("clickToOpenRate: decimalMetric(metrics.clickToOpenRate)");
    expect(normalizer).toContain("parserMetadata");
    expect(normalizer).toContain("confidence: metrics._confidence ?? null");
    expect(normalizer).toContain("warnings: Array.isArray(metrics._warnings) ? metrics._warnings : []");
    expect(normalizer).not.toContain("const normalized: any = { ...metrics };");
    expect((routesSource.match(/normalizeCustomIntegrationMetrics\(parsedMetrics\)/g) || []).length).toBe(3);
    expect((routesSource.match(/normalizeCustomIntegrationMetrics\(metrics\)/g) || []).length).toBe(2);
    expect(routesSource).not.toContain("cleanMetric(parsedMetrics");
    expect(noMetricsFallback).toContain("metrics._warnings = ['No metrics extracted from PDF']");
    expect(noMetricsFallback).not.toContain("metrics.impressions = 0");
    expect(noMetricsFallback).not.toContain("metrics.spend = 0");
    expect(noMetricsFallback).not.toContain("metrics.conversions = 0");
    expect(schemaSource).toContain('parserMetadata: jsonb("parser_metadata")');
    expect(migrationSource).toContain("ADD COLUMN IF NOT EXISTS parser_metadata jsonb");
    expect(uiSource).toContain("function getCustomIntegrationParserMetadata");
    expect(uiSource).toContain('data-testid="custom-integration-parser-review"');
    expect(uiSource).toContain("Import needs review");
  });

  it("Custom Integration KPI and Benchmark metric selection does not zero-fill missing imports", () => {
    const source = readCustomIntegrationAnalyticsSource();

    expect(source).toContain("const CUSTOM_INTEGRATION_METRIC_OPTIONS");
    expect(source).toContain("function resolveCustomIntegrationMetric");
    expect(source).toContain("fields: ['clickToOpenRate', 'clickToOpen']");
    expect(source).toContain("resolved.available && resolved.currentValue !== null ? String(resolved.currentValue) : ''");
    expect(source).toContain("disabled={!resolved.available}");
    expect(source).not.toContain("String(metricsData?.users || 0)");
    expect(source).not.toContain("String(metricsData?.sessions || 0)");
    expect(source).not.toContain("String(metricsData?.pageviews || 0)");
    expect(source).not.toContain("String(metricsData?.openRate || 0)");
    expect(source).not.toContain("String(metricsData?.clickThroughRate || 0)");
    expect(source).not.toContain("String(metricsData?.clickToOpen || 0)");
    expect(source).not.toContain("String(metricsData?.listGrowth || 0)");
    expect(source).not.toContain("String(metricsData?.emailsDelivered || 0)");
    expect(source).toContain("metricsData.users != null");
    expect(source).toContain("metrics.users != null");
    expect(source).toContain("metrics.emailsDelivered != null");
  });

  it("Custom Integration KPI and Benchmark cards exclude unavailable source metrics from scoring", () => {
    const source = readCustomIntegrationAnalyticsSource();

    expect(source).toContain("const resolveCustomIntegrationCurrentValue = (item: any) => {");
    expect(source).toContain("Metric is not supported by Custom Integration.");
    expect(source).toContain("Current value is not available.");
    expect(source).toContain("let status = resolvedCurrent.available ? 'Underperforming' : 'Unavailable';");
    expect(source).toContain("resolvedCurrent.available ? `Source: ${resolvedCurrent.sourceLabel}` : resolvedCurrent.reason");
    expect(source).toContain("resolved.available && current !== null && target > 0");
    expect(source).toContain("resolved.available && current !== null && benchmark > 0");
    expect(source).toContain("targetVal > 0 && resolvedCurrent.available && currentVal !== null");
    expect(source).toContain("resolvedCurrent.available && currentVal !== null && benchmarkVal !== null && benchmarkVal > 0");
  });

  it("Custom Integration analytics shell follows the Google Sheets tab layout", () => {
    const source = readCustomIntegrationAnalyticsSource();

    const overview = source.indexOf('TabsTrigger value="overview"');
    const summary = source.indexOf('TabsTrigger value="summary"');
    const kpis = source.indexOf('TabsTrigger value="kpis"');
    const benchmarks = source.indexOf('TabsTrigger value="benchmarks"');
    const insights = source.indexOf('TabsTrigger value="insights"');
    const reports = source.indexOf('TabsTrigger value="reports"');

    expect(overview).toBeGreaterThan(-1);
    expect(summary).toBeGreaterThan(overview);
    expect(kpis).toBeGreaterThan(summary);
    expect(benchmarks).toBeGreaterThan(kpis);
    expect(insights).toBeGreaterThan(benchmarks);
    expect(reports).toBeGreaterThan(insights);
    expect(source).toContain('data-testid="custom-integration-data-status"');
    expect(source).toContain("Custom Data");
    expect(source).toContain('data-testid="custom-integration-imported-data-card"');
    expect(source).toContain("Imported Data");
    expect(source).toContain('data-testid="content-summary"');
    expect(source).toContain('data-testid="content-insights"');
    expect(source).toContain('data-testid="button-upload-custom-integration-pdf"');
    expect(source).not.toContain('id="manual-pdf-upload"');
  });
});
