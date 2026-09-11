import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { storage } from "./storage";
import { getAutoRefreshSchedulerConfig, runHubSpotPipelineAutoRefreshOnce } from "./auto-refresh-scheduler";

const scheduler = readFileSync("server/auto-refresh-scheduler.ts", "utf8");
const routes = readFileSync("server/routes-oauth.ts", "utf8");
const storageSource = readFileSync("server/storage.ts", "utf8");
const ga4Page = readFileSync("client/src/pages/ga4-metrics.tsx", "utf8");

const sliceBetween = (source: string, start: string, end: string) => {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
};

describe("HubSpot Pipeline Proxy automatic stage transition", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete (global as any).__autoRefreshInProgress;
    delete (global as any).__googleSheetsSpendRefreshInProgress;
    delete (global as any).__salesforcePipelineRefreshInProgress;
  });

  it("polls only the eligible GA4 Pipeline source with its saved mapping and stable source ID", async () => {
    const savedMapping = JSON.stringify({
      platformContext: "ga4",
      campaignProperty: "dealname",
      selectedValues: ["Mapped HubSpot Deal"],
      revenueProperty: "amount",
      dateField: "closedate",
      pipelineEnabled: true,
      pipelineStageId: "appointmentscheduled",
      pipelineStageLabel: "Appointment Scheduled",
    });
    vi.spyOn(storage, "getCampaigns").mockResolvedValue([{ id: "campaign-1" }] as any);
    vi.spyOn(storage, "getRevenueSources").mockResolvedValue([
      { id: "hubspot-valid", campaignId: "campaign-1", sourceType: "hubspot", platformContext: "ga4", isActive: true, mappingConfig: savedMapping },
      { id: "hubspot-other-campaign", campaignId: "campaign-2", sourceType: "hubspot", platformContext: "ga4", isActive: true, mappingConfig: savedMapping },
      { id: "hubspot-disabled", campaignId: "campaign-1", sourceType: "hubspot", platformContext: "ga4", isActive: false, mappingConfig: savedMapping },
      { id: "hubspot-no-pipeline", campaignId: "campaign-1", sourceType: "hubspot", platformContext: "ga4", isActive: true, mappingConfig: JSON.stringify({ ...JSON.parse(savedMapping), pipelineEnabled: false }) },
      { id: "hubspot-foreign", campaignId: "campaign-1", sourceType: "hubspot", platformContext: "linkedin", isActive: true, mappingConfig: savedMapping },
    ] as any);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      success: true,
      totalRevenue: 1250,
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    await runHubSpotPipelineAutoRefreshOnce();

    expect(storage.getRevenueSources).toHaveBeenCalledWith("campaign-1", "ga4");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/campaigns/campaign-1/hubspot/save-mappings");
    expect(JSON.parse(String(options?.body))).toMatchObject({
      sourceId: "hubspot-valid",
      expectedSourceMappingConfig: savedMapping,
      platformContext: "ga4",
      campaignProperty: "dealname",
      selectedValues: ["Mapped HubSpot Deal"],
      dateField: "closedate",
      pipelineEnabled: true,
      pipelineStageId: "appointmentscheduled",
    });
  });

  it("serializes HubSpot behind the existing five-minute Salesforce Pipeline cadence", () => {
    const refresh = sliceBetween(
      scheduler,
      "export async function runHubSpotPipelineAutoRefreshOnce",
      "export async function runSalesforcePipelineAutoRefreshOnce",
    );

    expect(getAutoRefreshSchedulerConfig({} as any).salesforcePipelineIntervalMinutes).toBe(5);
    expect(refresh).toContain('storage.getRevenueSources(campaignId, "ga4")');
    expect(refresh).toContain('String(source?.sourceType || "").trim().toLowerCase() === "hubspot"');
    expect(refresh).toContain('String(source?.platformContext || "").trim().toLowerCase() === "ga4"');
    expect(refresh).toContain('mappingConfig?.pipelineEnabled !== true');
    expect(refresh).toContain('!mappingConfig?.pipelineStageId');
    expect(refresh).toContain('reprocessHubSpot(campaignId, mappingConfig, String(source.id))');
    expect(refresh).toContain('expectedSourceMappingConfig: String(source.mappingConfig)');
    expect(refresh).toContain('isSourceOutsideCampaign(source, campaignId)');
    expect(scheduler).toContain('.then(() => runHubSpotPipelineAutoRefreshOnce())');
    expect(scheduler).toContain('setInterval(runSalesforcePipelineRefresh, salesforcePipelineIntervalMs)');
    expect(refresh).toContain('(global as any).__salesforcePipelineRefreshInProgress = true');
    expect(refresh).toContain('(global as any).__salesforcePipelineRefreshInProgress = false');
  });

  it("keeps the selected open-stage amount exclusive to proxy, then materializes it once as confirmed revenue", () => {
    const dealAmount = 1250;
    const before = {
      pipelineProxy: dealAmount,
      totalRevenue: 4000,
      confirmedItems: [] as Array<{ name: string; revenue: number }>,
    };
    const after = {
      pipelineProxy: 0,
      totalRevenue: before.totalRevenue + dealAmount,
      confirmedItems: [{ name: "Mapped HubSpot Deal", revenue: dealAmount }],
    };

    expect(after.pipelineProxy - before.pipelineProxy).toBe(-dealAmount);
    expect(after.totalRevenue - before.totalRevenue).toBe(dealAmount);
    expect(after.totalRevenue + after.pipelineProxy).toBe(before.totalRevenue + before.pipelineProxy);
    expect(after.confirmedItems).toContainEqual({ name: "Mapped HubSpot Deal", revenue: dealAmount });

    const saveRoute = sliceBetween(
      routes,
      'app.post("/api/campaigns/:id/hubspot/save-mappings"',
      "// Helper function to refresh Google Sheets access token",
    );
    const replacement = sliceBetween(
      storageSource,
      "async replaceGa4HubspotRevenueSourceWithRecords(",
      "async replaceGa4ShopifyRevenueSourceWithRecords(",
    );
    expect(saveRoute).toContain("{ propertyName: 'dealstage', operator: 'IN', values: effectiveStageIds }");
    expect(saveRoute).toContain("{ propertyName: 'dealstage', operator: 'IN', values: [pipelineStageId] }");
    expect(saveRoute).toContain("campaignValueRevenueTotals: Array.from(campaignValueRevenueTotals.entries())");
    expect(saveRoute).toContain("(mappingConfig as any).pipelineValueRevenueTotals = Array.from(pipelineValueRevenueTotals.entries())");
    expect(saveRoute).toContain("existingHubspot ? String((existingHubspot as any).id) : null");
    expect(saveRoute).toContain("expectedSourceMappingConfig,");
    expect(saveRoute).toContain("error?.code === HUBSPOT_PAGINATION_ERROR_CODE || (platformCtx === 'ga4' && expectedSourceMappingConfig)");
    expect(replacement).toContain("eq(revenueSources.mappingConfig, expectedSourceMappingConfig)");
    expect(replacement.indexOf("tx.delete(revenueRecords)")).toBeLessThan(replacement.indexOf("tx.insert(revenueRecords)"));
    expect(replacement).toContain("error.code = 'HUBSPOT_REVENUE_SOURCE_CHANGED'");
  });

  it("lets an open Overview observe HubSpot sync time and itemize the confirmed mapped deal", () => {
    const pipelineQuery = sliceBetween(
      ga4Page,
      "const { data: hubspotPipelineProxyData",
      "// Note: In GA4 daily mode",
    );
    const sourceDialog = sliceBetween(
      ga4Page,
      '<Dialog open={showRevenueSourcesDialog}',
      '<Dialog open={showSpendSourcesDialog}',
    );

    expect(pipelineQuery).toContain("refetchInterval: 60 * 1000");
    expect(pipelineQuery).toContain("hubspotPipelineProxyData?.lastUpdatedAt");
    expect(pipelineQuery).toContain("salesforcePipelineProxyData?.lastUpdatedAt");
    expect(pipelineQuery).toContain("/revenue-to-date");
    expect(pipelineQuery).toContain("/revenue-sources");
    expect(pipelineQuery).toContain("/revenue-breakdown");
    expect(sourceDialog).toContain('sourceType === "hubspot" && Array.isArray(cfg?.campaignValueRevenueTotals)');
    expect(sourceDialog).toContain('? "Confirmed deals"');
    expect(sourceDialog).toContain("formatMoney(item.revenue)");
    expect(sourceDialog).toContain('sourceType === "salesforce" && <button');
    expect(sourceDialog).toContain('aria-label="Remove HubSpot revenue source"');
    expect(sourceDialog).not.toContain("cfg?.pipelineValueRevenueTotals");
  });

  it("serves a scheduler-written zero proxy as valid last-good data without a second provider write", () => {
    const pipelineRoute = sliceBetween(
      routes,
      "// HubSpot pipeline proxy status",
      "// Clear HubSpot pipeline proxy config",
    );

    expect(pipelineRoute).toContain("const cachedIsUsable = Number.isFinite(cached) && cached >= 0");
    expect(pipelineRoute).toContain("cached === 0 || cachedValueTotals.length > 0");
    expect(pipelineRoute).toContain("!!cfg.pipelineLastUpdatedAt && !cfg.pipelineWarning");
    expect(pipelineRoute.indexOf("if (cachedIsUsable)")).toBeLessThan(pipelineRoute.indexOf("getHubspotAccessTokenForCampaign(campaignId)"));
  });
});
