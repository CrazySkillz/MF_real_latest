import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const readSource = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), "utf-8");

const sliceBetween = (source: string, startNeedle: string, endNeedle: string) => {
  const start = source.indexOf(startNeedle);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = source.indexOf(endNeedle, start);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
};

describe("Google Ads revenue Shopify flow", () => {
  it("admits Google Ads for Shopify revenue save through the shared platform validator", () => {
    const routes = readSource("server", "routes-oauth.ts");
    const route = sliceBetween(
      routes,
      'app.post("/api/campaigns/:id/shopify/save-mappings"',
      'app.post("/api/campaigns/:id/chat"'
    );

    expect(routes).toContain('const zPlatformContext = z.enum(["ga4", "linkedin", "meta", "google_ads"]);');
    expect(routes).toContain('const zShopifyRevenuePlatformContext = z.enum(["ga4", "linkedin", "meta", "google_ads"]);');
    expect(route).toContain("platformContext: zShopifyRevenuePlatformContext.optional()");
    expect(route).not.toContain("platformContext: zPlatformContext.optional()");
  });

  it("keeps Google Ads Shopify imports revenue-only and source-scoped", () => {
    const routes = readSource("server", "routes-oauth.ts");
    const route = sliceBetween(
      routes,
      'app.post("/api/campaigns/:id/shopify/save-mappings"',
      'app.post("/api/campaigns/:id/chat"'
    );

    expect(route).toContain('const platformCtx = body.data.platformContext || "ga4";');
    expect(route).toContain('const effectiveValueSource: "revenue" = "revenue";');
    expect(route).toContain("storage.getRevenueSources(campaignId, platformCtx as any)");
    expect(route).toContain('sourceType: "shopify"');
    expect(route).toContain("platformContext: platformCtx");
    expect(route).toContain('provider: "shopify"');
    expect(route).toContain("campaignValueRevenueTotals: Array.from(campaignValueRevenueTotals.entries()).map");
  });

  it("materializes Google Ads Shopify per-campaign revenue for exact IDs or explicit active campaign mappings", () => {
    const routes = readSource("server", "routes-oauth.ts");
    const route = sliceBetween(
      routes,
      'app.post("/api/campaigns/:id/shopify/save-mappings"',
      'app.post("/api/campaigns/:id/chat"'
    );

    expect(route).toContain('const activeGoogleAdsCampaignIds = platformCtx === "google_ads"');
    expect(route).toContain("googleAdsCampaignIdFromValueOrMapping(platformCtx, orderCrmValue, campaignMappings, activeGoogleAdsCampaignIds)");
    expect(route).toContain('} else if (platformCtx === "linkedin" && campaignMappings.length > 0) {');
    expect(route).toContain('if ((campaignMappings.length > 0 || platformCtx === "google_ads") && revenueByDateAndCampaign.size > 0)');
    expect(route).toContain("subCampaignUrn: urn,");
    expect(route).not.toContain("spend weight");
  });

  it("fails closed for stale or wrong Shopify revenue source IDs", () => {
    const routes = readSource("server", "routes-oauth.ts");
    const route = sliceBetween(
      routes,
      'app.post("/api/campaigns/:id/shopify/save-mappings"',
      'app.post("/api/campaigns/:id/chat"'
    );

    expect(route).toContain("storage.getRevenueSource(campaignId, requestedSourceId)");
    expect(route).toContain('sourceType || "").toLowerCase() !== "shopify"');
    expect(route).toContain("existingCtx !== String(platformCtx || \"ga4\").trim().toLowerCase()");
    expect(route).toContain('return res.status(404).json({ error: "Shopify revenue source not found" });');
    expect(route).toContain("await storage.deleteRevenueRecordsBySource(String((source as any).id));");
  });

  it("preserves Shopify additive source behavior and dry-run preview semantics", () => {
    const routes = readSource("server", "routes-oauth.ts");
    const route = sliceBetween(
      routes,
      'app.post("/api/campaigns/:id/shopify/save-mappings"',
      'app.post("/api/campaigns/:id/chat"'
    );

    expect(route).toContain("// Dry-run preview: return computed totals without persisting anything.");
    expect(route).toContain("if (isDryRun) {");
    expect(route).toContain("platformContext: platformCtx");
    expect(route).toContain("// Note: do NOT deactivate existing sources");
    expect(route).toContain("if (requestedSourceId) return String((s as any).id || \"\") === requestedSourceId;");
  });

  it("passes Google Ads context, source identity, attribution boundary, and revenue-only settings from the wizard", () => {
    const wizard = readSource("client", "src", "components", "ShopifyRevenueWizard.tsx");
    const modal = readSource("client", "src", "components", "AddRevenueWizardModal.tsx");
    const scheduler = readSource("server", "auto-refresh-scheduler.ts");

    expect(wizard).toContain('platformContext?: "ga4" | "linkedin" | "meta" | "google_ads";');
    expect(wizard).toContain("platformContext = \"ga4\"");
    expect(wizard).toContain("...(initialMappingConfig?.sourceId ? { sourceId: initialMappingConfig.sourceId } : {})");
    expect(wizard).toContain("selectedValues,");
    expect(wizard).toContain("revenueMetric,");
    expect(wizard).toContain("platformContext,");
    expect(wizard).toContain("valueSource: \"revenue\"");
    expect(wizard).toContain('const isGoogleAds = platformContext === "google_ads";');
    expect(wizard).toContain("selectedCampaignMappings");
    expect(wizard).toContain("Google Ads campaign mapping");
    expect(modal).toContain("platformContext={platformContext}");
    expect(modal).toContain("sourceId: initialSource?.id ? String(initialSource.id) : undefined");
    expect(scheduler).toContain("async function reprocessShopify");
    expect(scheduler).toContain("platformContext: mappingConfig.platformContext");
    expect(scheduler).toContain("...(sourceId ? { sourceId } : {})");
    expect(scheduler).toContain("for (const ctx of refreshableRevenueContexts)");
  });
});
