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

const ga4ScheduledReportPdfFile = () =>
  readFileSync(join(process.cwd(), "server", "ga4-scheduled-report-pdf.ts"), "utf-8");

const hubspotWizardFile = () =>
  readFileSync(join(process.cwd(), "client", "src", "components", "HubSpotRevenueWizard.tsx"), "utf-8");

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

  it("shows selected HubSpot campaign mappings in review before save", () => {
    const wizard = hubspotWizardFile();
    const reviewBlock = sliceBetween(
      wizard,
      '{step === "review" && (',
      '{reviewDealBreakdown.length > 0 && ('
    );
    const selectedDealsIndex = reviewBlock.indexOf("Selected deal(s)");
    const mappingIndex = reviewBlock.indexOf("{selectedCampaignMappings.length > 0 && (");

    expect(wizard).toContain('const reviewPlatformLabel = isGA4 ? "GA4"');
    expect(mappingIndex).toBeGreaterThan(selectedDealsIndex);
    expect(reviewBlock).toContain("{reviewPlatformLabel} campaign mapping");
    expect(reviewBlock).toContain("mapping.crmValue");
    expect(reviewBlock).toContain("mapping.linkedinCampaignName || mapping.linkedinCampaignUrn");
    expect(reviewBlock).toContain("selectedCampaignMappings.slice(0, 6).map");
  });
  it("hides zero Pipeline Proxy summary in unchanged HubSpot edit review", () => {
    const wizard = hubspotWizardFile();
    const visibilityBlock = sliceBetween(
      wizard,
      "const showReviewPipelineProxy = useMemo(() => {",
      "  // Advanced options"
    );
    const reviewSummaryBlock = sliceBetween(
      wizard,
      '<div className="text-xs text-muted-foreground/70">Campaign identifier field</div>',
      '<div className="text-xs text-muted-foreground/70">Date field</div>'
    );

    expect(visibilityBlock).toContain('if (!pipelineEnabled) return false;');
    expect(visibilityBlock).toContain('mode === "edit" && !hasEditChanges');
    expect(visibilityBlock).toContain('Number(reviewPipelineProxyDisplayAmount) <= 0');
    expect(reviewSummaryBlock).toContain('{showReviewPipelineProxy && (');
    expect(reviewSummaryBlock).not.toContain('{pipelineEnabled && (');
    expect(wizard).toContain('pipelineEnabled,');
    expect(wizard).toContain('pipelineStageId: pipelineEnabled ? pipelineStageId : null');
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

  it("keeps HubSpot Pipeline Proxy scoped and separate from confirmed GA4 financial revenue", () => {
    const routes = routesFile();
    const client = ga4MetricsFile();
    const pipelineRoute = sliceBetween(
      routes,
      'app.get("/api/hubspot/:campaignId/pipeline-proxy"',
      'app.delete("/api/hubspot/:campaignId/pipeline-proxy"'
    );
    const pipelineMemo = sliceBetween(
      client,
      "const pipelineProxyData = useMemo(() => {",
      "  // Availability flags for UI gating"
    );
    const financialRevenueBlock = sliceBetween(
      client,
      "const importedRevenueForFinancials",
      "const revenueSourceLabels = useMemo"
    );
    const revenueExportBlock = sliceBetween(
      client,
      "const revenueCards: [string, string][] = [",
      "      sourceRows(\"Revenue\", ["
    );
    const revenueSourcesDialog = sliceBetween(
      client,
      "{revenueDisplaySources.map((s: any) => {",
      "<AlertDialog open={!!deletingRevenueSourceId}"
    );
    const mappedCampaignLabelHelper = sliceBetween(
      client,
      "const revenueSourceMappedCampaignLabel = (source: any, cfg: any) => {",
      "  // Merged spend sources"
    );

    expect(pipelineRoute).toContain("requestedPlatformContext");
    expect(pipelineRoute).toContain("storage.getRevenueSources(campaignId, context)");
    expect(pipelineRoute).toContain("const pipelineSelectedValues = Array.isArray(cfg.selectedValues) ? cfg.selectedValues.map((v: any) => String(v)) : [];");
    expect(pipelineRoute).toContain("{ propertyName: campaignProp, operator: 'IN', values: pipelineSelectedValues }");
    expect(pipelineRoute).toContain("{ propertyName: 'dealstage', operator: 'IN', values: [pipelineStageId] }");
    expect(pipelineRoute).toContain("totalToDate: Number(cfg.pipelineTotalToDate || 0)");

    expect(pipelineMemo).toContain('getPipelineSourceData("hubspot", hubspotPipelineProxyData, "HubSpot")');
    expect(pipelineMemo).toContain("sourceMatchesGa4Scope");
    expect(pipelineMemo).toContain("providerEntries: entries.map");
    expect(financialRevenueBlock).toContain("const financialRevenue = ga4RevenueForFinancials + importedRevenueForFinancials;");
    expect(financialRevenueBlock).not.toContain("pipelineProxyData");
    expect(revenueExportBlock).toContain('if (pipelineProxyData?.success) revenueCards.push(["Pipeline Proxy", fC(Number(pipelineProxyData.totalToDate || 0))]);');
    expect(revenueSourcesDialog).toContain("isPipelineOnlyRevenueSource");
    expect(revenueSourcesDialog).toContain("Pipeline Proxy only");
    expect(mappedCampaignLabelHelper).toContain('String(source?.sourceType || "").trim().toLowerCase() !== "hubspot"');
    expect(mappedCampaignLabelHelper).toContain("cfg?.campaignMappings");
    expect(mappedCampaignLabelHelper).toContain("mapping?.linkedinCampaignName");
    expect(revenueSourcesDialog).toContain("const mappedCampaignText = revenueSourceMappedCampaignLabel(s, cfg);");
    expect(revenueSourcesDialog).toContain('isPipelineOnlyRevenueSource ? `${mappedCampaignText} - Pipeline Proxy only` : mappedCampaignText');
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

    expect(runner).toContain('var VERSION = "2026-07-04.9";');
    expect(hubspotRunner).toContain('"hubspotInventory"');
    expect(hubspotRunner).toContain('"/api/campaigns/" + encodeURIComponent(campaignId) + "/ga4-overview/source-damage-inventory"');
    expect(hubspotRunner).toContain("inventoryPass: data.hubspotInventoryPass === true");
    expect(hubspotRunner).toContain("hubspotFindings.activeHubspotSourcesWithZeroRecords || []");
    expect(hubspotRunner).toContain("summary.overallPass = result.pass && data.success === true && data.readonly === true && data.hubspotInventoryPass === true");
    expect(runner).toContain("hubspotInventory: hubspotInventory");
  });

  it("exposes non-secret HubSpot provenance evidence without mutating provider or revenue state", () => {
    const routes = routesFile();
    const inventoryRoute = sliceBetween(
      routes,
      'app.get("/api/campaigns/:id/ga4-overview/source-damage-inventory"',
      'app.get("/api/campaigns/:id/spend-sources/google-sheets-duplicates"'
    );
    const runner = validationRunnerFile();
    const provenanceRunner = sliceBetween(
      runner,
      "async function hubspotProvenance(config)",
      "function googleSheetsAmount(sourceRow, breakdownRows, family)"
    );

    expect(routes).toContain("hubspotConnections as hubspotConnectionsTable");
    expect(inventoryRoute).toContain("portalId: hubspotConnectionsTable.portalId");
    expect(inventoryRoute).toContain("portalName: hubspotConnectionsTable.portalName");
    expect(inventoryRoute).toContain("mappingConfig: hubspotConnectionsTable.mappingConfig");
    expect(inventoryRoute).toContain("hubspotProvenancePass");
    expect(inventoryRoute).toContain("hubspotProvenance: {");
    expect(inventoryRoute).toContain("sourceModalExpected");
    expect(inventoryRoute).toContain("const hubspotSourceRevenueTotal = (sourceId: string) => {");
    expect(inventoryRoute).toContain("if (record?.subCampaignUrn) subCampaign += value;");
    expect(inventoryRoute).toContain("else aggregate += value;");
    expect(inventoryRoute).toContain("return Math.round((aggregate > 0 ? aggregate : subCampaign) * 100) / 100;");
    expect(inventoryRoute).not.toContain("const hubspotSourceRevenueTotal = (sourceId: string) => centsOverviewInventoryTotal");
    expect(inventoryRoute).toContain("campaignProperty");
    expect(inventoryRoute).toContain("selectedValues");
    expect(inventoryRoute).toContain("revenueProperty");
    expect(inventoryRoute).toContain("dateField");
    expect(inventoryRoute).toContain("pipelineEnabled");
    expect(inventoryRoute).toContain("mapping.campaignMappings.flatMap");
    expect(inventoryRoute).toContain("item?.linkedinCampaignName");
    expect(inventoryRoute).toContain("pipelineStageLabel");
    expect(inventoryRoute).toContain("pipelineTotalToDate");
    expect(inventoryRoute).toContain("pipelineValueRevenueTotals");
    expect(inventoryRoute).toContain("&& a.pipelineStageId === b.pipelineStageId;");
    expect(inventoryRoute).toContain("sourceModalEvidenceBoundary");
    expect(inventoryRoute).not.toContain("accessToken: hubspotConnectionsTable.accessToken");
    expect(inventoryRoute).not.toContain("refreshToken: hubspotConnectionsTable.refreshToken");
    expect(inventoryRoute).not.toContain("clientSecret: hubspotConnectionsTable.clientSecret");
    expect(inventoryRoute).not.toContain("encryptedTokens: hubspotConnectionsTable.encryptedTokens");
    expect(inventoryRoute).not.toContain("storage.getHubspotConnection(campaignId)");
    expect(inventoryRoute).not.toContain("storage.getHubspotConnections(campaignId)");
    expect(inventoryRoute).not.toContain("updateHubspotConnection");
    expect(inventoryRoute).not.toContain("getHubspotAccessTokenForCampaign");

    expect(provenanceRunner).toContain('"hubspotProvenance"');
    expect(provenanceRunner).toContain('"/api/campaigns/" + encodeURIComponent(campaignId) + "/ga4-overview/source-damage-inventory"');
    expect(provenanceRunner).toContain("expectedPipelineEnabled");
    expect(provenanceRunner).toContain("serverProvenancePass: data.hubspotProvenancePass === true");
    expect(provenanceRunner).toContain("activeSources: activeSources");
    expect(provenanceRunner).toContain("summary.overallPass = summary.provenancePass");
    expect(runner).toContain("hubspotProvenance: hubspotProvenance");
  });

  it("keeps HubSpot GA4 revenue refresh/reprocess scheduler-only, not a user-facing source action", () => {
    const client = ga4MetricsFile();
    const routes = routesFile();
    const scheduler = schedulerFile();
    const revenueWizardMount = sliceBetween(
      client,
      "<AddRevenueWizardModal",
      "<Dialog open={showRevenueSourcesDialog}"
    );
    const revenueSourcesDialog = sliceBetween(
      client,
      "<Dialog open={showRevenueSourcesDialog}",
      "<Dialog open={showSpendSourcesDialog}"
    );
    const sourceScopedRunNowRoutes = routes.match(/app\.post\("\/api\/campaigns\/:id\/(?:revenue|spend)-sources\/:sourceId\/[^\"]*run-now"/g) || [];

    expect(revenueWizardMount).toContain("initialSource={editingRevenueSource || undefined}");
    expect(revenueWizardMount).toContain('platformContext="ga4"');
    expect(revenueWizardMount).not.toContain("refreshRevenue");
    expect(revenueWizardMount).not.toContain("run-now");

    expect(revenueSourcesDialog).toContain('title="Edit revenue source"');
    expect(revenueSourcesDialog).toContain('title="Remove revenue source"');
    expect(revenueSourcesDialog).toContain("setEditingRevenueSource");
    expect(revenueSourcesDialog).toContain("setDeletingRevenueSourceId");
    expect(revenueSourcesDialog).not.toContain("refreshRevenue");
    expect(revenueSourcesDialog).not.toContain("run-now");
    expect(revenueSourcesDialog).not.toContain("RefreshCw");
    expect(revenueSourcesDialog).not.toContain("Reprocess");
    expect(revenueSourcesDialog).not.toContain("Sync");

    expect(sourceScopedRunNowRoutes).toEqual([
      'app.post("/api/campaigns/:id/revenue-sources/:sourceId/google-sheets-refresh/run-now"',
      'app.post("/api/campaigns/:id/spend-sources/:sourceId/google-sheets-refresh/run-now"',
    ]);
    expect(routes).toContain('app.post("/api/campaigns/:id/hubspot/save-mappings"');
    expect(routes).not.toContain('/api/campaigns/:id/revenue-sources/:sourceId/hubspot-refresh/run-now');
    expect(routes).not.toContain('/api/campaigns/:id/revenue-sources/:sourceId/hubspot-reprocess/run-now');
    expect(routes).not.toContain('/api/campaigns/:id/revenue-sources/:sourceId/hubspot/run-now');

    expect(scheduler).toContain("async function reprocessHubSpot(campaignId: string, mappingConfig: AnyRecord, sourceId?: string): Promise<boolean>");
    expect(scheduler).toContain('postJson(`/api/campaigns/${encodeURIComponent(campaignId)}/hubspot/save-mappings`, body)');
    expect(scheduler).toContain("reprocessHubSpot(campaignId, hubCfg, String(hubspotSource.id))");
  });

  it("exposes a read-only HubSpot provider propagation comparison runner", () => {
    const runner = validationRunnerFile();
    const propagationRunner = sliceBetween(
      runner,
      "async function hubspotPropagationPoint(config, stage)",
      "function normalizeHubspotPipelineValue(value)"
    );

    expect(runner).toContain('var VERSION = "2026-07-04.9";');
    expect(propagationRunner).toContain("async function hubspotPropagationBefore(config)");
    expect(propagationRunner).toContain("async function hubspotPropagationAfter(config)");
    expect(propagationRunner).toContain("hubspotPropagationPoint(config");
    expect(propagationRunner).toContain('"hubspotSourceDamageInventory"');
    expect(propagationRunner).toContain("expectedHubspotRevenueDelta");
    expect(propagationRunner).toContain("providerExpectationProvided");
    expect(propagationRunner).toContain("sameActiveHubspotSourceIds");
    expect(propagationRunner).toContain("sameRevenueSourceIds");
    expect(propagationRunner).toContain("activeSourceStayedSame");
    expect(propagationRunner).toContain("revenueDeltaMatchesHubspotDelta");
    expect(propagationRunner).toContain("spendUnchanged");
    expect(propagationRunner).toContain("This HubSpot propagation helper is read-only");
    expect(propagationRunner).not.toContain("save-mappings");
    expect(propagationRunner).not.toContain("run-now");
    expect(propagationRunner).not.toContain('method: "POST"');
    expect(runner).toContain("hubspotPropagationBefore: hubspotPropagationBefore");
    expect(runner).toContain("hubspotPropagationAfter: hubspotPropagationAfter");
  });

  it("exposes a read-only HubSpot Pipeline Proxy validation runner", () => {
    const runner = validationRunnerFile();
    const pipelineRunner = sliceBetween(
      runner,
      "async function hubspotPipelineProxy(config)",
      "async function hubspotProxyTransitionPoint(config, stage)"
    );
    const pipelineChecks = sliceBetween(
      pipelineRunner,
      "var checks = {",
      "    if (config.expectedPipelineStageId !== undefined) {"
    );

    expect(runner).toContain('var VERSION = "2026-07-04.9";');
    expect(pipelineRunner).toContain('"hubspotSourceDamageInventory"');
    expect(pipelineRunner).toContain("selectHubspotPipelineSource(activeSources, config.sourceId)");
    expect(pipelineRunner).toContain("activePipelineSourceCountMatchesExpected");
    expect(pipelineRunner).toContain("selectedSourceProvenancePresent");
    expect(pipelineRunner).toContain("serverProvenancePass: data.hubspotProvenancePass === true");
    expect(pipelineChecks).not.toContain("serverProvenancePass");
    expect(pipelineRunner).toContain("expectedConfirmedRevenueTotal");
    expect(pipelineRunner).toContain("expectedPipelineTotalToDate");
    expect(pipelineRunner).toContain("pipelineNotAddedToConfirmedRevenue");
    expect(pipelineRunner).toContain("pipelineValuesWithinSelectedValues");
    expect(pipelineRunner).toContain("pipelineTotalMatchesValueTotals");
    expect(pipelineRunner).toContain("This HubSpot Pipeline Proxy helper is read-only");
    expect(pipelineRunner).not.toContain("/pipeline-proxy");
    expect(pipelineRunner).not.toContain('method: "POST"');
    expect(pipelineRunner).not.toContain("save-mappings");
    expect(runner).toContain("hubspotPipelineProxy: hubspotPipelineProxy");
  });

  it("exposes a read-only HubSpot proxy-to-confirmed transition runner", () => {
    const runner = validationRunnerFile();
    const transitionRunner = sliceBetween(
      runner,
      "async function hubspotProxyTransitionPoint(config, stage)",
      "function parseStoredGa4CampaignFilterForRunner(raw)"
    );

    expect(runner).toContain('var VERSION = "2026-07-04.9";');
    expect(transitionRunner).toContain("async function hubspotProxyTransitionBefore(config)");
    expect(transitionRunner).toContain("async function hubspotProxyTransitionAfter(config)");
    expect(transitionRunner).toContain('"hubspotSourceDamageInventory"');
    expect(transitionRunner).toContain("hubspotPipelineTotalFromMapping(mapping)");
    expect(transitionRunner).toContain("expectedProxyDelta");
    expect(transitionRunner).toContain("expectedConfirmedRevenueDelta");
    expect(transitionRunner).toContain("combinedRevenueAndProxyDeltaMatchesExpected");
    expect(transitionRunner).toContain("activeSourceRevenueDeltaMatchesConfirmedDelta");
    expect(transitionRunner).toContain("proxyDecreased");
    expect(transitionRunner).toContain("confirmedRevenueIncreased");
    expect(transitionRunner).toContain("spendUnchanged");
    expect(transitionRunner).toContain("sameRevenueSourceIds");
    expect(transitionRunner).toContain("This HubSpot proxy-to-confirmed transition helper is read-only");
    expect(transitionRunner).not.toContain("/pipeline-proxy");
    expect(transitionRunner).not.toContain('method: "POST"');
    expect(runner).toContain("hubspotProxyTransitionBefore: hubspotProxyTransitionBefore");
    expect(runner).toContain("hubspotProxyTransitionAfter: hubspotProxyTransitionAfter");
  });
  it("exposes a read-only HubSpot Campaign Breakdown mapped-revenue transition runner", () => {
    const runner = validationRunnerFile();
    const campaignBreakdownRunner = sliceBetween(
      runner,
      "function parseStoredGa4CampaignFilterForRunner(raw)",
      "function googleSheetsAmount(sourceRow, breakdownRows, family)"
    );

    expect(runner).toContain('var VERSION = "2026-07-04.9";');
    expect(campaignBreakdownRunner).toContain("async function hubspotCampaignBreakdownBefore(config)");
    expect(campaignBreakdownRunner).toContain("async function hubspotCampaignBreakdownAfter(config)");
    expect(campaignBreakdownRunner).toContain('"ga4Breakdown"');
    expect(campaignBreakdownRunner).toContain('"revenueSources"');
    expect(campaignBreakdownRunner).toContain('"revenueBreakdown"');
    expect(campaignBreakdownRunner).toContain('"hubspotSourceDamageInventory"');
    expect(campaignBreakdownRunner).toContain("campaignValueRevenueTotals");
    expect(campaignBreakdownRunner).toContain("campaignMappings");
    expect(campaignBreakdownRunner).toContain("normalizeCampaignBreakdownKey");
    expect(campaignBreakdownRunner).toContain("targetDisplayedRevenueDeltaMatchesExpected");
    expect(campaignBreakdownRunner).toContain("targetHubspotRevenueDeltaMatchesExpected");
    expect(campaignBreakdownRunner).toContain("unchangedRowsDisplayedRevenueUnchanged");
    expect(campaignBreakdownRunner).toContain("unchangedRowsHubspotRevenueUnchanged");
    expect(campaignBreakdownRunner).toContain("This HubSpot Campaign Breakdown helper is read-only");
    expect(campaignBreakdownRunner).not.toContain('method: "POST"');
    expect(campaignBreakdownRunner).not.toContain("/pipeline-proxy");
    expect(runner).toContain("hubspotCampaignBreakdownBefore: hubspotCampaignBreakdownBefore");
    expect(runner).toContain("hubspotCampaignBreakdownAfter: hubspotCampaignBreakdownAfter");
  });

  it("keeps GA4 report payload formulas aligned with HubSpot mapped revenue", () => {
    const pdf = ga4ScheduledReportPdfFile();
    const payloadBlock = sliceBetween(
      pdf,
      "const importedRevenueForFinancials",
      "const pipelineEntries"
    );
    const overviewReportBlock = sliceBetween(
      pdf,
      "if (sections.overview)",
      "if (sections.ads)"
    );

    expect(payloadBlock).toContain("const importedRevenueForFinancials = Number(revenueBreakdown.reduce");
    expect(payloadBlock).toContain("const financialRevenue = Number((ga4RevenueForFinancials + importedRevenueForFinancials).toFixed(2));");
    expect(payloadBlock).toContain("const revenueDisplaySources = revenueBreakdown.length > 0");
    expect(payloadBlock).toContain("mappingConfig: revenueSources.find");
    expect(payloadBlock).toContain("const campaignBreakdownMatchedExternalRevenue = new Map<string, number>();");
    expect(payloadBlock).toContain("campaignValueRevenueTotals");
    expect(payloadBlock).toContain("campaignMappings");
    expect(payloadBlock).toContain("mappedCampaignByValue");
    expect(payloadBlock).toContain("mapping?.linkedinCampaignName || mapping?.linkedinCampaignUrn");
    expect(overviewReportBlock).toContain("[\"Total Revenue\", formatMoney(payload.financialRevenue)]");
    expect(overviewReportBlock).toContain("payload.revenueDisplaySources.map");
    expect(overviewReportBlock).toContain("payload.campaignBreakdownMatchedExternalRevenue.get");
    expect(overviewReportBlock).not.toContain("pipelineTotal + payload.financialRevenue");
  });

  it("exposes a read-only HubSpot Reports value propagation runner", () => {
    const runner = validationRunnerFile();
    const reportRunner = sliceBetween(
      runner,
      "async function hubspotReportValuePack(config)",
      "function googleSheetsAmount(sourceRow, breakdownRows, family)"
    );

    expect(runner).toContain('var VERSION = "2026-07-04.9";');
    expect(reportRunner).toContain('"reports"');
    expect(reportRunner).toContain('"snapshots"');
    expect(reportRunner).toContain('"snapshotPdf"');
    expect(reportRunner).toContain('"hubspotSourceDamageInventory"');
    expect(reportRunner).toContain("buildCampaignBreakdownRows(");
    expect(reportRunner).toContain("reportFinancialRevenue");
    expect(reportRunner).toContain("hubspotRevenueForFinancials");
    expect(reportRunner).toContain("reportIncludesOverviewRevenue");
    expect(reportRunner).toContain("reportIncludesOverviewCampaignBreakdown");
    expect(reportRunner).toContain("pipelineProxyExcludedFromReportTotal");
    expect(reportRunner).toContain("This HubSpot Reports helper is read-only");
    expect(reportRunner).not.toContain('method: "POST"');
    expect(reportRunner).not.toContain("send-test");
    expect(reportRunner).not.toContain("createSnapshot");
    expect(runner).toContain("hubspotReportValuePack: hubspotReportValuePack");
  });
});
