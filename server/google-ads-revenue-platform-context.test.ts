import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const readSource = (file: string) => readFileSync(join(process.cwd(), file), "utf-8");

describe("Google Ads revenue platform context", () => {
  it("adds Google Ads to storage revenue context filtering without routing non-GA4 totals through LinkedIn", () => {
    const storageFile = readSource("server/storage.ts");

    expect(storageFile).toContain("export type RevenuePlatformContext = 'ga4' | 'linkedin' | 'meta' | 'google_ads' | 'instagram' | 'tiktok' | 'google_sheets';");
    expect(storageFile).toContain("getRevenueTotalForRange(campaignId: string, startDate: string, endDate: string, platformContext?: RevenuePlatformContext)");
    expect(storageFile).toContain("platformContext: RevenuePlatformContext = 'ga4'");
    expect(storageFile).toContain("eq(revenueSources.platformContext, platformContext as any)");
    expect(storageFile).not.toContain("eq(revenueSources.platformContext, 'linkedin' as any),");
  });

  it("permits Google Ads on revenue read and manual source endpoints", () => {
    const routesFile = readSource("server/routes-oauth.ts");

    expect(routesFile).toContain('const zPlatformContext = z.enum(["ga4", "linkedin", "meta", "google_ads", "instagram", "tiktok", "google_sheets"]);');
    expect(routesFile).toContain('const zRevenueReadPlatformContext = z.enum(["ga4", "linkedin", "meta", "google_ads", "instagram", "tiktok", "google_sheets"]);');
    expect(routesFile).toContain("const parseRevenueReadPlatformContext = (");
    expect(routesFile).toContain('storage.getRevenueSources(campaignId, \'google_ads\').catch(() => [] as any[])');
    expect(routesFile).toContain("const revenuePurposeForPlatformContext = (platformContext: any): string => {");
    expect(routesFile).toContain('if (ctx === "google_ads") return "google_ads_revenue";');
    expect(routesFile).toContain("subCampaignUrn: subCampaignUrn || null,");

    const totalsRoute = routesFile.slice(
      routesFile.indexOf('app.get("/api/campaigns/:id/revenue-totals"'),
      routesFile.indexOf("// NOTE: /api/campaigns/:id/revenue-to-date", routesFile.indexOf('app.get("/api/campaigns/:id/revenue-totals"'))
    );
    expect(totalsRoute).toContain("parseRevenueReadPlatformContext");
    expect(totalsRoute).toContain("storage.getRevenueTotalForRange(campaignId, startDate, endDate, platformContext)");
  });
});
