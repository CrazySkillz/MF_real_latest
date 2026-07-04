import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const routesFile = () =>
  readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");

const ga4MetricsFile = () =>
  readFileSync(join(process.cwd(), "client", "src", "pages", "ga4-metrics.tsx"), "utf-8");

const storageFile = () =>
  readFileSync(join(process.cwd(), "server", "storage.ts"), "utf-8");

const schedulerFile = () =>
  readFileSync(join(process.cwd(), "server", "auto-refresh-scheduler.ts"), "utf-8");

const validationRunnerFile = () =>
  readFileSync(join(process.cwd(), "client", "public", "ga4-overview-validation-runner.js"), "utf-8");

const sliceBetween = (source: string, startNeedle: string, endNeedle: string): string => {
  const start = source.indexOf(startNeedle);
  const end = source.indexOf(endNeedle, start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
};

describe("HubSpot revenue GA4 Overview regression guard", () => {
  it("guards HubSpot OAuth connect and callback with campaign-scoped signed state", () => {
    const routes = routesFile();
    const connectBlock = sliceBetween(
      routes,
      'app.post("/api/auth/hubspot/connect"',
      "// Salesforce OAuth - Start connection"
    );
    const callbackBlock = sliceBetween(
      routes,
      'app.get("/api/auth/hubspot/callback"',
      "// Get spreadsheets for campaign"
    );

    expect(routes).toContain("const HUBSPOT_OAUTH_STATE_TTL_MS = 10 * 60 * 1000;");
    expect(routes).toContain("const signHubSpotOAuthState = (campaignId: string): string => {");
    expect(routes).toContain("const verifyHubSpotOAuthState = (stateRaw: unknown)");
    expect(routes).toContain("process.env.HUBSPOT_OAUTH_STATE_SECRET");
    expect(routes).toContain('createHmac("sha256", secret).update(payloadB64).digest();');
    expect(routes).toContain("timingSafeEqual(providedSig, expectedSig)");

    expect(connectBlock).toContain("const parsedCampaignId = campaignIdSchema.safeParse");
    expect(connectBlock).toContain("const ok = await ensureCampaignAccess(req as any, res as any, parsedCampaignId.data);");
    expect(connectBlock).toContain("const state = signHubSpotOAuthState(parsedCampaignId.data);");
    expect(connectBlock).not.toContain("state=${encodeURIComponent(campaignId)}");

    expect(callbackBlock).toContain("const verified = verifyHubSpotOAuthState(state);");
    expect(callbackBlock).toContain("const campaignId = verified.campaignId;");
    expect(callbackBlock).not.toContain("const campaignId = String(state);");
  });

  it("keeps HubSpot save source identity stable and GA4 records daily-materialized", () => {
    const routes = routesFile();
    const saveRoute = sliceBetween(
      routes,
      'app.post("/api/campaigns/:id/hubspot/save-mappings"',
      "// Helper function to refresh Google Sheets access token with robust error handling"
    );

    expect(saveRoute).toContain("sourceId: z.string().trim().optional(),");
    expect(saveRoute).toContain("const existingSource = await storage.getRevenueSource(campaignId, requestedSourceId);");
    expect(saveRoute).toContain('String((existingSource as any).sourceType || "").toLowerCase() !== "hubspot" || existingCtx !== platformCtx');
    expect(saveRoute).toContain('return res.status(404).json({ error: "HubSpot revenue source not found" });');
    expect(saveRoute).toContain("const existingSources = await storage.getRevenueSources(campaignId, platformCtx as any).catch(() => [] as any[]);");
    expect(saveRoute).toContain('if (requestedSourceId) return String((s as any).id || "") === requestedSourceId;');
    expect(saveRoute).toContain("existingHubspot\n            ? await storage.updateRevenueSource");
    expect(saveRoute).toContain(": await storage.createRevenueSource({");
    expect(saveRoute).toContain("await storage.deleteRevenueRecordsBySource(String((source as any).id));");
    expect(saveRoute).toContain("Note: do NOT deactivate existing sources");

    expect(saveRoute).toContain('platformContext: platformCtx,');
    expect(saveRoute).toContain('dailyMaterialization: platformCtx === "ga4" && revenueByCloseDate.size > 0 ? "selected_date_field_v1" : null,');
    expect(saveRoute).toContain('if (platformCtx === "ga4" && revenueByCloseDate.size > 0) {');
    expect(saveRoute).toContain("Array.from(revenueByCloseDate.entries())");
    expect(saveRoute).toContain("revenueSourceId: String((source as any).id),");
    expect(saveRoute).toContain("sourceType: 'hubspot',");
    expect(saveRoute).toContain("subCampaignUrn: urn,");
    expect(saveRoute).toContain("await storage.createRevenueRecords(records);");
  });

  it("fails closed when GA4 HubSpot revenue record materialization fails", () => {
    const routes = routesFile();
    const saveRoute = sliceBetween(
      routes,
      'app.post("/api/campaigns/:id/hubspot/save-mappings"',
      "// Helper function to refresh Google Sheets access token with robust error handling"
    );
    const catchIndex = saveRoute.indexOf('console.warn("[HubSpot Save Mappings] Failed to materialize revenue records:", e);');
    const failClosedIndex = saveRoute.indexOf('if (platformCtx === "ga4") {', catchIndex);
    const responseIndex = saveRoute.indexOf('return res.status(500).json({ error: "Failed to materialize HubSpot revenue records" });', catchIndex);
    const recomputeIndex = saveRoute.indexOf('await recomputeCampaignDerivedValues(campaignId, { platformContext: platformCtx });', catchIndex);
    const successIndex = saveRoute.indexOf('success: true', catchIndex);

    expect(catchIndex).toBeGreaterThan(-1);
    expect(failClosedIndex).toBeGreaterThan(catchIndex);
    expect(responseIndex).toBeGreaterThan(failClosedIndex);
    expect(responseIndex).toBeLessThan(recomputeIndex);
    expect(responseIndex).toBeLessThan(successIndex);
  });

  it("deletes only the campaign-owned HubSpot revenue source and records after context validation", () => {
    const routes = routesFile();
    const deleteRoute = sliceBetween(
      routes,
      'app.delete("/api/campaigns/:id/revenue-sources/:sourceId"',
      "// Check if this was the last revenue source for the platform context."
    );

    expect(deleteRoute).toContain("const ok = await ensureCampaignAccess(req as any, res as any, campaignId);");
    expect(deleteRoute).toContain("parsePlatformContext(requestedPlatformContextRaw, \"ga4\", res)");
    expect(deleteRoute).toContain("const source = await storage.getRevenueSource(campaignId, sourceId);");
    expect(deleteRoute).toContain("if (!source) return res.status(404).json({ success: false, error: \"Revenue source not found\" });");
    expect(deleteRoute).toContain("if (requestedPlatformContext && sourcePlatformContext.toLowerCase() !== requestedPlatformContext) {");
    expect(deleteRoute).toContain("await storage.deleteRevenueSource(sourceId);");
    expect(deleteRoute).toContain("await storage.deleteRevenueRecordsBySource(sourceId);");
  });

  it("keeps GA4 revenue reads active-source-only and platform-context scoped", () => {
    const storage = storageFile();
    const sourcesMethod = sliceBetween(
      storage,
      "async getRevenueSources(campaignId: string, platformContext: RevenuePlatformContext = 'ga4')",
      "async getRevenueSource(campaignId: string, sourceId: string)"
    );
    const totalMethod = sliceBetween(
      storage,
      "async getRevenueTotalForRange(campaignId: string, startDate: string, endDate: string, platformContext: RevenuePlatformContext = 'ga4')",
      "async getRevenueBreakdownBySource(campaignId: string, startDate: string, endDate: string, platformContext: RevenuePlatformContext = 'ga4')"
    );
    const breakdownMethod = sliceBetween(
      storage,
      "async getRevenueBreakdownBySource(campaignId: string, startDate: string, endDate: string, platformContext: RevenuePlatformContext = 'ga4')",
      "async updateGoogleAdsDailyMetricsGA4Revenue"
    );

    for (const method of [sourcesMethod, totalMethod, breakdownMethod]) {
      expect(method).toContain("eq(revenueSources.isActive, true)");
      expect(method).toContain("or(eq(revenueSources.platformContext, 'ga4' as any), isNull(revenueSources.platformContext))");
    }
    expect(sourcesMethod).toContain("ctx === 'ga4'");
    expect(sourcesMethod).toContain("eq(revenueSources.platformContext, ctx as any)");
    expect(totalMethod).toContain("platformContext === 'ga4'");
    expect(totalMethod).toContain("eq(revenueSources.platformContext, platformContext as any)");
    expect(breakdownMethod).toContain("platformContext === 'ga4'");
    expect(breakdownMethod).toContain("eq(revenueSources.platformContext, platformContext as any)");

    expect(totalMethod).toContain("const totalsBySource = new Map<string, { aggregate: number; subCampaign: number }>();");
    expect(totalMethod).toContain("item.aggregate > 0 ? item.aggregate : item.subCampaign");
    expect(breakdownMethod).toContain("data.aggregate > 0 ? data.aggregate : data.subCampaign");
  });

  it("scheduler reprocesses saved HubSpot revenue mappings with platform context and stable source IDs", () => {
    const scheduler = schedulerFile();
    const reprocessHubSpot = sliceBetween(
      scheduler,
      "async function reprocessHubSpot(campaignId: string, mappingConfig: AnyRecord, sourceId?: string): Promise<boolean>",
      "async function reprocessSalesforce(campaignId: string, mappingConfig: AnyRecord, sourceId?: string): Promise<boolean>"
    );
    const hubspotLoop = sliceBetween(
      scheduler,
      "// HubSpot revenue sources are the source of truth for saved campaign mappings.",
      "// Salesforce revenue sources are the source of truth for saved campaign mappings."
    );

    expect(reprocessHubSpot).toContain("dateField: mappingConfig.dateField,");
    expect(reprocessHubSpot).toContain("platformContext: mappingConfig.platformContext,");
    expect(reprocessHubSpot).toContain("...(sourceId ? { sourceId } : {}),");
    expect(reprocessHubSpot).toContain('postJson(`/api/campaigns/${encodeURIComponent(campaignId)}/hubspot/save-mappings`, body)');
    expect(reprocessHubSpot).toContain("Skipping stale HubSpot revenue source");

    expect(hubspotLoop).toContain("const hubspotRevenueSources = (await storage.getRevenueSources(campaignId, ctx).catch(() => [] as any[]))");
    expect(hubspotLoop).toContain('String(s.sourceType || "").toLowerCase() === "hubspot"');
    expect(hubspotLoop).toContain("const hubCfg = hubCfgRaw ? { ...hubCfgRaw, platformContext: hubCfgRaw.platformContext || hubspotSource.platformContext || ctx } : null;");
    expect(hubspotLoop).toContain("reprocessHubSpot(campaignId, hubCfg, String(hubspotSource.id))");
  });

  it("scopes the GA4 HubSpot Pipeline Proxy fetch to GA4 platform context", () => {
    const client = ga4MetricsFile();
    const hubspotQuery = sliceBetween(
      client,
      "const { data: hubspotPipelineProxyData } = useQuery<any>({",
      "const { data: salesforcePipelineProxyData } = useQuery<any>({"
    );

    expect(hubspotQuery).toContain('/pipeline-proxy?platformContext=ga4`);');
    expect(hubspotQuery).not.toContain('/pipeline-proxy`);');
  });

  it("exposes a read-only HubSpot GA4 Overview inventory runner", () => {
    const routes = routesFile();
    const inventoryRoute = sliceBetween(
      routes,
      'app.get("/api/campaigns/:id/ga4-overview/source-damage-inventory"',
      'app.get("/api/campaigns/:id/spend-sources/google-sheets-duplicates"'
    );
    const runner = validationRunnerFile();
    const hubspotRunner = sliceBetween(
      runner,
      "async function hubspotInventory(config)",
      "function googleSheetsAmount(sourceRow, breakdownRows, family)"
    );

    expect(inventoryRoute).toContain("storage.getCampaign(campaignId).catch(() => null as any)");
    expect(inventoryRoute).toContain("hubspotInventoryPass");
    expect(inventoryRoute).toContain("hubspotSummary");
    expect(inventoryRoute).toContain("hubspotFindings");
    expect(inventoryRoute).toContain("activeHubspotSourcesWithZeroRecords");
    expect(inventoryRoute).toContain("orphanHubspotRevenueRecordGroups");
    expect(inventoryRoute).toContain("duplicateActiveHubspotSourceGroups");
    expect(inventoryRoute).toContain("hubspotGa4ContextMismatchSources");
    expect(inventoryRoute).toContain("hubspotPipelineProxyScopeMismatches");
    expect(inventoryRoute).toContain("readonly: true");
    expect(inventoryRoute).not.toContain("deleteRevenue");
    expect(inventoryRoute).not.toContain("deleteSpendSource");
    expect(inventoryRoute).not.toContain("recomputeCampaignDerivedValues");
    expect(inventoryRoute).not.toContain("recomputeGA4KPIAndBenchmarkValues");
    expect(inventoryRoute).not.toContain("recalcCampaignSpend");

    expect(runner).toContain('var VERSION = "2026-07-04.1";');
    expect(hubspotRunner).toContain('"hubspotInventory"');
    expect(hubspotRunner).toContain('"/api/campaigns/" + encodeURIComponent(campaignId) + "/ga4-overview/source-damage-inventory"');
    expect(hubspotRunner).toContain("inventoryPass: data.hubspotInventoryPass === true");
    expect(hubspotRunner).toContain("hubspotFindings.activeHubspotSourcesWithZeroRecords || []");
    expect(hubspotRunner).toContain("summary.overallPass = result.pass && data.success === true && data.readonly === true && data.hubspotInventoryPass === true");
    expect(runner).toContain("hubspotInventory: hubspotInventory");
  });
});