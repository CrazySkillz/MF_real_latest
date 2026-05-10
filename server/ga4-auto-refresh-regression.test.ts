import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const schedulerFile = () =>
  readFileSync(join(process.cwd(), "server", "auto-refresh-scheduler.ts"), "utf-8");

describe("GA4 external value auto-refresh regression guard", () => {
  it("uses saved CRM and Shopify revenue source mappings with stable source IDs", () => {
    const content = schedulerFile();

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
  });

  it("refreshes Google Sheets revenue and spend sources, but does not auto-refresh CSV snapshots", () => {
    const content = schedulerFile();

    expect(content).toContain("async function reprocessGoogleSheetsSpend(campaignId: string, mappingConfig: AnyRecord): Promise<boolean>");
    expect(content).toContain("async function reprocessGoogleSheetsRevenue(campaignId: string, source: any, mappingConfig: AnyRecord): Promise<boolean>");
    expect(content).toContain('String((s as any).sourceType || "") === "google_sheets"');
    expect(content).toContain("reprocessGoogleSheetsSpend(campaignId, spendCfg)");
    expect(content).toContain("reprocessGoogleSheetsRevenue(campaignId, sheetRevenue, revCfg)");
    expect(content).toContain("await storage.deleteRevenueRecordsBySource(sourceId);");
    expect(content).toContain("await storage.deleteSpendRecordsBySource(String((src as any).id));");
    expect(content).not.toContain('String((s as any).sourceType || "") === "csv"');
    expect(content).not.toContain("reprocessCsv");
  });

  it("keeps ad-platform spend scoped to saved campaign IDs and logs provider-specific failures", () => {
    const content = schedulerFile();

    expect(content).toContain("selectedCampaignIds");
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
