import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), "utf8");
const routes = read("server", "routes-oauth.ts");
const ga4Overview = read("client", "src", "pages", "ga4-metrics.tsx");
const snapshotRunner = read("scripts", "ga4_overview_current_commit_2_source_lifecycle_snapshot.ps1");

const routeSlice = (startMarker: string, endMarker: string) => {
  const start = routes.indexOf(startMarker);
  const end = routes.indexOf(endMarker, start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return routes.slice(start, end);
};

describe("GA4 Overview retained-source reconciliation", () => {
  it("passes GA4 context through the Salesforce request and cache key", () => {
    expect(ga4Overview).toContain('queryKey: ["/api/salesforce", campaignId, "pipeline-proxy", "ga4"]');
    expect(ga4Overview).toContain('/pipeline-proxy?platformContext=ga4`);');
    expect(snapshotRunner).toContain("/pipeline-proxy?platformContext=ga4");
  });

  it("requires one supported Salesforce context and never falls back across platforms", () => {
    const route = routeSlice(
      'app.get("/api/salesforce/:campaignId/pipeline-proxy"',
      "// HubSpot pipeline proxy status",
    );

    expect(route).toContain("zSalesforceRevenuePlatformContext.safeParse");
    expect(route).toContain("const requestedContexts = [requestedPlatformContext];");
    expect(route).toContain("mappingContext !== requestedPlatformContext");
    expect(route).toContain("candidates.find(({ cfg }) => sourceMatchesGa4Scope(cfg)) || null");
    expect(route).toContain("Pipeline proxy is not configured for the requested platform context.");
    expect(route).not.toContain('["ga4", "linkedin", "meta"] as const');
    expect(route).not.toContain("|| candidates[0]");
  });

  it("inventories retained sources without mutating or guessing reconciliation", () => {
    const route = routeSlice(
      'app.get("/api/campaigns/:id/ga4-overview/source-damage-inventory"',
      'app.get("/api/ga4-overview/shopify/source-damage-inventory"',
    );

    expect(routes).toContain('new Set(["manual", "salesforce", "google_sheets"])');
    expect(routes).toContain('new Set(["manual", "google_sheets", "linkedin_api", "ad_platforms"])');
    expect(routes).toContain("storedPlatformContext");
    expect(routes).toContain("legacyNullContext");
    expect(routes).toContain("mappingHash");
    expect(routes).toContain("amountTotal");
    expect(route).toContain("retainedSourceInventoryPass");
    expect(route).toContain("automaticCleanupAllowed: false");
    expect(route).not.toContain("updateRevenueSource(");
    expect(route).not.toContain("updateSpendSource(");
    expect(route).not.toContain("deleteRevenueSource(");
    expect(route).not.toContain("deleteSpendSource(");
  });

  it("batches retained-source evidence only across the signed-in owner's active GA4 campaigns", () => {
    const route = routeSlice(
      'app.get("/api/ga4-overview/retained-source-inventory"',
      'app.get("/api/ga4-overview/shopify/source-damage-inventory"',
    );

    expect(route).toContain("const actorId = getActorId(req as any)");
    expect(route).toContain('String(campaign?.ownerId || "").trim() === actorId');
    expect(route).toContain("connection?.isActive !== false");
    expect(route).toContain("inArray(revenueRecordsTable.revenueSourceId, retainedRevenueSourceIds)");
    expect(route).toContain("inArray(spendRecordsTable.spendSourceId, retainedSpendSourceIds)");
    expect(route).toContain("ownerScopedBatchComplete: true");
    expect(route).toContain("automaticCleanupAllowed: false");
    expect(route).not.toContain("updateRevenueSource(");
    expect(route).not.toContain("updateSpendSource(");
    expect(route).not.toContain("deleteRevenueSource(");
    expect(route).not.toContain("deleteSpendSource(");
  });
});
