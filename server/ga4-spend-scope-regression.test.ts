import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("GA4 spend source-scope regression guard", () => {
  it("scopes storage reads while preserving GA4 legacy-null compatibility", () => {
    const storage = read("server/storage.ts");

    expect(storage).toContain("export type SpendPlatformContext = RevenuePlatformContext;");
    expect(storage).toContain('return platformContext === "ga4"');
    expect(storage).toContain('or(eq(spendSources.platformContext, "ga4"), isNull(spendSources.platformContext))');
    expect(storage).toContain("eq(spendSources.platformContext, platformContext)");
    expect(storage).toContain("async getSpendSources(campaignId: string, platformContext?: SpendPlatformContext)");
    expect(storage).toContain("async getSpendSource(campaignId: string, sourceId: string, platformContext?: SpendPlatformContext)");
    expect(storage).toContain("async getSpendTotalForRange(campaignId: string, startDate: string, endDate: string, platformContext?: SpendPlatformContext)");
    expect(storage).toContain("async getSpendBreakdownBySource(campaignId: string, startDate: string, endDate: string, platformContext?: SpendPlatformContext)");
    expect(storage.split("spendPlatformContextPredicate(platformContext)").length - 1).toBeGreaterThanOrEqual(4);
    expect(storage.split("eq(spendSources.campaignId, campaignId)").length - 1).toBeGreaterThanOrEqual(4);
  });

  it("keeps GA4 Overview reads and deletion inside the GA4 source family", () => {
    const page = read("client/src/pages/ga4-metrics.tsx");
    const validationRunner = read("client/public/ga4-overview-validation-runner.js");
    const routes = read("server/routes-oauth.ts");

    for (const endpoint of ["spend-to-date", "spend-sources", "spend-breakdown", "spend-daily"]) {
      expect(page).toContain(endpoint + "?platformContext=ga4");
    }
    for (const endpoint of ["spend-to-date", "spend-sources", "spend-breakdown"]) {
      expect(validationRunner).toContain(endpoint + "?platformContext=ga4");
      expect(validationRunner).not.toContain(endpoint + '"),');
    }
    expect(page).toContain("spend-sources/${deletingSpendSourceId}?platformContext=ga4");
    expect(routes).toContain("const platformContext = parseOptionalSpendPlatformContext((req.query as any)?.platformContext, res);");
    expect(routes).toContain("storage.getSpendSources(campaignId, platformContext)");
    expect(routes).toContain("storage.getSpendBreakdownBySource(campaignId, startDate, endDate, platformContext)");
    expect(routes).toContain("storage.getSpendSources(campaignId, requestedPlatformContext || undefined)");
  });
  it("fails closed when runner financial totals are missing or disagree", () => {
    const validationRunner = read("client/public/ga4-overview-validation-runner.js");

    expect(validationRunner).toContain('if (value === undefined || value === null || value === "") return null;');
    expect(validationRunner).toContain('["spendToDate", "totalSpend", "spend", "total", "amount"]');
    expect(validationRunner).toContain("financialTotalsPresent:");
    expect(validationRunner).toContain("revenueToDateMatchesBreakdown:");
    expect(validationRunner).toContain("spendToDateMatchesBreakdown:");
  });


  it("treats valid zero as authoritative and does not reuse cached campaign spend for GA4", () => {
    const page = read("client/src/pages/ga4-metrics.tsx");
    const routes = read("server/routes-oauth.ts");

    expect(page).toContain("spendBreakdownResp?.totalSpend ?? spendToDateResp?.spendToDate ?? 0");
    expect(page).not.toContain("spendBreakdownResp?.totalSpend || spendToDateResp?.spendToDate");
    expect(routes).toContain('const startDate = "1900-01-01"');
    expect(routes).toContain("storage.getSpendTotalForRange(campaignId, startDate, endDate, platformContext)");
    expect(routes).toContain("const uiSpend = (Array.isArray(spendSources) && spendSources.length > 0)");
    expect(routes).toContain("? spendBreakdownTotal");
    expect(routes).not.toContain("spendBreakdownTotal || parseNum((campaign as any)?.spend)");
  });

  it("uses the same GA4 scope in reports, KPIs, cleanup, notifications, and aggregates", () => {
    const scheduledReport = read("server/ga4-scheduled-report-pdf.ts");
    const currentValues = read("server/utils/campaign-current-values.ts");
    const jobs = read("server/ga4-kpi-benchmark-jobs.ts");
    const damagedCleanup = read("server/ga4-kpi-damaged-data-cleanup.ts");
    const roasCleanup = read("server/ga4-roas-persisted-cleanup.ts");
    const routes = read("server/routes-oauth.ts");

    expect(scheduledReport).toContain('storage.getSpendSources(campaignId, "ga4")');
    expect(scheduledReport).toContain('storage.getSpendBreakdownBySource(campaignId, spendSourceStartDate, financialEndDate, "ga4")');
    expect(currentValues).toContain('storage.getSpendTotalForRange(campaignId, spendSourceStartDate, endDate, "ga4")');
    expect(currentValues).toContain('storage.getSpendBreakdownBySource(campaignId, spendSourceStartDate, endDate, "ga4")');
    expect(jobs).toContain('getSpendTotalForRange(campaignId, spendSourceWindow.startDate, spendSourceWindow.endDate, "ga4")');
    expect(damagedCleanup).toContain('getSpendTotalForRange(campaignId, "1900-01-01", financialEndDate, "ga4")');
    expect(roasCleanup).toContain('getSpendTotalForRange(campaignId, "2000-01-01", date, "ga4")');
    expect(routes).toContain('getSpendTotalForRange(campaignId, spendSourceWindow.startDate, spendSourceWindow.endDate, "ga4")');
    expect(routes).toContain('getSpendTotalForRange(campaignId, startDate, endDate, "ga4")');
    expect(routes).toContain('getSpendBreakdownBySource(campaignId, spendStartDate, spendEndDate, "ga4")');
    expect(routes).toContain('const executiveSpendPlatformContext = hasGA4Connection ? "ga4" : undefined;');
  });

  it("stores new GA4 sources explicitly but only self-heals legacy null sources on exact edits", () => {
    const routes = read("server/routes-oauth.ts");

    expect(routes).toContain('const scopedSpendPlatformContexts = new Set(["ga4", "google_sheets", "custom_integration"]);');
    expect(routes).toContain('return requested === "ga4" ? stored === "" || stored === "ga4" : stored === requested;');
    expect(routes).toContain("platformContext: platformContext || null");
    expect(routes).toContain("...(platformContext ? { platformContext } : {})");
    expect(routes).not.toContain('requestedPlatformContext === "ga4" ? null');
  });

  it("keeps the GA4 aggregate scheduler scoped while generic auto-refresh stays unscoped", () => {
    const scheduler = read("server/scheduler.ts");
    const autoRefresh = read("server/auto-refresh-scheduler.ts");

    expect(scheduler).toContain('storage.getSpendTotalForRange(campaignId, financialSourceStartDate, financialSourceEndDate, "ga4")');
    expect(scheduler).not.toContain("storage.getSpendTotalForRange(campaignId, startDate, endDate)");
    expect(autoRefresh).toContain("storage.getSpendSources(campaignId)");
    expect(autoRefresh).toContain('storage.getSpendTotalForRange(campaignId, "1900-01-01", endDate)');
  });
});
