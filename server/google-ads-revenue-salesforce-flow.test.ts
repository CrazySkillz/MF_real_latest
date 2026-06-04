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

describe("Google Ads revenue Salesforce flow", () => {
  it("admits Google Ads for Salesforce revenue save through the shared platform validator", () => {
    const routes = readSource("server", "routes-oauth.ts");
    const route = sliceBetween(
      routes,
      'app.post("/api/campaigns/:id/salesforce/save-mappings"',
      "// Salesforce pipeline proxy status"
    );

    expect(routes).toContain('const zPlatformContext = z.enum(["ga4", "linkedin", "meta", "google_ads"]);');
    expect(routes).toContain('const zSalesforceRevenuePlatformContext = z.enum(["ga4", "linkedin", "meta", "google_ads"]);');
    expect(route).toContain("platformContext: zSalesforceRevenuePlatformContext.optional()");
    expect(route).not.toContain("platformContext: zPlatformContext.optional()");
  });

  it("keeps Google Ads Salesforce imports revenue-only and source-scoped", () => {
    const routes = readSource("server", "routes-oauth.ts");
    const route = sliceBetween(
      routes,
      'app.post("/api/campaigns/:id/salesforce/save-mappings"',
      "// Salesforce pipeline proxy status"
    );

    expect(route).toContain('platformContextRaw === "linkedin" ? "linkedin" : platformContextRaw === "google_ads" ? "google_ads" : "ga4"');
    expect(route).toContain("platformCtx === 'linkedin' && String(valueSource || '').trim().toLowerCase() === 'conversion_value'");
    expect(route).toContain('sourceType: "salesforce"');
    expect(route).toContain("platformContext: platformCtx");
    expect(route).toContain('dailyMaterialization: platformCtx === "ga4" && revenueByDate.size > 0 ? "selected_date_field_v1" : null');
    expect(route).toContain("if (platformCtx === \"ga4\" && totalRevenue > 0 && materializedRecordCount <= 0)");
  });

  it("materializes Google Ads Salesforce per-campaign revenue only for exact active campaign IDs", () => {
    const routes = readSource("server", "routes-oauth.ts");
    const route = sliceBetween(
      routes,
      'app.post("/api/campaigns/:id/salesforce/save-mappings"',
      "// Salesforce pipeline proxy status"
    );

    expect(route).toContain('const activeGoogleAdsCampaignIds = platformCtx === "google_ads"');
    expect(route).toContain("exactGoogleAdsCampaignIdOrNull(platformCtx, campaignValue, activeGoogleAdsCampaignIds)");
    expect(route).toContain('if ((campaignMappings.length > 0 || platformCtx === "google_ads") && revenueByDateAndCampaign.size > 0)');
    expect(route).toContain("subCampaignUrn: urn,");
    expect(route).not.toContain("spend weight");
  });

  it("fails closed for stale or wrong Salesforce revenue source IDs", () => {
    const routes = readSource("server", "routes-oauth.ts");
    const route = sliceBetween(
      routes,
      'app.post("/api/campaigns/:id/salesforce/save-mappings"',
      "// Salesforce pipeline proxy status"
    );

    expect(route).toContain("storage.getRevenueSource(campaignId, existingSourceIdOrNull)");
    expect(route).toContain('sourceType || "").toLowerCase() !== "salesforce"');
    expect(route).toContain("existingCtx !== platformCtx");
    expect(route).toContain('return res.status(404).json({ error: "Salesforce revenue source not found" });');
    expect(route).toContain("await storage.deleteRevenueRecordsBySource(existingSourceIdOrNull);");
  });

  it("keeps Salesforce Pipeline Proxy separate and only includes Google Ads when explicitly requested", () => {
    const routes = readSource("server", "routes-oauth.ts");
    const pipelineRoute = sliceBetween(
      routes,
      'app.get("/api/salesforce/:campaignId/pipeline-proxy"',
      "// HubSpot pipeline proxy status"
    );

    expect(pipelineRoute).toContain('["ga4", "linkedin", "meta", "google_ads"]');
    expect(pipelineRoute).toContain(': ["ga4", "linkedin", "meta"] as const;');
    expect(pipelineRoute).toContain('String(cfg?.platformContext || cfg?.platform || "").trim().toLowerCase() !== requestedPlatformContext');
    expect(pipelineRoute).toContain("totalToDate: cached");
    expect(pipelineRoute).toContain("mode: cachedMode");
  });

  it("passes Google Ads context, source identity, attribution boundary, and Pipeline Proxy settings from the wizard", () => {
    const wizard = readSource("client", "src", "components", "SalesforceRevenueWizard.tsx");
    const modal = readSource("client", "src", "components", "AddRevenueWizardModal.tsx");
    const scheduler = readSource("server", "auto-refresh-scheduler.ts");

    expect(wizard).toContain('platformContext?: "ga4" | "linkedin" | "meta" | "google_ads";');
    expect(wizard).toContain("platformContext = \"ga4\"");
    expect(wizard).toContain("...(mode === \"edit\" && sourceId ? { sourceId } : {})");
    expect(wizard).toContain("selectedValues,");
    expect(wizard).toContain("dateField,");
    expect(wizard).toContain("pipelineStageName: pipelineEnabled ? (pipelineStageName || null) : null");
    expect(wizard).toContain("platformContext,");
    expect(modal).toContain("platformContext={platformContext}");
    expect(modal).toContain('sourceId={isEditing && String(initialSource?.sourceType || "").toLowerCase() === "salesforce" ? String(initialSource?.id || "") : undefined}');
    expect(scheduler).toContain("async function reprocessSalesforce");
    expect(scheduler).toContain("platformContext: mappingConfig.platformContext");
    expect(scheduler).toContain("...(sourceId ? { sourceId } : {})");
  });
});
