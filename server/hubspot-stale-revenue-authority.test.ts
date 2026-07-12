import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const routes = readFileSync("server/routes-oauth.ts", "utf8");
const ga4Page = readFileSync("client/src/pages/ga4-metrics.tsx", "utf8");
const revenueModal = readFileSync("client/src/components/AddRevenueWizardModal.tsx", "utf8");

const sliceBetween = (source: string, start: string, end: string) => {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex);
  expect(startIndex).toBeGreaterThan(-1);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
};

describe("GA4 HubSpot materialized revenue authority", () => {
  it("publishes unavailable instead of configuration revenue when HubSpot records are missing", () => {
    const route = sliceBetween(
      routes,
      'app.get("/api/campaigns/:id/revenue-sources"',
      "// Unified data-sources endpoint",
    );
    expect(route).toContain('const hasMaterializedRevenue = totalsBySource.has(sourceId)');
    expect(route).toContain('platformContext === "ga4"');
    expect(route).toContain('String(source?.sourceType || "").trim().toLowerCase() === "hubspot"');
    expect(route).toContain('? hasMaterializedRevenue ? Number(recordTotal.toFixed(2)) : null');
    expect(route).toContain('materializedRevenueStatus: hasMaterializedRevenue ? "available" : "unavailable"');
    expect(route).toContain('Number((recordTotal || cfgTotal || 0).toFixed(2))');
  });

  it("does not add stale HubSpot connection revenue to outcome totals", () => {
    const route = sliceBetween(
      routes,
      'app.get("/api/campaigns/:id/outcome-totals"',
      "// New route: Get all GA4 connections",
    );
    expect(route).toContain('const isHubspot = s.type === "hubspot"');
    expect(route).toContain('materializedRevenueSourceTypes.add(String(source?.sourceType || "").trim().toLowerCase())');
    expect(route).toContain('const hubspotMaterialized = isHubspot && materializedRevenueSourceTypes.has("hubspot")');
    expect(route).toContain('const lastTotalRevenue = isHubspot ? hubspotMaterialized ? 0 : null : parseNum(cfg.lastTotalRevenue)');
    expect(route).toContain('materializedRevenueStatus: hubspotMaterialized ? "available" : "unavailable"');
    expect(route).toContain('if (!isHubspot && offsite && Number(lastTotalRevenue) > 0)');
  });

  it("keeps provenance visible but renders the missing value as unavailable", () => {
    expect(ga4Page).toContain('source?.materializedRevenueStatus === "available" ? Number(source?.lastTotalRevenue || 0) : null');
    expect(ga4Page).toContain('materializedRevenueUnavailable ? "Unavailable" : formatMoney(Number(s.revenue || 0))');
    expect(ga4Page).toContain('materializedRevenueStatus: s.materializedRevenueStatus');
  });

  it("does not pass stale GA4 configuration revenue into HubSpot edit review", () => {
    expect(revenueModal).toContain('platformContext === "ga4"');
    expect(revenueModal).toContain('initialSource?.materializedRevenueStatus === "available"');
    expect(revenueModal).toContain(': Number.isFinite(Number(config?.lastTotalRevenue)) ? Number(config.lastTotalRevenue)');
  });
});
