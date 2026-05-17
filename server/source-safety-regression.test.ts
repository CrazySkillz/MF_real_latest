import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

function readRoutesSource(): string {
  return fs.readFileSync(path.join(process.cwd(), "server", "routes-oauth.ts"), "utf8");
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
});
