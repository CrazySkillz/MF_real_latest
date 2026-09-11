import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { storage } from "./storage";
import { getAutoRefreshSchedulerConfig, runSalesforcePipelineAutoRefreshOnce } from "./auto-refresh-scheduler";

const scheduler = readFileSync("server/auto-refresh-scheduler.ts", "utf8");
const routes = readFileSync("server/routes-oauth.ts", "utf8");
const storageSource = readFileSync("server/storage.ts", "utf8");
const ga4Page = readFileSync("client/src/pages/ga4-metrics.tsx", "utf8");
const addRevenueWizard = readFileSync("client/src/components/AddRevenueWizardModal.tsx", "utf8");
const salesforceWizard = readFileSync("client/src/components/SalesforceRevenueWizard.tsx", "utf8");

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

  it("refreshes pipeline-enabled and revenue-only sources while preserving stable IDs", async () => {
    vi.spyOn(storage, "getCampaigns").mockResolvedValue([{ id: "campaign-1" }] as any);
    vi.spyOn(storage, "getRevenueSources").mockResolvedValue([
      { id: "sf-valid", campaignId: "campaign-1", sourceType: "salesforce", platformContext: "ga4", isActive: true, mappingConfig: JSON.stringify({ platformContext: "ga4", pipelineEnabled: true, pipelineStageName: "Prospecting", selectedValues: ["Delta"] }) },
      { id: "sf-legacy", campaignId: "campaign-1", sourceType: "salesforce", platformContext: null, isActive: true, mappingConfig: JSON.stringify({ pipelineEnabled: true, pipelineStageName: "Prospecting", selectedValues: ["Legacy"] }) },
      { id: "sf-revenue-only", campaignId: "campaign-1", sourceType: "salesforce", platformContext: "ga4", isActive: true, mappingConfig: JSON.stringify({ platformContext: "ga4", pipelineEnabled: false, pipelineStageName: null, selectedValues: ["Revenue only"] }) },
      { id: "sf-malformed", campaignId: "campaign-1", sourceType: "salesforce", platformContext: "ga4", isActive: true, mappingConfig: JSON.stringify({ platformContext: "ga4", pipelineEnabled: true, pipelineStageName: "Prospecting", selectedValues: "Delta" }) },
    ] as any);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(JSON.stringify({
      success: true,
      totalRevenue: 350,
      materializedRecordCount: 3,
      materializedDates: ["2026-09-02", "2026-09-05", "2026-09-10"],
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    await runSalesforcePipelineAutoRefreshOnce();

    expect(storage.getRevenueSources).toHaveBeenCalledWith("campaign-1", "ga4");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const requests = fetchMock.mock.calls.map(([url, options]) => ({
      url: String(url),
      body: JSON.parse(String(options?.body)),
    }));
    expect(requests[0].url).toContain("/api/campaigns/campaign-1/salesforce/save-mappings");
    expect(requests[0].body).toMatchObject({
      sourceId: "sf-valid",
      platformContext: "ga4",
      pipelineEnabled: true,
      pipelineStageName: "Prospecting",
      selectedValues: ["Delta"],
    });
    expect(requests[1].body).toMatchObject({
      sourceId: "sf-revenue-only",
      platformContext: "ga4",
      pipelineEnabled: false,
      pipelineStageName: null,
      selectedValues: ["Revenue only"],
    });
  });

  it("polls active GA4 Salesforce revenue sources through the stable source save path", () => {
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
    expect(refresh).not.toContain("mappingConfig?.pipelineEnabled !== true");
    expect(refresh).not.toContain("!mappingConfig?.pipelineStageName");
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
    expect(sourceDialog).not.toContain('"Confirmed opportunities"');
    expect(sourceDialog).not.toContain('"Confirmed attributed values"');
    expect(sourceDialog).toContain('sourceType !== "hubspot" && sourceType !== "salesforce"');
    expect(sourceDialog).toContain("formatMoney(item.revenue)");
    expect(sourceDialog).not.toContain("cfg?.pipelineValueRevenueTotals");
    expect(sourceDialog).toContain('{materializedRevenueUnavailable ? "Unavailable" : formatMoney(Number(s.revenue || 0))}');
  });

  it("edits the Salesforce source from its provider heading and removes confirmed values individually", () => {
    const sourceDialog = sliceBetween(
      ga4Page,
      '<Dialog open={showRevenueSourcesDialog}',
      '<Dialog open={showSpendSourcesDialog}',
    );

    expect(sourceDialog).toContain('grid-cols-[minmax(0,1fr)_6rem_3.5rem]');
    expect(sourceDialog).toContain('confirmedRevenueItems.length > 0 || sourceType === "shopify" ? "col-span-2" : ""');
    expect(sourceDialog).toContain('confirmedRevenueItems.length === 0 && sourceType !== "shopify" && (');
    expect(sourceDialog).toContain('ga4ConnectionUsable && s.sourceType !== "manual"');
    expect(sourceDialog).toContain('aria-label={sourceType === "salesforce" ? "Edit Salesforce revenue source" : "Edit revenue source"}');
    expect(sourceDialog).not.toContain('focusedRevenueValue: item.name');
    expect(sourceDialog).toContain('setDeletingSalesforceRevenueItem({');
    expect(sourceDialog).toContain('aria-label={`Remove ${item.name}`}');
    expect(addRevenueWizard).toContain('initialFocusValue={isSalesforceEditing');
    expect(salesforceWizard).toContain('setStep("value-source")');
    expect(salesforceWizard).toContain('Editing selection: <strong>{initialFocusValue}</strong>');
    expect(salesforceWizard).toContain('visibleUniqueValues.map((v) =>');
  });

  it("disables an already-added Salesforce chooser card and preserves exact-source pencil editing", () => {
    const sourceClick = sliceBetween(
      addRevenueWizard,
      'const handleCrmSourceClick = async (platform: "hubspot" | "salesforce" | "shopify") => {',
      '// Shopify handles its own OAuth inside ShopifyRevenueWizard',
    );
    const salesforceEmbed = sliceBetween(
      addRevenueWizard,
      '{step === "salesforce" && (',
      '{step === "shopify" && (',
    );

    expect(addRevenueWizard).toContain('const sourcesResolved = dsResp?.success === true && Array.isArray(dsResp?.revenueSources)');
    expect(sourceClick).toContain('platform === "salesforce" && !salesforceSourcesResolved');
    expect(addRevenueWizard).toContain('setActiveSalesforceSources(revSources.filter((s: any) => matchesRevenuePlatformContext(s, "salesforce")))');
    expect(sourceClick).toContain('platform === "salesforce" && crmHasSource.salesforce');
    expect(sourceClick).toContain('activeSalesforceSources.length !== 1');
    expect(sourceClick).toContain('!String(source?.id || "").trim()');
    expect(sourceClick).toContain('setSalesforcePickerEditSource(source)');
    expect(addRevenueWizard).toContain('if (crmHasSource.salesforce) return;');
    expect(addRevenueWizard).toContain('Already added. Edit opportunities from Revenue Sources.');
    expect(salesforceEmbed).toContain('sourceId={isSalesforceEditing ? String(salesforceEditSource?.id || "") : undefined}');
    expect(salesforceEmbed).toContain('autoStartOAuth={!isSalesforceEditing}');
    expect(salesforceEmbed).toContain('mode={isSalesforceEditing ? "edit" : "connect"}');
  });

  it("aligns Shopify source actions with their provider and mapped campaign rows", () => {
    const sourceDialog = sliceBetween(
      ga4Page,
      '<Dialog open={showRevenueSourcesDialog}',
      '<Dialog open={showSpendSourcesDialog}',
    );
    const shopifyBreakdown = sliceBetween(
      sourceDialog,
      '{sourceType === "shopify" && (',
      '{confirmedRevenueItems.length > 0 && (',
    );

    expect(sourceDialog).toContain('confirmedRevenueItems.length > 0 || sourceType === "shopify" ? "col-span-2" : ""');
    expect(shopifyBreakdown).toContain('className="mt-2 border-t border-border pt-2"');
    expect(shopifyBreakdown).toContain('className="grid grid-cols-[minmax(0,1fr)_6rem_3.5rem] items-center gap-x-2 text-xs"');
    expect(shopifyBreakdown).toContain('className="text-right tabular-nums text-foreground"');
    expect(shopifyBreakdown).not.toContain('font-medium tabular-nums');
    expect(shopifyBreakdown).toContain('aria-label="Remove Shopify revenue source"');
  });

  it("shows selected Salesforce campaign mappings in review before save", () => {
    const reviewBlock = sliceBetween(
      salesforceWizard,
      '{step === "review" && (',
      '{reviewOpportunityBreakdown.length > 0 && (',
    );
    const selectedOpportunitiesIndex = reviewBlock.indexOf("Selected opportunity(ies)");
    const mappingIndex = reviewBlock.indexOf("{reviewPlatformLabel} campaign mapping");

    expect(salesforceWizard).toContain("const reviewShowsCampaignMappings = isGA4 || isGoogleAds || isMeta || isInstagram || isTikTok");
    expect(salesforceWizard).toContain('const reviewPlatformLabel = isGA4 ? "GA4"');
    expect(mappingIndex).toBeGreaterThan(selectedOpportunitiesIndex);
    expect(reviewBlock).toContain('grid-cols-[minmax(0,1fr)_6rem_minmax(0,2fr)]');
    expect(reviewBlock).toContain('aria-hidden="true" className="text-center text-muted-foreground/70">→</span>');
    expect(reviewBlock).toContain("selectedCampaignMappings.find");
    expect(reviewBlock).toContain('mapping?.linkedinCampaignName || mapping?.linkedinCampaignUrn || "Not mapped"');
  });

  it("removes one value through the stable atomic source path and rejects scheduler races", () => {
    const saveRoute = sliceBetween(
      routes,
      'app.post("/api/campaigns/:id/salesforce/save-mappings"',
      '// Salesforce pipeline proxy status',
    );
    const storageReplacement = sliceBetween(
      storageSource,
      'async replaceGa4SalesforceRevenueSourceWithRecords(',
      'async replaceGa4CsvRevenueSourceWithRecords(',
    );

    expect(ga4Page).toContain('selectedValues: remainingSelectedValues');
    expect(ga4Page).toContain('expectedSourceMappingConfig');
    expect(ga4Page).toContain('cfg.campaignMappings.filter');
    expect(ga4Page).toContain('remainingSelectedValues.length === 0');
    expect(ga4Page).toContain('Salesforce opportunity removed');
    expect(saveRoute).toContain('expectedSourceMappingConfig: z.string().min(1).optional()');
    expect(saveRoute).toContain('revenueRecordsToInsert, expectedSourceMappingConfig');
    expect(saveRoute).toContain("error?.code === 'SALESFORCE_REVENUE_SOURCE_CHANGED' ? 409 : 500");
    expect(storageReplacement).toContain('eq(revenueSources.mappingConfig, expectedSourceMappingConfig)');
    expect(storageReplacement).toContain("error.code = 'SALESFORCE_REVENUE_SOURCE_CHANGED'");
    expect(scheduler).toContain('expectedSourceMappingConfig: String(source.mappingConfig)');
    expect(scheduler).toContain('expectedSourceMappingConfig: String(salesforceSource.mappingConfig)');
    expect(scheduler).toContain('result.status === 409 && message.includes("revenue source changed")');
  });
});
