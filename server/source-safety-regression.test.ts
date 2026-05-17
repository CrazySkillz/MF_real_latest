import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

function readRoutesSource(): string {
  return fs.readFileSync(path.join(process.cwd(), "server", "routes-oauth.ts"), "utf8");
}

function readStorageSource(): string {
  return fs.readFileSync(path.join(process.cwd(), "server", "storage.ts"), "utf8");
}

describe("source safety regression guards", () => {
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
    expect(importRoute).toContain("`${platformLabel} spend source not found`");
    expect(importRoute.indexOf("storage.deleteSpendRecordsBySource")).toBeGreaterThan(importRoute.indexOf("requestedSourceId"));
  });

  it("Google Ads disconnect route is campaign-scoped and fails closed when no row is deleted", () => {
    const routesSource = readRoutesSource();
    const routeStart = routesSource.indexOf('app.delete("/api/google-ads/:campaignId/connection"');
    const routeEnd = routesSource.indexOf("/**\n   * Get Google Ads daily metrics", routeStart);
    const route = routesSource.slice(routeStart, routeEnd);

    expect(route).toContain("ensureCampaignAccess");
    expect(route.indexOf("ensureCampaignAccess")).toBeLessThan(route.indexOf("storage.deleteGoogleAdsConnection(campaignId)"));
    expect(route).toContain("Google Ads connection not found");

    const storageSource = readStorageSource();
    const methodStart = storageSource.indexOf("async deleteGoogleAdsConnection(campaignId: string)");
    const methodEnd = storageSource.indexOf("async getGoogleAdsDailyMetrics", methodStart);
    const method = storageSource.slice(methodStart, methodEnd);

    expect(method).toContain("eq(googleAdsConnections.campaignId, campaignId)");
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
