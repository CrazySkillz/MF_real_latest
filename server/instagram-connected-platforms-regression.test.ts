import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("Instagram Connected Platforms regression guard", () => {
  it("surfaces Instagram status only from the persisted source contract", () => {
    const routes = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");
    const routeStart = routes.indexOf('app.get("/api/campaigns/:id/connected-platforms"');
    const routeEnd = routes.indexOf("// Get list of LinkedIn campaigns", routeStart);
    const route = routes.slice(routeStart, routeEnd);

    expect(route).toContain("storage.getInstagramConnection(campaignId)");
    expect(route).toContain("instagramSelectedCampaignIds");
    expect(route).toContain("instagramSelectedCampaignIds.length > 0");
    expect(route).toContain('id: "instagram"');
    expect(route).toContain('name: "Instagram Ads"');
    expect(route).toContain("connected: instagramConnected");
    expect(route).toContain('analyticsPath: instagramConnected ? `/campaigns/${campaignId}/instagram-analytics` : null');
    expect(route).toContain("sourceContractVersion: instagramConnection?.sourceContractVersion");
    expect(route).not.toContain("upsertInstagramDailyMetrics");
    expect(route).not.toContain("refreshInstagram");
  });

  it("renders the Instagram Connected Platforms card shell with guarded analytics exposure", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "campaign-detail.tsx"), "utf-8");

    expect(page).toContain('import { SiGoogle, SiFacebook, SiInstagram');
    expect(page).toContain('const isInstagramConnected = platformStatusMap.get("instagram")?.connected === true;');
    expect(page).toContain('platform: "Instagram Ads"');
    expect(page).toContain("connected: isInstagramConnected");
    expect(page).toContain("platformStatusMap.get(\"instagram\")?.analyticsPath || `/campaigns/${campaign?.id}/instagram-analytics`");
    expect(page).toContain('case "Instagram Ads":');
    expect(page).toContain("p === 'Instagram Ads'");
    expect(page).toContain("`/api/instagram/${campaignId}/connection`");
    expect(page).toContain("button-view-${platform.platform.toLowerCase().replace");
    expect(page).not.toContain("InstagramConnectionFlow");
  });

  it("connects Instagram from Connected Platforms only through the test source-contract route", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "campaign-detail.tsx"), "utf-8");

    expect(page).toContain("connectInstagramTestMode");
    expect(page).toContain("invalidateInstagramConnectedPlatformQueries");
    expect(page).toContain("selectedCampaignIds.length === 0");
    expect(page).toContain('title: "Instagram campaign required"');
    expect(page).toContain('title: "Connection Failed"');
    expect(page).toContain("`/api/instagram/${campaignId}/connect-test`");
    expect(page).toContain('platform.platform === "Instagram Ads" ?');
    expect(page).toContain("Connect Instagram Test Account");
    expect(page).toContain('queryKey: ["/api/campaigns", campaignId, "connected-platforms"]');
    expect(page).toContain("`/api/instagram/${campaignId}/connection`");
    expect(page).toContain("`/api/campaigns/${campaignId}/outcome-totals`");
    expect(page).toContain("`/api/campaigns/${campaignId}/executive-summary`");
    expect(page).toContain("`/api/campaigns/${campaignId}/trend-analysis`");
    expect(page).toContain("`/api/campaigns/${campaignId}/kpis`");
    expect(page).toContain("`/api/campaigns/${campaignId}/benchmarks`");
    expect(page).toContain("`/api/campaigns/${campaignId}/all-data-sources`");
    expect(page).not.toContain("/api/instagram/oauth");
    expect(page).not.toContain("refreshInstagram");
    expect(page).not.toContain("upsertInstagramDailyMetrics");
  });

  it("keeps Campaign Overview Instagram status read-only until source-backed metrics and financial context exist", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "campaign-detail.tsx"), "utf-8");

    expect(page).toContain('const isInstagramConnected = platformStatusMap.get("instagram")?.connected === true;');
    expect(page).toContain('platform: "Instagram Ads"');
    expect(page).toContain("connected: isInstagramConnected");
    expect(page).toContain("platformStatusMap.get(\"instagram\")?.analyticsPath || `/campaigns/${campaign?.id}/instagram-analytics`");
    expect(page).toContain('instagramHasSourceRows ? undefined : "Source-backed Instagram metrics are not available yet."');
    expect(page).toContain("platform.platform === \"Instagram Ads\" && platform.unavailableReason");
    expect(page).toContain("`/api/instagram/${campaignId}/overview-summary`");
    expect(page).toContain("instagramHasSourceRows ? undefined");
    expect(page).not.toContain('{ label: "Instagram", value: "instagram"');
    expect(page).not.toContain('{ label: "Instagram Ads", value: "instagram"');
  });

  it("reads Campaign Overview Instagram metrics only from selected persisted daily rows", () => {
    const routes = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");
    const routeStart = routes.indexOf('app.get("/api/instagram/:campaignId/overview-summary"');
    const routeEnd = routes.indexOf('app.post("/api/meta/transfer-connection"', routeStart);
    const route = routes.slice(routeStart, routeEnd);

    expect(route).toContain("ensureCampaignAccess");
    expect(route).toContain("storage.getInstagramConnection(parsedId.data)");
    expect(route).toContain("selectedCampaignIds");
    expect(route).toContain("storage.getInstagramDailyMetrics(parsedId.data, startDate, endDate)");
    expect(route).toContain("selected.has(String(row.instagramCampaignId))");
    expect(route).toContain('String(row.publisherPlatform || "instagram") === "instagram"');
    expect(route).toContain("hasRows: rows.length > 0");
    expect(route).not.toContain("upsertInstagramDailyMetrics");
    expect(route).not.toContain("refreshInstagram");
  });

  it("exposes Instagram analytics daily metrics only from selected persisted daily rows", () => {
    const routes = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");
    const routeStart = routes.indexOf('app.get("/api/instagram/:campaignId/daily-metrics"');
    const routeEnd = routes.indexOf('app.post("/api/meta/transfer-connection"', routeStart);
    const route = routes.slice(routeStart, routeEnd);

    expect(route).toContain("ensureCampaignAccess");
    expect(route).toContain("storage.getInstagramConnection(parsedId.data)");
    expect(route).toContain("selectedCampaignIds");
    expect(route).toContain("storage.getInstagramDailyMetrics(parsedId.data, startDate, endDate)");
    expect(route).toContain("selected.has(String(row.instagramCampaignId))");
    expect(route).toContain('String(row.publisherPlatform || "instagram") === "instagram"');
    expect(route).toContain("rowCount: rows.length");
    expect(route).toContain("rows,");
    expect(route).not.toContain("upsertInstagramDailyMetrics");
    expect(route).not.toContain("refreshInstagram");
    expect(route).not.toContain("/api/instagram/oauth");
  });

  it("builds Instagram aggregate sources only from selected persisted Instagram daily rows", () => {
    const routes = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");
    const helperStart = routes.indexOf("async function buildInstagramPlatformSourceForAggregate");
    const helperEnd = routes.indexOf("async function buildLinkedInPlatformSourceForAggregate", helperStart);
    const helper = routes.slice(helperStart, helperEnd);

    expect(helperStart).toBeGreaterThanOrEqual(0);
    expect(helper).toContain("storage.getInstagramConnection(campaignId)");
    expect(helper).toContain("selectedCampaignIds.length > 0");
    expect(helper).toContain("storage.getInstagramDailyMetrics(campaignId, startDate, endDate)");
    expect(helper).toContain("selectedSet.has(String(row?.instagramCampaignId))");
    expect(helper).toContain('String(row?.publisherPlatform || "instagram") === "instagram"');
    expect(helper).toContain('id: "instagram"');
    expect(helper).toContain('label: "Instagram Ads"');
    expect(helper).toContain('category: "paid_media"');
    expect(helper).toContain('attributedRevenueSource: "unavailable"');
    expect(helper).not.toContain("getMetaDailyMetrics");
    expect(helper).not.toContain("MetaGraphAPIClient");
    expect(helper).not.toContain("upsertInstagramDailyMetrics");
    expect(helper).not.toContain("refreshInstagram");
  });

  it("allows Instagram through the aggregate main platform source composition without route wiring", () => {
    const routes = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");
    const helperStart = routes.indexOf("function buildMainPlatformSourcesForAggregate");
    const helperEnd = routes.indexOf("function buildCampaignPerformanceSummaryAggregate", helperStart);
    const helper = routes.slice(helperStart, helperEnd);

    expect(helperStart).toBeGreaterThanOrEqual(0);
    expect(helper).toContain("sources: { googleAds?: any; instagram?: any } = {}");
    expect(helper).toContain("[sources.googleAds, sources.instagram]");
    expect(helper).toContain("source?.connected === true");
  });

  it("fails closed for Meta plus Instagram combined paid-media aggregate totals", () => {
    const aggregate = readFileSync(join(process.cwd(), "server", "utils", "performance-summary-aggregate.ts"), "utf-8");

    expect(aggregate).toContain("hasMetaInstagramOverlapRisk");
    expect(aggregate).toContain('source.id === "meta" && source.connected');
    expect(aggregate).toContain('source.id === "instagram" && source.connected');
    expect(aggregate).toContain('!(hasMetaInstagramOverlapRisk && source.id === "instagram")');
  });

  it("wires Instagram into Campaign DeepDive aggregate routes without refresh or write behavior", () => {
    const routes = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");
    const outcomeStart = routes.indexOf('app.get("/api/campaigns/:id/outcome-totals"');
    const outcomeEnd = routes.indexOf('app.get("/api/campaigns/:id/ga4-connections"', outcomeStart);
    const outcomeRoute = routes.slice(outcomeStart, outcomeEnd);
    const executiveStart = routes.indexOf('app.get("/api/campaigns/:id/executive-summary"');
    const executiveEnd = routes.indexOf('app.get("/api/campaigns/:id/utm-performance"', executiveStart);
    const executiveRoute = routes.slice(executiveStart, executiveEnd);

    for (const route of [outcomeRoute, executiveRoute]) {
      expect(route).toContain("buildInstagramPlatformSourceForAggregate");
      expect(route).toContain("mainPlatformSources: { googleAds, instagram }");
      expect(route).toContain("instagramSpendForAggregate");
      expect(route).not.toContain("upsertInstagramDailyMetrics");
      expect(route).not.toContain("refreshInstagram");
      expect(route).not.toContain("/api/instagram/oauth");
    }
  });

  it("registers an Instagram analytics route shell guarded by the campaign connection", () => {
    const app = readFileSync(join(process.cwd(), "client", "src", "App.tsx"), "utf-8");
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "instagram-analytics.tsx"), "utf-8");

    expect(app).toContain('const InstagramAnalytics = lazy(() => import("@/pages/instagram-analytics"));');
    expect(app).toContain('<Route path="/campaigns/:id/instagram-analytics" component={InstagramAnalytics} />');
    expect(page).toContain('useRoute("/campaigns/:id/instagram-analytics")');
    expect(page).toContain("`/api/instagram/${campaignId}/connection`");
    expect(page).toContain("connection?.connected === true");
    expect(page).toContain("connection.selectedCampaignIds.length > 0");
    expect(page).toContain("Connect Instagram Ads from the campaign Connected Platforms section");
    expect(page).not.toContain("overview-summary");
    expect(page).not.toContain("upsertInstagramDailyMetrics");
    expect(page).not.toContain("refreshInstagram");
    expect(page).not.toContain("/api/instagram/oauth");
  });

  it("renders Instagram analytics Overview from the selected daily metrics endpoint only", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "instagram-analytics.tsx"), "utf-8");

    expect(page).toContain("`/api/instagram/${campaignId}/daily-metrics`");
    expect(page).toContain("`/api/instagram/${campaignId}/daily-metrics?dateRange=30days`");
    expect(page).toContain('<TabsTrigger value="overview">Overview</TabsTrigger>');
    expect(page).toContain("overviewTotals.impressions");
    expect(page).toContain("overviewTotals.clicks");
    expect(page).toContain("overviewTotals.spend");
    expect(page).toContain("overviewTotals.conversions");
    expect(page).toContain("No selected source-backed Instagram metric rows are available yet.");
    expect(page).not.toContain("upsertInstagramDailyMetrics");
    expect(page).not.toContain("refreshInstagram");
    expect(page).not.toContain("/api/instagram/oauth");
  });

  it("renders Instagram analytics Campaign Breakdown from selected daily rows only", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "instagram-analytics.tsx"), "utf-8");

    expect(page).toContain('<TabsTrigger value="campaign-breakdown">Campaign Breakdown</TabsTrigger>');
    expect(page).toContain("const campaignBreakdown = useMemo");
    expect(page).toContain("row.instagramCampaignId");
    expect(page).toContain("instagramCampaignName");
    expect(page).toContain("campaignBreakdown.map");
    expect(page).toContain("No selected Instagram campaign rows are available yet.");
    expect(page).not.toContain("upsertInstagramDailyMetrics");
    expect(page).not.toContain("refreshInstagram");
    expect(page).not.toContain("/api/instagram/oauth");
  });

  it("renders Instagram analytics unavailable, error, and freshness states without refresh behavior", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "instagram-analytics.tsx"), "utf-8");

    expect(page).toContain("error: metricsError");
    expect(page).toContain("Latest Instagram row import:");
    expect(page).toContain("latestImportedAt");
    expect(page).toContain("No selected source-backed Instagram metric rows are available yet.");
    expect(page).toContain("No selected Instagram campaign rows are available yet.");
    expect(page).toContain("Connect Instagram Ads from the campaign Connected Platforms section");
    expect(page).not.toContain("upsertInstagramDailyMetrics");
    expect(page).not.toContain("refreshInstagram");
    expect(page).not.toContain("/api/instagram/oauth");
  });
});
