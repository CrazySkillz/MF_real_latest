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

describe("Google Ads revenue HubSpot flow", () => {
  it("admits Google Ads for HubSpot revenue save through the shared platform validator", () => {
    const routes = readSource("server", "routes-oauth.ts");
    const route = sliceBetween(
      routes,
      'app.post("/api/campaigns/:id/hubspot/save-mappings"',
      "// Helper function to refresh Google Sheets access token"
    );

    expect(routes).toContain('const zPlatformContext = z.enum(["ga4", "linkedin", "meta", "google_ads"]);');
    expect(routes).toContain('const zHubSpotRevenuePlatformContext = z.enum(["ga4", "linkedin", "meta", "google_ads"]);');
    expect(route).toContain("platformContext: zHubSpotRevenuePlatformContext.optional()");
    expect(route).not.toContain("platformContext: zPlatformContext.optional()");
  });

  it("keeps Google Ads HubSpot imports revenue-only and source-scoped", () => {
    const routes = readSource("server", "routes-oauth.ts");
    const route = sliceBetween(
      routes,
      'app.post("/api/campaigns/:id/hubspot/save-mappings"',
      "// Helper function to refresh Google Sheets access token"
    );

    expect(route).toContain('platformContextRaw === "linkedin" ? "linkedin" : platformContextRaw === "meta" ? "meta" : platformContextRaw === "google_ads" ? "google_ads" : "ga4"');
    expect(route).toContain("const effectiveValueSource: 'revenue' | 'conversion_value' = (platformCtx === 'linkedin' ? parsedValueSource : 'revenue');");
    expect(route).toContain("storage.getRevenueSources(campaignId, platformCtx as any)");
    expect(route).toContain('sourceType: "hubspot"');
    expect(route).toContain("platformContext: platformCtx");
    expect(route).toContain("dailyMaterialization: platformCtx === \"ga4\" && revenueByCloseDate.size > 0 ? \"selected_date_field_v1\" : null");
  });

  it("materializes Google Ads HubSpot per-campaign revenue for exact IDs or explicit active campaign mappings", () => {
    const routes = readSource("server", "routes-oauth.ts");
    const route = sliceBetween(
      routes,
      'app.post("/api/campaigns/:id/hubspot/save-mappings"',
      "// Helper function to refresh Google Sheets access token"
    );

    expect(route).toContain('const activeGoogleAdsCampaignIds = platformCtx === "google_ads"');
    expect(route).toContain("googleAdsCampaignIdFromValueOrMapping(platformCtx, campaignValue, campaignMappings, activeGoogleAdsCampaignIds)");
    expect(route).toContain('} else if (platformCtx === "linkedin" && campaignMappings.length > 0) {');
    expect(route).toContain('if ((campaignMappings.length > 0 || platformCtx === "google_ads") && revenueByLinkedinCampaign.size > 0)');
    expect(route).toContain("subCampaignUrn: urn,");
    expect(route).not.toContain("spend weight");
  });

  it("fails closed for stale or wrong HubSpot revenue source IDs", () => {
    const routes = readSource("server", "routes-oauth.ts");
    const route = sliceBetween(
      routes,
      'app.post("/api/campaigns/:id/hubspot/save-mappings"',
      "// Helper function to refresh Google Sheets access token"
    );

    expect(route).toContain("storage.getRevenueSource(campaignId, requestedSourceId)");
    expect(route).toContain('sourceType || "").toLowerCase() !== "hubspot"');
    expect(route).toContain("existingCtx !== platformCtx");
    expect(route).toContain('return res.status(404).json({ error: "HubSpot revenue source not found" });');
    expect(route).toContain("await storage.deleteRevenueRecordsBySource(String((source as any).id));");
  });

  it("keeps HubSpot Pipeline Proxy separate and only includes Google Ads when explicitly requested", () => {
    const routes = readSource("server", "routes-oauth.ts");
    const pipelineRoute = sliceBetween(
      routes,
      'app.get("/api/hubspot/:campaignId/pipeline-proxy"',
      "// Clear HubSpot pipeline proxy config"
    );

    expect(pipelineRoute).toContain('["ga4", "linkedin", "meta", "google_ads"]');
    expect(pipelineRoute).toContain(': ["ga4", "linkedin", "meta"] as const;');
    expect(pipelineRoute).toContain('String(cfg?.platformContext || cfg?.platform || "").trim().toLowerCase() !== requestedPlatformContext');
    expect(pipelineRoute).toContain("totalToDate: Number(cfg.pipelineTotalToDate || 0)");
  });

  it("passes Google Ads context, source identity, attribution boundary, and Pipeline Proxy settings from the wizard", () => {
    const wizard = readSource("client", "src", "components", "HubSpotRevenueWizard.tsx");
    const modal = readSource("client", "src", "components", "AddRevenueWizardModal.tsx");
    const scheduler = readSource("server", "auto-refresh-scheduler.ts");

    expect(wizard).toContain('platformContext?: "ga4" | "linkedin" | "meta" | "google_ads";');
    expect(wizard).toContain("platformContext,");
    expect(wizard).toContain("selectedValues,");
    expect(wizard).toContain("...(sourceId ? { sourceId } : {})");
    expect(wizard).toContain("pipelineEnabled,");
    expect(wizard).toContain("pipelineStageId: pipelineEnabled ? pipelineStageId : null");
    expect(wizard).toContain('const isGoogleAds = platformContext === "google_ads";');
    expect(wizard).toContain("selectedCampaignMappings");
    expect(wizard).toContain("Google Ads campaign mapping");
    expect(modal).toContain("platformContext={platformContext}");
    expect(modal).toContain('sourceId={isEditing && String(initialSource?.sourceType || "").toLowerCase() === "hubspot" ? String(initialSource?.id || "") : undefined}');
    expect(scheduler).toContain("platformContext: mappingConfig.platformContext");
    expect(scheduler).toContain("...(sourceId ? { sourceId } : {})");
  });
});
