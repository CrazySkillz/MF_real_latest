import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("Latest Day Revenue regression guard", () => {
  it("GA4 Overview uses the previous day for latest-day revenue", () => {
    const clientFile = readFileSync(
      join(process.cwd(), "client", "src", "pages", "ga4-metrics.tsx"),
      "utf-8"
    );

    expect(clientFile).toContain('queryKey: [`/api/campaigns/${campaignId}/revenue-daily`, "latest"]');
    expect(clientFile).toContain('fetch(`/api/campaigns/${campaignId}/revenue-daily`, { credentials: "include" })');
    expect(clientFile).toContain('throw new Error("Failed to fetch latest-day revenue")');
    expect(clientFile).toContain("Latest Day Revenue uses imported daily revenue records for the server-selected previous complete UTC day.");
    expect(clientFile).toContain("const latestDayRevenue = Number(revenueDailyResp?.totalRevenue || 0);");
    expect(clientFile).toContain("formatMoney(Number(revenueDailyResp?.totalRevenue || 0))");
    expect(clientFile).toContain('queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/revenue-daily`], exact: false });');
    expect(clientFile).toContain('queryClient.refetchQueries({ queryKey: [`/api/campaigns/${campaignId}/revenue-daily`], exact: false });');
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
    expect(routesFile).toContain('const revenueDate = normalizeDate(props?.[dateFieldChoice]);');
    expect(routesFile).toContain('if (/^\\d{10,13}$/.test(s)) {');
    expect(routesFile).toContain('dailyMaterialization: platformCtx === "ga4" && revenueByCloseDate.size > 0 ? "selected_date_field_v1" : null,');
    expect(routesFile).toContain('if (platformCtx === "ga4" && revenueByCloseDate.size > 0) {');
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
    expect(routesFile).toContain("if ((!accessToken || shouldRefresh) && conn.refreshToken) {");
    expect(routesFile).toContain("accessToken = await refreshHubspotToken(conn);");
    expect(routesFile).toContain("HubSpot access token missing and no refresh token available. Please reconnect HubSpot.");
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
  });

  it("Revenue Sources modal keeps active source definitions visible when breakdown rows exist", () => {
    const clientFile = readFileSync(
      join(process.cwd(), "client", "src", "pages", "ga4-metrics.tsx"),
      "utf-8"
    );

    expect(clientFile).toContain("const shownIds = new Set(rows.map((s: any) => String(s.sourceId || \"\")));");
    expect(clientFile).toContain("rows.push({ sourceId: d.id, sourceType: d.sourceType, displayName: d.displayName, revenue: 0, mappingConfig: d.mappingConfig });");
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
