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

  it("fails closed in the dedicated scheduler when saved Google Ads campaign scope is missing or mismatched", () => {
    const scheduler = read("server", "google-ads-scheduler.ts");
    const materialize = sliceBetween(
      scheduler,
      "export async function materializeGA4GoogleAdsSpendForCampaign",
      "export async function enrichGoogleAdsWithGA4Revenue"
    );

    expect(materialize).toContain('storage.getSpendSources(campaignId, "ga4")');
    expect(materialize).toContain('String(mapping.platform || "").trim().toLowerCase() === "google_ads"');
    expect(materialize).toContain("const sourceIds = parseSelectedGoogleAdsCampaignIds(mapping.selectedCampaignIds)");
    expect(materialize).toContain("const connectionIds = parseSelectedGoogleAdsCampaignIds(connection.selectedCampaignIds)");
    expect(materialize).toContain("sourceIds.length === 0 || JSON.stringify(sourceIds) !== JSON.stringify(connectionIds)");
    expect(materialize).toContain("buildGA4GoogleAdsSpendMaterialization({");
    expect(materialize).toContain("selectedCampaignIds: sourceIds");
    expect(materialize).toContain("await storage.replaceSpendRecordsForSource(");
    expect(materialize).toContain('storage.getSpendTotalForRange(campaignId, "1900-01-01", endDate, "ga4")');
    expect(materialize).not.toContain("deleteSpendRecordsBySource");
  });
});
