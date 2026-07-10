import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("Spend source additivity", () => {
  it("Google Sheets spend add mode creates a new additive source instead of replacing by connection", () => {
    const routesFile = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");

    const routeStart = routesFile.indexOf('app.post("/api/campaigns/:id/spend/sheets/process"');
    const nextRouteStart = routesFile.indexOf("// ---------------------------------------------------------------------------", routeStart);
    expect(routeStart).toBeGreaterThan(-1);
    expect(nextRouteStart).toBeGreaterThan(routeStart);
    const route = routesFile.slice(routeStart, nextRouteStart);

    expect(route).toContain("Add mode creates a new additive source. Edit/refresh mode passes sourceId and updates only that source.");
    expect(route).toContain("const existingSheetsSpendSource = existingSourceId");
    expect(route).toContain("return String((s as any).id || \"\") === existingSourceId;");
    expect(route).toContain('if (existingSourceId && !existingSheetsSpendSource) {');
    expect(route).toContain('return res.status(404).json({ success: false, error: "Spend source not found" });');
    expect(route).not.toContain("String(cfg?.connectionId || \"\") === String(connectionId)");
  });

  it("Total Spend source totals use the full imported lifetime window", () => {
    const routesFile = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");
    const helperStart = routesFile.indexOf("const recalcCampaignSpend");
    const helperEnd = routesFile.indexOf("const getGoogleSheetsConfirmedFinancialsForAggregate", helperStart);
    const helper = routesFile.slice(helperStart, helperEnd);

    expect(helperStart).toBeGreaterThan(-1);
    expect(helperEnd).toBeGreaterThan(helperStart);
    expect(helper).toContain('const startDate = "1900-01-01";');
    expect(helper).not.toContain("campaign as any)?.startDate");
  });

  it("Google Sheets spend duplicate inspection is read-only", () => {
    const routesFile = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");
    const routeStart = routesFile.indexOf('app.get("/api/campaigns/:id/spend-sources/google-sheets-duplicates"');
    const nextRouteStart = routesFile.indexOf('app.post("/api/campaigns/:id/spend-sources/google-sheets-duplicates/cleanup"', routeStart);
    expect(routeStart).toBeGreaterThan(-1);
    expect(nextRouteStart).toBeGreaterThan(routeStart);
    const route = routesFile.slice(routeStart, nextRouteStart);

    expect(route).toContain('duplicateGroups');
    expect(route).toContain('duplicateSourceCount');
    expect(route).not.toContain('deleteSpendSource');
    expect(route).not.toContain('deleteSpendRecordsBySource');
    expect(route).not.toContain('updateSpendSource');
  });

  it("GA4 Overview source-damage inventory is read-only", () => {
    const routesFile = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");
    const routeStart = routesFile.indexOf('app.get("/api/campaigns/:id/ga4-overview/source-damage-inventory"');
    const nextRouteStart = routesFile.indexOf('app.get("/api/campaigns/:id/spend-sources/google-sheets-duplicates"', routeStart);
    expect(routeStart).toBeGreaterThan(-1);
    expect(nextRouteStart).toBeGreaterThan(routeStart);
    const route = routesFile.slice(routeStart, nextRouteStart);

    expect(route).toContain("orphanRevenueRecordGroups");
    expect(route).toContain("duplicateActiveSpendSourceGroups");
    expect(route).toContain("readonly: true");
    expect(route).not.toContain("deleteSpendSource");
    expect(route).not.toContain("deleteSpendRecordsBySource");
    expect(route).not.toContain("deleteRevenue");
    expect(route).not.toContain("recomputeGA4KPIAndBenchmarkValues");
    expect(route).not.toContain("recalcCampaignSpend");
  });
  it("Google Sheets spend duplicate cleanup requires confirmation and only deactivates confirmed duplicate groups", () => {
    const routesFile = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");
    const routeStart = routesFile.indexOf('app.post("/api/campaigns/:id/spend-sources/google-sheets-duplicates/cleanup"');
    const nextRouteStart = routesFile.indexOf('// Remove all active spend sources for a campaign', routeStart);
    expect(routeStart).toBeGreaterThan(-1);
    expect(nextRouteStart).toBeGreaterThan(routeStart);
    const route = routesFile.slice(routeStart, nextRouteStart);

    expect(route).toContain('if ((req.body as any)?.confirm !== true)');
    expect(route).toContain('const duplicates = group.sources.slice(1);');
    expect(route).toContain('await storage.deleteSpendRecordsBySource(String(source.id));');
    expect(route).toContain('await storage.deleteSpendSource(String(source.id));');
    expect(route).toContain('await recalcCampaignSpend(campaignId);');
  });

  it("Google Sheets inactive duplicate purge requires confirmation and only hard-deletes inactive zero-record matches", () => {
    const routesFile = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");
    const routeStart = routesFile.indexOf('app.post("/api/campaigns/:id/spend-sources/google-sheets-duplicates/purge-inactive"');
    const nextRouteStart = routesFile.indexOf('// Remove all active spend sources for a campaign', routeStart);
    expect(routeStart).toBeGreaterThan(-1);
    expect(nextRouteStart).toBeGreaterThan(routeStart);
    const route = routesFile.slice(routeStart, nextRouteStart);

    expect(route).toContain('if ((req.body as any)?.confirm !== true)');
    expect(route).toContain('await storage.getInactiveSpendSources(campaignId)');
    expect(route).toContain('const recordCount = await storage.countSpendRecordsBySource(id);');
    expect(route).toContain('if (!activeKeys.has(key) || recordCount !== 0)');
    expect(route).toContain('await storage.hardDeleteInactiveSpendSource(campaignId, id)');
    expect(route).not.toContain('recalcCampaignSpend(campaignId)');
  });
});
