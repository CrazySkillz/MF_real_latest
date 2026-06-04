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
    expect(helper).toContain('queryKey: ["/api/meta/reports", campaignId], exact: false');
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
