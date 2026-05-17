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
});
