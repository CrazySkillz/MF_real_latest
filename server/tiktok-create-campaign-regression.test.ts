import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const readCampaignsPage = () => readFileSync(join(process.cwd(), "client", "src", "pages", "campaigns.tsx"), "utf8");
const readCampaignDetailPage = () => readFileSync(join(process.cwd(), "client", "src", "pages", "campaign-detail.tsx"), "utf8");
const readTikTokAnalyticsPage = () => readFileSync(join(process.cwd(), "client", "src", "pages", "tiktok-analytics.tsx"), "utf8");
const readApp = () => readFileSync(join(process.cwd(), "client", "src", "App.tsx"), "utf8");
const readRoutes = () => readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf8");
const readReportScheduler = () => readFileSync(join(process.cwd(), "server", "report-scheduler.ts"), "utf8");

describe("TikTok Create Campaign source-contract regression guard", () => {
  it("exposes TikTok only through the Create Campaign test source contract", () => {
    const source = readCampaignsPage();

    expect(source).toContain('id: "tiktok"');
    expect(source).toContain('name: "TikTok Ads"');
    expect(source).toContain("SIMULATED_TIKTOK_ADVERTISERS");
    expect(source).toContain("SIMULATED_TIKTOK_CAMPAIGNS");
    expect(source).toContain("selectedWizardPlatform === 'tiktok'");
    expect(source).toContain("connectTikTokTestMode");
    expect(source).toContain('apiRequest("POST", `/api/tiktok/${draftCampaignId}/connect-test`');
    expect(source).toContain("selectedCampaignMetadata: SIMULATED_TIKTOK_CAMPAIGNS.filter");
    expect(source).not.toContain("upsertTikTokDailyMetrics");
    expect(source).not.toContain("tiktok-analytics");
  });

  it("blocks finalization unless the TikTok backend source has selected campaigns", () => {
    const source = readCampaignsPage();
    const guardStart = source.indexOf("if (selectedPlatforms.includes('tiktok'))");
    const finalizeStart = source.indexOf("// Finalize: update the already-created campaign", guardStart);
    const guard = source.slice(guardStart, finalizeStart);

    expect(guardStart).toBeGreaterThanOrEqual(0);
    expect(guard).toContain('apiRequest("GET", `/api/tiktok/${draftCampaignId}/connection`)');
    expect(guard).toContain("TikTok connection required");
    expect(guard).toContain("TikTok campaign required");
    expect(guard).toContain("Array.isArray(connection.selectedCampaignIds)");
    expect(guard).toContain("connection.selectedCampaignIds.length === 0");
  });

  it("keeps TikTok campaigns deselected until the user selects them", () => {
    const source = readCampaignsPage();

    expect(source).toContain('const [tiktokSelectedCampaignIds, setTikTokSelectedCampaignIds] = useState("");');
    expect(source).toContain('setTikTokSelectedCampaignIds("");');
    expect(source).toContain("Select all");
    expect(source).toContain("updateTikTokCampaignSelection");
  });

  it("exposes TikTok in Connected Platforms only through the add-source contract", () => {
    const campaignDetail = readCampaignDetailPage();

    expect(campaignDetail).toContain("connectTikTokTestMode");
    expect(campaignDetail).toContain('apiRequest("POST", `/api/tiktok/${campaignId}/connect-test`');
    expect(campaignDetail).toContain('platform: "TikTok Ads"');
    expect(campaignDetail).toContain("platformStatusMap.get(\"tiktok\")?.analyticsPath");
    expect(campaignDetail).toContain('url = `/api/tiktok/${campaignId}/connection`');
  });

  it("reads TikTok analytics from selected persisted rows only", () => {
    const routes = readRoutes();
    const reportScheduler = readReportScheduler();
    const app = readApp();
    const page = readTikTokAnalyticsPage();
    const dailyRouteStart = routes.indexOf('app.get("/api/tiktok/:campaignId/daily-metrics"');
    const instagramStart = routes.indexOf('app.get("/api/instagram/:campaignId/overview-summary"', dailyRouteStart);
    const dailyRoute = routes.slice(dailyRouteStart, instagramStart);

    expect(routes).toContain('app.get("/api/tiktok/:campaignId/daily-metrics"');
    expect(routes).toContain("ensureCampaignAccess(req as any, res as any, parsedId.data)");
    expect(routes).toContain("storage.getTikTokConnection(parsedId.data)");
    expect(routes).toContain("storage.getTikTokDailyMetrics(parsedId.data, startDate, endDate)");
    expect(routes).toContain("selected.has(String(row.tiktokCampaignId))");
    expect(dailyRoute).toContain('storage.getRevenueTotalForRange(parsedId.data, startDate, endDate, "tiktok")');
    expect(dailyRoute).toContain("financialSummary");
    expect(dailyRoute).toContain("hasAttributedRevenue");
    expect(dailyRoute).not.toContain("upsertTikTokDailyMetrics");
    expect(app).toContain('const TikTokAnalytics = lazy(() => import("@/pages/tiktok-analytics"))');
    expect(app).toContain('<Route path="/campaigns/:id/tiktok-analytics" component={TikTokAnalytics} />');
    expect(page).toContain("TikTok Ads Analytics");
    expect(page).toContain('{ key: "impressions", label: "Impressions", unit: "count" }');
    expect(page).toContain("function formatTikTokNumberAsYouType");
    expect(page).toContain("function formatTikTokNumberByUnit");
    expect(page).not.toContain("Revenue / ROI / ROAS");
    expect(page).toContain("Total Revenue");
    expect(page).toContain("ROI");
    expect(page).toContain("ROAS");
    expect(page).not.toContain('<TabsTrigger value="campaigns">Campaign Breakdown</TabsTrigger>');
    expect(page).not.toContain('<TabsContent value="campaigns"');
    const overviewTab = page.indexOf('<TabsTrigger value="overview">Overview</TabsTrigger>');
    const kpisTab = page.indexOf('<TabsTrigger value="kpis">KPIs</TabsTrigger>');
    const benchmarksTab = page.indexOf('<TabsTrigger value="benchmarks">Benchmarks</TabsTrigger>');
    const adsTab = page.indexOf('<TabsTrigger value="ads">Ad Comparison</TabsTrigger>');
    const insightsTab = page.indexOf('<TabsTrigger value="insights">Insights</TabsTrigger>');
    const reportsTab = page.indexOf('<TabsTrigger value="reports">Reports</TabsTrigger>');
    expect(overviewTab).toBeGreaterThanOrEqual(0);
    expect(kpisTab).toBeGreaterThan(overviewTab);
    expect(benchmarksTab).toBeGreaterThan(kpisTab);
    expect(adsTab).toBeGreaterThan(benchmarksTab);
    expect(insightsTab).toBeGreaterThan(adsTab);
    expect(reportsTab).toBeGreaterThan(insightsTab);
    expect(page).toContain('fetch(`/api/platforms/tiktok/kpis?campaignId=${campaignId}`)');
    expect(page).toContain('fetch(`/api/platforms/tiktok/benchmarks?campaignId=${campaignId}`)');
    expect(page).toContain('REVENUE_DEPENDENT_METRICS.has(metricKey) && !hasAttributedRevenue');
    expect(page).toContain("function isRevenueDependentMetric(metricKey: string)");
    expect(page).toContain("Key Performance Indicators");
    expect(page).toContain("Track daily TikTok KPIs and progress toward targets.");
    expect(page).toContain("Create KPI");
    expect(page).toContain("Create New KPI");
    expect(page).toContain("Select KPI Template");
    expect(page).toContain("Choose a predefined KPI that will automatically calculate from your platform data, or create a custom one.");
    expect(page).toContain("const disabled = isRevenueDependentMetric(metric.key) && !hasAttributedRevenue;");
    expect(page).toContain("disabled={disabled}");
    expect(page).toContain('title={disabled ? "Requires TikTok-scoped attributed revenue." : undefined}');
    expect(page).toContain("KPI Name *");
    expect(page).toContain('metric: ""');
    expect(page).toContain("const resetKpiForm = (metricKey?: string)");
    expect(page).toContain('metric: "custom"');
    expect(page).toContain("currentValue: getTikTokCurrentMetricValue(metric.key)");
    expect(page).toContain("function getTikTokCurrentMetricValue(metricKey: string)");
    expect(page).toContain("return formatTikTokNumberByUnit(String(value), getTikTokGoalMetric(metricKey).unit);");
    expect(page).toContain("totalRevenue: attributedRevenue");
    expect(page).toContain("roas");
    expect(page).toContain("Describe what this KPI measures and why it's important");
    expect(page).toContain("Current Value");
    expect(page).toContain("Target Value *");
    expect(page).toContain("targetValue: formatTikTokNumberAsYouType(event.target.value, form.unit)");
    expect(page).toContain("Priority");
    expect(page).toContain("Enable alerts for this KPI");
    expect(page).toContain("Receive notifications for KPI performance alerts on the bell icon &amp; in your Notifications center");
    expect(page).toContain("alertThreshold: kpiForm.alertsEnabled && kpiForm.alertThreshold");
    expect(page).toContain("disabled={createKpiMutation.isPending || !kpiForm.name || !kpiForm.targetValue || (kpiForm.alertsEnabled && !kpiForm.alertThreshold)}");
    expect(page).toContain('fetch("/api/platforms/tiktok/kpis"');
    expect(page).toContain("Total KPIs");
    expect(page).toContain("Above Target");
    expect(page).toContain("On Track");
    expect(page).toContain("Below Target");
    expect(page).toContain("Avg. Progress");
    expect(page).toContain("getGoalProgress(kpi, hasAttributedRevenue)");
    expect(page).toContain('"text-green-600", "text-green-500"');
    expect(page).toContain('"text-blue-600", "text-blue-500"');
    expect(page).toContain('"text-red-600", "text-red-500"');
    expect(page).toContain('"text-violet-600"');
    expect(page).toContain("Performance Benchmarks");
    expect(page).toContain("Track and measure TikTok performance against industry standards and custom targets.");
    expect(page).toContain("Create Benchmark");
    expect(page).toContain("Create New Benchmark");
    expect(page).toContain("Select Benchmark Template");
    expect(page).toContain("Choose a metric to benchmark, then fill in the benchmark details below.");
    expect(page).toContain("const resetBenchmarkForm = (metricKey?: string)");
    expect(page).toContain("Benchmark Name *");
    expect(page).toContain("e.g., Target sessions for this campaign");
    expect(page).toContain("What is this benchmark and why does it matter?");
    expect(page).toContain("Auto-filled from TikTok");
    expect(page).toContain("Enter benchmark value");
    expect(page).toContain("benchmarkValue: formatTikTokNumberAsYouType(event.target.value, form.unit)");
    expect(page).toContain("%, $, count, etc.");
    expect(page).toContain("Benchmark Value *");
    expect(page).toContain("Enable alerts for this Benchmark");
    expect(page).toContain("Receive notifications when this benchmark crosses a threshold you define.");
    expect(page).toContain("Value at which to trigger the alert");
    expect(page).toContain("Bell and Notifications keep one active alert record.");
    expect(page).toContain("Email addresses *");
    expect(page).toContain("Comma-separated email addresses for alerts.");
    expect(page).not.toContain('id="tiktok-benchmark-metric"');
    expect(page).toContain("alertThreshold: benchmarkForm.alertsEnabled && benchmarkForm.alertThreshold");
    expect(page).toContain("disabled={createBenchmarkMutation.isPending || !benchmarkForm.name || !benchmarkForm.benchmarkValue || (benchmarkForm.alertsEnabled && !benchmarkForm.alertThreshold)}");
    expect(page).toContain('fetch("/api/platforms/tiktok/benchmarks"');
    expect(page).toContain("Total Benchmarks");
    expect(page).toContain("Needs Attention");
    expect(page).toContain("Behind");
    expect(page).toContain("getBenchmarkProgress(benchmark, hasAttributedRevenue)");
    expect(page).toContain('"text-amber-600", "text-amber-500"');
    expect(page).toContain("No Benchmarks Yet");
    expect(page).toContain("Selected Campaign Rows");
    expect(page).toContain("Attributed Revenue");
    expect(page).toContain("From TikTok-scoped revenue source.");
    expect(page).toContain("TikTok Reports are unavailable until the campaign-scoped TikTok source-backed reports contract is implemented.");
    expect(page).toContain("Snapshot, PDF, test-send, and scheduled-send output are blocked rather than generated from generic report data.");
    expect(routes).toContain('sourceBackedReportPlatform === "instagram" || sourceBackedReportPlatform === "tiktok"');
    expect(routes).toContain('const label = sourceBackedReportPlatform === "tiktok" ? "TikTok" : "Instagram";');
    expect(routes).toContain("${label} source-backed PDF output unavailable; snapshot not created");
    expect(reportScheduler).toContain('normalized === "instagram" || normalized === "tiktok"');
    expect(reportScheduler).toContain('String((report as any)?.platformType || "") === "tiktok"');
    expect(reportScheduler).toContain("sourceBackedReportOutputUnavailableMessage");
    expect(reportScheduler).toContain('const label = normalized === "tiktok" ? "TikTok" : "Instagram";');
    expect(page).toContain("Requires TikTok-scoped attributed revenue.");
    expect(page).toContain("const financialSummary = dailyMetrics?.financialSummary || {};");
    expect(page).toContain("const attributedRevenue = hasAttributedRevenue ? Number(financialSummary.attributedRevenue || 0) : null;");
    expect(page).toContain("No persisted TikTok metric rows exist");
  });

  it("allows explicit test-mode TikTok refresh without hidden analytics seeding", () => {
    const routes = readRoutes();
    const page = readTikTokAnalyticsPage();

    expect(routes).toContain('app.post("/api/tiktok/:campaignId/refresh-test"');
    expect(routes).toContain('String((connection as any).method || "") !== "test_mode"');
    expect(routes).toContain("storage.upsertTikTokDailyMetrics(rows as any)");
    expect(routes).toContain("isSimulated: true");
    expect(routes).toContain('metricAvailability: { revenue: "unavailable_until_tiktok_scoped_attributed_revenue_exists" }');
    expect(page).toContain("shouldAutoRefreshTestMetrics");
    expect(page).toContain("refreshTestMetrics.mutate()");
    expect(page).not.toContain("Refresh test metrics");
  });

  it("does not show a static TikTok no-row warning on Connected Platforms", () => {
    const campaignDetail = readCampaignDetailPage();
    const tiktokCardStart = campaignDetail.indexOf('platform: "TikTok Ads"');
    const customIntegrationStart = campaignDetail.indexOf('platform: "Custom Integration"', tiktokCardStart);
    const tiktokCard = campaignDetail.slice(tiktokCardStart, customIntegrationStart);

    expect(tiktokCardStart).toBeGreaterThanOrEqual(0);
    expect(tiktokCard).toContain("platformStatusMap.get(\"tiktok\")?.analyticsPath");
    expect(tiktokCard).not.toContain("unavailableReason");
    expect(campaignDetail).not.toContain("Source-backed TikTok metrics are not available until persisted TikTok metric rows exist.");
  });

  it("feeds TikTok into Campaign DeepDive aggregate through selected persisted rows only", () => {
    const routes = readRoutes();

    expect(routes).toContain("async function buildTikTokPlatformSourceForAggregate");
    expect(routes).toContain("storage.getTikTokConnection(campaignId)");
    expect(routes).toContain("storage.getTikTokDailyMetrics(campaignId, startDate, endDate)");
    expect(routes).toContain("selectedSet.has(String(row?.tiktokCampaignId))");
    expect(routes).toContain('id: "tiktok"');
    expect(routes).toContain('label: "TikTok Ads"');
    expect(routes).toContain('reason: "TikTok attributed revenue requires a TikTok-scoped imported revenue source"');
    expect(routes).toContain('storage.getRevenueTotalForRange(campaignId, startDate, endDate, "tiktok")');
    expect(routes).toContain('...(hasImportedAttributedRevenue ? ["attributedRevenue"] : [])');
    expect(routes).toContain('attributedRevenueSource: hasImportedAttributedRevenue ? "tiktok_imported_attributed_revenue" : "unavailable"');
    expect(routes).toContain("mainPlatformSources: { googleAds, instagram, tiktok }");
    expect(routes).toContain("linkedInSpend + metaSpend + googleAdsSpend + instagramSpendForAggregate + tiktokSpend");
    expect(routes).toContain("hasTikTokData");
  });

  it("refreshes TikTok KPI and Benchmark current values from selected rows only", () => {
    const routes = readRoutes();
    const refresh = readFileSync(join(process.cwd(), "server", "utils", "kpi-refresh.ts"), "utf8");

    expect(routes).toContain("refreshTikTokKPIsForCampaign");
    expect(routes).toContain("refreshTikTokBenchmarksForCampaign");
    expect(routes).toContain('if (platform === "tiktok") await refreshTikTokKPIsForCampaign(String(campaignId));');
    expect(routes).toContain('if (platform === "tiktok") await refreshTikTokBenchmarksForCampaign(String(campaignId));');
    expect(routes).toContain("String(platformType || '').toLowerCase() === 'tiktok') && campaignId");
    expect(routes).toContain('String(platformType || "").trim().toLowerCase() === "tiktok"');
    expect(routes).toContain('String((okKpi as any)?.platformType || "").trim().toLowerCase() === "tiktok"');
    expect(routes).toContain('String((existing as any)?.platformType || "").trim().toLowerCase() === "tiktok"');
    expect(routes).toContain("checkBenchmarkPerformanceAlerts");
    expect(refresh).toContain('storage.getPlatformKPIs("tiktok", campaignId)');
    expect(refresh).toContain('storage.getPlatformBenchmarks("tiktok", campaignId)');
    expect(refresh).toContain("storage.getTikTokDailyMetrics(campaignId, startDate, endDate)");
    expect(refresh).toContain('selectedSet.has(String(row?.tiktokCampaignId || ""))');
    expect(refresh).toContain('storage.getRevenueTotalForRange(campaignId, startDate, endDate, "tiktok")');
    expect(refresh).toContain("if (!specificId) {");
    expect(refresh).not.toContain('storage.getRevenueTotalForRange(campaignId, startDate, endDate, "ga4")');
  });
});
