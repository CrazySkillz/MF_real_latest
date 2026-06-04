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

describe("Google Ads revenue Google Sheets flow", () => {
  it("admits Google Ads for Google Sheets revenue routes through the shared platform validator", () => {
    const routes = readSource("server", "routes-oauth.ts");
    const previewRoute = sliceBetween(
      routes,
      'app.post("/api/campaigns/:id/revenue/sheets/preview"',
      'app.post("/api/campaigns/:id/revenue/sheets/process"'
    );
    const processRoute = sliceBetween(
      routes,
      'app.post("/api/campaigns/:id/revenue/sheets/process"',
      'const deactivateSpendSourcesForCampaign'
    );

    expect(routes).toContain('const zPlatformContext = z.enum(["ga4", "linkedin", "meta", "google_ads"]);');
    expect(routes).toContain('const zSheetsRevenuePlatformContext = z.enum(["ga4", "linkedin", "meta", "google_ads"]);');
    expect(previewRoute).toContain("platformContext: zSheetsRevenuePlatformContext.optional()");
    expect(processRoute).toContain("platformContext: zSheetsRevenuePlatformContext.optional()");
  });

  it("uses Google Ads revenue purpose and keeps imports revenue-only", () => {
    const routes = readSource("server", "routes-oauth.ts");
    const processRoute = sliceBetween(
      routes,
      'app.post("/api/campaigns/:id/revenue/sheets/process"',
      'const deactivateSpendSourcesForCampaign'
    );

    expect(processRoute).toContain("platformContext === 'google_ads' ? 'google_ads_revenue' : 'revenue'");
    expect(processRoute).toContain('platformContext === "linkedin" ? parseValueSource(mapping?.valueSource, "revenue") : "revenue"');
    expect(processRoute).toContain("storage.createRevenueSource({");
    expect(processRoute).toContain("sourceType: \"google_sheets\"");
    expect(processRoute).toContain("platformContext,");
    expect(processRoute).toContain("storage.getRevenueSources(campaignId, platformContext)");
  });

  it("fails closed for stale or wrong Google Sheets revenue source IDs", () => {
    const routes = readSource("server", "routes-oauth.ts");
    const processRoute = sliceBetween(
      routes,
      'app.post("/api/campaigns/:id/revenue/sheets/process"',
      'const deactivateSpendSourcesForCampaign'
    );

    expect(processRoute).toContain('sourceType || "") !== "google_sheets"');
    expect(processRoute).toContain("if (existingSourceId && !existingSheetsSource)");
    expect(processRoute).toContain('return res.status(404).json({ success: false, error: "Revenue source not found" });');
    expect(processRoute).toContain("await storage.deleteRevenueRecordsBySource(String((source as any).id));");
  });

  it("materializes Google Ads Sheets per-campaign revenue only for exact active campaign IDs", () => {
    const routes = readSource("server", "routes-oauth.ts");
    const processRoute = sliceBetween(
      routes,
      'app.post("/api/campaigns/:id/revenue/sheets/process"',
      'const deactivateSpendSourcesForCampaign'
    );

    expect(processRoute).toContain('const activeGoogleAdsCampaignIds = platformContext === "google_ads"');
    expect(processRoute).toContain("exactGoogleAdsCampaignIdOrNull(platformContext, campaignKey, activeGoogleAdsCampaignIds)");
    expect(processRoute).toContain("const revenueByDateAndCampaign = new Map<string, number>();");
    expect(processRoute).toContain("subCampaignUrn,");
    expect(processRoute).not.toContain("spend weight");
  });

  it("passes Google Ads context, purpose, source identity, campaign scope, and date mapping from the shared wizard", () => {
    const modal = readSource("client", "src", "components", "AddRevenueWizardModal.tsx");
    const sheetsAuth = readSource("client", "src", "components", "SimpleGoogleSheetsAuth.tsx");

    expect(modal).toContain("platformContext === 'google_ads' ? 'google_ads_revenue' : 'revenue'");
    expect(modal).toContain("body: JSON.stringify({ connectionId: cid, platformContext })");
    expect(modal).toContain("body: JSON.stringify({ connectionId: sheetsConnectionId, mapping, platformContext })");
    expect(modal).toContain("...(isEditing && initialSource?.id ? { sourceId: String(initialSource.id) } : {})");
    expect(modal).toContain("campaignColumn: hasCampaignScope ? sheetsCampaignCol : null");
    expect(modal).toContain("campaignValues: hasCampaignScope ? sheetsCampaignValues : null");
    expect(modal).toContain("dateColumn: sheetsDateCol || null");
    expect(sheetsAuth).toContain("purpose?: 'spend' | 'revenue' | 'general' | 'linkedin_revenue' | 'meta_revenue' | 'google_ads_revenue';");
    expect(sheetsAuth).toContain("purpose === 'revenue' || purpose === 'linkedin_revenue' || purpose === 'google_ads_revenue'");
  });
});
