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
    expect(manualRoute).toContain('String((existingSource as any)?.platformContext || "ga4").trim().toLowerCase()');
    expect(manualRoute).toContain('String((existingSource as any)?.sourceType || "").trim() !== effectiveSourceType');
    expect(manualRoute).toContain('effectiveSourceType === "ad_platforms" && overrideDisplayName');
    expect(manualRoute).toContain("source = await storage.updateSpendSource(existingSourceId,");
    expect(manualRoute).toContain("source = await storage.createSpendSource({");
    expect(manualRoute).toContain("sourceType: effectiveSourceType");
    expect(manualRoute).toContain("platformContext: platformContext || null");
    expect(manualRoute).toContain("displayName: effectiveDisplayName");
    expect(manualRoute).toContain("mappingConfig: finalMappingConfig");
    expect(manualRoute.indexOf("await storage.deleteSpendRecordsBySource(existingSourceId)")).toBeLessThan(manualRoute.indexOf("await storage.createSpendRecords"));
    expect(manualRoute).toContain("spendSourceId: String(source.id)");
    expect(manualRoute.indexOf("await recalcCampaignSpend(campaignId);")).toBeLessThan(manualRoute.indexOf("scheduleGA4SpendPostResponseRecompute(campaignId);"));
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
      "async getSpendSources(campaignId: string): Promise<SpendSource[]>",
      "async getInactiveSpendSources"
    );
    const spendSourceStorage = sliceBetween(
      storage,
      "async getSpendSource(campaignId: string, sourceId: string): Promise<SpendSource | undefined>",
      "async createSpendSource"
    );
    const deleteStorage = sliceBetween(
      storage,
      "async deleteSpendSource(sourceId: string): Promise<boolean>",
      "async hardDeleteInactiveSpendSource"
    );
    const spendTotalStorage = sliceBetween(
      storage,
      "async getSpendTotalForRange(campaignId: string, startDate: string, endDate: string)",
      "async getSpendBreakdownBySource"
    );
    const spendBreakdownStorage = sliceBetween(
      storage,
      "async getSpendBreakdownBySource(campaignId: string, startDate: string, endDate: string)",
      "async getRevenueSources"
    );

    expect(spendSourcesRoute).toContain("requireCampaignAccessParamId");
    expect(spendSourcesRoute).toContain("const sources = await storage.getSpendSources(campaignId);");
    expect(spendToDateRoute).toContain("requireCampaignAccessParamId");
    expect(spendToDateRoute).toContain("const campaign = await storage.getCampaign(campaignId);");
    expect(spendToDateRoute).toContain("const sources = await storage.getSpendSources(campaignId);");
    expect(spendToDateRoute).toContain("sourceIds: Array.isArray(sources) ? sources.map");
    expect(spendBreakdownRoute).toContain("const campaign = await ensureCampaignAccess(req as any, res as any, campaignId);");
    expect(spendBreakdownRoute).toContain('const startDate = "1900-01-01";');
    expect(spendBreakdownRoute).toContain("storage.getSpendBreakdownBySource(campaignId, startDate, endDate)");
    expect(deleteRoute).toContain("const ok = await ensureCampaignAccess(req as any, res as any, campaignId);");
    expect(deleteRoute).toContain("const existingSpendSources = await storage.getSpendSources(campaignId)");
    expect(deleteRoute).toContain('String((deletingSource as any)?.platformContext || "ga4").trim().toLowerCase()');
    expect(deleteRoute).toContain("await storage.deleteSpendSource(sourceId);");
    expect(deleteRoute).toContain("await storage.deleteSpendRecordsBySource(sourceId);");
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
      "const toRateRatio = (value: any) =>"
    );
    const cards = sliceBetween(
      ga4Page,
      '<p className="text-sm font-medium text-muted-foreground/70">Profit</p>',
      "Add spend to unlock ROAS / ROI / CPA"
    );

    expect(spendQueries).toContain('fetch(`/api/campaigns/${campaignId}/spend-to-date`)');
    expect(spendQueries).toContain('fetch(`/api/campaigns/${campaignId}/spend-sources`)');
    expect(spendQueries).toContain('fetch(`/api/campaigns/${campaignId}/spend-breakdown`)');
    expect(financials).toContain("const hasSpendSources = spendDisplaySources.length > 0;");
    expect(financials).toContain("const totalSpendForFinancials = hasSpendSources ? Number(spendBreakdownResp?.totalSpend || spendToDateResp?.spendToDate || 0) : 0;");
    expect(financials).toContain("const financialSpend = Number(totalSpendForFinancials || 0);");
    expect(financials).toContain("const financialROAS = financialSpend > 0 ? financialRevenue / financialSpend : 0;");
    expect(financials).toContain("const financialROI = computeRoiPercent(financialRevenue, financialSpend);");
    expect(financials).toContain("const financialCPA = computeCpa(financialSpend, financialConversions);");
    expect(cards).toContain("formatMoney(financialRevenue - financialSpend)");
    expect(cards).toContain("`${financialROAS.toFixed(2)}x`");
    expect(cards).toContain("formatPercentage(financialROI)");
    expect(cards).toContain("formatMoney(Number(financialCPA || 0))");
  });

  it("fails closed during scheduler Google Ads spend reprocess when saved selected campaign IDs are missing", () => {
    const scheduler = read("server", "auto-refresh-scheduler.ts");
    const adPlatformReprocess = sliceBetween(
      scheduler,
      "// Ad Platform Spend (Google Ads / Meta)",
      "// Google Sheets (Revenue)"
    );
    const googleAdsBranch = sliceBetween(
      adPlatformReprocess,
      'if (displayName.includes("Google Ads"))',
      '} else if (displayName.includes("Meta"))'
    );

    expect(adPlatformReprocess).toContain("const spendSrcs = await storage.getSpendSources(campaignId)");
    expect(adPlatformReprocess).toContain("isSourceOutsideCampaign(src, campaignId)");
    expect(adPlatformReprocess).toContain("selectedCampaignIds");
    expect(googleAdsBranch).toContain("if (!selectedIds || selectedIds.size === 0)");
    expect(googleAdsBranch).toContain("Refusing Google Ads spend reprocess for campaign ${campaignId}: missing selected campaign IDs");
    expect(googleAdsBranch).toContain("skipped++;");
    expect(googleAdsBranch).toContain("continue;");
    expect(googleAdsBranch.indexOf("continue;")).toBeLessThan(googleAdsBranch.indexOf("storage.getGoogleAdsDailyMetrics"));
    expect(googleAdsBranch).toContain("rows = (await storage.getGoogleAdsDailyMetrics(campaignId, startDate, endDate)) || [];");
    expect(googleAdsBranch).toContain('rows = rows.filter((r: any) => selectedIds.has(String(r?.googleCampaignId || "").trim()));');
    expect(adPlatformReprocess).toContain("await storage.deleteSpendRecordsBySource(String((src as any).id));");
    expect(adPlatformReprocess).toContain("await storage.createSpendRecords(records);");
    expect(adPlatformReprocess).toContain('const allSpend = await storage.getSpendTotalForRange(campaignId, "2020-01-01", endDate);');
    expect(adPlatformReprocess).toContain("await storage.updateCampaign(campaignId, { spend: String(allSpend.totalSpend.toFixed(2)) } as any);");
  });
});