import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const readSource = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), "utf-8");

describe("Google Ads revenue scheduler flow", () => {
  it("includes Google Ads revenue sources in refreshable provider context loops", () => {
    const scheduler = readSource("server", "auto-refresh-scheduler.ts");

    expect(scheduler).toContain('const refreshableRevenueContexts = ["ga4", "linkedin", "meta", "google_ads"] as const;');
    expect(scheduler).toContain('const crmRevenueContexts = ["ga4", "meta", "google_ads"] as const;');
    expect(scheduler).toContain("for (const ctx of crmRevenueContexts)");
    expect(scheduler).toContain("for (const ctx of refreshableRevenueContexts)");
    expect(scheduler).toContain("storage.getRevenueSources(campaignId, ctx)");
  });

  it("keeps Google Ads auto-refresh source-scoped with stable source IDs", () => {
    const scheduler = readSource("server", "auto-refresh-scheduler.ts");

    expect(scheduler).toContain("reprocessHubSpot(campaignId, hubCfg, String(hubspotSource.id))");
    expect(scheduler).toContain("reprocessSalesforce(campaignId, sfCfg, String(salesforceSource.id))");
    expect(scheduler).toContain("reprocessShopify(campaignId, shopCfg, String(shopifySource.id))");
    expect(scheduler).toContain("reprocessGoogleSheetsRevenue(campaignId, sheetRevenue, revCfg)");
    expect(scheduler).toContain("platformContext: hubCfgRaw.platformContext || hubspotSource.platformContext || ctx");
    expect(scheduler).toContain("platformContext: sfCfgRaw.platformContext || salesforceSource.platformContext || ctx");
    expect(scheduler).toContain("platformContext: shopCfgRaw.platformContext || shopifySource.platformContext || ctx");
    expect(scheduler).toContain("platformContext: revCfgRaw.platformContext || sheetRevenue.platformContext || ctx");
  });
});
