import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("Latest Day Revenue regression guard", () => {
  it("GA4 Overview does not render the removed previous-day revenue card", () => {
    const clientFile = readFileSync(
      join(process.cwd(), "client", "src", "pages", "ga4-metrics.tsx"),
      "utf-8"
    );

    expect(clientFile).not.toContain("Latest Day Revenue");
    expect(clientFile).not.toContain("const latestDayRevenue = Number(revenueDailyResp?.totalRevenue || 0);");
    expect(clientFile).not.toContain("formatMoney(Number(revenueDailyResp?.totalRevenue || 0))");
    expect(clientFile).not.toContain("ga4LatestDayRevenue");
    expect(clientFile).not.toContain("const revenueDailyDate = ga4ReportDate || spendDailyYesterday;");
    expect(clientFile).not.toContain("const revenueDailyDate = spendDailyYesterday;");
  });

  it("revenue-daily endpoint defaults to server UTC yesterday and includes safe GA4 HubSpot daily records", () => {
    const routesFile = readFileSync(
      join(process.cwd(), "server", "routes-oauth.ts"),
      "utf-8"
    );
    const schedulerFile = readFileSync(
      join(process.cwd(), "server", "auto-refresh-scheduler.ts"),
      "utf-8"
    );

    expect(routesFile).toContain("const isEligibleForLatestDayRevenue = (source: any): boolean => {");
    expect(routesFile).toContain('if (sourceType === "manual") return false;');
    expect(routesFile).toContain('if (sourceType === "hubspot") {');
    expect(routesFile).toContain('if (cfg?.pipelineEnabled === true) return String(cfg?.dailyMaterialization || "") === "selected_date_field_v1";');
    expect(routesFile).toContain('const date = String(req.query.date || "").trim() || yesterdayUTC();');
    expect(routesFile).toContain("? normalizeStrictUtcDateKey(props?.[dateFieldChoice])");
    expect(routesFile).toContain("code: 'HUBSPOT_INVALID_CONFIRMED_REVENUE_DATES'");
    expect(routesFile).toContain('if (/^\\d{10,13}$/.test(s)) {');
    expect(routesFile).toContain('dailyMaterialization: platformCtx === "ga4" && revenueByCloseDate.size > 0 ? "selected_date_field_v1" : null,');
    expect(routesFile).toContain('source = await storage.replaceGa4HubspotRevenueSourceWithRecords(');
    expect(routesFile).toContain('sourceId: z.string().trim().optional(),');
    expect(routesFile).toContain('if (requestedSourceId) return String((s as any).id || "") === requestedSourceId;');
    expect(routesFile).toContain('&& String(cfg?.dateField || "") === dateFieldChoice');
    expect(routesFile).toContain('const isLegacyClosedWonOnly = hasCallerStageIds && effectiveStageIds.length === 1 && effectiveStageIds[0].toLowerCase() === "closedwon";');
    expect(routesFile).toContain('if (derived.length > 0 && (!hasCallerStageIds || isLegacyClosedWonOnly)) effectiveStageIds = derived;');
    expect(routesFile).toContain('isEligibleForLatestDayRevenue(source)');
    expect(routesFile).toContain('storage.getRevenueBreakdownBySource(campaignId, date, date, "ga4")');
  });

  it("HubSpot refresh preserves the saved date field", () => {
    const schedulerFile = readFileSync(
      join(process.cwd(), "server", "auto-refresh-scheduler.ts"),
      "utf-8"
    );
    const routesFile = readFileSync(
      join(process.cwd(), "server", "routes-oauth.ts"),
      "utf-8"
    );

    expect(schedulerFile).toContain("dateField: mappingConfig.dateField,");
    expect(schedulerFile).not.toContain("stageIds: mappingConfig.stageIds,");
    expect(routesFile).toContain("if ((!accessToken || shouldRefresh) && conn.refreshToken) {");
    expect(routesFile).toContain("accessToken = await refreshHubspotToken(conn);");
    expect(routesFile).toContain("HubSpot access token missing and no refresh token available. Please reconnect HubSpot.");
  });

  it("LinkedIn HubSpot confirmed revenue uses closed-won stages while Pipeline Proxy stays separate", () => {
    const routesFile = readFileSync(
      join(process.cwd(), "server", "routes-oauth.ts"),
      "utf-8"
    );

    expect(routesFile).toContain("Confirmed revenue must use closed-won-ish stages; Pipeline Proxy stays separate.");
    expect(routesFile).toContain("const derived = deriveDefaultClosedWonStageIds(pipelines);");
    expect(routesFile).not.toContain('const derived = platformCtx === "linkedin" ? deriveDefaultNonLostStageIds(pipelines) : deriveDefaultClosedWonStageIds(pipelines);');
  });

  it("LinkedIn Overview can show Pipeline Proxy from saved source config when the live proxy endpoint has not returned", () => {
    const clientFile = readFileSync(
      join(process.cwd(), "client", "src", "pages", "linkedin-analytics.tsx"),
      "utf-8"
    );

    expect(clientFile).toContain("const pipelineProxyFallbackData = (() => {");
    expect(clientFile).toContain("cfg?.pipelineEnabled === true && !!(cfg?.pipelineStageId || cfg?.pipelineStageName)");
    expect(clientFile).toContain("pipelineProxyApiData?.success ? pipelineProxyApiData : pipelineProxyFallbackData");
    expect(clientFile).toContain('const renderPipelineProxyCard = (showEmpty = false, className = "") => {');
    expect(clientFile).toContain("if (!hasPipelineProxy && !showEmpty) return null;");
    expect(clientFile).toContain('<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">');
    expect(clientFile).toContain('{renderPipelineProxyCard(true)}');
    expect(clientFile).not.toContain('{renderPipelineProxyCard(true, "lg:col-span-2")}');
    expect(clientFile).toContain("Select Total Revenue + Pipeline (Proxy) in the revenue wizard");
    expect(clientFile).toContain("Open CRM value only. Not counted in Total Revenue, ROI, or ROAS until it closes.");
  });

  it("LinkedIn Salesforce Crosswalk uses selected Salesforce values instead of campaign dropdown mapping", () => {
    const clientFile = readFileSync(
      join(process.cwd(), "client", "src", "components", "SalesforceRevenueWizard.tsx"),
      "utf-8"
    );

    expect(clientFile).toContain("Selected: <strong>{selectedValues.length}</strong>");
    expect(clientFile).toContain('(step === "crosswalk" && selectedValues.length === 0)');
    expect(clientFile).toContain("selectedValues,");
    expect(clientFile).not.toContain("Map each Salesforce value to a LinkedIn campaign");
    expect(clientFile).not.toContain("/linkedin-campaigns");
    expect(clientFile).toContain('const isGoogleAds = platformContext === "google_ads";');
    expect(clientFile).toContain('if ((!isGA4 && !isGoogleAds && !isMeta && !isInstagram && !isTikTok) || selectedValues.length === 0) return null;');
  });

  it("Salesforce review total preview key is stable when moving from Revenue to Save", () => {
    const clientFile = readFileSync(
      join(process.cwd(), "client", "src", "components", "SalesforceRevenueWizard.tsx"),
      "utf-8"
    );

    const keyBlock = clientFile.slice(
      clientFile.indexOf("const reviewPreviewKey = useMemo("),
      clientFile.indexOf("const canUpdateRevenue = useMemo(")
    );
    expect(keyBlock).toContain("campaignField,");
    expect(keyBlock).toContain("selectedValues: [...selectedValues].sort(),");
    expect(keyBlock).not.toContain("step,");
    expect(clientFile).toContain("setPreviewKey(reviewPreviewKey);");
    expect(clientFile).toContain("limit: 200,");
    expect(clientFile).toContain("const reviewOpportunityBreakdown = useMemo<ReviewOpportunityBreakdownRow[]>");
    expect(clientFile).toContain("Opportunity amount breakdown");
  });

  it("LinkedIn disconnect clears stale campaign-scoped analytics before removing the connection", () => {
    const storageFile = readFileSync(
      join(process.cwd(), "server", "storage.ts"),
      "utf-8"
    );
    const routesFile = readFileSync(
      join(process.cwd(), "server", "routes-oauth.ts"),
      "utf-8"
    );

    expect(storageFile).toContain("async deleteLinkedInCampaignAnalytics(campaignId: string): Promise<boolean> {");
    expect(storageFile).toContain("tx.delete(linkedinImportMetrics).where(inArray(linkedinImportMetrics.sessionId, sessionIds))");
    expect(storageFile).toContain("tx.delete(linkedinAdPerformance).where(inArray(linkedinAdPerformance.sessionId, sessionIds))");
    expect(storageFile).toContain("tx.delete(linkedinDailyMetrics).where(eq(linkedinDailyMetrics.campaignId, campaignId))");
    expect(storageFile).toContain('String(s?.platformContext || "").trim().toLowerCase() === "linkedin" || isLinkedInTaggedConfig(s?.mappingConfig)');
    expect(storageFile).toContain('purpose === "linkedin_revenue"');
    expect(storageFile).toContain("tx.update(hubspotConnections).set({ mappingConfig: null } as any)");
    expect(storageFile).toContain("tx.update(salesforceConnections).set({ mappingConfig: null } as any)");
    expect(storageFile).toContain("tx.update(shopifyConnections).set({ mappingConfig: null } as any)");
    expect(routesFile).toContain("await storage.deleteLinkedInCampaignAnalytics(campaignId);");
    expect(routesFile.indexOf("await storage.deleteLinkedInCampaignAnalytics(campaignId);")).toBeLessThan(
      routesFile.indexOf("const deleted = await storage.deleteLinkedInConnection(campaignId);")
    );
  });

  it("LinkedIn Pipeline Proxy is scoped to LinkedIn revenue sources only", () => {
    const clientFile = readFileSync(
      join(process.cwd(), "client", "src", "pages", "linkedin-analytics.tsx"),
      "utf-8"
    );
    const routesFile = readFileSync(
      join(process.cwd(), "server", "routes-oauth.ts"),
      "utf-8"
    );

    expect(clientFile).toContain("/pipeline-proxy?platformContext=linkedin");
    expect(clientFile).toContain("pipelineProxySource && pipelineProxyApiData?.success ? pipelineProxyApiData : pipelineProxyFallbackData");
    expect(routesFile).toContain('const requestedPlatformContext = String((req.query as any)?.platformContext || "").trim().toLowerCase();');
    expect(routesFile).toContain("for (const context of requestedContexts)");
    expect(routesFile).toContain('String(cfg?.platformContext || cfg?.platform || "").trim().toLowerCase() !== requestedPlatformContext');
  });

  it("HubSpot edit review uses the saved pipeline proxy amount before live preview", () => {
    const modalFile = readFileSync(
      join(process.cwd(), "client", "src", "components", "AddRevenueWizardModal.tsx"),
      "utf-8"
    );
    const clientFile = readFileSync(
      join(process.cwd(), "client", "src", "components", "HubSpotRevenueWizard.tsx"),
      "utf-8"
    );

    expect(modalFile).toContain("pipelineTotalToDate: Number.isFinite(Number(config?.pipelineTotalToDate)) ? Number(config.pipelineTotalToDate) : undefined,");
    expect(clientFile).toContain("const reviewPipelineProxyDisplayAmount = useMemo(() => {");
    expect(clientFile).toContain("if (mode === \"edit\" && !hasEditChanges && Number.isFinite(stored) && stored >= 0) return stored;");
    expect(clientFile).toContain("reviewPipelineProxyDisplayAmount != null");
    expect(clientFile).toContain("const [reviewDealBreakdown, setReviewDealBreakdown] = useState<ReviewDealBreakdownRow[]>([]);");
    expect(clientFile).toContain("Deal amount breakdown");
  });

  it("HubSpot preview returns bounded deal amount breakdown for review only", () => {
    const routesFile = readFileSync(
      join(process.cwd(), "server", "routes-oauth.ts"),
      "utf-8"
    );

    expect(routesFile).toContain("const MAX_CRM_REVIEW_BREAKDOWN_ROWS = 200;");
    expect(routesFile).toContain("const dealBreakdown: Array<{ id: string; name: string; campaignValue: string; amount: number; date: string | null }> = [];");
    expect(routesFile).toContain("let importedDealCount = 0;");
    expect(routesFile).toContain("if (previewOnly && dealBreakdown.length < MAX_CRM_REVIEW_BREAKDOWN_ROWS)");
    expect(routesFile).toContain("dealBreakdown,");
    expect(routesFile).toContain("dealBreakdownTruncated: importedDealCount > dealBreakdown.length,");
  });

  it("Shopify revenue supports order tags as an attribution key", () => {
    const clientFile = readFileSync(
      join(process.cwd(), "client", "src", "components", "ShopifyRevenueWizard.tsx"),
      "utf-8"
    );
    const routesFile = readFileSync(
      join(process.cwd(), "server", "routes-oauth.ts"),
      "utf-8"
    );
    const schedulerFile = readFileSync(
      join(process.cwd(), "server", "auto-refresh-scheduler.ts"),
      "utf-8"
    );

    expect(clientFile).toContain('<SelectItem value="tags">Tags</SelectItem>');
    expect(clientFile).toContain('if (campaignField === "tags") return "Tags";');
    expect(routesFile).toContain("const getShopifyOrderTags = (order: any): string[] => {");
    expect(routesFile).toContain('if (field === "tags") return getShopifyOrderTags(o)[0] || "";');
    expect(routesFile).toContain('const values = field === "tags" ? getShopifyOrderTags(o) : [getFieldValue(o).trim()].filter(Boolean);');
    expect(schedulerFile).toContain("campaignField: mappingConfig.campaignField,");
    expect(schedulerFile).toContain("async function reprocessShopify(campaignId: string, mappingConfig: AnyRecord, sourceId?: string): Promise<boolean> {");
    expect(schedulerFile).toContain("...(sourceId ? { sourceId } : {}),");
    expect(schedulerFile).toContain('String(s.sourceType || "").toLowerCase() === "shopify"');
    expect(schedulerFile).toContain("reprocessShopify(campaignId, shopCfg, String(shopifySource.id))");
  });

  it("Revenue Sources modal keeps active source definitions visible when breakdown rows exist", () => {
    const clientFile = readFileSync(
      join(process.cwd(), "client", "src", "pages", "ga4-metrics.tsx"),
      "utf-8"
    );

    expect(clientFile).toContain("const shownIds = new Set(rows.map((s: any) => String(s.sourceId || \"\")));");
    expect(clientFile).toContain("rows.push({ sourceId: d.id, sourceType: d.sourceType, displayName: d.displayName, revenue: getDefinitionRevenue(d), mappingConfig: d.mappingConfig, materializedRevenueStatus: d.materializedRevenueStatus });");
    expect(clientFile).toContain('materializedRevenueUnavailable ? "Unavailable" : formatMoney(Number(s.revenue || 0))');
  });

  it("Total Revenue source provenance is not narrowed by campaign pacing metadata", () => {
    const routesFile = readFileSync(
      join(process.cwd(), "server", "routes-oauth.ts"),
      "utf-8"
    );

    const revenueToDateStart = routesFile.indexOf('app.get("/api/campaigns/:id/revenue-to-date"');
    const revenueBreakdownStart = routesFile.indexOf('app.get("/api/campaigns/:id/revenue-breakdown"');
    const spendBreakdownStart = routesFile.indexOf('app.get("/api/campaigns/:id/spend-breakdown"');
    expect(revenueToDateStart).toBeGreaterThan(-1);
    expect(revenueBreakdownStart).toBeGreaterThan(revenueToDateStart);
    expect(spendBreakdownStart).toBeGreaterThan(revenueBreakdownStart);

    const revenueToDateRoute = routesFile.slice(revenueToDateStart, revenueBreakdownStart);
    const revenueBreakdownRoute = routesFile.slice(revenueBreakdownStart, spendBreakdownStart);
    expect(revenueToDateRoute).toContain("Budget pacing dates are campaign metadata and must not narrow platform revenue provenance.");
    expect(revenueBreakdownRoute).toContain("Budget pacing dates are campaign metadata and must not narrow platform revenue provenance.");
    expect(revenueToDateRoute).toContain('const startDate = "1900-01-01";');
    expect(revenueBreakdownRoute).toContain('const startDate = "1900-01-01";');
    expect(revenueToDateRoute).not.toContain("toISODateUTC((campaign as any)?.startDate)");
    expect(revenueBreakdownRoute).not.toContain("toISODateUTC((campaign as any)?.startDate)");
    expect(revenueToDateRoute).not.toContain("toISODateUTC((campaign as any)?.createdAt)");
    expect(revenueBreakdownRoute).not.toContain("toISODateUTC((campaign as any)?.createdAt)");
    expect(revenueToDateRoute).toContain('const endDate = new Date().toISOString().slice(0, 10);');
    expect(revenueBreakdownRoute).toContain('const endDate = new Date().toISOString().slice(0, 10);');
  });

  it("Total Spend source provenance is not narrowed by campaign pacing metadata", () => {
    const routesFile = readFileSync(
      join(process.cwd(), "server", "routes-oauth.ts"),
      "utf-8"
    );

    const spendBreakdownStart = routesFile.indexOf('app.get("/api/campaigns/:id/spend-breakdown"');
    const spendDailyStart = routesFile.indexOf('app.get("/api/campaigns/:id/spend-daily"', spendBreakdownStart);
    expect(spendBreakdownStart).toBeGreaterThan(-1);
    expect(spendDailyStart).toBeGreaterThan(spendBreakdownStart);

    const spendBreakdownRoute = routesFile.slice(spendBreakdownStart, spendDailyStart);
    expect(spendBreakdownRoute).toContain("Budget pacing dates are campaign metadata and must not narrow platform spend provenance.");
    expect(spendBreakdownRoute).toContain('const startDate = "1900-01-01";');
    expect(spendBreakdownRoute).not.toContain("toISODateUTC((campaign as any)?.startDate)");
  });

  it("Auto-refresh scheduler has source-specific spend failure logs", () => {
    const schedulerFile = readFileSync(
      join(process.cwd(), "server", "auto-refresh-scheduler.ts"),
      "utf-8"
    );

    expect(schedulerFile).toContain("Google Sheets spend reprocess failed");
    expect(schedulerFile).toContain("LinkedIn spend reprocess failed");
    expect(schedulerFile).toContain('displayName.includes("Google Ads") ? "Google Ads" : displayName.includes("Meta") ? "Meta" : "Ad platform"');
    expect(schedulerFile).toContain("${provider} spend reprocess failed");
  });

  it("Salesforce refresh updates the saved revenue source instead of creating duplicates", () => {
    const schedulerFile = readFileSync(
      join(process.cwd(), "server", "auto-refresh-scheduler.ts"),
      "utf-8"
    );
    const rateLimiterFile = readFileSync(
      join(process.cwd(), "server", "middleware", "rateLimiter.ts"),
      "utf-8"
    );

    expect(schedulerFile).toContain("async function reprocessSalesforce(campaignId: string, mappingConfig: AnyRecord, sourceId?: string): Promise<boolean> {");
    expect(schedulerFile).toContain("dateField: mappingConfig.dateField,");
    expect(schedulerFile).toContain("...(sourceId ? { sourceId } : {}),");
    expect(schedulerFile).toContain('String(s.sourceType || "").toLowerCase() === "salesforce"');
    expect(schedulerFile).toContain("reprocessSalesforce(campaignId, sfCfg, String(salesforceSource.id))");
    expect(rateLimiterFile).toContain("isInternalAutoRefreshRequest(req)");
  });

  it("Salesforce review preview and persisted source metadata use the selected date field", () => {
    const clientFile = readFileSync(
      join(process.cwd(), "client", "src", "components", "SalesforceRevenueWizard.tsx"),
      "utf-8"
    );
    const modalFile = readFileSync(
      join(process.cwd(), "client", "src", "components", "AddRevenueWizardModal.tsx"),
      "utf-8"
    );
    const routesFile = readFileSync(
      join(process.cwd(), "server", "routes-oauth.ts"),
      "utf-8"
    );
    const schedulerFile = readFileSync(
      join(process.cwd(), "server", "auto-refresh-scheduler.ts"),
      "utf-8"
    );

    expect(clientFile).toContain("dateField,");
    expect(clientFile).toContain("setDateField((cfg as any).dateField ? String((cfg as any).dateField) : \"CloseDate\");");
    expect(clientFile).toContain("setPreviewTotalRevenue(null);");
    expect(clientFile).toContain("setPreviewKey(null);");
    expect(modalFile).toContain("lastTotalRevenue: initialSource?.revenue != null && Number.isFinite(Number(initialSource.revenue)) ? Number(initialSource.revenue)");
    expect(clientFile).toContain("const hasCurrentPreview = previewKey === reviewPreviewKey;");
    expect(clientFile).toContain("if (hasCurrentPreview && Number.isFinite(Number(previewTotalRevenue))) return Number(previewTotalRevenue);");
    expect(clientFile).toContain("Math.abs(currentPreviewTotal - storedTotal) >= 0.01");
    expect(routesFile).toContain('const dateFieldChoice = ["CloseDate", "CreatedDate", "LastModifiedDate"].includes');
    expect(routesFile).toContain("const wonClause = `(IsWon = true OR StageName LIKE 'Closed Won%')`;");
    expect(routesFile).toContain("`WHERE ${wonClause} AND ${dateFieldChoice} = LAST_N_DAYS:${rangeDays} AND ${attribField} IN (${quoted}) `");
    expect(routesFile).toContain("totalRevenue: Number(totalRevenue.toFixed(2)),");
    expect(routesFile).toContain("materializedRecordCount,");
    expect(routesFile).toContain("materializedDates,");
    expect(routesFile).toContain("unmatchedSelectedValues,");
    expect(routesFile).toContain("unmatchedSelectedDiagnostics,");
    expect(schedulerFile).toContain("Salesforce reprocess complete for campaign");
    expect(schedulerFile).toContain("unmatchedSelectedValues=");
    expect(schedulerFile).toContain("if (unmatchedSelectedValues.length > 0)");
    expect(schedulerFile).toContain("Salesforce unmatched diagnostics for campaign");
    expect(routesFile).toContain("Salesforce revenue was fetched but no daily revenue records were materialized.");
    expect(schedulerFile).toContain("[Auto Refresh] Salesforce reprocess produced no materialized revenue records");
    expect(routesFile).toContain("dateField: dateFieldChoice,");
    expect(routesFile).toContain('dailyMaterialization: platformCtx === "ga4" && revenueByDate.size > 0 ? "selected_date_field_v1" : null,');
  });

  it("spend-daily endpoints use strict daily records rather than source-type exclusions", () => {
    const routesFile = readFileSync(
      join(process.cwd(), "server", "routes-oauth.ts"),
      "utf-8"
    );

    expect(routesFile).toContain("const isEligibleForLatestDaySpend = (source: any): boolean => {");
    expect(routesFile).toContain("if (!source) return false;");
    expect(routesFile).toContain("if (cfg?.testMode === true) return false;");
    expect(routesFile).toContain("return true;");
    expect(routesFile).toContain('isEligibleForLatestDaySpend(source)');
    expect(routesFile).toContain('storage.getSpendBreakdownBySource(campaignId, date, date)');
  });
});
