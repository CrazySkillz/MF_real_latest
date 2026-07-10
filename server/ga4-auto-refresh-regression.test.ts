import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { getAutoRefreshSchedulerConfig, getNextAutoRefreshRunAt } from "./auto-refresh-scheduler";

const schedulerFile = () =>
  readFileSync(join(process.cwd(), "server", "auto-refresh-scheduler.ts"), "utf-8");

const routesFile = () =>
  readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");

describe("GA4 external value auto-refresh regression guard", () => {
  it("schedules external refresh by configured reporting timezone instead of server local time", () => {
    const content = schedulerFile();
    const config = getAutoRefreshSchedulerConfig({
      AUTO_REFRESH_TIME_ZONE: "Europe/Amsterdam",
      AUTO_REFRESH_DAILY_HOUR: "3",
      AUTO_REFRESH_DAILY_MINUTE: "0",
      AUTO_REFRESH_RUN_ON_STARTUP: "true",
    } as any);

    expect(config).toEqual({
      enabled: true,
      reportingTimeZone: "Europe/Amsterdam",
      hour: 3,
      minute: 0,
      runOnStartup: true,
    });
    expect(getNextAutoRefreshRunAt(new Date("2026-06-20T22:30:00.000Z"), config).toISOString()).toBe("2026-06-21T01:00:00.000Z");
    expect(content).toContain("AUTO_REFRESH_TIME_ZONE || env.GA4_DAILY_REFRESH_TIME_ZONE || \"UTC\"");
    expect(content).toContain("Next scheduled run at");
    expect(content).toContain("expectedCompleteDay=${getLatestCompleteReportingDate(config.reportingTimeZone, nextRun)}");
    expect(content).toContain("__autoRefreshSchedulerTimer");
    expect(content).not.toContain("server local time");
    expect(content).not.toContain("setHours(hour, minute, 0, 0)");
    expect(content).not.toContain("setInterval(() =>");
  });

  it("uses saved CRM and Shopify revenue source mappings with stable source IDs", () => {
    const content = schedulerFile();

    expect(content).toContain("function isStaleRevenueSourceReprocess");
    expect(content).toContain("async function reprocessHubSpot(campaignId: string, mappingConfig: AnyRecord, sourceId?: string): Promise<boolean>");
    expect(content).toContain("async function reprocessSalesforce(campaignId: string, mappingConfig: AnyRecord, sourceId?: string): Promise<boolean>");
    expect(content).toContain("async function reprocessShopify(campaignId: string, mappingConfig: AnyRecord, sourceId?: string): Promise<boolean>");
    expect(content).toContain("...(sourceId ? { sourceId } : {}),");
    expect(content).toContain('String(s.sourceType || "").toLowerCase() === "hubspot"');
    expect(content).toContain('String(s.sourceType || "").toLowerCase() === "salesforce"');
    expect(content).toContain('String(s.sourceType || "").toLowerCase() === "shopify"');
    expect(content).toContain("reprocessHubSpot(campaignId, hubCfg, String(hubspotSource.id))");
    expect(content).toContain("reprocessSalesforce(campaignId, sfCfg, String(salesforceSource.id))");
    expect(content).toContain("reprocessShopify(campaignId, shopCfg, String(shopifySource.id))");
    expect(content).toContain("Skipping stale Salesforce revenue source");
  });

  it("refreshes Google Sheets revenue and spend sources, but does not auto-refresh CSV snapshots", () => {
    const content = schedulerFile();

    expect(content).toContain("async function reprocessGoogleSheetsSpendWithDetails(campaignId: string, source: any, mappingConfig: AnyRecord): Promise<ReprocessResult>");
    expect(content).toContain("async function reprocessGoogleSheetsSpend(campaignId: string, source: any, mappingConfig: AnyRecord): Promise<boolean>");
    expect(content).toContain("async function reprocessGoogleSheetsRevenue(campaignId: string, source: any, mappingConfig: AnyRecord): Promise<boolean>");
    expect(content).toContain('String((s as any).sourceType || "") === "google_sheets"');
    expect(content).toContain("reprocessGoogleSheetsSpend(campaignId, sheetSpend, spendCfg)");
    expect(content).toContain('mapping: { ...(mappingConfig || {}), sourceId: String(source?.id || "") },');
    expect(content).toContain("reprocessGoogleSheetsRevenue(campaignId, sheetRevenue, revCfg)");
    expect(content).toContain("await storage.deleteRevenueRecordsBySource(sourceId);");
    expect(content).toContain("await storage.deleteSpendRecordsBySource(String((src as any).id));");
    expect(content).not.toContain('String((s as any).sourceType || "") === "csv"');
    expect(content).not.toContain("reprocessCsv");
  });
  it("persists fresh Google Sheets spend preview metadata after reprocess", () => {
    const routes = routesFile();
    const processStart = routes.indexOf('app.post("/api/campaigns/:id/spend/sheets/process"');
    const processEnd = routes.indexOf('  // ---------------------------------------------------------------------------', processStart);
    const processRoute = routes.slice(processStart, processEnd);

    expect(processStart).toBeGreaterThan(-1);
    expect(processEnd).toBeGreaterThan(processStart);
    expect(processRoute).toContain("sheetHeaders: headers,");
    expect(processRoute).toContain("sheetSampleRows: rows.slice(0, 25),");
    expect(processRoute).toContain("sheetRowCount: rows.length,");
    expect(processRoute.indexOf("sheetSampleRows: rows.slice(0, 25),")).toBeGreaterThan(processRoute.indexOf("for (let i = 1; i < values.length; i++)"));
    expect(processRoute.indexOf("sheetSampleRows: rows.slice(0, 25),")).toBeLessThan(processRoute.indexOf("const nextSpendMappingConfig = JSON.stringify(mappingForStorage);"));
  });
  it("refreshes fallback Google Sheets spend tokens before self-healing stale spend connections", () => {
    const routes = routesFile();
    const previewStart = routes.indexOf('app.post("/api/campaigns/:id/spend/sheets/preview"');
    const previewEnd = routes.indexOf('app.post("/api/campaigns/:id/spend/sheets/process"', previewStart);
    const processStart = previewEnd;
    const processEnd = routes.indexOf("  // ---------------------------------------------------------------------------", processStart);
    const previewRoute = routes.slice(previewStart, previewEnd);
    const processRoute = routes.slice(processStart, processEnd);

    expect(previewStart).toBeGreaterThan(-1);
    expect(previewEnd).toBeGreaterThan(previewStart);
    expect(processStart).toBeGreaterThan(-1);
    expect(processEnd).toBeGreaterThan(processStart);
    for (const route of [previewRoute, processRoute]) {
      expect(route).toContain('let connections = await storage.getGoogleSheetsConnections(campaignId, "spend");');
      expect(route).toContain("connections = await storage.getGoogleSheetsConnections(campaignId);");
      expect(route.indexOf("connections = await storage.getGoogleSheetsConnections(campaignId);")).toBeLessThan(route.indexOf('if (!conn) return res.status(404).json({ success: false, error: "Google Sheets connection not found" });'));
      expect(route).toContain("const fallback = (await storage.getGoogleSheetsConnections(campaignId))");
      expect(route).toContain("let fallbackAccessToken = fallback.accessToken;");
      expect(route).toContain("if (!fallbackResp.ok && fallbackResp.status === 401 && fallback.refreshToken)");
      expect(route).toContain("fallbackAccessToken = await refreshGoogleSheetsToken(fallback);");
      expect(route).toContain('{ headers: { "Authorization": `Bearer ${fallbackAccessToken}` } }');
      expect(route).toContain("accessToken: fallbackAccessToken,");
      expect(route).not.toContain('const fallback = (await storage.getGoogleSheetsConnections(campaignId, "spend"))');
    }
  });
  it("exposes campaign/source-scoped Google Sheets revenue and spend scheduler validation triggers", () => {
    const scheduler = schedulerFile();
    const routes = routesFile();

    expect(scheduler).toContain("export async function runGoogleSheetsRevenueSourceRefreshForValidation");
    expect(scheduler).toContain("export async function runGoogleSheetsSpendSourceRefreshForValidation");
    expect(scheduler).toContain("return String((s as any).id || \"\") === normalizedSourceId;");
    expect(scheduler).toContain("const sources = await storage.getSpendSources(normalizedCampaignId).catch(() => [] as any[]);");
    expect(scheduler).toContain("reason: \"source_not_found\"");
    expect(scheduler).toContain("reason: \"missing_google_sheets_spend_mapping\"");
    expect(scheduler).toContain("reprocessGoogleSheetsRevenue(normalizedCampaignId, source, mappingConfig)");
    expect(scheduler).toContain("const result = await reprocessGoogleSheetsSpendWithDetails(normalizedCampaignId, source, mappingConfig);");
    expect(scheduler).toContain("processStatus: result.status");
    expect(scheduler).toContain("processError: result.error");
    expect(routes).toContain('app.post("/api/campaigns/:id/revenue-sources/:sourceId/google-sheets-refresh/run-now"');
    expect(routes).toContain('app.post("/api/campaigns/:id/spend-sources/:sourceId/google-sheets-refresh/run-now"');
    expect(routes).toContain("googleSheetsRateLimiter, requireCampaignAccessParamId");
    expect(routes).toContain("runGoogleSheetsRevenueSourceRefreshForValidation(campaignId, sourceId)");
    expect(routes).toContain("runGoogleSheetsSpendSourceRefreshForValidation(campaignId, sourceId)");
    expect(routes).toContain("Requires campaign access and an active google_sheets spend source matching the requested source ID.");
    expect(routes).toContain("Does not run the full daily auto-refresh cycle, other providers, alerts, emails, reports, or unrelated campaigns.");
    expect(routes).not.toContain('app.post("/api/campaigns/:id/auto-refresh/run-now"');
  });

  it("keeps ad-platform spend scoped to saved campaign IDs and logs provider-specific failures", () => {
    const content = schedulerFile();

    expect(content).toContain("selectedCampaignIds");
    expect(content).toContain("if (!selectedIds || selectedIds.size === 0)");
    expect(content).toContain("Refusing Google Ads spend reprocess for campaign ${campaignId}: missing selected campaign IDs");
    expect(content).toContain("selectedIds.has(String(r?.googleCampaignId || \"\").trim())");
    expect(content).toContain("selectedIds.has(String(r?.metaCampaignId || \"\").trim())");
    expect(content).toContain('displayName.includes("Google Ads") ? "Google Ads" : displayName.includes("Meta") ? "Meta" : "Ad platform"');
    expect(content).toContain("${provider} spend reprocess failed");
    expect(content).toContain("LinkedIn spend reprocess failed");
    expect(content).toContain("Google Sheets spend reprocess failed");
  });

  it("recomputes GA4 KPI/Benchmark state after upstream source changes and checks alerts once per cycle", () => {
    const content = schedulerFile();

    expect(content).toContain("if (anyUpdated) {");
    expect(content).toContain("anyCampaignUpdated = true;");
    expect(content).toContain("await runGA4DailyKPIAndBenchmarkJobs({ campaignId }).catch");
    expect(content).toContain("if (anyCampaignUpdated) {");
    expect(content).toContain("await checkPerformanceAlerts().catch");
    expect(content).toContain("await checkBenchmarkPerformanceAlerts().catch");
  });

  it("uses bounded internal timeouts and prevents overlapping runs", () => {
    const content = schedulerFile();

    expect(content).toContain("AUTO_REFRESH_INTERNAL_TIMEOUT_MS");
    expect(content).toContain("signal: AbortSignal.timeout(timeoutMs)");
    expect(content).toContain("AUTO_REFRESH_LINKEDIN_TIMEOUT_MS");
    expect(content).toContain('await withTimeout("LinkedIn auto-refresh", refreshAllLinkedInData(), linkedInTimeoutMs);');
    expect(content).toContain("__autoRefreshInProgress");
    expect(content).toContain('console.log("[Auto Refresh] Skipping run (already in progress)")');
    expect(content).toContain("=== AUTO-REFRESH COMPLETE");
  });
});
