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

describe("Google Ads GA4 Overview spend lifecycle and downstream regression guard", () => {
  it("allows GA4 Spend OAuth setup without a developer token while retaining the Connected Platform guard", () => {
    const routes = read("server", "routes-oauth.ts");
    const credentials = sliceBetween(routes, "const getGoogleAdsOAuthClientCredentials = (spendOnly: boolean) =>", "const getGoogleAdsOAuthStateSecret");
    const route = sliceBetween(routes, 'app.post("/api/auth/google-ads/connect"', 'app.get("/api/auth/google-ads/callback"');
    const callback = sliceBetween(routes, 'app.get("/api/auth/google-ads/callback"', 'app.post("/api/google-ads/:campaignId/select-customer"');
    const selection = sliceBetween(routes, 'app.post("/api/google-ads/:campaignId/select-customer"', 'app.post("/api/google-ads/:campaignId/connect-test"');
    expect(credentials).toContain('spendOnly && !process.env.GOOGLE_ADS_CLIENT_ID && !process.env.GOOGLE_ADS_CLIENT_SECRET');
    expect(credentials).toContain('process.env.GOOGLE_CLIENT_ID : process.env.GOOGLE_ADS_CLIENT_ID');
    expect(credentials).toContain('process.env.GOOGLE_CLIENT_SECRET : process.env.GOOGLE_ADS_CLIENT_SECRET');
    expect(route).toContain('const spendOnly = !!(req.body as any)?.spendOnly;');
    expect(route).toContain('getGoogleAdsOAuthClientCredentials(spendOnly)');
    expect(route).toContain('!clientId || !clientSecret || (!spendOnly && !developerToken)');
    expect(route).toContain('Google Ads OAuth is not configured for this app.');
    expect(route).toContain('Set GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET, and GOOGLE_ADS_DEVELOPER_TOKEN.');
    expect(callback).toContain('getGoogleAdsOAuthClientCredentials(spendOnly)');
    expect(selection).toContain('getGoogleAdsOAuthClientCredentials(spendOnly)');
    expect(selection).toContain('clientSecret: clientSecret ||');
  });

  it("routes GA4 Overview Google Ads spend imports through a GA4-scoped ad-platform source with selected campaign IDs", () => {
    const ga4Page = read("client", "src", "pages", "ga4-metrics.tsx");
    const modal = read("client", "src", "components", "AddSpendWizardModal.tsx");
    const ga4SpendModal = sliceBetween(
      ga4Page,
      "<AddSpendWizardModal",
      "<AddRevenueWizardModal"
    );
    const preview = sliceBetween(
      modal,
      "const fetchAdPlatformPreview = async (platform: string) =>",
      "// Import ad platform spend (selected campaigns only)"
    );
    const importFlow = sliceBetween(
      modal,
      "const importAdPlatformSpend = async () =>",
      "// Check Meta / Google Ads connection when entering ad_platform step"
    );
    const connectCustomer = sliceBetween(modal, "const connectGoogleAdsSpendCustomer = async () =>", "// Handle test mode toggle for Meta demos only");
    const routes = read("server", "routes-oauth.ts");
    const selectCustomer = sliceBetween(routes, 'app.post("/api/google-ads/:campaignId/select-customer"', 'app.post("/api/google-ads/:campaignId/connect-test"');
    const connectionStatus = sliceBetween(routes, 'app.get("/api/google-ads/:campaignId/connection"', 'app.delete("/api/google-ads/:campaignId/connection"');

    expect(ga4SpendModal).toContain('platformContext="ga4"');
    expect(preview).toContain('const spendPreviewParam = platform === "google_ads" ? "&spendPreview=1" : "";');
    expect(preview).toContain('const campaignIdKey = platform === "google_ads" ? "googleCampaignId" : "metaCampaignId";');
    expect(preview).toContain('const campaignNameKey = platform === "google_ads" ? "googleCampaignName" : "metaCampaignName";');
    expect(importFlow).toContain('const platformLabel = selectedPlatform === "google_ads" ? "Google Ads" : "Meta Ads";');
    expect(importFlow).toContain('fetch(`/api/campaigns/${props.campaignId}/spend/process/manual`');
    expect(importFlow).toContain('sourceType: "ad_platforms"');
    expect(importFlow).toContain("displayName: platformLabel");
    expect(importFlow).toContain("platformContext: props.platformContext");
    expect(importFlow).toContain("...(isEditing && props.initialSource?.id ? { sourceId: String(props.initialSource.id) } : {}),");
    expect(importFlow).toContain("platform: selectedPlatform");
    expect(importFlow).toContain("selectedCampaignIds: selectedAdPlatformCampaignIds");
    expect(importFlow).toContain("breakdown: selectedCampaigns.map");
    expect(importFlow).toContain('testMode: selectedPlatform === "meta" ? isAdPlatformTestMode : false');
    expect(importFlow).not.toContain("/spend/ad-platform/import");
    expect(connectCustomer).toContain('/select-customer`');
    expect(modal).toContain('/connection?spendPreview=1`');
    expect(connectCustomer).toContain('await fetchAdPlatformPreview("google_ads")');
    expect(connectCustomer).not.toContain('/refresh`');
    expect(selectCustomer).toContain("await provider.getDailyMetrics(startDate, endDate)");
    expect(selectCustomer).toContain("if (spendOnly) {");
    expect(selectCustomer).toContain("await storage.replaceGA4GoogleAdsSpendConnection(connectionData, initialDailyMetrics as any);");
    expect(selectCustomer).toContain("await storage.replaceGoogleAdsConnection(connectionData, initialDailyMetrics as any);");
    expect(selectCustomer).toContain('storage.getSpendSources(campaignId, "ga4")');
    expect(selectCustomer).toContain("Delete the existing Google Ads Spend source before changing its account.");
    expect(selectCustomer.indexOf("hasGoogleAdsSpendSource")).toBeLessThan(selectCustomer.indexOf("await provider.getDailyMetrics(startDate, endDate)"));
    expect(connectionStatus).toContain("storage.getGA4GoogleAdsSpendConnection(campaignId)");
  });

  it("preserves campaign/source identity when a Google Ads spend source is added or edited through the manual spend route", () => {
    const routes = read("server", "routes-oauth.ts");
    const manualRoute = sliceBetween(
      routes,
      'app.post("/api/campaigns/:id/spend/process/manual"',
      "const processConnectorDerivedSpend"
    );

    expect(manualRoute).toContain("const campaign = await ensureCampaignAccess(req as any, res as any, campaignId);");
    expect(manualRoute).toContain("const effectiveSourceType = spendSourceTypeForPlatformContext(platformContext, overrideSourceType);");
    const googleAdsAdd = sliceBetween(manualRoute, "if (isGA4GoogleAdsSpend) {", "if (!connection || !connection.spendOnly)");
    expect(googleAdsAdd).toContain("if (!existingSourceId) {");
    expect(googleAdsAdd).toContain('storage.getSpendSources(campaignId, "ga4")');
    expect(googleAdsAdd).toContain('source.sourceType !== "ad_platforms"');
    expect(googleAdsAdd).toContain('String(mapping.platform || "").trim().toLowerCase() === "google_ads"');
    expect(googleAdsAdd).toContain("res.status(409)");
    expect(googleAdsAdd).toContain("storage.getGA4GoogleAdsSpendConnection(campaignId)");
    expect(manualRoute).toContain("const existingSource = await storage.getSpendSource(campaignId, existingSourceId);");
    expect(manualRoute).toContain("spendSourceMatchesPlatformContext(existingSource, platformContext)");
    expect(manualRoute).toContain('String((existingSource as any)?.sourceType || "").trim() !== effectiveSourceType');
    expect(manualRoute).toContain('effectiveSourceType === "ad_platforms" && overrideDisplayName');
    expect(manualRoute).toContain("source = await storage.updateSpendSource(existingSourceId,");
    expect(manualRoute).toContain("source = await storage.createSpendSource({");
    expect(manualRoute).toContain("sourceType: effectiveSourceType");
    expect(manualRoute).toContain("platformContext: platformContext || null");
    expect(manualRoute).toContain("displayName: resolvedDisplayName");
    expect(manualRoute).toContain("mappingConfig: finalMappingConfig");
    expect(manualRoute.indexOf("await storage.deleteSpendRecordsBySource(existingSourceId)")).toBeLessThan(manualRoute.indexOf("await storage.createSpendRecords"));
    expect(manualRoute).toContain("spendSourceId: String(source.id)");
    expect(manualRoute.indexOf("await recalcCampaignSpend(campaignId);")).toBeLessThan(manualRoute.indexOf("await recomputeGA4SpendBeforeResponse(campaignId);"));
    expect(manualRoute).toContain("platformContext: platformContext || null");
  });

  it("keeps Google Ads spend source reads, deletes, and rollups campaign-scoped and active-source bounded", () => {
    const routes = read("server", "routes-oauth.ts");
    const storage = read("server", "storage.ts");
    const spendSourcesRoute = sliceBetween(
      routes,
      'app.get("/api/campaigns/:id/spend-sources"',
      "const getGoogleSheetsSpendDuplicateGroups"
    );
    const spendToDateRoute = sliceBetween(
      routes,
      'app.get("/api/campaigns/:id/spend-to-date"',
      "const toISODateUTC"
    );
    const spendBreakdownRoute = sliceBetween(
      routes,
      'app.get("/api/campaigns/:id/spend-breakdown"',
      "// Daily spend total"
    );
    const deleteRoute = sliceBetween(
      routes,
      'app.delete("/api/campaigns/:id/spend-sources/:sourceId"',
      'app.get("/api/campaigns/:id/revenue-totals"'
    );
    const spendStorage = sliceBetween(
      storage,
      "async getSpendSources(campaignId: string, platformContext?: SpendPlatformContext): Promise<SpendSource[]>",
      "async getInactiveSpendSources"
    );
    const spendSourceStorage = sliceBetween(
      storage,
      "async getSpendSource(campaignId: string, sourceId: string, platformContext?: SpendPlatformContext): Promise<SpendSource | undefined>",
      "async createSpendSource"
    );
    const deleteStorage = sliceBetween(
      storage,
      "async deleteSpendSource(sourceId: string): Promise<boolean>",
      "async hardDeleteInactiveSpendSource"
    );
    const spendTotalStorage = sliceBetween(
      storage,
      "async getSpendTotalForRange(campaignId: string, startDate: string, endDate: string, platformContext?: SpendPlatformContext)",
      "async getSpendBreakdownBySource"
    );
    const spendBreakdownStorage = sliceBetween(
      storage,
      "async getSpendBreakdownBySource(campaignId: string, startDate: string, endDate: string, platformContext?: SpendPlatformContext)",
      "async getRevenueSources"
    );

    expect(spendSourcesRoute).toContain("requireCampaignAccessParamId");
    expect(spendSourcesRoute).toContain("const sources = await storage.getSpendSources(campaignId, platformContext);");
    expect(spendToDateRoute).toContain("requireCampaignAccessParamId");
    expect(spendToDateRoute).toContain("const campaign = await storage.getCampaign(campaignId);");
    expect(spendToDateRoute).toContain("const sources = await storage.getSpendSources(campaignId, platformContext);");
    expect(spendToDateRoute).toContain('const startDate = "1900-01-01"');
    expect(spendToDateRoute).toContain("getSpendTotalForRange(campaignId, startDate, endDate, platformContext)");
    expect(spendToDateRoute).toContain("startDate,");
    expect(spendToDateRoute).toContain("endDate,");
    expect(spendToDateRoute).toContain("sourceIds: scopedTotals");
    expect(spendToDateRoute).toContain("? scopedTotals.sourceIds");
    expect(spendBreakdownRoute).toContain("const campaign = await ensureCampaignAccess(req as any, res as any, campaignId);");
    expect(spendBreakdownRoute).toContain('const startDate = "1900-01-01";');
    expect(spendBreakdownRoute).toContain("storage.getSpendBreakdownBySource(campaignId, startDate, endDate, platformContext)");
    expect(deleteRoute).toContain("const ok = await ensureCampaignAccess(req as any, res as any, campaignId);");
    expect(deleteRoute).toContain("storage.getSpendSources(campaignId, requestedPlatformContext || undefined)");
    expect(deleteRoute).toContain("await storage.deleteSpendSourceWithRecords(campaignId, sourceId, deletingSourcePlatformContext);");
    expect(deleteRoute).not.toContain("await storage.deleteSpendSource(sourceId);");
    expect(deleteRoute).not.toContain("await storage.deleteSpendRecordsBySource(sourceId);");
    expect(deleteRoute).toContain("await recalcCampaignSpend(campaignId);");
    expect(deleteRoute).toContain('await recomputeGA4KPIAndBenchmarkValues(campaignId, "Spend Update");');
    expect(spendStorage).toContain("eq(spendSources.campaignId, campaignId)");
    expect(spendStorage).toContain("eq(spendSources.isActive, true)");
    expect(spendSourceStorage).toContain("eq(spendSources.campaignId, campaignId)");
    expect(spendSourceStorage).toContain("eq(spendSources.isActive, true)");
    expect(deleteStorage).toContain(".set({ isActive: false } as any)");
    expect(spendTotalStorage).toContain(".innerJoin(spendSources");
    expect(spendTotalStorage).toContain("eq(spendRecords.campaignId, campaignId)");
    expect(spendTotalStorage).toContain("eq(spendSources.isActive, true)");
    expect(spendBreakdownStorage).toContain(".innerJoin(spendSources");
    expect(spendBreakdownStorage).toContain("eq(spendRecords.campaignId, campaignId)");
    expect(spendBreakdownStorage).toContain("eq(spendSources.isActive, true)");
  });

  it("feeds GA4 Overview financial values from source-backed spend totals into Profit, ROAS, ROI, and CPA", () => {
    const ga4Page = read("client", "src", "pages", "ga4-metrics.tsx");
    const spendQueries = sliceBetween(
      ga4Page,
      "// Spend/Revenue to-date for executive financial metrics",
      "// Latest-day endpoints default"
    );
    const financials = sliceBetween(
      ga4Page,
      "const getInvalidBenchmarkConfigReason = (benchmark: any) =>",
      "const overviewVisibleDataUsingLastGoodData = Boolean("
    );
    const cards = sliceBetween(
      ga4Page,
      '<p className="text-sm font-medium text-muted-foreground/70">Profit</p>',
      "Add spend to unlock ROAS / ROI / CPA"
    );

    expect(spendQueries).toContain('fetch(`/api/campaigns/${campaignId}/spend-to-date?platformContext=ga4`)');
    expect(spendQueries).toContain('fetch(`/api/campaigns/${campaignId}/spend-sources?platformContext=ga4`)');
    expect(spendQueries).toContain('fetch(`/api/campaigns/${campaignId}/spend-breakdown?platformContext=ga4`)');
    expect(financials).toContain("const hasSpendSources = spendDisplaySources.length > 0;");
    expect(financials).toContain("const totalSpendForFinancials = hasSpendSources ? Number(spendBreakdownResp?.totalSpend ?? spendToDateResp?.spendToDate ?? 0) : 0;");
    expect(financials).toContain("const financialSpend = Number(totalSpendForFinancials || 0);");
    expect(financials).toContain("const financialROAS = financialSpend > 0 ? financialRevenue / financialSpend : 0;");
    expect(financials).toContain("const financialROI = computeRoiPercent(financialRevenue, financialSpend);");
    expect(financials).toContain("const financialCPA = computeCpa(financialSpend, financialConversions);");
    expect(cards).toContain("formatMoney(financialRevenue - financialSpend)");
    expect(cards).toContain("`${financialROAS.toFixed(2)}x`");
    expect(cards).toContain("formatPercentage(financialROI)");
    expect(cards).toContain("formatMoney(Number(financialCPA || 0))");
  });

  it("uses saved Google Ads Spend selection and fails closed when that selection is missing", () => {
    const scheduler = read("server", "google-ads-scheduler.ts");
    const fetch = sliceBetween(scheduler, "async function fetchRealGoogleAdsData", "const parseSelectedGoogleAdsCampaignIds");
    const materialize = sliceBetween(
      scheduler,
      "export async function materializeGA4GoogleAdsSpendForCampaign",
      "export async function enrichGoogleAdsWithGA4Revenue"
    );

    expect(materialize).toContain('storage.getSpendSources(campaignId, "ga4")');
    expect(materialize).toContain('String(mapping.platform || "").trim().toLowerCase() === "google_ads"');
    expect(materialize).toContain("const sourceIds = parseSelectedGoogleAdsCampaignIds(mapping.selectedCampaignIds)");
    expect(fetch).toContain('storage.getSpendSources(campaignId, "ga4")');
    expect(fetch).toContain('String(source.displayName || "").trim() === "Google Ads"');
    expect(fetch).toContain('source mapping is unavailable');
    expect(fetch).toContain("selectedIds = mapping ? parseSelectedGoogleAdsCampaignIds(mapping.selectedCampaignIds) : undefined");
    expect(materialize).toContain("if (sourceIds.length === 0) throw new Error");
    expect(materialize).toContain("buildGA4GoogleAdsSpendMaterialization({");
    expect(materialize).toContain("selectedCampaignIds: sourceIds");
    expect(materialize).toContain("await storage.replaceSpendRecordsForSource(");
    expect(materialize).toContain('storage.getSpendTotalForRange(campaignId, "1900-01-01", endDate, "ga4")');
    expect(materialize).not.toContain("deleteSpendRecordsBySource");
  });

  it("shows the saved Spend-only connection with refresh and exact disconnect controls", () => {
    const modal = read("client", "src", "components", "AddSpendWizardModal.tsx");
    const routes = read("server", "routes-oauth.ts");
    const storage = read("server", "storage.ts");
    const chooser = sliceBetween(modal, '{step === "select" && (', '{step === "ad_platform" && (');
    const disconnectRoute = sliceBetween(
      routes,
      "app.delete('/api/campaigns/:id/ga4/google-ads-spend/disconnect'",
      'app.get("/api/campaigns/:id/spend-totals"'
    );
    const disconnectStorage = sliceBetween(
      storage,
      "async disconnectGa4GoogleAdsSpend(campaignId: string)",
      "async deleteSpendRecordsBySource"
    );

    expect(modal).toContain('/connection?spendPreview=1`');
    expect(chooser).toContain('googleAdsSpendConnected ? "Connected" : "Reconnect required"');
    expect(chooser).toContain('title="Disconnect Google Ads Spend"');
    expect(chooser).toContain("The separate Google Ads Connected Platform is preserved.");
    expect(modal).toContain('/ga4/google-ads-spend/disconnect`');
    expect(modal).toContain('/refresh?spendPreview=1`');
    expect(modal).toContain('"Refresh data"');
    expect(modal).toContain('"No campaigns with spend found yet."');
    expect(modal).toContain('style: "currency", currency: props.currency || "USD"');
    expect(disconnectRoute).toContain("requireCampaignAccessParamId");
    expect(disconnectRoute).toContain("storage.disconnectGa4GoogleAdsSpend(campaignId)");
    expect(disconnectRoute).toContain("await recalcCampaignSpend(campaignId);");
    expect(disconnectRoute).toContain('await recomputeGA4KPIAndBenchmarkValues(campaignId, "Spend Update");');
    expect(disconnectStorage).toContain("eq(googleAdsConnections.spendOnly, true)");
    expect(disconnectStorage).toContain("ga4GoogleAdsSpendDailyMetrics");
    expect(disconnectStorage).toContain("ga4GoogleAdsSpendConnections");
  });
});
