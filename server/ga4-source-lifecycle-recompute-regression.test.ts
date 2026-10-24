import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it, vi } from "vitest";
import ts from "typescript";

const routes = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf8");
const storage = readFileSync(join(process.cwd(), "server", "storage.ts"), "utf8");
const scheduler = readFileSync(join(process.cwd(), "server", "auto-refresh-scheduler.ts"), "utf8");
const jobs = readFileSync(join(process.cwd(), "server", "ga4-kpi-benchmark-jobs.ts"), "utf8");
const ga4Page = readFileSync(join(process.cwd(), "client", "src", "pages", "ga4-metrics.tsx"), "utf8");

const sliceBetween = (source: string, start: string, end: string) => {
  const startIndex = source.indexOf(start);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  const endIndex = source.indexOf(end, startIndex);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
};

describe("GA4 source lifecycle recompute route guards", () => {
  it("does not misreport a saved source as a failed import when background publication fails", async () => {
    const body = sliceBetween(routes, "const recomputeCampaignDerivedValues =", "// When \"revenue to date\"");
    const recovery = vi.fn().mockRejectedValue(new Error("fixture processing failure"));
    const warning = vi.fn(), otherKPIs = vi.fn();
    const fn = new Function("isGA4RevenuePlatformContext", "recoverInterruptedGA4Refreshes", "refreshKPIsForCampaign", "checkPerformanceAlerts", "console",
      ts.transpileModule(body + "return recomputeCampaignDerivedValues;", { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText)(
      (value: string) => value === "ga4", recovery, otherKPIs, vi.fn(), { warn: warning });
    await expect(fn("campaign-a", { platformContext: "ga4" })).resolves.toBeUndefined();
    expect(recovery).toHaveBeenCalledExactlyOnceWith("campaign-a");
    expect(warning).toHaveBeenCalled(); expect(otherKPIs).not.toHaveBeenCalled();
  });
  it.each(["success", "kpiIdsFailed", "benchmarkIdsFailed", "benchmarkIdsSkipped"])("checks the actual source recompute result: %s", async condition => {
    const body = sliceBetween(routes, "const recomputeGA4KPIAndBenchmarkValues =", "const recomputeGA4SpendBeforeResponse =");
    const storage = { getGA4PublicationVersion: vi.fn().mockResolvedValue("completed-version"), getCampaign: vi.fn().mockResolvedValue({ reportingTimeZone: "Europe/Amsterdam" }), invalidateExecutiveSummaryDailySnapshotAlignment: vi.fn().mockResolvedValue(undefined) };
    const result: any = { campaignsProcessed: 1, campaignIdsFailed: [], campaignIdsSkipped: [], kpiIdsFailed: [], kpiIdsSkipped: [], benchmarkIdsFailed: [], benchmarkIdsSkipped: [], alertReconciliationFailures: [] };
    if (condition !== "success") result[condition] = ["affected-row"];
    const jobs = vi.fn().mockResolvedValue(result);
    const fn = new Function("storage", "getReportingDateWindow", "runGA4DailyKPIAndBenchmarkJobs", "console", ts.transpileModule(body + "return recomputeGA4KPIAndBenchmarkValues;", { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText)(storage, () => ({ endDate: "2026-10-16" }), jobs, { warn: vi.fn() });
    if (condition === "success") await expect(fn("campaign-a", "Test")).resolves.toBe(true);
    else await expect(fn("campaign-a", "Test")).rejects.toThrow("recompute incomplete");
    expect(storage.getGA4PublicationVersion).toHaveBeenCalledExactlyOnceWith("campaign-a");
    expect(storage.invalidateExecutiveSummaryDailySnapshotAlignment).toHaveBeenCalledWith("campaign-a", "2026-10-16", { publicationVersion: { campaignId: "campaign-a", version: "completed-version" } });
    expect(jobs).toHaveBeenCalledWith({ campaignId: "campaign-a", useSavedOverview: true, publicationVersion: { campaignId: "campaign-a", version: "completed-version" } });
  });
  it.each(["busy", "changed", "missing campaign"])("stops source recompute before downstream jobs when %s", async condition => {
    const body = sliceBetween(routes, "const recomputeGA4KPIAndBenchmarkValues =", "const recomputeGA4SpendBeforeResponse =");
    const error = condition === "busy" ? "GA4_REFRESH_PUBLICATION_BUSY" : condition === "changed" ? "GA4_REFRESH_PUBLICATION_CHANGED" : "Campaign no longer exists";
    const storage = { getGA4PublicationVersion: vi.fn().mockResolvedValue("v1"),
      getCampaign: vi.fn().mockResolvedValue(condition === "missing campaign" ? null : { reportingTimeZone: "Europe/Amsterdam" }),
      invalidateExecutiveSummaryDailySnapshotAlignment: vi.fn().mockResolvedValue(undefined) };
    if (condition === "busy") storage.getGA4PublicationVersion.mockRejectedValue(new Error(error));
    if (condition === "changed") storage.invalidateExecutiveSummaryDailySnapshotAlignment.mockRejectedValue(new Error(error));
    const jobs = vi.fn();
    const fn = new Function("storage", "getReportingDateWindow", "runGA4DailyKPIAndBenchmarkJobs", "console", ts.transpileModule(body + "return recomputeGA4KPIAndBenchmarkValues;", { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText)(storage, () => ({ endDate: "2026-10-16" }), jobs, { warn: vi.fn() });
    await expect(fn("campaign-a", "Test")).rejects.toThrow(error);
    expect(jobs).not.toHaveBeenCalled();
    if (condition !== "changed") expect(storage.invalidateExecutiveSummaryDailySnapshotAlignment).not.toHaveBeenCalled();
  });
  it("keeps Spend recompute synchronous and starts durable coordinated revenue publication after saving", () => {
    expect(routes).toContain('import { getCampaignMetricTotals, refreshCampaignCurrentValuesForCampaign } from "./utils/campaign-current-values";');
    expect(routes).toContain('import { resolveAlertCurrentValueForDecision } from "./utils/ga4-alert-current-value";');

    const ga4Helper = sliceBetween(
      routes,
      "const recomputeGA4KPIAndBenchmarkValues",
      "const recomputeGA4SpendBeforeResponse",
    );
    expect(ga4Helper).toContain("await runGA4DailyKPIAndBenchmarkJobs({ campaignId, useSavedOverview: true, publicationVersion });");
    expect(ga4Helper.indexOf("await storage.invalidateExecutiveSummaryDailySnapshotAlignment")).toBeLessThan(ga4Helper.indexOf("await runGA4DailyKPIAndBenchmarkJobs"));

    const spendHelper = sliceBetween(routes, "const recomputeGA4SpendBeforeResponse", "const scheduleGA4KpiCreatePostResponseProcessing");
    expect(spendHelper).toContain('await recomputeGA4KPIAndBenchmarkValues(campaignId, "Spend Update");');
    expect(routes).not.toContain("scheduleGA4SpendPostResponseRecompute");
    expect(routes).toContain("result.kpiIdsSkipped.length > 0");
    expect(jobs).toContain("kpiIdsSkipped.size === 0");

    const revenueHelper = sliceBetween(
      routes,
      "const recomputeCampaignDerivedValues",
      "// When \"revenue to date\"",
    );
    expect(revenueHelper).toContain("if (isGA4RevenuePlatformContext(opts.platformContext))");
    expect(revenueHelper).toContain("void recoverInterruptedGA4Refreshes(campaignId).catch");
    expect(revenueHelper).not.toContain("await refreshCampaignCurrentValuesForCampaign");
    expect(revenueHelper).not.toContain("Promise.race");
    expect(routes).not.toContain("scheduleGA4RevenuePostResponseRecompute");
  });

  it("passes platform context through GA4 revenue source add, edit, and delete recompute paths", () => {
    const platformContextCalls = routes.match(/await recomputeCampaignDerivedValues\(campaignId, \{ platformContext \}\);/g) || [];
    expect(platformContextCalls.length).toBe(8);

    const platformCtxCalls = routes.match(/await recomputeCampaignDerivedValues\(campaignId, \{ platformContext: platformCtx \}\);/g) || [];
    expect(platformCtxCalls.length).toBe(5);
    expect(routes).toContain("await recomputeCampaignDerivedValues(campaignId, { platformContext: sourcePlatformContext });");

    const csvRevenueRoute = sliceBetween(
      routes,
      '"/api/campaigns/:id/revenue/csv/process"',
      'app.post("/api/campaigns/:id/revenue/sheets/preview"',
    );
    expect(csvRevenueRoute.indexOf("await storage.replaceGa4CsvRevenueSourceWithRecords")).toBeLessThan(
      csvRevenueRoute.indexOf("await recomputeCampaignDerivedValues(campaignId, { platformContext });"),
    );

    const bulkDeleteRoute = sliceBetween(
      routes,
      'app.delete("/api/campaigns/:id/revenue-sources", async',
      '// Individual revenue source delete',
    );
    expect(bulkDeleteRoute.indexOf("await storage.deleteRevenueRecordsBySource(sid);")).toBeLessThan(
      bulkDeleteRoute.indexOf("await recomputeCampaignDerivedValues(campaignId, { platformContext });"),
    );

    const singleDeleteRoute = sliceBetween(
      routes,
      'app.delete("/api/campaigns/:id/revenue-sources/:sourceId", async',
      '// Individual spend source delete',
    );
    expect(singleDeleteRoute.indexOf("await storage.deleteRevenueSourceWithRecords(campaignId, sourceId, sourcePlatformContext")).toBeLessThan(
      singleDeleteRoute.indexOf("await recomputeCampaignDerivedValues(campaignId, { platformContext: sourcePlatformContext });"),
    );
  });

  it("keeps spend source process recomputes after durable source totals and before responses", () => {
    const processRoutes = [
      sliceBetween(routes, 'app.post("/api/campaigns/:id/spend/process/manual"', "const processConnectorDerivedSpend"),
      sliceBetween(routes, "const processConnectorDerivedSpend", 'app.post("/api/campaigns/:id/spend/process/connectors"'),
      sliceBetween(routes, 'app.post("/api/campaigns/:id/spend/csv/process"', 'app.post("/api/campaigns/:id/spend/sheets/preview"'),
      sliceBetween(routes, 'app.post("/api/campaigns/:id/spend/sheets/process"', "  // Salesforce PKCE support"),
    ];

    for (const route of processRoutes) {
      expect(route.indexOf("await recalcCampaignSpend(campaignId")).toBeGreaterThanOrEqual(0);
      expect(route.indexOf("await recalcCampaignSpend(campaignId")).toBeLessThan(
        route.indexOf("await recomputeGA4SpendBeforeResponse(campaignId);"),
      );
      expect(route).toContain("await recomputeGA4SpendBeforeResponse(campaignId);");
    }
    const linkedinRoute = sliceBetween(routes, 'app.post("/api/campaigns/:id/spend/linkedin/process"', 'app.post("/api/campaigns/:id/spend/csv/preview"');
    expect(linkedinRoute).toContain("LinkedIn spend is not enabled for this GA4 Insights release");
    expect(linkedinRoute).not.toContain("replaceSpendSourceWithRecords");
  });

  it("keeps spend cleanup and delete recomputes after durable spend total changes", () => {
    const duplicateCleanupRoute = sliceBetween(
      routes,
      'app.post("/api/campaigns/:id/spend-sources/google-sheets-duplicates/cleanup"',
      'app.post("/api/campaigns/:id/spend-sources/google-sheets-duplicates/purge-inactive"',
    );
    expect(duplicateCleanupRoute.indexOf("await recalcCampaignSpend(campaignId);")).toBeLessThan(
      duplicateCleanupRoute.indexOf('await recomputeGA4KPIAndBenchmarkValues(campaignId, "Spend Update");'),
    );

    const singleDeleteRoute = sliceBetween(
      routes,
      'app.delete("/api/campaigns/:id/spend-sources/:sourceId"',
      'app.get("/api/campaigns/:id/revenue-totals"',
    );
    expect(singleDeleteRoute.indexOf("await recalcCampaignSpend(campaignId);")).toBeLessThan(
      singleDeleteRoute.indexOf('await recomputeGA4KPIAndBenchmarkValues(campaignId, "Spend Update");'),
    );

    const bulkSpendDeleteRoute = sliceBetween(
      routes,
      'app.delete("/api/campaigns/:id/spend-sources", requireCampaignAccessParamId',
      'app.get("/api/campaigns/:id/spend-totals"',
    );
    expect(bulkSpendDeleteRoute.indexOf('await storage.updateCampaign(campaignId, { spend: "0" as any } as any);')).toBeLessThan(
      bulkSpendDeleteRoute.indexOf('await recomputeGA4KPIAndBenchmarkValues(campaignId, "Spend Update");'),
    );
  });

  it("refreshes every GA4 downstream cache after spend add, edit, or delete", () => {
    const spendProcessed = sliceBetween(ga4Page, "<AddSpendWizardModal", "<AddRevenueWizardModal");
    const spendDelete = sliceBetween(
      ga4Page,
      'fetch(`/api/campaigns/${campaignId}/spend-sources/${deletingSpendSourceId}?platformContext=ga4`',
      '<AlertDialog open={!!deletingRevenueSourceId}',
    );

    for (const successPath of [spendProcessed, spendDelete]) {
      expect(successPath).toContain('queryKey: [`/api/platforms/google_analytics/kpis`, campaignId]');
      expect(successPath).toContain('queryKey: [`/api/platforms/google_analytics/benchmarks`, String(campaignId || "")]');
      expect(successPath).toContain('queryKey: ["/api/platforms/google_analytics/reports", campaignId]');
      expect(successPath).toContain("void refreshNotificationQueries();");
    }
  });

  it('atomically replaces every retained GA4 source family without deleting last-good records first', () => {
    expect(storage).toContain('async replaceSpendSourceWithRecords(');
    expect(storage).toContain('async replaceRevenueSourceWithRecords(');
    expect(storage).toContain('async replaceGa4SalesforceRevenueSourceWithRecords(');
    for (const routeCall of [
      "replaceSpendSourceWithRecords(campaignId, existingSourceId, effectiveSourceType, 'ga4'",
      "replaceRevenueSourceWithRecords(campaignId, existingSourceId, 'google_sheets', 'ga4'",
      "replaceSpendSourceWithRecords(campaignId, existingSourceId, 'google_sheets', 'ga4'",
      'replaceGa4SalesforceRevenueSourceWithRecords(campaignId, existingSourceIdOrNull',
    ]) expect(routes).toContain(routeCall);
    expect(routes).toContain("LinkedIn spend is not enabled for this GA4 Insights release");
    expect(storage).toContain("if (!savedConnection) throw new Error('Salesforce connection not found')");
    const sheetsRevenueRefresh = sliceBetween(scheduler, 'async function reprocessGoogleSheetsRevenue(', 'export async function runGoogleSheetsSpendSourceRefreshForValidation');
    expect(sheetsRevenueRefresh).toContain('storage.replaceRevenueSourceWithRecords(');
    expect(sheetsRevenueRefresh).not.toContain('storage.deleteRevenueRecordsBySource(');
    const adPlatformRefresh = sliceBetween(scheduler, '// Ad Platform Spend (Google Ads / Meta)', '// Google Sheets (Revenue)');
    expect(adPlatformRefresh).toContain('storage.replaceSpendRecordsForSource(');
    expect(adPlatformRefresh).not.toContain('storage.deleteSpendRecordsBySource(');
  });

  it('atomically deletes the exact retained spend source and its campaign records', () => {
    const singleSpendDelete = sliceBetween(
      routes,
      '// Individual spend source delete',
      'app.get("/api/campaigns/:id/revenue-totals"',
    );
    expect(storage).toContain('async deleteSpendSourceWithRecords(');
    expect(singleSpendDelete).toContain('storage.deleteSpendSourceWithRecords(campaignId, sourceId, deletingSourcePlatformContext)');
    expect(singleSpendDelete).not.toContain('storage.deleteSpendSource(sourceId)');
    expect(singleSpendDelete).not.toContain('storage.deleteSpendRecordsBySource(sourceId)');
  });

  it('blocks GA4 Manual Revenue and Spend create/edit while preserving exact deletion', () => {
    const manualRevenueRoute = sliceBetween(
      routes,
      'app.post("/api/campaigns/:id/revenue/process/manual"',
      '"/api/campaigns/:id/revenue/csv/preview"',
    );
    const revenueRejection = manualRevenueRoute.indexOf('Manual Revenue is not supported for GA4.');
    expect(revenueRejection).toBeGreaterThan(-1);
    expect(manualRevenueRoute).not.toContain('replaceRevenueSourceWithRecords(');
    expect(revenueRejection).toBeLessThan(manualRevenueRoute.indexOf('storage.updateRevenueSource('));
    expect(revenueRejection).toBeLessThan(manualRevenueRoute.indexOf('storage.createRevenueSource('));

    const manualSpendRoute = sliceBetween(
      routes,
      'app.post("/api/campaigns/:id/spend/process/manual"',
      'const processConnectorDerivedSpend',
    );
    const rejection = manualSpendRoute.indexOf("Manual Spend is not supported for GA4.");
    expect(rejection).toBeGreaterThan(-1);
    expect(manualSpendRoute).toContain("platformContext === 'ga4' && effectiveSourceType !== 'ad_platforms'");
    expect(rejection).toBeLessThan(manualSpendRoute.indexOf('replaceSpendSourceWithRecords('));
    expect(manualSpendRoute).not.toContain('storage.updateSpendSource(');
    expect(manualSpendRoute).not.toContain('storage.createSpendSource(');

    const revenueSourcesModal = sliceBetween(ga4Page, '>Revenue Sources</DialogTitle>', '>Spend Sources</DialogTitle>');
    expect(revenueSourcesModal).toContain('{ga4ConnectionUsable && s.sourceType !== "manual" && (');
    expect(revenueSourcesModal).toContain('setDeletingRevenueSourceId(s.sourceId);');
    expect(revenueSourcesModal).toContain('title="Remove revenue source"');

    const spendSourcesModal = sliceBetween(ga4Page, '>Spend Sources</DialogTitle>', '>Pipeline Proxy Sources</DialogTitle>');
    expect(spendSourcesModal).toContain('{ga4ConnectionUsable && s.sourceType !== "manual" && (');
    expect(spendSourcesModal).toContain('setDeletingSpendSourceId(s.sourceId);');
    expect(spendSourcesModal).toContain('title="Remove spend source"');
  });

  it('does not report an empty-property GA4 placeholder as a usable connection', () => {
    const connectionRoute = sliceBetween(
      routes,
      'app.get("/api/ga4/check-connection/:campaignId"',
      '// Connected platforms summary for campaign detail page',
    );
    const accessGuard = connectionRoute.indexOf('await ensureCampaignAccess(req as any, res as any, campaignId)');
    const sourceRead = connectionRoute.indexOf('await storage.getGA4Connections(campaignId, { migrateLegacyTokens: !validationReadOnly })');
    const configuredFilter = connectionRoute.indexOf('const configuredGA4Connections = ga4Connections.filter');
    const usableFilter = connectionRoute.indexOf('const usableGA4Connections = configuredGA4Connections.filter');
    expect(accessGuard).toBeGreaterThan(-1);
    expect(accessGuard).toBeLessThan(sourceRead);
    expect(configuredFilter).toBeGreaterThan(sourceRead);
    expect(usableFilter).toBeGreaterThan(configuredFilter);
    expect(connectionRoute).toContain('String(connection?.propertyId || "").trim().length > 0');
    expect(connectionRoute).toContain('if (usableGA4Connections.length > 0)');
    expect(connectionRoute).toContain('totalConnections: usableGA4Connections.length');
    expect(connectionRoute).toContain('connections: usableGA4Connections.map');
  });

  it('fails closed without skeletons while retaining exact financial-source cleanup', () => {
    expect(ga4Page).toContain('.filter((property) => String(property?.propertyId || "").trim().length > 0)');
    expect(ga4Page).toContain('const ga4ConnectionUsable = !!ga4Connection?.connected && availableGA4Properties.length > 0;');
    expect(ga4Page).toContain('ga4ConnLoading || (!ga4ConnectionUsable && (revenueSourcesLoading || spendSourcesLoading))');
    expect(ga4Page).toContain('if (!ga4ConnectionUsable && !persistedFinancialSourceCleanupAvailable)');
    expect(ga4Page).toContain('data-testid="ga4-financial-cleanup-state"');
    expect(ga4Page).toContain('GA4 metrics are unavailable. Saved financial sources remain available below for review or removal.');
    expect(ga4Page).toContain('const campaignBreakdownUnavailable =');
    expect(ga4Page).toContain('breakdownPlaceholder ||');
    expect(ga4Page).toContain('const landingPagesUnavailable = !ga4ConnectionUsable');
    expect(ga4Page).toContain('const conversionEventsUnavailable = !ga4ConnectionUsable');
    expect(ga4Page).toContain('{ga4ConnectionUsable && <button');
    expect(ga4Page).toContain('{ga4ConnectionUsable && s.sourceType !== "manual" && (');
    expect(ga4Page).toContain('setDeletingRevenueSourceId(s.sourceId);');
    expect(ga4Page).toContain('setDeletingSpendSourceId(s.sourceId);');
  });
});
