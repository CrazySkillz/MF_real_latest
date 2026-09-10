import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { storage } from "./storage";
import { getAutoRefreshSchedulerConfig, runSalesforcePipelineAutoRefreshOnce } from "./auto-refresh-scheduler";

const scheduler = readFileSync("server/auto-refresh-scheduler.ts", "utf8");
const routes = readFileSync("server/routes-oauth.ts", "utf8");
const ga4Page = readFileSync("client/src/pages/ga4-metrics.tsx", "utf8");

const sliceBetween = (source: string, start: string, end: string) => {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
};

describe("Salesforce Pipeline Proxy automatic refresh and provenance", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete (global as any).__autoRefreshInProgress;
    delete (global as any).__googleSheetsSpendRefreshInProgress;
    delete (global as any).__salesforcePipelineRefreshInProgress;
  });

  it("executes only the eligible source and preserves its stable ID", async () => {
    vi.spyOn(storage, "getCampaigns").mockResolvedValue([{ id: "campaign-1" }] as any);
    vi.spyOn(storage, "getRevenueSources").mockResolvedValue([
      { id: "sf-valid", campaignId: "campaign-1", sourceType: "salesforce", platformContext: "ga4", isActive: true, mappingConfig: JSON.stringify({ platformContext: "ga4", pipelineEnabled: true, pipelineStageName: "Prospecting", selectedValues: ["Delta"] }) },
      { id: "sf-legacy", campaignId: "campaign-1", sourceType: "salesforce", platformContext: null, isActive: true, mappingConfig: JSON.stringify({ pipelineEnabled: true, pipelineStageName: "Prospecting", selectedValues: ["Legacy"] }) },
      { id: "sf-disabled", campaignId: "campaign-1", sourceType: "salesforce", platformContext: "ga4", isActive: true, mappingConfig: JSON.stringify({ platformContext: "ga4", pipelineEnabled: false, pipelineStageName: "Prospecting", selectedValues: ["Disabled"] }) },
      { id: "sf-malformed", campaignId: "campaign-1", sourceType: "salesforce", platformContext: "ga4", isActive: true, mappingConfig: JSON.stringify({ platformContext: "ga4", pipelineEnabled: true, pipelineStageName: "Prospecting", selectedValues: "Delta" }) },
    ] as any);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      success: true,
      totalRevenue: 350,
      materializedRecordCount: 3,
      materializedDates: ["2026-09-02", "2026-09-05", "2026-09-10"],
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    await runSalesforcePipelineAutoRefreshOnce();

    expect(storage.getRevenueSources).toHaveBeenCalledWith("campaign-1", "ga4");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/campaigns/campaign-1/salesforce/save-mappings");
    expect(JSON.parse(String(options?.body))).toMatchObject({
      sourceId: "sf-valid",
      platformContext: "ga4",
      pipelineEnabled: true,
      pipelineStageName: "Prospecting",
      selectedValues: ["Delta"],
    });
  });

  it("polls only explicit active GA4 Salesforce Pipeline sources through the stable source save path", () => {
    const refresh = sliceBetween(
      scheduler,
      "export async function runSalesforcePipelineAutoRefreshOnce",
      "export async function runDailyAutoRefreshOnce",
    );
    const config = getAutoRefreshSchedulerConfig({} as any);

    expect(config.salesforcePipelineIntervalMinutes).toBe(5);
    expect(getAutoRefreshSchedulerConfig({ SALESFORCE_PIPELINE_REFRESH_INTERVAL_MINUTES: "0" } as any).salesforcePipelineIntervalMinutes).toBe(1);
    expect(getAutoRefreshSchedulerConfig({ SALESFORCE_PIPELINE_REFRESH_INTERVAL_MINUTES: "90" } as any).salesforcePipelineIntervalMinutes).toBe(60);
    expect(refresh).toContain('storage.getRevenueSources(campaignId, "ga4")');
    expect(refresh).toContain('String(source?.sourceType || "").trim().toLowerCase() === "salesforce"');
    expect(refresh).toContain('String(source?.platformContext || "").trim().toLowerCase() === "ga4"');
    expect(refresh).toContain('mappingContext !== "ga4"');
    expect(refresh).toContain("mappingConfig?.pipelineEnabled !== true");
    expect(refresh).toContain("!Array.isArray(mappingConfig?.selectedValues)");
    expect(refresh).toContain("isSourceOutsideCampaign(source, campaignId)");
    expect(refresh).toContain("reprocessSalesforce(campaignId, mappingConfig, String(source.id))");
    expect(refresh).not.toContain("reprocessHubSpot");
    expect(refresh).not.toContain("reprocessShopify");
    expect(scheduler).toContain("setInterval(runSalesforcePipelineRefresh, salesforcePipelineIntervalMs)");
    expect(scheduler).toContain("|| (global as any).__salesforcePipelineRefreshSchedulerInterval");
    expect(scheduler).toContain("__salesforcePipelineRefreshInProgress");
    expect(scheduler).toContain("Waiting for an interval financial refresh to finish");
  });

  it("serves a valid cached zero and refreshes open Overview revenue when Salesforce sync time changes", () => {
    const pipelineRoute = sliceBetween(
      routes,
      '// Salesforce pipeline proxy status',
      '// HubSpot pipeline proxy status',
    );
    const pipelineQuery = sliceBetween(
      ga4Page,
      "const { data: salesforcePipelineProxyData",
      "// Note: In GA4 daily mode",
    );

    expect(pipelineRoute).toContain("cached >= 0");
    expect(pipelineRoute).toContain("cached === 0 || cachedValueTotals.length > 0");
    expect(pipelineRoute).toContain("!!cfg.pipelineLastUpdatedAt && !cfg.pipelineWarning");
    expect(pipelineQuery).toContain("refetchInterval: 60 * 1000");
    expect(pipelineQuery).toContain("salesforcePipelineProxyData?.lastUpdatedAt");
    expect(pipelineQuery).toContain(`/revenue-to-date`);
    expect(pipelineQuery).toContain(`/revenue-sources`);
    expect(pipelineQuery).toContain(`/revenue-breakdown`);
  });

  it("itemizes only confirmed Salesforce Opportunity totals inside the provider source row", () => {
    const sourceDialog = sliceBetween(
      ga4Page,
      '<Dialog open={showRevenueSourcesDialog}',
      '<Dialog open={showSpendSourcesDialog}',
    );

    expect(sourceDialog).toContain('sourceType === "salesforce" && Array.isArray(cfg?.campaignValueRevenueTotals)');
    expect(sourceDialog).toContain('? "Confirmed opportunities"');
    expect(sourceDialog).toContain(': "Confirmed attributed values"');
    expect(sourceDialog).toContain("{confirmedRevenueItemsLabel} ({confirmedRevenueItems.length})");
    expect(sourceDialog).toContain("formatMoney(item.revenue)");
    expect(sourceDialog).not.toContain("cfg?.pipelineValueRevenueTotals");
    expect(sourceDialog).toContain('{materializedRevenueUnavailable ? "Unavailable" : formatMoney(Number(s.revenue || 0))}');
  });
});
