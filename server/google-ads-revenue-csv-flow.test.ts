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

describe("Google Ads revenue CSV flow", () => {
  it("admits Google Ads for CSV revenue processing through the shared platform validator", () => {
    const routes = readSource("server", "routes-oauth.ts");
    const csvRoute = sliceBetween(
      routes,
      '"/api/campaigns/:id/revenue/csv/process"',
      'app.post("/api/campaigns/:id/revenue/sheets/preview"'
    );

    expect(routes).toContain('const zPlatformContext = z.enum(["ga4", "linkedin", "meta", "google_ads"]);');
    expect(routes).toContain('const zCsvRevenuePlatformContext = z.enum(["ga4", "linkedin", "meta", "google_ads"]);');
    expect(csvRoute).toContain('parseCsvRevenuePlatformContext((req.body as any)?.platformContext, "ga4", res)');
    expect(csvRoute).not.toContain('parsePlatformContext((req.body as any)?.platformContext, "ga4", res)');
  });

  it("keeps Google Ads CSV imports source-scoped and revenue-only", () => {
    const routes = readSource("server", "routes-oauth.ts");
    const csvRoute = sliceBetween(
      routes,
      '"/api/campaigns/:id/revenue/csv/process"',
      'app.post("/api/campaigns/:id/revenue/sheets/preview"'
    );

    expect(csvRoute).toContain('platformContext === "linkedin" ? parseValueSource(mapping?.valueSource, "revenue") : "revenue"');
    expect(csvRoute).toContain('sourceType || "").trim().toLowerCase() !== "csv"');
    expect(csvRoute).toContain('platformContext || "ga4").trim().toLowerCase() !== platformContext');
    expect(csvRoute).toContain("storage.updateRevenueSource(existingSourceIdOrNull");
    expect(csvRoute).toContain("await storage.deleteRevenueRecordsBySource(existingSourceIdOrNull);");
    expect(csvRoute).toContain("storage.createRevenueSource({");
    expect(csvRoute).toContain("platformContext,");
    expect(csvRoute).toContain("await storage.deleteRevenueRecordsBySource(source.id);");
  });

  it("materializes Google Ads CSV per-campaign revenue only for exact active campaign IDs", () => {
    const routes = readSource("server", "routes-oauth.ts");
    const csvRoute = sliceBetween(
      routes,
      '"/api/campaigns/:id/revenue/csv/process"',
      'app.post("/api/campaigns/:id/revenue/sheets/preview"'
    );

    expect(csvRoute).toContain('const activeGoogleAdsCampaignIds = platformContext === "google_ads"');
    expect(csvRoute).toContain("exactGoogleAdsCampaignIdOrNull(platformContext, campaignKey, activeGoogleAdsCampaignIds)");
    expect(csvRoute).toContain("const revenueByDateAndCampaign = new Map<string, number>();");
    expect(csvRoute).toContain("subCampaignUrn,");
    expect(csvRoute).not.toContain("spend weight");
  });

  it("passes the Google Ads context and campaign scope from the shared CSV wizard path", () => {
    const modal = readSource("client", "src", "components", "AddRevenueWizardModal.tsx");

    expect(modal).toContain('fd.append("platformContext", platformContext);');
    expect(modal).toContain('toast({ title: "Select a campaign column"');
    expect(modal).toContain('toast({ title: "Select at least 1 campaign value"');
    expect(modal).toContain("campaignColumn: csvCampaignCol");
    expect(modal).toContain("campaignValues: csvCampaignValues");
  });
});
