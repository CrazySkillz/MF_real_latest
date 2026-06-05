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

describe("Meta production readiness regression guard", () => {
  it("refreshes Connected Platforms Meta add-source state without a page reload", () => {
    const page = read("client", "src", "pages", "campaign-detail.tsx");
    const helper = sliceBetween(
      page,
      "const invalidateMetaConnectedPlatformQueries = () => {",
      "// Mutation to set primary connection"
    );
    const metaBlock = sliceBetween(
      page,
      'platform.platform === "Facebook Ads" ?',
      'platform.platform === "Google Ads" ?'
    );

    expect(helper).toContain('queryKey: ["/api/campaigns", campaignId, "connected-platforms"]');
    expect(helper).toContain('queryKey: ["/api/meta", campaignId], exact: false');
    expect(helper).toContain('queryKey: [`/api/campaigns/${campaignId}/outcome-totals`], exact: false');
    expect(helper).toContain('queryKey: [`/api/campaigns/${campaignId}/trend-analysis`], exact: false');
    expect(helper).toContain('queryKey: ["/api/platforms/meta/kpis", campaignId], exact: false');
    expect(helper).toContain('queryKey: ["/api/platforms/meta/reports", campaignId], exact: false');
    expect(metaBlock).toContain("invalidateMetaConnectedPlatformQueries();");
    expect(metaBlock).not.toContain("window.location.reload()");
  });

  it("uses source-backed Meta metrics for the Campaign Overview Facebook card", () => {
    const page = read("client", "src", "pages", "campaign-detail.tsx");
    const metaSetup = sliceBetween(
      page,
      "const metaSource = useMemo(() => {",
      "const googleAdsSource = useMemo(() => {"
    );
    const facebookCard = sliceBetween(
      page,
      'platform: "Facebook Ads"',
      'platform: "Google Ads"'
    );

    expect(metaSetup).toContain("campaignOutcomeTotals.performanceSummary.sources");
    expect(metaSetup).toContain('String(source?.id || "") === "meta"');
    expect(metaSetup).toContain("const metaMetrics = metaSource?.metrics || {};");
    expect(metaSetup).toContain('const isMetaConnected = platformStatusMap.get("facebook")?.connected === true;');
    expect(facebookCard).toContain("connected: isMetaConnected");
    expect(facebookCard).toContain("impressions: metaImpressions");
    expect(facebookCard).toContain("clicks: metaClicks");
    expect(facebookCard).toContain("conversions: metaConversions");
    expect(facebookCard).toContain("spend: metaSpend.toFixed(2)");
    expect(facebookCard).toContain("ctr: metaCtr");
    expect(facebookCard).toContain("cpc: metaCpc");
    expect(page).not.toContain("platformDistribution");
    expect(page).not.toContain('platformStatusMap.get("facebook")?.connected ? "2.64%" : "0.00%"');
    expect(page).not.toContain('platformStatusMap.get("facebook")?.connected ? "$0.68" : "$0.00"');
  });

  it("scopes visible Meta analytics and overview totals to selected Meta campaign IDs", () => {
    const routes = read("server", "routes-oauth.ts");
    const connectedPlatformsRoute = sliceBetween(
      routes,
      'app.get("/api/campaigns/:id/connected-platforms"',
      'app.get("/api/campaigns/:id/outcome-totals"'
    );
    const outcomeTotalsMetaBlock = sliceBetween(
      routes,
      "// Meta summary inputs",
      "const { googleAds, googleAdsSpend } = await buildGoogleAdsPlatformSourceForAggregate"
    );
    const analyticsRoute = sliceBetween(
      routes,
      'app.get("/api/meta/:campaignId/analytics"',
      'app.get("/api/meta/:campaignId/summary"'
    );
    const dailyInsightsRoute = sliceBetween(
      routes,
      'app.get("/api/meta/:campaignId/insights/daily"',
      'app.get("/api/meta/:campaignId/demographics"'
    );
    const dailyMetricsRoute = sliceBetween(
      routes,
      'app.get("/api/meta/:campaignId/daily-metrics"',
      'app.post("/api/campaigns/:id/spend/ad-platform/import"'
    );

    expect(routes).toContain("const parseMetaSelectedCampaignIds = (connection: any): string[] => {");
    expect(connectedPlatformsRoute).toContain("const metaSelectedCampaignIds = parseMetaSelectedCampaignIds(metaConnection);");
    expect(connectedPlatformsRoute).toContain("metaSelectedCampaignIds.length > 0");
    expect(connectedPlatformsRoute).toContain("connected: metaConnected");
    expect(outcomeTotalsMetaBlock).toContain("const selectedMetaCampaignIds = parseMetaSelectedCampaignIds(metaConn);");
    expect(outcomeTotalsMetaBlock).toContain("storage.getMetaDailyMetrics(campaignId, startDate, endDate)");
    expect(outcomeTotalsMetaBlock).toContain('selectedMetaCampaignSet.has(String(row?.metaCampaignId || ""))');
    expect(outcomeTotalsMetaBlock).toContain('selectedMetaCampaignSet.has(String(campaign?.id || ""))');
    expect(outcomeTotalsMetaBlock).not.toContain("generateMetaMockData");
    expect(analyticsRoute).toContain("const selectedCampaignIds = parseMetaSelectedCampaignIds(connection);");
    expect(analyticsRoute).toContain('return res.json(emptyResponse("missing_selected_campaign_ids"));');
    expect(analyticsRoute).toContain("const { META_MOCK_CAMPAIGNS } = await import('./meta-scheduler');");
    expect(analyticsRoute).toContain("storage.getMetaDailyMetrics(campaignId, '1900-01-01', '2099-12-31')");
    expect(analyticsRoute).toContain('selectedCampaignSet.has(String(row?.metaCampaignId || ""))');
    expect(analyticsRoute).toContain('selectedCampaignSet.has(String(campaign?.id || ""))');
    expect(analyticsRoute).not.toContain("generateMetaMockData");
    expect(dailyInsightsRoute).toContain("const selectedCampaignIds = parseMetaSelectedCampaignIds(connection);");
    expect(dailyInsightsRoute).toContain("!selectedCampaignIds.includes(String(metaCampaignId))");
    expect(dailyInsightsRoute).toContain("storage.getMetaDailyMetrics(parsedId.data, start, end)");
    expect(dailyMetricsRoute).toContain("const selectedCampaignIds = parseMetaSelectedCampaignIds(connection);");
    expect(dailyMetricsRoute).toContain('scopeUnavailableReason: "missing_selected_campaign_ids"');
    expect(dailyMetricsRoute).toContain('selectedSet.has(String(row?.metaCampaignId || ""))');
  });

  it("keeps Meta aggregate revenue platform-scoped and gated by Meta revenue tracking", () => {
    const routes = read("server", "routes-oauth.ts");
    const aggregate = read("server", "utils", "performance-summary-aggregate.ts");
    const outcomeTotalsMetaBlock = sliceBetween(
      routes,
      "// Meta summary inputs",
      "const { googleAds, googleAdsSpend } = await buildGoogleAdsPlatformSourceForAggregate"
    );
    const executiveSummaryMetaBlock = sliceBetween(
      routes,
      "// Fetch Meta/Facebook metrics",
      "// Fetch GA4 metrics"
    );

    expect(outcomeTotalsMetaBlock).toContain("const hasRevenueTracking = !!rev.hasRevenueTracking;");
    expect(outcomeTotalsMetaBlock).toContain("const attributedRevenue = hasRevenueTracking ?");
    expect(outcomeTotalsMetaBlock).toContain("const roas = hasRevenueTracking && metaSpend > 0");
    expect(outcomeTotalsMetaBlock).toContain("const roi = hasRevenueTracking && metaSpend > 0");
    expect(executiveSummaryMetaBlock).toContain('storage.getRevenueTotalForRange(id, metaStart, metaEnd, "meta")');
    expect(executiveSummaryMetaBlock).not.toContain("storage.getRevenueTotalForRange(id, metaStart, metaEnd).catch");
    expect(executiveSummaryMetaBlock).toContain("metaMetrics.hasRevenueTracking = metaMetrics.revenue > 0;");
    expect(aggregate).toContain("const hasMetaRevenue = meta.hasRevenueTracking === true;");
    expect(aggregate).toContain('...(hasMetaRevenue ? ["attributedRevenue"] : [])');
    expect(aggregate).toContain('reason: "Meta Total Revenue requires a Meta-scoped imported revenue source"');
    expect(aggregate).toContain("attributedRevenue: hasMetaRevenue ? parseNum(meta.attributedRevenue) : null");
  });

  it("exposes Meta Overview Total Revenue source management through the shared revenue wizard", () => {
    const page = read("client", "src", "pages", "meta-analytics.tsx");
    const revenueSection = sliceBetween(
      page,
      "{/* Revenue Section */}",
      "{/* Performance Metrics - Derived Metrics */}"
    );

    expect(page).toContain('import { AddRevenueWizardModal } from "@/components/AddRevenueWizardModal";');
    expect(page).toContain('revenue-sources?platformContext=meta');
    expect(page).toContain('revenue-totals?platformContext=meta&dateRange=90days');
    expect(page).toContain('queryKey: ["/api/campaigns", campaignId, "revenue-sources", "meta"]');
    expect(revenueSection).toContain("Total Revenue");
    expect(revenueSection).toContain("onClick={() => openMetaRevenueModal()}");
    expect(revenueSection).toContain("Sources ({activeMetaRevenueSources.length})");
    expect(page).toContain('platformContext="meta"');
    expect(page).toContain("Meta Revenue Sources");
    expect(page).toContain("openMetaRevenueModal(source)");
    expect(page).toContain("setDeletingRevenueSourceId(String(source.id))");
    expect(page).toContain("deleteMetaRevenueSourceMutation");
    expect(page).toContain("revenue-sources/${encodeURIComponent(sourceId)}");
    expect(page).not.toContain("Configure Revenue Tracking");
  });

  it("labels the Meta Overview per-campaign section and avoids invented row financials", () => {
    const page = read("client", "src", "pages", "meta-analytics.tsx");
    const campaignBreakdown = sliceBetween(
      page,
      "{/* Campaign Breakdown - Card Layout */}",
      "{/* Demographics & Geographics */}"
    );

    expect(campaignBreakdown).toContain("<CardTitle>Campaign Breakdown</CardTitle>");
    expect(campaignBreakdown).toContain("<CardDescription>Metrics grouped by selected Meta campaign</CardDescription>");
    expect(campaignBreakdown).not.toContain("<CardTitle>All Campaigns</CardTitle>");
    expect(campaignBreakdown).not.toContain("Detailed performance metrics for all campaigns");
    expect(campaignBreakdown).not.toContain("{formatCurrency(totals.spend || 0)}</span>");
    expect(campaignBreakdown).not.toContain("revenueSummary.totalRevenue / campaigns.length");
    expect(campaignBreakdown).not.toContain("Revenue metrics");
  });

  it("renders Meta optional breakdown sections only when breakdown rows exist", () => {
    const page = read("client", "src", "pages", "meta-analytics.tsx");
    const overviewBreakdowns = sliceBetween(
      page,
      "{/* Demographics & Geographics */}",
      '<TabsContent value="kpis"'
    );

    expect(page).toContain("const [selectedBreakdownCampaignId, setSelectedBreakdownCampaignId] = useState<string>('');");
    expect(page).toContain("const breakdownCampaignOptions = useMemo(() => {");
    expect(page).toContain("const selectedBreakdownCampaign = breakdownCampaignOptions.find");
    expect(page).toContain("const selectedCampaignDemographics = Array.isArray(selectedBreakdownCampaign?.demographics)");
    expect(page).toContain("const selectedCampaignGeographics = Array.isArray(selectedBreakdownCampaign?.geographics)");
    expect(page).toContain("const selectedCampaignPlacements = Array.isArray(selectedBreakdownCampaign?.placements)");
    expect(overviewBreakdowns).toContain("{breakdownCampaignOptions.length > 0 && (");
    expect(overviewBreakdowns).toContain("<Select value={selectedBreakdownCampaignValue} onValueChange={setSelectedBreakdownCampaignId}>");
    expect(overviewBreakdowns).toContain("{breakdownCampaignOptions.map((campaignData: any) => {");
    expect(overviewBreakdowns).toContain("{selectedCampaignDemographics.length > 0 && (");
    expect(overviewBreakdowns).toContain("{selectedCampaignGeographics.length > 0 && (");
    expect(overviewBreakdowns).toContain("{selectedCampaignPlacements.length > 0 && (");
    expect(overviewBreakdowns).toContain("{demo.ageRange || demo.age}");
    expect(overviewBreakdowns).toContain("placement.placement || [placement.publisherPlatform, placement.platformPosition]");
    expect(overviewBreakdowns).toContain("Source: Meta age and gender breakdown for the selected campaign.");
    expect(overviewBreakdowns).toContain("Source: Meta country breakdown for the selected campaign.");
    expect(overviewBreakdowns).toContain("Source: Meta placement breakdown for the selected campaign.");
    expect(overviewBreakdowns).toContain("These rows are not a reconciliation to the metric cards above.");
    expect(overviewBreakdowns).not.toContain("first selected Meta campaign");
    expect(page).not.toContain("firstCampaignBreakdowns");
    expect(page).not.toContain("firstCampaignDemographics");
    expect(page).not.toContain("firstCampaignGeographics");
    expect(page).not.toContain("firstCampaignPlacements");
    expect(overviewBreakdowns).not.toContain("campaigns[0]?.demographics &&");
    expect(overviewBreakdowns).not.toContain("campaigns[0]?.geographics &&");
    expect(overviewBreakdowns).not.toContain("campaigns[0]?.placements &&");
  });

  it("includes Meta breakdown imports in the selected analytics response", () => {
    const routes = read("server", "routes-oauth.ts");
    const metaGraphClient = read("server", "services", "meta-graph-api.ts");
    const analyticsRoute = sliceBetween(
      routes,
      'app.get("/api/meta/:campaignId/analytics"',
      'app.get("/api/meta/:campaignId/summary"'
    );

    expect(analyticsRoute).toContain("const { generateDemographics, generateGeographics, generatePlacements } = await import('./utils/metaMockData');");
    expect(analyticsRoute).toContain("const hasBreakdownInputs = totals.impressions > 0 && totals.clicks > 0;");
    expect(analyticsRoute).toContain("demographics: hasBreakdownInputs ? generateDemographics(totals.impressions, totals.clicks, totals.spend, totals.conversions) : []");
    expect(analyticsRoute).toContain("geographics: hasBreakdownInputs ? generateGeographics(totals.impressions, totals.clicks, totals.spend, totals.conversions) : []");
    expect(analyticsRoute).toContain("placements: hasBreakdownInputs ? generatePlacements(totals.impressions, totals.clicks, totals.spend, totals.conversions) : []");
    expect(analyticsRoute).toContain("metaClient.getDemographicInsights(campaign.id, dateRange).catch(() => [])");
    expect(analyticsRoute).toContain("metaClient.getGeographicInsights(campaign.id, dateRange).catch(() => [])");
    expect(analyticsRoute).toContain("metaClient.getPlacementInsights(campaign.id, dateRange).catch(() => [])");
    expect(metaGraphClient).toContain("conversions: number;");
    expect(metaGraphClient).toContain("const conversions = actions.reduce((sum: number, action: MetaAction) => {");
    expect(metaGraphClient).toContain("const actionType = String(action.actionType || action.action_type || \"\");");
    expect(metaGraphClient).toContain("actionType.includes('purchase') || actionType.includes('lead') || actionType.includes('conversion')");
    expect(metaGraphClient).toContain("conversions,");
  });

  it("keeps Meta imported revenue source-safe across Overview and Insights", () => {
    const page = read("client", "src", "pages", "meta-analytics.tsx");
    const revenueSection = sliceBetween(
      page,
      "{/* Revenue Section */}",
      "{/* Performance Metrics - Derived Metrics */}"
    );
    const insightsSection = sliceBetween(
      page,
      '<TabsContent value="insights"',
      '<TabsContent value="reports"'
    );

    expect(revenueSection).toContain("Total Revenue");
    expect(revenueSection).toContain("onClick={() => openMetaRevenueModal()}");
    expect(revenueSection).toContain("Sources ({activeMetaRevenueSources.length})");
    expect(page).not.toContain("Imported Meta Revenue Active");
    expect(page).not.toContain("Match GA4 Revenue");
    expect(page).not.toContain("GA4 Revenue Attribution");
    expect(page).not.toContain("revenueSummary.totalRevenue / campaigns.length");
    expect(page).not.toContain("revenueSummary.totalRevenue / summary.totalSpend");
    expect(page).not.toContain("revenueSummary.totalRevenue - summary.totalSpend");
    expect(page).not.toContain("const revenue = hasRev ? conversions * convValue : 0");
    expect(page).not.toContain('<SelectItem value="revenue">Revenue</SelectItem>');
    expect(page).not.toContain('<SelectItem value="roas">ROAS</SelectItem>');
    expect(insightsSection).toContain("Total Revenue");
    expect(insightsSection).toContain('hasMetaAttributedRevenue ? fmtCurrency(metaAttributedRevenue) : "Not connected"');
    expect(insightsSection).toContain("Profit");
    expect(insightsSection).toContain("ROAS");
    expect(insightsSection).toContain("ROI");
    expect(insightsSection).toContain("Meta attributed revenue + Meta spend");
    expect(insightsSection).toContain("Unavailable until Meta attributed revenue is connected");
    expect(insightsSection).toContain("if (!hasMetaAttributedRevenue)");
    expect(insightsSection).not.toContain("if (!revenueSummary?.hasRevenueTracking)");
    expect(insightsSection).not.toContain("Revenue metrics appear only when a Meta revenue source is connected.");
    expect(insightsSection).not.toContain("Connect a revenue source to unlock ROAS, ROI, and revenue-dependent KPIs.");
  });

  it("supports exact Meta campaign mapping for imported revenue sources", () => {
    const modal = read("client", "src", "components", "AddRevenueWizardModal.tsx");
    const hubspot = read("client", "src", "components", "HubSpotRevenueWizard.tsx");
    const salesforce = read("client", "src", "components", "SalesforceRevenueWizard.tsx");
    const shopify = read("client", "src", "components", "ShopifyRevenueWizard.tsx");
    const routes = read("server", "routes-oauth.ts");
    const metaCampaignRevenueRoute = sliceBetween(
      routes,
      'app.get("/api/campaigns/:id/meta-campaign-revenue"',
      'app.get("/api/campaigns/:id/outcome-totals"'
    );

    expect(modal).toContain('platformContext === "meta" ? "Meta" : "Google Ads"');
    expect(modal).toContain('const needsCampaignMapping = (platformContext === \'google_ads\' || platformContext === \'meta\')');
    expect(modal).toContain('fetch(`/api/meta/${campaignId}/campaigns`');
    expect(modal).toContain('selectedIds.has(String(c?.id || ""))');
    expect(modal).toContain('renderPlatformCampaignMapping(csvCampaignValues)');
    expect(modal).toContain('renderPlatformCampaignMapping(sheetsCampaignValues)');

    expect(hubspot).toContain('const isMeta = platformContext === "meta";');
    expect(hubspot).toContain('const url = isMeta ? `/api/meta/${campaignId}/campaigns`');
    expect(hubspot).toContain('renderAdPlatformCampaignMappings()');
    expect(salesforce).toContain('const isMeta = platformContext === "meta";');
    expect(salesforce).toContain('const url = isMeta ? `/api/meta/${campaignId}/campaigns`');
    expect(salesforce).toContain('renderAdPlatformCampaignMappings()');
    expect(shopify).toContain('const isMeta = platformContext === "meta";');
    expect(shopify).toContain('? `/api/meta/${campaignId}/campaigns`');
    expect(shopify).toContain('(isLinkedIn || isGoogleAds || isMeta) && selectedCampaignMappings.length > 0');

    expect(routes).toContain("const getActiveMetaCampaignIdSet = async (campaignId: string): Promise<Set<string>> => {");
    expect(routes).toContain('if (!id || (platformContext !== "google_ads" && platformContext !== "meta")) return null;');
    expect(routes).toContain('mapping?.metaCampaignId || mapping?.linkedinCampaignUrn');
    expect(metaCampaignRevenueRoute).toContain("const activeMetaCampaignIds = await getActiveMetaCampaignIdSet(campaignId);");
    expect(metaCampaignRevenueRoute).toContain("rs.platform_context = 'meta'");
    expect(metaCampaignRevenueRoute).toContain("activeMetaCampaignIds.has(metaCampaignId)");
    expect(metaCampaignRevenueRoute).toContain("storage.getRevenueSources(campaignId, \"meta\")");
    expect(metaCampaignRevenueRoute).toContain("campaignValueRevenueByValue.get(crmValue)");
  });

  it("renders Meta Campaign Breakdown revenue only from exact campaign revenue data", () => {
    const page = read("client", "src", "pages", "meta-analytics.tsx");
    const campaignBreakdown = sliceBetween(
      page,
      "{/* Campaign Breakdown - Card Layout */}",
      "{/* Demographics & Geographics */}"
    );

    expect(page).toContain('queryKey: ["/api/campaigns", campaignId, "meta-campaign-revenue"]');
    expect(page).toContain('fetch(`/api/campaigns/${campaignId}/meta-campaign-revenue?dateRange=90days`)');
    expect(page).toContain("const metaCampaignRevenueById = useMemo(() => {");
    expect(campaignBreakdown).toContain("const campaignRevenue = Number(metaCampaignRevenueById.get(String(campaign.id || \"\")) || 0);");
    expect(campaignBreakdown).toContain("Total Revenue");
    expect(campaignBreakdown).toContain("campaignRevenue > 0 ? formatCurrency(campaignRevenue)");
    expect(campaignBreakdown).not.toContain("revenueSummary.totalRevenue / campaigns.length");
  });

  it("keeps Meta Ad Comparison source-backed and scoped to selected campaigns", () => {
    const page = read("client", "src", "pages", "meta-analytics.tsx");
    const chartSetup = sliceBetween(
      page,
      "// Prepare data for charts",
      "// Handler: create or update KPI"
    );
    const adComparison = sliceBetween(
      page,
      '<TabsContent value="ad-comparison"',
      '<TabsContent value="insights"'
    );

    expect(chartSetup).toContain("const rankingCampaigns = campaigns.filter");
    expect(chartSetup).toContain("const bestCtrCampaign = [...rankingCampaigns]");
    expect(chartSetup).toContain("const mostEfficientCampaign = [...rankingCampaigns]");
    expect(chartSetup).toContain("const needsAttentionCampaign = [...rankingCampaigns]");
    expect(chartSetup).toContain("const campaignPerformanceData = [...campaigns]");
    expect(chartSetup).toContain(".sort((a: any, b: any) => Number(b?.totals?.spend || 0) - Number(a?.totals?.spend || 0))");
    expect(chartSetup).toContain(".slice(0, 5)");
    expect(chartSetup).not.toContain("campaigns.slice(0, 5)");

    expect(adComparison).toContain("Compare performance across selected Meta campaigns");
    expect(adComparison).toContain("Best CTR");
    expect(adComparison).toContain("Lowest CPC");
    expect(adComparison).toContain("Lowest Conversion Rate");
    expect(adComparison).toContain("bestCtrCampaign?.campaign?.name");
    expect(adComparison).toContain("mostEfficientCampaign?.campaign?.name");
    expect(adComparison).toContain("needsAttentionCampaign?.campaign?.name");
    expect(adComparison).toContain("Top 5 campaigns by spend");
    expect(adComparison).toContain("Side-by-side metrics for selected campaigns");
    expect(adComparison).not.toContain("Product Launch - Holiday Sale");
    expect(adComparison).not.toContain("Retargeting Campaign");
    expect(adComparison).not.toContain("Video Views Campaign");
    expect(adComparison).not.toContain("all Meta campaigns");
    expect(adComparison).not.toContain("Total Revenue");
    expect(adComparison).not.toContain("ROAS");
    expect(adComparison).not.toContain("ROI");
    expect(adComparison).not.toContain("Profit");
  });

  it("preserves Meta revenue import context across shared provider save and refresh paths", () => {
    const wizard = read("client", "src", "components", "AddRevenueWizardModal.tsx");
    const routes = read("server", "routes-oauth.ts");
    const scheduler = read("server", "auto-refresh-scheduler.ts");
    const legacyCsvRoute = sliceBetween(
      routes,
      'app.post("/api/meta/:campaignId/revenue/csv"',
      'app.get("/api/meta/:campaignId/revenue/summary"'
    );

    expect(wizard).toContain("platformContext === 'meta' ? 'meta_revenue'");
    expect(wizard).toContain("fetch(`/api/campaigns/${campaignId}/revenue/csv/process`");
    expect(wizard).toContain('queryKey: ["/api/platforms/meta/reports", campaignId], exact: false');
    expect(routes).toContain("platformContext === 'meta' ? 'meta_revenue'");
    expect(routes).toContain('platformContextRaw === "meta" ? "meta"');
    expect(scheduler).toContain('const crmRevenueContexts = ["ga4", "meta", "google_ads"] as const;');
    expect(legacyCsvRoute).toContain("res.status(501).json");
    expect(legacyCsvRoute).toContain("Legacy Meta CSV revenue import is unavailable");
    expect(legacyCsvRoute).not.toContain("processMetaRevenueCSV");
    expect(legacyCsvRoute).not.toContain("Revenue data imported successfully");
  });

  it("keeps Meta reports on shared platform-report storage and fail-closes legacy send/preview routes", () => {
    const page = read("client", "src", "pages", "meta-analytics.tsx");
    const routes = read("server", "routes-oauth.ts");
    const legacySendRoute = sliceBetween(
      routes,
      'app.post("/api/meta/reports/:reportId/send"',
      'app.get("/api/meta/reports/:reportId/preview"'
    );
    const legacyPreviewRoute = sliceBetween(
      routes,
      'app.get("/api/meta/reports/:reportId/preview"',
      'app.post("/api/meta/:campaignId/revenue/manual"'
    );

    expect(page).toContain("/api/platforms/meta/reports");
    expect(page).toContain("queryKey: ['/api/platforms/meta/reports', campaignId]");
    expect(page).toContain("scheduleRecipients: merged.scheduleEnabled");
    expect(page).toContain("scheduleTime: merged.scheduleEnabled ? to24HourHHMM(merged.scheduleTime) : undefined");
    expect(page).toContain("scheduleTimeZone: merged.scheduleEnabled ? userTimeZone : undefined");
    expect(page).toContain("const reportConfiguration = parseMetaReportConfiguration(report.configuration);");
    expect(page).not.toContain("fetch(`/api/meta/reports?campaignId=${campaignId}`)");
    expect(page).not.toContain("fetch('/api/meta/reports'");
    expect(legacySendRoute).toContain("res.status(501).json");
    expect(legacySendRoute).toContain("Meta report sending is not available");
    expect(legacySendRoute).not.toContain("Report sent successfully");
    expect(legacyPreviewRoute).toContain("res.status(501).json");
    expect(legacyPreviewRoute).toContain("Meta report preview is not available");
    expect(legacyPreviewRoute).not.toContain("Report preview HTML would be generated here");
  });

  it("keeps Meta KPI and Benchmark lifecycle on shared platform-scoped storage", () => {
    const page = read("client", "src", "pages", "meta-analytics.tsx");
    const routes = read("server", "routes-oauth.ts");
    const kpiRoutes = sliceBetween(
      routes,
      'app.get("/api/platforms/meta/kpis/:campaignId"',
      "// ====================== GOOGLE ADS INTEGRATION ======================"
    );

    expect(kpiRoutes).toContain('storage.getPlatformKPIs("meta", parsedId.data)');
    expect(kpiRoutes).toContain('platformType: "meta"');
    expect(kpiRoutes).toContain("insertKPISchema.parse(requestData)");
    expect(kpiRoutes).toContain("storage.createKPI(validatedKPI)");
    expect(kpiRoutes).toContain("storage.updateKPI(kpiId, validatedUpdates)");
    expect(kpiRoutes).toContain("storage.deleteKPI(kpiId)");
    expect(page).toContain("Array.isArray(json) ? json : Array.isArray(json?.kpis) ? json.kpis : []");
    expect(page).toContain("fetch(`/api/platforms/meta/benchmarks?campaignId=${encodeURIComponent(String(campaignId))}`)");
    expect(page).toContain("fetch('/api/platforms/meta/benchmarks'");
    expect(page).toContain("fetch(`/api/platforms/meta/benchmarks/${id}`,");
    expect(page).not.toContain("benchmarks/evaluated?platform=meta");
  });

  it("maps Meta KPI and Benchmark revenue metrics to imported attributed revenue", () => {
    const page = read("client", "src", "pages", "meta-analytics.tsx");
    const kpiModal = read("client", "src", "pages", "meta-analytics", "MetaKpiModal.tsx");
    const benchmarkModal = read("client", "src", "pages", "meta-analytics", "MetaBenchmarkModal.tsx");

    expect(page).toContain("{ key: 'totalRevenue', label: 'Total Revenue'");
    expect(page).toContain("if (normalizedKey === 'totalrevenue' || normalizedKey === 'revenue') return hasMetaAttributedRevenue ? metaAttributedRevenue : 0;");
    expect(page).toContain("if (normalizedKey === 'profit') return hasMetaAttributedRevenue ? metaAttributedProfit : 0;");
    expect(page).toContain("if (normalizedKey === 'roas') return hasMetaAttributedRevenue ? metaAttributedRoas : 0;");
    expect(page).toContain("if (normalizedKey === 'roi') return hasMetaAttributedRevenue ? metaAttributedRoi : 0;");
    expect(page).toContain("if (normalizedKey === 'profitmargin') return hasMetaAttributedRevenue ? metaAttributedProfitMargin : 0;");
    expect(page).toContain("revenueSummary={metaRevenueMetricSummary}");
    expect(page).toContain("currentValue: String(currentVal)");
    expect(kpiModal).toContain("campaign.totals || campaign.metrics || campaign");
    expect(benchmarkModal).toContain("campaign.totals || campaign.metrics || campaign");
    expect(kpiModal).toContain("Requires Revenue Source");
    expect(benchmarkModal).toContain("Requires Revenue Source");
  });

  it("keeps the Meta KPI modal focused and creates cards from clean numeric values", () => {
    const page = read("client", "src", "pages", "meta-analytics.tsx");
    const kpiModal = read("client", "src", "pages", "meta-analytics", "MetaKpiModal.tsx");

    expect(kpiModal).not.toContain('Label htmlFor="kpi-category">Category</Label>');
    expect(kpiModal).not.toContain('data-testid="select-kpi-category"');
    expect(kpiModal).not.toContain('Label htmlFor="kpi-timeframe">Timeframe</Label>');
    expect(kpiModal).not.toContain('data-testid="select-kpi-timeframe"');
    expect(kpiModal).not.toContain('Label htmlFor="kpi-tracking-period">Tracking Period (days)</Label>');
    expect(kpiModal).not.toContain('data-testid="input-kpi-tracking-period"');
    expect(kpiModal).toContain("useGrouping: true, allowNegative: false");
    expect(page).toContain("function stripNumberFormatting(value: any): any");
    expect(page).toContain("targetValue: stripNumberFormatting(kpiForm.targetValue)");
    expect(page).toContain("currentValue: stripNumberFormatting(kpiForm.currentValue) || String(getLiveMetricValue(kpiForm.metric))");
    expect(page).toContain("await queryClient.refetchQueries({ queryKey: ['/api/platforms/meta/kpis', campaignId], exact: true });");
    expect(page).toContain("category: kpiForm.category || 'performance'");
    expect(page).toContain("trackingPeriod: Number(kpiForm.trackingPeriod || 30)");
    expect(page).toContain("title: 'Failed to create KPI'");
  });

  it("keeps the Meta Benchmark modal on custom values and creates cards from clean numeric values", () => {
    const page = read("client", "src", "pages", "meta-analytics.tsx");
    const benchmarkModal = read("client", "src", "pages", "meta-analytics", "MetaBenchmarkModal.tsx");

    expect(page).toContain("benchmarkType: 'custom' as 'industry' | 'custom'");
    expect(benchmarkModal).not.toContain('Label htmlFor="benchmark-type">Benchmark Type</Label>');
    expect(benchmarkModal).not.toContain('data-testid="select-benchmark-type"');
    expect(benchmarkModal).not.toContain('Label htmlFor="benchmark-industry">Select Industry</Label>');
    expect(benchmarkModal).not.toContain('data-testid="select-benchmark-industry"');
    expect(benchmarkModal).not.toContain('benchmarkForm.benchmarkType === "industry"');
    expect(benchmarkModal).toContain("useGrouping: true, allowNegative: false");
    expect(page).toContain("benchmarkValue: stripNumberFormatting(benchmarkForm.benchmarkValue)");
    expect(page).toContain("targetValue: stripNumberFormatting(benchmarkForm.benchmarkValue)");
    expect(page).toContain("currentValue: stripNumberFormatting(benchmarkForm.currentValue) || String(getLiveMetricValue(benchmarkForm.metric))");
    expect(page).toContain("category: 'performance'");
    expect(page).toContain("await queryClient.refetchQueries({ queryKey: ['/api/campaigns', campaignId, 'benchmarks', 'meta'], exact: true });");
    expect(page).toContain("title: 'Failed to create benchmark'");
  });

  it("does not show a Source tile on Meta Benchmark cards when custom value is the only create path", () => {
    const page = read("client", "src", "pages", "meta-analytics.tsx");
    const benchmarkCards = sliceBetween(
      page,
      "{/* Benchmark Cards */}",
      "No benchmarks have been created yet."
    );

    expect(benchmarkCards).toContain('className="grid gap-4 md:grid-cols-2"');
    expect(benchmarkCards).toContain("Benchmark Value");
    expect(benchmarkCards).not.toContain("All Campaigns");
    expect(benchmarkCards).not.toContain(">Source<");
    expect(benchmarkCards).not.toContain("Industry (${benchmark.industry})");
    expect(benchmarkCards).not.toContain("'Custom'");
  });

  it("keeps Meta initial loading aligned with the app fallback to avoid refresh layout jumps", () => {
    const page = read("client", "src", "pages", "meta-analytics.tsx");
    const loadingState = sliceBetween(
      page,
      "if (isLoading) {",
      "if (!analyticsData) {"
    );

    expect(loadingState).toContain("min-h-screen w-full flex items-center justify-center bg-gray-50");
    expect(loadingState).toContain("Loading...");
    expect(loadingState).not.toContain("Loading Meta analytics");
    expect(loadingState).not.toContain("<Navigation />");
    expect(loadingState).not.toContain("<Sidebar />");
  });

  it("keeps the Create Campaign confirm Back button on platform selection instead of re-entering OAuth", () => {
    const page = read("client", "src", "pages", "campaigns.tsx");
    const handler = sliceBetween(
      page,
      "const handleBackFromConfirm = () => {",
      "const handleContinuePlatformSetup = () => {"
    );
    const confirmStep = sliceBetween(
      page,
      "/* Step 5: Confirm & Create */",
      ") : null}"
    );

    expect(handler).toContain("setSelectedWizardPlatform(null);");
    expect(handler).toContain("setWizardPlatformConnected(false);");
    expect(handler).toContain("setWizardStep(2);");
    expect(confirmStep).toContain("onClick={handleBackFromConfirm}");
    expect(confirmStep).not.toContain("onClick={() => setWizardStep(3)}");
  });

  it("keeps Meta test-mode setup from finalizing without an explicit campaign selection", () => {
    const flow = read("client", "src", "components", "SimpleMetaAuth.tsx");

    expect(flow).toContain("deferSeedUntilSelection: true");
    expect(flow).toContain("selected: selectedCampaignIds.has(String(c.id))");
    expect(flow).toContain("if (selectedIds.length === 0) throw new Error('Select at least one Meta campaign')");
    expect(flow).toContain("disabled={selectedCount === 0 || savingSelection}");
    expect(flow).toContain("Meta cannot be finalized until at least one campaign is available and selected.");
    expect(flow).not.toContain("Skip (import all)");
    expect(flow).not.toContain("Campaign selection available later.");
  });

  it("lists Meta test-mode campaigns from the same mock IDs used by the scheduler", () => {
    const routes = read("server", "routes-oauth.ts");
    const scheduler = read("server", "meta-scheduler.ts");
    const campaignsRoute = sliceBetween(
      routes,
      'app.get("/api/meta/:campaignId/campaigns"',
      'app.get("/api/meta/:campaignId/insights/daily"'
    );

    expect(scheduler).toContain("export const META_MOCK_CAMPAIGNS = [");
    expect(campaignsRoute).toContain('String((connection as any).method || "") === "test_mode"');
    expect(campaignsRoute).toContain("const { META_MOCK_CAMPAIGNS } = await import('./meta-scheduler');");
    expect(campaignsRoute).toContain("const campaigns = META_MOCK_CAMPAIGNS.map((campaign) => ({");
    expect(campaignsRoute.indexOf("META_MOCK_CAMPAIGNS")).toBeLessThan(campaignsRoute.indexOf("MetaGraphAPIClient"));
  });

  it("seeds Meta test-mode daily rows only after selected campaign IDs are saved by the setup UI", () => {
    const routes = read("server", "routes-oauth.ts");
    const testConnectRoute = sliceBetween(
      routes,
      'app.post("/api/meta/:campaignId/connect-test"',
      'app.get("/api/meta/:campaignId/connection"'
    );
    const selectedCampaignRoute = sliceBetween(
      routes,
      'app.patch("/api/meta/:campaignId/selected-campaigns"',
      'app.get("/api/campaigns/:id/benchmarks/evaluated"'
    );

    expect(testConnectRoute).toContain("const deferSeedUntilSelection = !!(req.body as any)?.deferSeedUntilSelection;");
    expect(testConnectRoute).toContain("if (!deferSeedUntilSelection)");
    expect(selectedCampaignRoute).toContain("if (selectedCampaignIds.length === 0) return res.status(400)");
    expect(selectedCampaignRoute).toContain("await storage.updateMetaConnection(campaignId");
    expect(selectedCampaignRoute).toContain('if (String(connection.method || "") === "test_mode")');
    expect(selectedCampaignRoute).toContain("const nextConnection = { ...connection, selectedCampaignIds: JSON.stringify(selectedCampaignIds) };");
    expect(selectedCampaignRoute).toContain("await generateMockMetaData(campaignId, nextConnection, { advanceDay: true });");
    expect(selectedCampaignRoute.indexOf("storage.updateMetaConnection")).toBeLessThan(selectedCampaignRoute.indexOf("generateMockMetaData"));
  });

  it("fails closed during Meta scheduler refresh when selected campaign IDs are missing", () => {
    const scheduler = read("server", "meta-scheduler.ts");
    const mockGenerator = sliceBetween(
      scheduler,
      "export async function generateMockMetaData(",
      "/**\n * Fetch real Meta data from Graph API"
    );
    const liveRefresh = sliceBetween(
      scheduler,
      "async function fetchRealMetaData(",
      "/**\n * Refresh Meta data for a single campaign"
    );
    const refreshForCampaign = sliceBetween(
      scheduler,
      "export async function refreshMetaDataForCampaign(",
      "/**\n * Refresh Meta data for all campaigns with Meta connections"
    );

    expect(scheduler).toContain("const getSelectedMetaCampaignIds = (connection: any): string[] => {");
    expect(mockGenerator).toContain("if (selectedIds.length === 0)");
    expect(mockGenerator).toContain("missing selected Meta campaign IDs");
    expect(mockGenerator).toContain("const campaignsToGenerate = META_MOCK_CAMPAIGNS.filter");
    expect(mockGenerator).not.toContain(": META_MOCK_CAMPAIGNS");
    expect(liveRefresh).toContain("if (selectedIds.length === 0)");
    expect(liveRefresh).toContain("missing selected Meta campaign IDs");
    expect(liveRefresh).toContain("const filteredCampaigns = campaigns.filter");
    expect(liveRefresh).not.toContain(": campaigns");
    expect(refreshForCampaign).toContain("if (getSelectedMetaCampaignIds(connection).length === 0)");
    expect(refreshForCampaign).toContain("return;");
  });

  it("stores live Meta scheduler refresh as daily rows and preserves upsert metadata", () => {
    const scheduler = read("server", "meta-scheduler.ts");
    const storage = read("server", "storage.ts");
    const liveRefresh = sliceBetween(
      scheduler,
      "async function fetchRealMetaData(",
      "/**\n * Refresh Meta data for a single campaign"
    );
    const upsert = sliceBetween(
      storage,
      "async upsertMetaDailyMetrics(metrics: InsertMetaDailyMetric[]): Promise<void> {",
      "// LinkedIn Import Session methods"
    );

    expect(liveRefresh).toContain("const dailyInsights = await metaClient.getCampaignDailyInsights(campaign.id, dailyDateRange);");
    expect(liveRefresh).toContain("for (const insights of Array.isArray(dailyInsights) ? dailyInsights : [])");
    expect(liveRefresh).toContain('const date = String(insights.dateStart || insights.dateStop || "").slice(0, 10);');
    expect(liveRefresh).toContain("metaCampaignName: campaign.name");
    expect(liveRefresh).not.toContain("getBatchCampaignInsights");
    expect(liveRefresh).not.toContain("getCampaignInsights(campaign.id, dailyDateRange)");
    expect(upsert).toContain("metaCampaignName: sql`COALESCE(EXCLUDED.meta_campaign_name, ${metaDailyMetrics.metaCampaignName})`");
    expect(upsert).toContain("ga4Revenue: sql`COALESCE(EXCLUDED.ga4_revenue, ${metaDailyMetrics.ga4Revenue})`");
    expect(upsert).toContain("ga4UtmName: sql`COALESCE(EXCLUDED.ga4_utm_name, ${metaDailyMetrics.ga4UtmName})`");
  });

  it("cleans Meta-owned metrics and spend rows when disconnecting or reconnecting", () => {
    const routes = read("server", "routes-oauth.ts");
    const storage = read("server", "storage.ts");
    const centralizedDelete = sliceBetween(
      routes,
      'app.delete("/api/campaigns/:campaignId/meta/connection"',
      "// END CENTRALIZED META/FACEBOOK OAUTH"
    );
    const legacyDelete = sliceBetween(
      routes,
      'app.delete("/api/meta/:campaignId/connection"',
      "Transfer Meta connection from temporary campaign to real campaign"
    );
    const testConnect = sliceBetween(
      routes,
      'app.post("/api/meta/:campaignId/connect-test"',
      'app.get("/api/meta/:campaignId/connection"'
    );
    const deleteMethod = sliceBetween(
      storage,
      "async deleteMetaConnection(campaignId: string): Promise<boolean> {",
      "// Google Ads Connection methods"
    );

    expect(centralizedDelete).toContain("storage.deleteMetaConnection(parsedId.data)");
    expect(legacyDelete).toContain("storage.deleteMetaConnection(campaignId)");
    expect(testConnect).toContain("await storage.deleteMetaConnection(campaignId).catch(() => {});");
    expect(deleteMethod).toContain("db.transaction");
    expect(deleteMethod).toContain("tx.delete(metaDailyMetrics).where(eq(metaDailyMetrics.campaignId, campaignId))");
    expect(deleteMethod).toContain("tx.delete(spendRecords).where");
    expect(deleteMethod).toContain("eq(spendRecords.spendSourceId, 'meta_daily_metrics')");
    expect(deleteMethod).toContain("eq(spendRecords.sourceType, 'meta_api')");
    expect(deleteMethod).not.toContain("revenueSources");
    expect(deleteMethod).not.toContain("metaKpis");
    expect(deleteMethod).not.toContain("metaBenchmarks");
    expect(deleteMethod).not.toContain("metaReports");
  });
});
