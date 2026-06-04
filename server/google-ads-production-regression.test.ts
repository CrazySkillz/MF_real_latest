import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), "utf-8");

const sliceBetween = (source: string, startNeedle: string, endNeedle: string) => {
  const start = source.indexOf(startNeedle);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = source.indexOf(endNeedle, start);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
};

describe("Google Ads production readiness regression guard", () => {
  it("keeps Google Ads available from Create Campaign and Connected Platforms", () => {
    const createCampaign = read("client", "src", "pages", "campaigns.tsx");
    const campaignDetail = read("client", "src", "pages", "campaign-detail.tsx");

    expect(createCampaign).toContain('id: "google-ads"');
    expect(createCampaign).toContain("const isComingSoon = ['twitter'].includes(platform.id);");
    expect(createCampaign).toContain("selectedWizardPlatform === 'google-ads'");
    expect(createCampaign).toContain("<GoogleAdsConnectionFlow");
    expect(campaignDetail).toContain('platform.platform === "Google Ads"');
    expect(campaignDetail).toContain("invalidateGoogleAdsConnectedPlatformQueries");
    expect(campaignDetail).toContain("queryKey: ['/api/platforms/google_ads/reports', campaignId]");
    expect(campaignDetail).not.toContain("queryKey: ['/api/meta/reports', campaignId, 'google_ads']");
  });

  it("preserves selected Google Ads campaign filtering across UI, API, aggregate, scheduler, and snapshots", () => {
    const flow = read("client", "src", "components", "GoogleAdsConnectionFlow.tsx");
    const routes = read("server", "routes-oauth.ts");
    const googleAdsScheduler = read("server", "google-ads-scheduler.ts");
    const campaignScheduler = read("server", "scheduler.ts");

    expect(flow).toContain("setAdsCampaigns(json.campaigns.map((c: any) => ({ ...c, selected: selectedCampaignIds.has(String(c.id)) })))");
    expect(flow).toContain("body: JSON.stringify({ selectedCampaignIds: selectedIds })");
    expect(flow).toContain("disabled={selectedCount === 0 || savingSelection}");
    expect(routes).toContain(".filter((row: any) => selectedSet.size === 0 || selectedSet.has(String(row?.googleCampaignId)));");
    expect(routes).toContain('selectedSet.size === 0 || selectedSet.has(String(row?.googleCampaignId || ""))');
    expect(googleAdsScheduler).toContain("MOCK_CAMPAIGNS.filter(c => selectedIds.includes(c.id))");
    expect(googleAdsScheduler).toContain("client.getDailyMetrics(iso(startDate), iso(endDate), selectedIds && selectedIds.length > 0 ? selectedIds : undefined)");
    expect(campaignScheduler).toContain("googleAdsDailyRows = selectedIds.size > 0");
    expect(campaignScheduler).toContain("freshness: { selectedCampaignIds: googleAdsSelectedCampaignIds }");
  });

  it("keeps disconnect and reconnect campaign-scoped so stale Google Ads rows cannot reseed the source", () => {
    const routes = read("server", "routes-oauth.ts");
    const storage = read("server", "storage.ts");
    const selectRoute = sliceBetween(routes, 'app.post("/api/google-ads/:campaignId/select-customer"', 'app.post("/api/google-ads/:campaignId/connect-test"');
    const testRoute = sliceBetween(routes, 'app.post("/api/google-ads/:campaignId/connect-test"', 'app.get("/api/google-ads/:campaignId/connection"');
    const selectedCampaignRoute = sliceBetween(routes, 'app.patch("/api/google-ads/:campaignId/selected-campaigns"', 'app.post("/api/google-ads/:campaignId/enrich-ga4-revenue"');

    expect(routes).toContain('app.delete("/api/google-ads/:campaignId/connection"');
    expect(routes).toContain("const clearGoogleAdsAttributedRevenueSourcesForCampaign = async (campaignId: string) => {");
    expect(routes).toContain("const existing = await storage.getRevenueSources(campaignId, 'google_ads');");
    expect(routes).toContain("const deleted = await storage.deleteGoogleAdsConnection(campaignId);");
    expect(routes).toContain("if (!connection || (connection as any).spendOnly) return res.json({ success: true, metrics: [] });");
    expect(selectRoute).toContain("await clearGoogleAdsAttributedRevenueSourcesForCampaign(campaignId);");
    expect(selectRoute).toContain("await storage.deleteGoogleAdsDailyMetrics(campaignId).catch(() => {});");
    expect(selectRoute.indexOf("clearGoogleAdsAttributedRevenueSourcesForCampaign(campaignId)")).toBeLessThan(selectRoute.indexOf("storage.createGoogleAdsConnection"));
    expect(testRoute).toContain("await clearGoogleAdsAttributedRevenueSourcesForCampaign(campaignId);");
    expect(selectRoute.indexOf("storage.deleteGoogleAdsDailyMetrics(campaignId)")).toBeLessThan(selectRoute.indexOf("storage.createGoogleAdsConnection"));
    expect(testRoute).toContain("await storage.deleteGoogleAdsDailyMetrics(campaignId).catch(() => {});");
    expect(testRoute.indexOf("storage.deleteGoogleAdsDailyMetrics(campaignId)")).toBeLessThan(testRoute.indexOf("storage.createGoogleAdsConnection"));
    expect(selectedCampaignRoute).toContain("const selectionChanged = previousSelectedCampaignIds.join(\"\\n\") !== nextSelectedCampaignIds.join(\"\\n\");");
    expect(selectedCampaignRoute).toContain("await clearGoogleAdsAttributedRevenueSourcesForCampaign(campaignId);");
    expect(selectedCampaignRoute.indexOf("clearGoogleAdsAttributedRevenueSourcesForCampaign(campaignId)")).toBeLessThan(selectedCampaignRoute.indexOf("storage.updateGoogleAdsConnection"));
    expect(storage).toContain("tx.delete(googleAdsDailyMetrics).where(eq(googleAdsDailyMetrics.campaignId, campaignId))");
  });

  it("keeps Google Ads revenue semantics explicit instead of mixing unavailable, native, and GA4-attributed values", () => {
    const routes = read("server", "routes-oauth.ts");
    const campaignScheduler = read("server", "scheduler.ts");
    const analytics = read("client", "src", "pages", "google-ads-analytics.tsx");
    const helper = sliceBetween(
      routes,
      "async function buildGoogleAdsPlatformSourceForAggregate(campaignId: string, startDate: string, endDate: string)",
      "async function buildLinkedInPlatformSourceForAggregate"
    );
    const trendRoute = sliceBetween(
      routes,
      'app.get("/api/campaigns/:id/trend-analysis"',
      "// Limits + timeouts"
    );

    expect(helper).toContain('storage.getRevenueTotalForRange(campaignId, startDate, endDate, "google_ads")');
    expect(helper).toContain('const attributedRevenueSource = hasImportedAttributedRevenue ? "google_ads_imported_attributed_revenue" : "unavailable";');
    expect(helper).toContain('includedMetrics: ["impressions", "clicks", "spend", "conversions", ...(hasImportedAttributedRevenue ? ["attributedRevenue"] : [])]');
    expect(helper).toContain('Google Ads Total Revenue requires a Google Ads-scoped imported revenue source');
    expect(helper).toContain('importedAttributedRevenue');
    expect(helper).toContain('conversionValueLabel: "Native Google Ads conversion value"');
    expect(helper).toContain('ga4AttributedRevenueLabel: "GA4-matched revenue; not used as Google Ads Total Revenue"');
    expect(helper).not.toContain('"google_ads_conversion_value"');
    expect(helper).not.toContain('"ga4_attributed_revenue"');
    expect(campaignScheduler).toContain('storage.getRevenueTotalForRange(campaignId, startDate, endDate, "google_ads")');
    expect(campaignScheduler).toContain('const googleAdsAttributedRevenueSource = hasGoogleAdsImportedAttributedRevenue ? "google_ads_imported_attributed_revenue" : "unavailable";');
    expect(campaignScheduler).toContain('attributedRevenue: hasGoogleAdsImportedAttributedRevenue ? googleAdsImportedAttributedRevenue : 0');
    expect(campaignScheduler).toContain('importedRevenueSourceIds: googleAdsImportedRevenueSourceIds');
    expect(campaignScheduler).toContain('Google Ads Total Revenue requires a Google Ads-scoped imported revenue source');
    expect(campaignScheduler).not.toContain('googleAdsRawData.conversionValue > 0 ? "google_ads_conversion_value" : "unavailable"');
    expect(campaignScheduler).not.toContain('attributedRevenueSource === "google_ads_conversion_value"');
    expect(trendRoute).toContain('storage.getRevenueTotalForRange(campaignId, startDate, endDate, "google_ads")');
    expect(trendRoute).toContain("const hasGoogleAdsImportedAttributedRevenue = googleAdsImportedAttributedRevenue > 0;");
    expect(trendRoute).toContain('...(hasGoogleAdsImportedAttributedRevenue ? ["attributedRevenue", "revenue"] : [])');
    expect(trendRoute).toContain('Google Ads Total Revenue requires a Google Ads-scoped imported revenue source');
    expect(trendRoute).toContain('attributedRevenue: hasGoogleAdsImportedAttributedRevenue ? importedAttributedRevenue : 0');
    expect(trendRoute).toContain('revenue: hasGoogleAdsImportedAttributedRevenue ? importedAttributedRevenue : 0');
    expect(trendRoute).not.toContain('attributedRevenueSource === "ga4_attributed_revenue"');
    expect(trendRoute).not.toContain('attributedRevenueSource === "google_ads_conversion_value"');
    expect(analytics).toContain("Native Google Ads conversion value and derived conversion-value efficiency. Imported attributed revenue is shown separately.");
    expect(analytics).toContain("Native Google Ads conversion value");
    expect(analytics).toContain("No value recorded");
  });
});
