import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { buildPerformanceSummaryAggregate } from "./utils/performance-summary-aggregate";
import { generateRecommendations, generateRiskAssessment } from "./utils/executive-summary-helpers";

describe("campaign Executive Summary regression guard", () => {
  it("documents Executive Summary readiness without mixing future source work into implementation status", () => {
    const tracker = readFileSync(join(process.cwd(), "CAMPAIGN_DEEPDIVE_EXECUTIVE_SUMMARY_PRODUCTION_READY.md"), "utf-8");

    expect(tracker).toContain("### Executive Summary Status Map");
    expect(tracker).toContain("| Executive Summary implementation | Complete |");
    expect(tracker).toContain("| Connected-source aggregate future-proofing | Complete |");
    expect(tracker).toContain("| Deployed validation evidence log | Evidence tracking only |");
    expect(tracker).toContain("| Future Connected Platform acceptance gate | Standing rule |");
    expect(tracker).toContain("| Google Ads Connected Platforms refinement | Separate source work |");
    expect(tracker).toContain("Do not treat the deployed evidence log, the future-source acceptance gate, or Google Ads source refinement as unfinished Executive Summary implementation work.");
    expect(tracker).toContain("### Completed Production-Readiness Work For Connected Platform Expansion");
    expect(tracker).toContain("Completed Executive Summary future-proofing checklist:");
    expect(tracker).not.toContain("Outstanding Executive Summary future-proofing tasks:");
    expect(tracker).toContain("Not covered by local implementation validation:");
    expect(tracker).toContain("Future standalone platforms beyond the current shared aggregate contract require the future-platform acceptance gate before that specific source is called production-ready in Executive Summary.");
    expect(tracker).not.toContain("remain unverified until the shared aggregate composition and regression tasks above are complete");
  });

  it("documents the future-platform acceptance gate for Executive Summary", () => {
    const tracker = readFileSync(join(process.cwd(), "CAMPAIGN_DEEPDIVE_EXECUTIVE_SUMMARY_PRODUCTION_READY.md"), "utf-8");
    const gateStart = tracker.indexOf("Future Connected Platform acceptance gate:");
    const provenStart = tracker.indexOf("Proven:", gateStart);
    const gate = tracker.slice(gateStart, provenStart);

    expect(tracker).toContain("[x] Future-platform acceptance rule documented and regression-guarded");
    expect(gate).toContain("shared aggregate contract");
    expect(gate).toContain("`/outcome-totals`");
    expect(gate).toContain("`/executive-summary`");
    expect(gate).toContain("scheduler snapshots");
    expect(gate).toContain("KPI/Benchmark mapping");
    expect(gate).toContain("Risk inputs");
    expect(gate).toContain("Strategic Recommendations");
    expect(gate).toContain("regression coverage");
    expect(gate).toContain("deployed validation evidence");
  });

  it("documents deployed validation evidence separately from implementation readiness", () => {
    const tracker = readFileSync(join(process.cwd(), "CAMPAIGN_DEEPDIVE_EXECUTIVE_SUMMARY_PRODUCTION_READY.md"), "utf-8");
    const checklistStart = tracker.indexOf("Deployed validation checklist and evidence log:");
    const provenStart = tracker.indexOf("Proven:", checklistStart);
    const checklist = tracker.slice(checklistStart, provenStart);

    expect(tracker).toContain("[x] Deployed validation checklist documented:");
    expect(checklist).toContain("not an additional Executive Summary implementation fix");
    expect(checklist).toContain("production-ready for the implemented connected-source aggregate pattern");
    expect(checklist).toContain("GA4-only campaign");
    expect(checklist).toContain("GA4 plus refined Google Ads campaign");
    expect(checklist).toContain("GA4 plus multiple paid-media sources");
    expect(checklist).toContain("`/executive-summary`");
    expect(checklist).toContain("`/outcome-totals`");
    expect(checklist).toContain("`performanceSummary.sources`");
    expect(checklist).toContain("`7-Day Snapshot Trajectory`");
    expect(checklist).toContain("KPI/Benchmark evidence");
    expect(checklist).toContain("Evidence recorded");
    expect(checklist).toContain("Evidence log:");
    expect(checklist).toContain("Not yet completed.");
  });

  it("guards the endpoint and builds current values from the shared aggregate contract", () => {
    const routes = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");
    const routeStart = routes.indexOf('app.get("/api/campaigns/:id/executive-summary"');
    const routeEnd = routes.indexOf("// ============================================================================", routeStart);
    const route = routes.slice(routeStart, routeEnd);

    expect(route).toContain("const campaign = await ensureCampaignAccess(req as any, res as any, id);");
    expect(route).not.toContain("const campaign = await storage.getCampaign(id);");
    expect(route).not.toContain("performing strongly with 1.93x ROAS");
    expect(route).not.toContain("Recommend increasing LinkedIn");
    expect(routes).toContain("function buildCampaignPerformanceSummaryAggregate(input: any)");
    expect(routes).toContain("function buildMainPlatformSourcesForAggregate(sources: { googleAds?: any } = {})");
    expect(route).toContain("const performanceSummary = buildCampaignPerformanceSummaryAggregate({");
    expect(route).toContain("const metaConnection = await storage.getMetaConnection(id).catch(() => null);");
    expect(route).toContain("if (metaConnection && !(metaConnection as any).spendOnly) {");
    expect(routes).toContain("async function buildGoogleAdsPlatformSourceForAggregate(campaignId: string, startDate: string, endDate: string)");
    expect(routes).toContain("const { googleAds, googleAdsSpend } = await buildGoogleAdsPlatformSourceForAggregate(campaignId, startDate, endDate);");
    expect(route).toContain("const { googleAds, googleAdsSpend, googleAdsLastUpdate } = await buildGoogleAdsPlatformSourceForAggregate(id, startDate, endDate);");
    expect(route).toContain("dateRange: executiveDateRange");
    expect(route).toContain("const metrics = await ga4Service.getMetricsWithAutoRefresh(id, storage, ga4DateRange, primaryPropertyId || undefined, campaignFilter);");
    expect(route).toContain('periodParam === "90d" ? "90daysAgo" : "30daysAgo"');
    expect(route).toContain("let usedGA4SourceTruth = false;");
    expect(route).toContain("if (!usedGA4SourceTruth) {");
    expect(route).toContain("ga4: { connected: hasGA4Connection, ...ga4Metrics }");
    expect(route).toContain("const spendBreakdown = await storage.getSpendBreakdownBySource(id, \"1900-01-01\", endDate).catch(() => []);");
    expect(route).toContain("const revenueBreakdown = await storage.getRevenueBreakdownBySource(id, \"1900-01-01\", endDate, \"ga4\").catch(() => []);");
    expect(route).toContain("const aggregateRevenue = hasGA4Connection");
    expect(route).toContain("parseFloat((ga4Metrics.revenue + importedRevenueToDateTotal).toFixed(2))");
    expect(route).toContain("spendSource: performanceSummarySpend > 0 ? \"persisted_spend_sources\" : \"platform_spend_fallback\"");
    expect(route).toContain("meta: { connected: hasMetaConnection");
    expect(route).toContain("const platformSpend = linkedinMetrics.spend + metaMetrics.spend + customMetrics.spend + googleAdsSpend;");
    expect(route).toContain("mainPlatformSources: { googleAds }");
    expect(route).toContain("checkFreshness(googleAdsLastUpdate, 'Google Ads');");
    expect(route).toContain('const hasGoogleAdsData = mainAggregateSources.some((source: any) => source.id === "google_ads");');
    expect(route).toContain("hasGoogleAdsData,");
    expect(route).toContain("const aggregateMetricValue = (metricName: string): number => {");
    expect(route).toContain('const totalImpressions = aggregateMetricValue("impressions");');
    expect(route).toContain('const totalClicks = aggregateMetricValue("clicks");');
    expect(route).toContain('const totalConversions = aggregateMetricValue("conversions");');
    expect(route).toContain('const totalSpend = aggregateMetricValue("spend");');
    expect(route).toContain('const totalRevenue = aggregateMetricValue("revenue");');
    expect(route).toContain('const roas = aggregateMetricValue("roas");');
    expect(route).toContain('const roi = aggregateMetricValue("roi");');
    expect(route).toContain('const ctr = aggregateMetricValue("ctr");');
    expect(route).toContain('const cvr = aggregateMetricValue("cvr");');
    expect(route).toContain("const aggregateMetricAvailable = (metricName: string) => aggregateMetric(metricName)?.available === true;");
    expect(route).toContain("const aggregateMetricValueOrNull = (metricName: string): number | null =>");
    expect(route).toContain('roi: aggregateMetricValueOrNull("roi")');
    expect(route).toContain('roas: aggregateMetricValueOrNull("roas")');
    expect(route).toContain('ctr: aggregateMetricValueOrNull("ctr")');
    expect(route).toContain('cvr: aggregateMetricValueOrNull("cvr")');
    expect(route).toContain("const kpiMetricAliases: Record<string, string> = {");
    expect(route).toContain('totalusers: "users"');
    expect(route).toContain('totalrevenue: "revenue"');
    expect(route).toContain('totalconversions: "conversions"');
    expect(route).toContain('roas: "roas"');
    expect(route).toContain("const kpis = await storage.getCampaignKPIs(id);");
    expect(route).toContain("const aggregateKpiMetric = resolveKpiAggregateMetric(kpi);");
    expect(route).toContain("if (!aggregateKpiMetric) continue;");
    expect(route).toContain("const currentValue = aggregateMetricValue(aggregateKpiMetric);");
    expect(route).not.toContain("await storage.getKPIProgress(kpi.id)");
    expect(route).not.toContain("parseNum(kpi.currentValue)");
    expect(route).toContain("const benchmarks = await storage.getCampaignBenchmarks(id);");
    expect(route).toContain("const aggregateBenchmarkMetric = resolveKpiAggregateMetric(bm);");
    expect(route).toContain("if (!aggregateBenchmarkMetric) continue;");
    expect(route).toContain("const currentVal = aggregateMetricValue(aggregateBenchmarkMetric);");
    expect(route).toContain("const progressPct = progressRatio * 100;");
    expect(route).toContain("status: progressPct >= 90 ? 'on_track' : progressPct >= 70 ? 'needs_attention' : 'behind'");
    expect(route).not.toContain("parseNum(bm.currentValue)");
    expect(route).toContain("const snapshotPerformanceSummary = (snapshot: any) => snapshot?.metrics?.performanceSummary || null;");
    expect(route).toContain("currentSnapshotSummary.version === previousSnapshotSummary?.version");
    expect(route).not.toContain("parseNum(comparisonData.current.totalConversions) * (totalRevenue / (totalConversions || 1))");
    expect(route).toContain("const riskExtraFactors: Array<{ type: string; message: string; severity?: string }> = [];");
    expect(route).toContain("const missedKpiCount = kpiProgress.filter((kpi: any) => Number(kpi.pctComplete) < 70).length;");
    expect(route).toContain('const missedBenchmarkCount = benchmarkComparison.filter((bm: any) => bm.status === "behind").length;');
    expect(route).toContain("dataFreshnessWarnings.forEach((warning: any) => {");
    expect(route).toContain("}, growthTrajectory, trendPercentage, riskExtraFactors);");
    expect(route).toContain("checkedInputs: risk.checkedInputs");

    const summaryStart = route.indexOf("// CEO summary");
    const summaryEnd = route.indexOf("// Recommendations from helper", summaryStart);
    const summaryBlock = route.slice(summaryStart, summaryEnd);
    expect(summaryBlock).not.toContain("healthResult.grade");
    expect(summaryBlock).not.toContain("performing exceptionally");
    expect(summaryBlock).not.toContain("recommend increased investment");
    expect(summaryBlock).toContain('aggregateMetricAvailable("roi")');
    expect(summaryBlock).toContain('aggregateMetricAvailable("roas")');
    expect(summaryBlock).toContain("Risk level is ${risk.riskLevel}.");
    expect(summaryBlock).toContain("7-day snapshot trajectory does not have enough compatible history yet.");

    const recommendationsStart = route.indexOf("// Recommendations from helper");
    const recommendationsEnd = route.indexOf("res.json({", recommendationsStart);
    const recommendationsBlock = route.slice(recommendationsStart, recommendationsEnd);
    expect(recommendationsBlock).toContain("generateRecommendations(platforms, totalSpend, roas, roi, growthTrajectory, {");
    expect(recommendationsBlock).toContain('hasSpend: aggregateMetricAvailable("spend")');
    expect(recommendationsBlock).toContain('hasRevenue: aggregateMetricAvailable("revenue")');
    expect(recommendationsBlock).toContain('hasRoas: aggregateMetricAvailable("roas")');
    expect(recommendationsBlock).toContain('hasRoi: aggregateMetricAvailable("roi")');
    expect(recommendationsBlock).toContain('users: aggregateMetricValue("users")');
    expect(recommendationsBlock).toContain('sessions: aggregateMetricValue("sessions")');
    expect(recommendationsBlock).toContain('conversions: aggregateMetricValue("conversions")');
    expect(recommendationsBlock).toContain('revenue: aggregateMetricValue("revenue")');
    expect(recommendationsBlock).toContain('cvr: aggregateMetricValue("cvr")');
    expect(recommendationsBlock).toContain('hasConversionTarget: recommendationTargetMetrics.has("conversions")');
    expect(recommendationsBlock).toContain('hasRevenueTarget: recommendationTargetMetrics.has("revenue")');
    expect(recommendationsBlock).toContain('hasCvrTarget: recommendationTargetMetrics.has("cvr")');
    expect(recommendationsBlock).toContain("paidMediaSources: platforms.length");
    expect(recommendationsBlock).toContain("webAnalyticsSources: platformsForDisplay.filter");
  });

  it("derives main platform rows from performanceSummary sources and excludes financial child inputs", () => {
    const routes = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");
    const routeStart = routes.indexOf('app.get("/api/campaigns/:id/executive-summary"');
    const routeEnd = routes.indexOf("// ============================================================================", routeStart);
    const route = routes.slice(routeStart, routeEnd);

    expect(route).toContain("const mainAggregateSources = Array.isArray((performanceSummary as any)?.sources)");
    expect(route).toContain('source?.connected === true && source?.category !== "financial"');
    expect(route).toContain("const platformsForDisplay: any[] = mainAggregateSources.map");
    expect(route).toContain("let executiveRevenueSources: any[] = [];");
    expect(route).toContain("const revenueBreakdown = await storage.getRevenueBreakdownBySource(id, \"1900-01-01\", endDate, \"ga4\").catch(() => []);");
    expect(route).toContain("revenueSources: executiveRevenueSources");
    expect(route).toContain("name: source.label");
    expect(route).toContain("sourceId: source.id");
    expect(route).toContain("includedMetrics: source.includedMetrics");
    expect(route).toContain("excludedMetrics: source.excludedMetrics");
    expect(route).not.toContain("spend: 0,\n          revenue: 0,\n          conversions: ga4Metrics.conversions");
    expect(route).toContain("performanceSummary,");
    expect(route).toContain("aggregateVersion: (performanceSummary as any)?.version");
  });

  it("proves Google Ads reaches Executive Summary response surfaces when connected", () => {
    const routes = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");
    const routeStart = routes.indexOf('app.get("/api/campaigns/:id/executive-summary"');
    const routeEnd = routes.indexOf("// ============================================================================", routeStart);
    const route = routes.slice(routeStart, routeEnd);

    expect(route).toContain("mainPlatformSources: { googleAds }");
    expect(route).toContain("platforms: platformsForDisplay");
    expect(route).toContain("platformsWithData: platforms");
    expect(route).toContain("paidMediaSources: platforms.length");
    expect(route).toContain('const hasGoogleAdsData = mainAggregateSources.some((source: any) => source.id === "google_ads");');

    const performanceSummary = buildPerformanceSummaryAggregate({
      campaignId: "campaign-google-ads",
      dateRange: "90days",
      ga4: { connected: false },
      webAnalytics: { connected: false, provider: null },
      spend: { unifiedSpend: 1000, spendSource: "platform_spend_fallback" },
      platforms: {},
      platformSources: [{
        id: "google_ads",
        label: "Google Ads",
        category: "paid_media",
        connected: true,
        capabilities: ["impressions", "clicks", "spend", "conversions", "attributedRevenue"],
        includedMetrics: ["impressions", "clicks", "spend", "conversions", "attributedRevenue"],
        excludedMetrics: [],
        metrics: { impressions: 10000, clicks: 500, spend: 1000, conversions: 50, attributedRevenue: 5000 },
      }],
      revenue: { onsiteRevenue: 0, offsiteRevenue: 5000, totalRevenue: 5000 },
      revenueSources: [],
    });
    const mainAggregateSources = performanceSummary.sources.filter((source: any) =>
      source?.connected === true && source?.category !== "financial"
    );
    const sourceMetric = (source: any, metricName: string) => Number(source?.metrics?.[metricName] || 0);
    const sourceIncludesMetric = (source: any, metricName: string) =>
      Array.isArray(source?.includedMetrics) && source.includedMetrics.includes(metricName);
    const platformsForDisplay = mainAggregateSources.map((source: any) => {
      const spend = sourceIncludesMetric(source, "spend") ? sourceMetric(source, "spend") : 0;
      const revenue = sourceIncludesMetric(source, "revenue")
        ? sourceMetric(source, "revenue")
        : sourceMetric(source, "attributedRevenue");
      const conversions = sourceIncludesMetric(source, "conversions") ? sourceMetric(source, "conversions") : 0;
      return {
        name: source.label,
        sourceId: source.id,
        category: source.category,
        spend,
        revenue,
        conversions,
        roas: spend > 0 ? revenue / spend : 0,
        roi: spend > 0 ? ((revenue - spend) / spend) * 100 : 0,
        hasData: spend > 0 || revenue > 0 || conversions > 0,
      };
    });
    const platforms = platformsForDisplay.filter((platform: any) =>
      platform.category !== "web_analytics" && (platform.spend > 0 || platform.revenue > 0 || platform.conversions > 0)
    );
    const recommendations = generateRecommendations(
      platforms,
      Number(performanceSummary.totals.spend.value),
      Number(performanceSummary.totals.roas.value),
      Number(performanceSummary.totals.roi.value),
      "stable",
      {
        hasSpend: performanceSummary.totals.spend.available,
        hasRevenue: performanceSummary.totals.revenue.available,
        hasRoas: performanceSummary.totals.roas.available,
        hasRoi: performanceSummary.totals.roi.available,
        paidMediaSources: platforms.length,
        webAnalyticsSources: 0,
      },
    );

    expect(performanceSummary.sources.map((source: any) => source.id)).toEqual(["google_ads"]);
    expect(performanceSummary.totals.spend).toMatchObject({ available: true, value: 1000, sources: ["google_ads"] });
    expect(performanceSummary.totals.revenue).toMatchObject({ available: true, value: 5000, sources: ["google_ads"] });
    expect(platformsForDisplay).toMatchObject([{
      name: "Google Ads",
      sourceId: "google_ads",
      category: "paid_media",
      spend: 1000,
      revenue: 5000,
      conversions: 50,
      hasData: true,
    }]);
    expect(platforms).toHaveLength(1);
    expect(recommendations.some((rec: any) => rec.category === "Scaling Opportunity")).toBe(true);
  });

  it("proves generic platformSources feed Executive Summary without source-specific branches", () => {
    const routes = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");
    const routeStart = routes.indexOf('app.get("/api/campaigns/:id/executive-summary"');
    const routeEnd = routes.indexOf("// ============================================================================", routeStart);
    const route = routes.slice(routeStart, routeEnd);

    expect(route).toContain("const platformsForDisplay: any[] = mainAggregateSources.map");
    expect(route).toContain("const aggregateKpiMetric = resolveKpiAggregateMetric(kpi);");
    expect(route).toContain("const aggregateBenchmarkMetric = resolveKpiAggregateMetric(bm);");
    expect(route).not.toContain("future_paid_source");
    expect(route).not.toContain("Future Paid Source");

    const performanceSummary = buildPerformanceSummaryAggregate({
      campaignId: "campaign-future-source",
      dateRange: "90days",
      ga4: { connected: false },
      webAnalytics: { connected: false, provider: null },
      spend: { unifiedSpend: 2000, spendSource: "platform_spend_fallback" },
      platforms: {},
      platformSources: [{
        id: "future_paid_source",
        label: "Future Paid Source",
        category: "paid_media",
        connected: true,
        capabilities: ["impressions", "clicks", "spend", "conversions", "attributedRevenue"],
        includedMetrics: ["impressions", "clicks", "spend", "conversions", "attributedRevenue"],
        excludedMetrics: [{ metric: "sessions", reason: "Sessions are web analytics metrics" }],
        metrics: { impressions: 20000, clicks: 1000, spend: 2000, conversions: 80, attributedRevenue: 8000 },
      }],
      revenue: { onsiteRevenue: 0, offsiteRevenue: 8000, totalRevenue: 8000 },
      revenueSources: [],
    });
    const aggregateMetric = (metricName: string) => performanceSummary.totals[metricName as keyof typeof performanceSummary.totals];
    const mainAggregateSources = performanceSummary.sources.filter((source: any) =>
      source?.connected === true && source?.category !== "financial"
    );
    const sourceMetric = (source: any, metricName: string) => Number(source?.metrics?.[metricName] || 0);
    const sourceIncludesMetric = (source: any, metricName: string) =>
      Array.isArray(source?.includedMetrics) && source.includedMetrics.includes(metricName);
    const platformsForDisplay = mainAggregateSources.map((source: any) => {
      const spend = sourceIncludesMetric(source, "spend") ? sourceMetric(source, "spend") : 0;
      const revenue = sourceIncludesMetric(source, "revenue")
        ? sourceMetric(source, "revenue")
        : sourceMetric(source, "attributedRevenue");
      const conversions = sourceIncludesMetric(source, "conversions") ? sourceMetric(source, "conversions") : 0;
      return {
        name: source.label,
        sourceId: source.id,
        category: source.category,
        spend,
        revenue,
        conversions,
        roas: spend > 0 ? revenue / spend : 0,
        roi: spend > 0 ? ((revenue - spend) / spend) * 100 : 0,
        hasData: spend > 0 || revenue > 0 || conversions > 0,
      };
    });
    const platforms = platformsForDisplay.filter((platform: any) =>
      platform.category !== "web_analytics" && (platform.spend > 0 || platform.revenue > 0 || platform.conversions > 0)
    );
    const risk = generateRiskAssessment(
      platforms,
      platformsForDisplay,
      { roi: Number(aggregateMetric("roi").value), roas: Number(aggregateMetric("roas").value) },
      "stable",
      0,
      [],
    );
    const recommendations = generateRecommendations(
      platforms,
      Number(aggregateMetric("spend").value),
      Number(aggregateMetric("roas").value),
      Number(aggregateMetric("roi").value),
      "stable",
      {
        hasSpend: aggregateMetric("spend").available,
        hasRevenue: aggregateMetric("revenue").available,
        hasRoas: aggregateMetric("roas").available,
        hasRoi: aggregateMetric("roi").available,
        paidMediaSources: platforms.length,
        webAnalyticsSources: 0,
      },
    );

    expect(performanceSummary.sources.map((source: any) => source.id)).toEqual(["future_paid_source"]);
    expect(aggregateMetric("conversions")).toMatchObject({ available: true, value: 80, sources: ["future_paid_source"] });
    expect(aggregateMetric("revenue")).toMatchObject({ available: true, value: 8000, sources: ["future_paid_source"] });
    expect(aggregateMetric("roas")).toMatchObject({ available: true, value: 4, sources: ["revenue", "spend"] });
    expect(platformsForDisplay).toMatchObject([{
      name: "Future Paid Source",
      sourceId: "future_paid_source",
      category: "paid_media",
      spend: 2000,
      revenue: 8000,
      conversions: 80,
      hasData: true,
    }]);
    expect(platforms).toHaveLength(1);
    expect(risk.checkedInputs).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Available ROI", status: "checked", detail: "300.0%" }),
      expect.objectContaining({ label: "Available ROAS", status: "checked", detail: "4.0x" }),
      expect.objectContaining({ label: "Paid-platform concentration", status: "checked" }),
    ]));
    expect(recommendations.some((rec: any) => rec.category === "Scaling Opportunity")).toBe(true);
  });

  it("renders Executive Overview current values from aggregate availability", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "executive-summary.tsx"), "utf-8");
    const campaignDetailPage = readFileSync(join(process.cwd(), "client", "src", "pages", "campaign-detail.tsx"), "utf-8");
    const overviewStart = page.indexOf('<TabsContent value="overview"');
    const overviewEnd = page.indexOf('{/* Strategic Recommendations Tab */}', overviewStart);
    const overview = page.slice(overviewStart, overviewEnd);

    expect(page).not.toContain("const [period");
    expect(page).not.toContain('params.set("period"');
    expect(page).not.toContain("<Select value={period}");
    expect(page).toContain('const executiveOutcomeDateRange = "90days";');
    expect(page).toContain("`/api/campaigns/${campaignId}/outcome-totals?dateRange=${executiveOutcomeDateRange}${demoMode ? \"&demo=1\" : \"\"}`");
    expect(page.match(/refetchOnMount: "always"/g)?.length).toBe(2);
    expect(page.match(/refetchOnWindowFocus: true/g)?.length).toBe(2);
    expect(page.match(/refetchInterval: 60000/g)?.length).toBe(2);
    expect(page.match(/refetchIntervalInBackground: false/g)?.length).toBe(2);
    expect(page.match(/staleTime: 0/g)?.length).toBe(2);
    expect(page).not.toContain("isFetching");
    expect(page).not.toContain("outcomeTotalsLoading");
    expect(page).toContain("if (campaignLoading || summaryLoading) {");
    expect(page).not.toContain("if (campaignLoading || summaryLoading || outcomeTotalsLoading)");
    expect(page).toContain('const EXECUTIVE_SUMMARY_TABS = new Set(["overview", "recommendations"]);');
    expect(page).toContain("const [activeTab, setActiveTab] = useState(() => {");
    expect(page).toContain('const hashTab = window.location.hash.replace("#", "");');
    expect(page).toContain("const handleTabChange = (tab: string) => {");
    expect(page).toContain('window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${tab}`);');
    expect(page).toContain('<Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">');
    expect(page).not.toContain('<Tabs defaultValue="overview" className="space-y-6">');
    expect(page).toContain("<TabsList>");
    expect(page).not.toContain('<TabsList className="grid w-full grid-cols-2">');
    expect(page).toContain("const performanceSummary = (outcomeTotals as any)?.performanceSummary || (executiveSummary as any).performanceSummary;");
    expect(page).toContain("const aggregateMetric = (metricName: string) => (performanceSummary as any)?.totals?.[metricName];");
    expect(page).toContain("const formatAggregateInteger = (metricName: string) =>");
    expect(page).toContain("aggregateMetricAvailable(metricName) ? Math.round(aggregateMetricValue(metricName)).toLocaleString() : \"Unavailable\";");
    expect(page).toContain("const getRecommendationExpectedImpactItems = (rec: any): string[] => {");
    expect(page).toContain('if (rec?.category !== "Website Outcomes") return [formatRecommendationText(rec?.expectedImpact || "")];');
    expect(page).toContain('if (aggregateMetricAvailable("users")) webMetrics.push');
    expect(page).toContain('if (aggregateMetricAvailable("sessions")) webMetrics.push');
    expect(page).toContain('if (aggregateMetricAvailable("conversions")) webMetrics.push');
    expect(page).toContain('if (aggregateMetricAvailable("revenue")) webMetrics.push(formatAggregateCurrency("revenue"));');
    expect(page).toContain('if (aggregateMetricAvailable("cvr")) webMetrics.push');
    expect(page).toContain('Revenue is ${formatAggregateCurrency("revenue")} from ${Math.round(aggregateMetricValue("conversions")).toLocaleString()} conversions.');
    expect(page).toContain('Conversion rate is ${aggregateMetricValue("cvr").toFixed(1)}%.');
    expect(page).toContain("Target check: ${targetComparisons.join(\"; \")}.");
    expect(page).toContain("Next action: inspect landing pages or conversion paths for metrics below target before increasing spend.");
    expect(page).toContain("Next action: create or confirm KPI/Benchmark targets for conversion rate, revenue, and conversions before judging quality.");
    expect(page).toContain("Next action: keep monitoring these outcome targets and connect a paid-media source before making budget or channel decisions.");
    expect(page).toContain('<ul className="list-disc pl-4 space-y-1 text-sm text-green-700 dark:text-green-300">');
    expect(page).toContain("{getRecommendationExpectedImpactItems(rec).map((item, idx) => (");
    expect(page).toContain("{getRecommendationExpectedImpactItems(rec)[0]}");
    expect(page).not.toContain("{formatRecommendationText(rec.expectedImpact)}");
    expect(page).toContain('if (aggregateMetricAvailable("roi")) executiveMetricParts.push(`ROI is ${formatAggregatePercent("roi")}`);');
    expect(page).toContain('if (aggregateMetricAvailable("roas")) executiveMetricParts.push(`ROAS is ${formatAggregateRatio("roas")}`);');
    expect(page).toContain("const executiveSummaryNarrative = `${(campaign as any)?.name}: ${executiveMetricSummary} Risk level is ${displayedRiskLevel}. ${executiveTrajectorySummary}`;");
    expect(page).toContain("const resolveKpiAggregateMetric = (kpi: any): string | null => {");
    expect(page).toContain("const executiveKpiProgress = Array.isArray((executiveSummary as any).kpiProgress)");
    expect(page).toContain("? (executiveSummary as any).kpiProgress.filter((kpi: any) => resolveKpiAggregateMetric(kpi))");
    expect(page).toContain("const executiveBenchmarkComparison = Array.isArray((executiveSummary as any).benchmarkComparison)");
    expect(page).toContain("const aggregateBenchmarkMetric = resolveKpiAggregateMetric(bm);");
    expect(page).toContain("const yours = aggregateMetricValue(aggregateBenchmarkMetric);");
    expect(page).toContain("status: progressPct >= 90 ? 'on_track' : progressPct >= 70 ? 'needs_attention' : 'behind'");
    expect(page).toContain("if (!aggregateKpiMetric) return null;");
    expect(page).toContain("const current = aggregateMetricValue(aggregateKpiMetric);");
    expect(page).toContain("const kpiProgressPct = (kpi: any): number => {");
    expect(page).toContain("const riskKpiMissCount = executiveKpiProgress.filter((kpi: any) => kpiProgressPct(kpi) < 70).length;");
    expect(page).toContain('const riskBenchmarkMissCount = executiveBenchmarkComparison.filter((bm: any) => bm.status === "behind").length;');
    expect(page).toContain("const paidRiskSources = aggregateSources.filter((source: any) =>");
    expect(page).toContain("const paidConcentrationRisk = paidRiskSources.length === 1 || paidTopSpendShare > 70;");
    expect(page).toContain("const roiRoasRisk = (aggregateMetricAvailable(\"roi\") && aggregateMetricValue(\"roi\") < 0) || (aggregateMetricAvailable(\"roas\") && aggregateMetricValue(\"roas\") < 1);");
    expect(page).toContain('const trendRisk = executiveTrajectory === "declining" && trendPercentage < -15;');
    expect(page).toContain("const displayedRiskFactors = [");
    expect(page).toContain("const riskInputRows = [");
    expect(page).toContain("paid-media recommendations are unavailable");
    expect(page).toContain("Available web analytics and outcome metrics can still feed website recommendations and risk inputs.");
    expect(page).not.toContain("excluded from strategic recommendations and risk assessment");
    expect(page).toContain('label: "KPI Risk"');
    expect(page).toContain('label: "Benchmark Risk"');
    expect(page).toContain('label: "Data Freshness"');
    expect(page).toContain('label: "ROI / ROAS Risk"');
    expect(page).toContain('label: "7-Day Trend Risk"');
    expect(page).toContain('label: "Paid Platform Concentration Risk"');
    expect(page).toContain("{riskInputRows.length > 0 && (");
    expect(page).toContain("{riskInputRows.map((input: any, index: number) => (");
    expect(page).not.toContain("const riskCheckedInputs = Array.isArray((executiveSummary as any)?.risk?.checkedInputs)");
    expect(page).not.toContain("const visibleRiskCheckedInputs = riskCheckedInputs.filter");
    expect(page).not.toContain("(executiveSummary as any).risk.factors.length === 0");
    expect(page).not.toContain("(executiveSummary as any).risk.factors.map");
    expect(page).not.toContain("(executiveSummary as any).risk.level === 'low'");
    expect(page).not.toContain("Number(kpi.current) || 0");
    expect(page).toContain("const targetDeltaPct = target > 0");
    expect(page).toContain("const progressRatio = target > 0");
    expect(page).toContain("const statusLabel = targetDeltaPct > 5 ? 'Above Target' :");
    expect(page).toContain("targetDeltaPct >= -5 ? 'On Track' : 'Below Target';");
    expect(page).toContain("const barColor = targetDeltaPct > 5 ? 'bg-green-500' :");
    expect(page).toContain("targetDeltaPct >= -5 ? 'bg-blue-500' : 'bg-red-500';");
    expect(page).toContain("{formatKpiValue(aggregateKpiMetric, current, kpi.unit)}");
    expect(page).toContain('<Progress value={pct} className="h-2" indicatorClassName={barColor} />');
    expect(page).toContain("{executiveBenchmarkComparison.map((bm: any, index: number) => (");
    expect(page).toContain("{formatKpiValue(bm.aggregateMetric, bm.yours, bm.unit)}");
    expect(page).toContain("{formatKpiValue(bm.aggregateMetric, bm.benchmark, bm.unit)}");
    expect(page).toContain("bm.status === 'on_track' ? 'bg-green-500' : bm.status === 'needs_attention' ? 'bg-yellow-500' : 'bg-red-500'");
    expect(page).toContain("bm.status === 'on_track' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : bm.status === 'needs_attention' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'");
    expect(page).not.toContain("const pct = kpi.pctComplete || (kpi.target > 0 ? Math.min((kpi.current / kpi.target) * 100, 100) : 0);");
    expect(page).not.toContain("{kpi.status.replace('_', ' ')}");
    expect(page).not.toContain("{kpi.priority}");
    expect(page).not.toContain("2,984");
    expect(page).not.toContain("2984");
    expect(page).toContain('const reachMetricKey = pickFirstAvailableMetric(["impressions", "users", "sessions"]);');
    expect(page).toContain('const engagementMetricKey = pickFirstAvailableMetric(["clicks", "sessions", "users"]);');
    expect(page).toContain("const funnelPathLabel = `${reachMetricLabels[reachMetricKey]} -> ${engagementMetricLabels[engagementMetricKey]} -> Conversions -> Revenue`;");
    expect(overview).toContain("{funnelPathLabel}");
    expect(overview).toContain("{reachStageQuestion}");
    expect(overview).toContain("{engagementStageQuestion}");
    expect(overview).toContain("Are visits becoming conversions and revenue?");
    expect(overview).toContain("{executiveSummaryNarrative}");
    expect(overview).not.toContain("{(executiveSummary as any).ceoSummary}");
    expect(overview).not.toContain("Campaign Story:");
    expect(overview).not.toContain("Connected sources show spend");
    expect(overview).not.toContain("Platform Performance");
    expect(overview).not.toContain("Website Analytics Only");
    expect(overview).not.toContain("Excellent");
    expect(overview).not.toContain("Good");
    expect(overview).not.toContain("Fair");
    expect(overview).not.toContain("Campaign Grade");
    expect(overview).not.toContain("Health Score");
    expect(overview).not.toContain("Weighted from available ROI, ROAS, CTR, and CVR inputs.");
    expect(overview).not.toContain("health.grade");
    expect(overview).not.toContain("health.score");
    expect(overview).toContain("7-Day Snapshot Trajectory");
    expect(overview).toContain("Not enough history");
    expect(overview).toContain("Based on compatible aggregate snapshots, not the removed date selector.");
    expect(overview).toContain("No configured risk factors identified");
    expect(overview).toContain("Based on available connected-source inputs checked below.");
    expect(overview).toContain("Risk inputs");
    expect(overview).not.toContain("Campaign is operating within acceptable parameters");
    expect(overview).toContain("{formatAggregateNumber(reachMetricKey)} {reachMetricLabels[reachMetricKey]}");
    expect(overview).toContain("{formatAggregateNumber(engagementMetricKey)} {engagementMetricLabels[engagementMetricKey]}");
    expect(overview).toContain('{formatAggregatePercent("ctr")}');
    expect(overview).toContain('{formatAggregatePercent("cvr")}');
    expect(overview).toContain('{formatAggregateInteger("conversions")}');
    expect(overview).toContain('{formatAggregateCurrency("revenue")}');
    expect(overview).toContain('{formatAggregateRatio("roas")}');
    expect(overview).not.toContain('{formatAggregateNumber("conversions")}');
    expect(overview).not.toContain("{formatNumber((executiveSummary as any).metrics.totalImpressions)} Impressions");
    expect(overview).not.toContain("{formatNumber((executiveSummary as any).metrics.totalClicks)} Clicks");
    expect(overview).not.toContain("{formatCurrency((executiveSummary as any).metrics.totalRevenue)}");
    expect(campaignDetailPage.match(/queryClient\.invalidateQueries\(\{ queryKey: \["\/api\/campaigns", campaign\.id, "executive-summary"\] \}\);/g)?.length).toBe(6);
  });
});
