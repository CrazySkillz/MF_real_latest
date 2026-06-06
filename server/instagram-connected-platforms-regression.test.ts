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
    const routeEnd = routes.indexOf('app.get("/api/instagram/:campaignId/daily-metrics"', routeStart);
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

  it("exposes Instagram analytics daily metrics only from selected rows with test-mode missing-row self-heal", () => {
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
    expect(route).toContain('String((connection as any).method || "") === "test_mode"');
    expect(route).toContain("persistedRows.length === 0");
    expect(route).toContain("storage.upsertInstagramDailyMetrics(seedRows as any)");
    expect(route).toContain("rowCount: rows.length");
    expect(route).toContain("rows,");
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

  it("allows source-backed Instagram paid-media metrics into aggregate totals", () => {
    const aggregate = readFileSync(join(process.cwd(), "server", "utils", "performance-summary-aggregate.ts"), "utf-8");

    expect(aggregate).toContain("const paidMetricSources = (metricName: string)");
    expect(aggregate).toContain("source.includedMetrics.includes(metricName)");
    expect(aggregate).not.toContain("hasMetaInstagramOverlapRisk");
    expect(aggregate).not.toContain('source.id === "instagram"');
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
      expect(route).toContain("const instagramSpendForAggregate = instagramSpend;");
      expect(route).not.toContain("upsertInstagramDailyMetrics");
      expect(route).not.toContain("refreshInstagram");
      expect(route).not.toContain("/api/instagram/oauth");
    }
  });

  it("allows Instagram as a validated financial platform context without adding refresh behavior", () => {
    const routes = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");
    const validationStart = routes.indexOf("const zPlatformContext = z.enum");
    const validationEnd = routes.indexOf("const zRevenueMapping = z", validationStart);
    const validation = routes.slice(validationStart, validationEnd);

    expect(validation).toContain('z.enum(["ga4", "linkedin", "meta", "google_ads", "instagram"])');
    expect(routes).toContain("RevenueReadPlatformContext[] = ['ga4', 'linkedin', 'meta', 'google_ads', 'instagram']");
    expect(validation).toContain('"instagram" | null');
    expect(routes).not.toContain("/api/instagram/oauth");
    expect(routes).not.toContain("refreshInstagram(");
    expect(routes).not.toContain("refreshInstagramForCampaign");
    expect(validation).not.toContain("upsertInstagramDailyMetrics");
  });

  it("writes Instagram test daily metrics from test connect and explicit test refresh only", () => {
    const routes = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");
    const connectStart = routes.indexOf('app.post("/api/instagram/:campaignId/connect-test"');
    const connectEnd = routes.indexOf("/**\n   * Update selected Instagram campaigns", connectStart);
    const connectRoute = routes.slice(connectStart, connectEnd);
    const routeStart = routes.indexOf('app.post("/api/instagram/:campaignId/refresh-test"');
    const routeEnd = routes.indexOf("/**\n   * Manually refresh live Instagram daily metrics", routeStart);
    const route = routes.slice(routeStart, routeEnd);

    expect(connectStart).toBeGreaterThanOrEqual(0);
    expect(connectRoute).toContain("ensureCampaignAccess");
    expect(connectRoute).toContain("selectedCampaignIds.length === 0");
    expect(connectRoute).toContain('publisherPlatform: "instagram"');
    expect(connectRoute).toContain('platformPosition: "instagram_feed"');
    expect(connectRoute).toContain("storage.upsertInstagramDailyMetrics(rows as any)");
    expect(connectRoute).not.toContain("MetaGraphAPIClient");
    expect(routeStart).toBeGreaterThanOrEqual(0);
    expect(route).toContain("ensureCampaignAccess");
    expect(route).toContain("storage.getInstagramConnection(parsedId.data)");
    expect(route).toContain('String((connection as any).method || "") !== "test_mode"');
    expect(route).toContain("selectedCampaignIds.length === 0");
    expect(route).toContain('publisherPlatform: "instagram"');
    expect(route).toContain('platformPosition: "instagram_feed"');
    expect(route).toContain("storage.upsertInstagramDailyMetrics(rows as any)");
    expect(route).toContain("storage.updateInstagramConnection(parsedId.data, { lastRefreshAt: new Date() } as any)");
    expect(route).not.toContain("MetaGraphAPIClient");
    expect(route).not.toContain("getMetaDailyMetrics");
    expect(route).not.toContain("/api/instagram/oauth");
    expect(route).not.toContain("refreshInstagram");
  });

  it("manual Instagram refresh imports only selected live Instagram placement rows", () => {
    const routes = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");
    const routeStart = routes.indexOf('app.post("/api/instagram/:campaignId/refresh"');
    const routeEnd = routes.indexOf("/**\n   * Get Meta analytics data for a campaign", routeStart);
    const route = routes.slice(routeStart, routeEnd);
    const metaClient = readFileSync(join(process.cwd(), "server", "services", "meta-graph-api.ts"), "utf-8");

    expect(routeStart).toBeGreaterThanOrEqual(0);
    expect(route).toContain("ensureCampaignAccess");
    expect(route).toContain("storage.getInstagramConnection(parsedId.data)");
    expect(route).toContain('String((connection as any).method || "") === "test_mode"');
    expect(route).toContain("selectedCampaignIds.length === 0");
    expect(route).toContain("new MetaGraphAPIClient((connection as any).accessToken as string)");
    expect(route).toContain("metaClient.getCampaignDailyPlacementInsights(instagramCampaignId, { since: startDate, until: endDate })");
    expect(route).toContain('String(placement.publisherPlatform || "").trim().toLowerCase() !== "instagram"');
    expect(route).toContain('publisherPlatform: "instagram"');
    expect(route).toContain("storage.upsertInstagramDailyMetrics(rows as any)");
    expect(route).toContain("storage.updateInstagramConnection(parsedId.data, { lastRefreshAt: new Date() } as any)");
    expect(route).not.toContain("getMetaDailyMetrics");
    expect(route).not.toContain("storage.upsertMetaDailyMetrics");
    expect(route).not.toContain("/api/instagram/oauth");
    expect(route).not.toContain("refreshInstagram");
    expect(metaClient).toContain("async getCampaignDailyPlacementInsights");
    expect(metaClient).toContain("time_increment: 1");
    expect(metaClient).toContain("breakdowns: 'publisher_platform,platform_position'");
    expect(metaClient).toContain("dateStart: placement.date_start");
  });

  it("wires Instagram into scheduler snapshots through the same aggregate source contract", () => {
    const scheduler = readFileSync(join(process.cwd(), "server", "scheduler.ts"), "utf-8");

    expect(scheduler).toContain("storage.getInstagramConnection(campaignId)");
    expect(scheduler).toContain("storage.getInstagramDailyMetrics(campaignId, startDate, endDate)");
    expect(scheduler).toContain("selectedIds.has(String(row?.instagramCampaignId || \"\"))");
    expect(scheduler).toContain('String(row?.publisherPlatform || "instagram") === "instagram"');
    expect(scheduler).toContain('id: "instagram"');
    expect(scheduler).toContain('label: "Instagram Ads"');
    expect(scheduler).toContain('category: "paid_media"');
    expect(scheduler).toContain("metrics: instagramData");
    expect(scheduler).toContain("freshness: { selectedCampaignIds: instagramSelectedCampaignIds }");
    expect(scheduler).toContain("ga4AttributedRevenue: row.ga4Revenue");
    expect(scheduler).not.toContain("storage.upsertInstagramDailyMetrics");
  });

  it("uses only instagram_api source identity for Instagram-scoped manual spend", () => {
    const routes = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");
    const helperStart = routes.indexOf("const spendSourceTypeForPlatformContext");
    const helperEnd = routes.indexOf("const recalcCampaignSpend", helperStart);
    const helper = routes.slice(helperStart, helperEnd);
    const routeStart = routes.indexOf('app.post("/api/campaigns/:id/spend/process/manual"');
    const routeEnd = routes.indexOf("const processConnectorDerivedSpend", routeStart);
    const route = routes.slice(routeStart, routeEnd);

    expect(helper).toContain('ctx === "instagram"');
    expect(helper).toContain('return "instagram_api"');
    expect(route).toContain("spendSourceTypeForPlatformContext(platformContext, overrideSourceType)");
    expect(route).toContain('sourceType: effectiveSourceType');
    expect(route).toContain('platformContext: platformContext || null');
    expect(route).toContain('sourceType: effectiveSourceType');
    expect(route).toContain('existingSource as any)?.platformContext');
    expect(route).not.toContain('sourceType: "meta_api"');
    expect(route).not.toContain('sourceType: "google_ads_api"');
    expect(route).not.toContain('sourceType: "linkedin_api"');
  });

  it("preserves Instagram platform context on shared revenue source edits", () => {
    const routes = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");
    const manualStart = routes.indexOf('app.post("/api/campaigns/:id/revenue/process/manual"');
    const manualEnd = routes.indexOf('app.post("/api/campaigns/:id/revenue/csv/preview"', manualStart);
    const manualRoute = routes.slice(manualStart, manualEnd);
    const csvStart = routes.indexOf('"/api/campaigns/:id/revenue/csv/process"');
    const csvEnd = routes.indexOf('app.post("/api/campaigns/:id/revenue/sheets/preview"', csvStart);
    const csvRoute = routes.slice(csvStart, csvEnd);
    const sheetsStart = routes.indexOf('app.post("/api/campaigns/:id/revenue/sheets/process"');
    const sheetsEnd = routes.indexOf("  // Keep spend totals predictable", sheetsStart);
    const sheetsRoute = routes.slice(sheetsStart, sheetsEnd);

    for (const route of [manualRoute, csvRoute, sheetsRoute]) {
      expect(route).toContain("platformContext");
      expect(route).toContain("updateRevenueSource");
      expect(route).toContain('platformContext,');
    }
    expect(manualRoute).toContain('String((existingSource as any)?.platformContext || "ga4").trim().toLowerCase() !== platformContext');
    expect(csvRoute).toContain('String((existingSource as any)?.platformContext || "ga4").trim().toLowerCase() !== platformContext');
    expect(sheetsRoute).toContain("storage.getRevenueSources(campaignId, platformContext)");
    expect(routes).not.toContain("/api/instagram/oauth");
    expect(routes).not.toContain("refreshInstagram(");
    expect(routes).not.toContain("refreshInstagramForCampaign");
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
    expect(page).toContain("showConnectionError");
    expect(page).toContain("showDisconnectedState");
    expect(page).toContain('aria-hidden="true"');
    expect(page).toContain("Connect Instagram Ads from the campaign Connected Platforms section");
    expect(page).not.toContain("Loading Instagram analytics...");
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
    expect(page).toContain("overviewTotals.videoViews");
    expect(page).toContain("overviewTotals.ctr");
    expect(page).toContain("overviewTotals.cpc");
    expect(page).toContain("overviewTotals.cpm");
    expect(page).toContain("overviewTotals.costPerConversion");
    expect(page).toContain("overviewTotals.conversionRate");
    expect(page).toContain('{ label: "CTR"');
    expect(page).toContain('{ label: "CPC"');
    expect(page).toContain('{ label: "CPM"');
    expect(page).toContain('{ label: "Cost / Conversion"');
    expect(page).toContain('{ label: "Conversion Rate"');
    expect(page).toContain('{ label: "Video Views"');
    expect(page).toContain("No selected source-backed Instagram metric rows are available yet.");
    expect(page).not.toContain("Loading source-backed Instagram metrics...");
    expect(page).not.toContain("upsertInstagramDailyMetrics");
    expect(page).not.toContain("refreshInstagram");
    expect(page).not.toContain("/api/instagram/oauth");
  });

  it("renders Instagram analytics platform tab shell without obsolete status or breakdown sections", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "instagram-analytics.tsx"), "utf-8");

    expect(page).toContain('<TabsTrigger value="overview">Overview</TabsTrigger>');
    expect(page).toContain('<TabsTrigger value="kpis">KPIs</TabsTrigger>');
    expect(page).toContain('<TabsTrigger value="benchmarks">Benchmarks</TabsTrigger>');
    expect(page).toContain('<TabsTrigger value="ads">Ad Comparison</TabsTrigger>');
    expect(page).toContain('<TabsTrigger value="reports">Reports</TabsTrigger>');
    expect(page).toContain("/api/platforms/instagram/kpis");
    expect(page).toContain("/api/platforms/instagram/benchmarks");
    expect(page).toContain("/api/platforms/instagram/reports");
    expect(page).toContain("Performance Benchmarks");
    expect(page).toContain("Create Benchmark");
    expect(page).toContain("benchmarkTracker");
    expect(page).toContain("getInstagramBenchmarkProgress");
    expect(page).toContain('method: editingBenchmark ? "PUT" : "POST"');
    expect(page).toContain('method: "DELETE"');
    expect(page).toContain("Create Custom Benchmark");
    expect(page).toContain("Benchmark Value *");
    expect(page).toContain("No Benchmarks Yet");
    expect(page).toContain("instagramComparisonRows");
    expect(page).toContain("Compare selected source-backed Instagram campaigns.");
    expect(page).toContain("Selected Campaigns");
    expect(page).toContain("Highest Spend");
    expect(page).toContain("Best CTR");
    expect(page).toContain("Lowest CPC");
    expect(page).toContain("ResponsiveContainer");
    expect(page).toContain("Spend vs Conversions");
    expect(page).toContain("Efficiency: CTR vs CPC");
    expect(page).toContain("instagramComparisonChartRows");
    expect(page).toContain("No selected source-backed Instagram campaign comparison rows are available yet.");
    expect(page).not.toContain("No source-backed Instagram ad comparison rows are available yet.");
    expect(page).not.toContain("Connection Status");
    expect(page).not.toContain('<TabsTrigger value="campaign-breakdown">Campaign Breakdown</TabsTrigger>');
    expect(page).not.toContain("const campaignBreakdown = useMemo");
    expect(page).not.toContain("upsertInstagramDailyMetrics");
    expect(page).not.toContain("refreshInstagram");
    expect(page).not.toContain("/api/instagram/oauth");
  });

  it("renders Instagram analytics KPI tab with management UI backed by shared KPI routes", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "instagram-analytics.tsx"), "utf-8");

    expect(page).toContain("Key Performance Indicators");
    expect(page).toContain("Create KPI");
    expect(page).toContain("Total KPIs");
    expect(page).toContain("Avg. Progress");
    expect(page).toContain("getInstagramKpiProgress");
    expect(page).toContain("formatInstagramKpiValue");
    expect(page).toContain("/api/platforms/instagram/kpis");
    expect(page).toContain('method: editingKpi ? "PATCH" : "POST"');
    expect(page).toContain('method: "DELETE"');
    expect(page).toContain("AlertDialog");
    expect(page).toContain("Create Campaign KPI");
    expect(page).toContain("Select KPI Template");
    expect(page).toContain("Create Custom KPI");
    expect(page).toContain("KPI Name *");
    expect(page).toContain("Current Value");
    expect(page).toContain("Target Value *");
    expect(page).toContain("Enable alerts for this KPI");
    expect(page).toContain("KPI_DESC_MAX");
    expect(page).toContain('metric: ""');
    expect(page).toContain("formatNumericInput");
    expect(page).toContain("stripNumberFormatting(kpiForm.targetValue)");
    expect(page).not.toContain("Tracking Period");
    expect(page).not.toContain("runGA4DailyKPIAndBenchmarkJobs");
    expect(page).not.toContain("refreshInstagram(");
    expect(page).not.toContain("/api/instagram/oauth");
  });

  it("renders Instagram analytics unavailable, error, and freshness states without refresh behavior", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "instagram-analytics.tsx"), "utf-8");

    expect(page).toContain("error: metricsError");
    expect(page).toContain("Latest Instagram row import:");
    expect(page).toContain("latestImportedAt");
    expect(page).toContain("No selected source-backed Instagram metric rows are available yet.");
    expect(page).toContain("No KPIs yet");
    expect(page).toContain("No Benchmarks Yet");
    expect(page).toContain("No Instagram Reports have been created yet.");
    expect(page).toContain("Connect Instagram Ads from the campaign Connected Platforms section");
    expect(page).not.toContain("upsertInstagramDailyMetrics");
    expect(page).not.toContain("refreshInstagram");
    expect(page).not.toContain("/api/instagram/oauth");
  });
});
