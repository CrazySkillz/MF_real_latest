import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROUTES_FILE = join(__dirname, "routes-oauth.ts");
const AUTO_REFRESH_SCHEDULER_FILE = join(__dirname, "auto-refresh-scheduler.ts");
const SHOPIFY_WIZARD_FILE = join(__dirname, "..", "client", "src", "components", "ShopifyRevenueWizard.tsx");
const GA4_METRICS_FILE = join(__dirname, "..", "client", "src", "pages", "ga4-metrics.tsx");
const LINKEDIN_ANALYTICS_FILE = join(__dirname, "..", "client", "src", "pages", "linkedin-analytics.tsx");
const REVENUE_MODAL_FILE = join(__dirname, "..", "client", "src", "components", "AddRevenueWizardModal.tsx");
const LINKEDIN_REVENUE_FILE = join(__dirname, "utils", "linkedin-revenue.ts");
const KPI_REFRESH_FILE = join(__dirname, "utils", "kpi-refresh.ts");
const GA4_SCHEDULED_REPORT_PDF_FILE = join(__dirname, "ga4-scheduled-report-pdf.ts");
const GA4_KPI_BENCHMARK_JOBS_FILE = join(__dirname, "ga4-kpi-benchmark-jobs.ts");

function read(file: string): string {
  return readFileSync(file, "utf-8").replace(/\r\n/g, "\n");
}

function routeSection(content: string, start: string, end: string): string {
  const startIndex = content.indexOf(start);
  expect(startIndex).toBeGreaterThan(-1);
  const endIndex = content.indexOf(end, startIndex);
  expect(endIndex).toBeGreaterThan(startIndex);
  return content.slice(startIndex, endIndex);
}

describe("Shopify revenue regression guard", () => {
  it("preserves stable source identity through Shopify revenue edit mode", () => {
    const modal = read(REVENUE_MODAL_FILE);
    const wizard = read(SHOPIFY_WIZARD_FILE);
    const routes = read(ROUTES_FILE);

    expect(modal).toContain('sourceId={isEditing && String(initialSource?.sourceType || "").toLowerCase() === "shopify" ? String(initialSource?.id || "") : undefined}');
    expect(wizard).toContain('sourceId?: string;');
    expect(wizard).toContain('const editSourceId = mode === "edit" ? String(sourceId || initialMappingConfig?.sourceId || "").trim() : "";');
    expect(wizard).toContain("...(editSourceId ? { sourceId: editSourceId } : {})");
    expect(routes).toContain('sourceId: z.string().trim().optional()');
    expect(routes).toContain('if (requestedSourceId) return String((s as any).id || "") === requestedSourceId;');
    expect(routes).toContain('if (requestedSourceId && !existingShopify) {');
    const saveRoute = routeSection(
      routes,
      'app.post("/api/campaigns/:id/shopify/save-mappings"',
      'app.post("/api/campaigns/:id/chat"',
    );
    expect(saveRoute.indexOf("const existingSources = await storage.getRevenueSources(campaignId, platformCtx as any)")).toBeLessThan(
      saveRoute.indexOf("await storage.updateShopifyConnection")
    );
  });

  it("shows Shopify as connected when an active scoped Shopify revenue source exists", () => {
    const modal = read(REVENUE_MODAL_FILE);

    expect(modal).toContain('crmStatus.shopify || crmHasSource.shopify ? (');
    expect(modal).toContain('crmStatus.shopify || crmHasSource.shopify ? "Attribute order revenue to this campaign." : "Connect Shopify to import order revenue."');
  });

  it("deletes Shopify revenue through the scoped GA4 Overview source route", () => {
    const ga4Metrics = read(GA4_METRICS_FILE);
    const routes = read(ROUTES_FILE);
    const deleteRoute = routeSection(
      routes,
      'app.delete("/api/campaigns/:id/revenue-sources/:sourceId"',
      "// Individual spend source delete",
    );

    expect(ga4Metrics).toContain('fetch(`/api/campaigns/${campaignId}/revenue-sources/${deletingRevenueSourceId}?platformContext=ga4`, { method: "DELETE", credentials: "include" })');
    expect(deleteRoute).toContain("const ok = await ensureCampaignAccess(req as any, res as any, campaignId);");
    expect(deleteRoute).toContain("const source = await storage.getRevenueSource(campaignId, sourceId);");
    expect(deleteRoute).toContain("sourcePlatformContext.toLowerCase() !== requestedPlatformContext");
    expect(deleteRoute.indexOf("await storage.deleteRevenueSource(sourceId);")).toBeGreaterThan(
      deleteRoute.indexOf("const source = await storage.getRevenueSource(campaignId, sourceId);")
    );
    expect(deleteRoute.indexOf("await storage.deleteRevenueRecordsBySource(sourceId);")).toBeGreaterThan(
      deleteRoute.indexOf("const source = await storage.getRevenueSource(campaignId, sourceId);")
    );
    expect(deleteRoute).toContain("await recomputeCampaignDerivedValues(campaignId, { platformContext: sourcePlatformContext });");
  });

  it("includes TikTok scoped revenue sources in the source picker inventory", () => {
    const routes = read(ROUTES_FILE);

    expect(routes).toContain("storage.getRevenueSources(campaignId, 'tiktok')");
    expect(routes).toContain("...tiktokRev.map((s: any) => ({ ...s, platformContext: 'tiktok' }))");
  });

  it("traces Shopify refresh applicability to scheduler only", () => {
    const ga4Metrics = read(GA4_METRICS_FILE);
    const routes = read(ROUTES_FILE);
    const scheduler = read(AUTO_REFRESH_SCHEDULER_FILE);

    expect(routes).not.toContain('shopify-refresh/run-now');
    expect(routes).not.toContain('shopify-reprocess/run-now');
    expect(routes).not.toContain('app.post("/api/campaigns/:id/revenue-sources/:sourceId/shopify');
    expect(ga4Metrics).not.toContain('shopify-refresh/run-now');
    expect(ga4Metrics).not.toContain('shopify-reprocess/run-now');
    expect(scheduler).toContain('async function reprocessShopify(campaignId: string, mappingConfig: AnyRecord, sourceId?: string): Promise<boolean>');
    expect(scheduler).toContain('String(s.sourceType || "").toLowerCase() === "shopify"');
    expect(scheduler).toContain('const shopCfg = shopCfgRaw ? { ...shopCfgRaw, platformContext: shopCfgRaw.platformContext || shopifySource.platformContext || ctx } : null;');
    expect(scheduler).toContain('reprocessShopify(campaignId, shopCfg, String(shopifySource.id))');
    expect(scheduler).toContain('const result = await postJson(`/api/campaigns/${encodeURIComponent(campaignId)}/shopify/save-mappings`, body);');
    expect(scheduler).toContain('if (isStaleRevenueSourceReprocess(result)) {');
  });

  it("keeps Shopify GA4 downstream consumers on source-backed revenue after source changes", () => {
    const modal = read(REVENUE_MODAL_FILE);
    const ga4Metrics = read(GA4_METRICS_FILE);
    const routes = read(ROUTES_FILE);
    const reportPdf = read(GA4_SCHEDULED_REPORT_PDF_FILE);
    const kpiBenchmarkJobs = read(GA4_KPI_BENCHMARK_JOBS_FILE);

    const modalDownstreamBlock = routeSection(
      modal,
      "// GA4 downstream caches consume source-backed revenue for KPI, Benchmark, Report, and alert values.",
      "// Best-effort immediate refresh"
    );
    expect(modalDownstreamBlock).toContain('["/api/platforms/google_analytics/benchmarks", String(campaignId || "")]');
    expect(modalDownstreamBlock).toContain('["/api/platforms/google_analytics/reports", campaignId]');
    expect(modalDownstreamBlock).toContain('["/api/notifications"]');

    const ga4AddRevenueBlock = routeSection(
      ga4Metrics,
      "<AddRevenueWizardModal",
      "<Dialog open={showRevenueSourcesDialog}"
    );
    const ga4DeleteRevenueBlock = routeSection(
      ga4Metrics,
      'fetch(`/api/campaigns/${campaignId}/revenue-sources/${deletingRevenueSourceId}?platformContext=ga4`',
      'toast({ title: "Revenue source removed"'
    );
    for (const block of [ga4AddRevenueBlock, ga4DeleteRevenueBlock]) {
      expect(block).toContain('[`/api/platforms/google_analytics/kpis`, campaignId]');
      expect(block).toContain('[`/api/platforms/google_analytics/benchmarks`, String(campaignId || "")]');
      expect(block).toContain('["/api/platforms/google_analytics/reports", campaignId]');
      expect(block).toContain("void refreshNotificationQueries();");
    }

    expect(reportPdf).toContain("const importedRevenueForFinancials = Number(revenueBreakdown.reduce");
    expect(reportPdf).toContain("const financialRevenue = Number((ga4RevenueForFinancials + importedRevenueForFinancials).toFixed(2));");
    expect(reportPdf).toContain('["Total Revenue", formatMoney(payload.financialRevenue)]');
    expect(kpiBenchmarkJobs).toContain('getRevenueTotalForRange(campaignId, financialSourceWindow.startDate, financialSourceWindow.endDate, "ga4")');
    expect(kpiBenchmarkJobs).toContain("const inputsForMetric = (metric: string) => isGA4FinancialKpiMetric(metric) ? financialInputs : inputs;");
    expect(routes).toContain('const importedRevenue = await storage.getRevenueTotalForRange(campaignId, financialWindow.startDate, financialWindow.endDate, "ga4")');
    expect(routes).toContain("const kpiInputs = usesGA4FinancialSource ? ga4FinancialInputs : ga4Inputs;");
  });

  it("does not silently truncate Shopify order pagination", () => {
    const routes = read(ROUTES_FILE);

    expect(routes).toContain("const { shopDomain, accessToken, apiVersion, createdAtMin, maxPages = 1000 } = args;");
    expect(routes).toContain("const seenUrls = new Set<string>();");
    expect(routes).toContain("if (nextUrl) {");
    expect(routes).toContain("Shopify orders pagination limit exceeded");
  });

  it("uses paginated Shopify order reads when saving revenue mappings", () => {
    const routes = read(ROUTES_FILE);
    const saveRoute = routeSection(
      routes,
      'app.post("/api/campaigns/:id/shopify/save-mappings"',
      'app.post("/api/campaigns/:id/chat"',
    );

    expect(saveRoute).toContain("const orders = await shopifyFetchAllOrders({");
    expect(saveRoute).toContain("apiVersion,");
    expect(saveRoute).toContain("createdAtMin,");
    expect(saveRoute).not.toContain("const ordersResp = await shopifyApiFetch({");
    expect(saveRoute).not.toContain("const orders: any[] = Array.isArray(ordersResp?.orders)");
  });

  it("fails closed when Shopify revenue record materialization fails", () => {
    const routes = read(ROUTES_FILE);
    const saveRoute = routeSection(
      routes,
      'app.post("/api/campaigns/:id/shopify/save-mappings"',
      'app.post("/api/campaigns/:id/chat"',
    );
    const catchStart = saveRoute.indexOf('console.warn("[Shopify Save Mappings] Failed to materialize revenue records:", e);');
    expect(catchStart).toBeGreaterThan(-1);
    const catchBlock = saveRoute.slice(catchStart, saveRoute.indexOf("// Ensure KPIs/alerts", catchStart));

    expect(catchBlock).toContain("return res.status(500).json({");
    expect(catchBlock).toContain("success: false");
    expect(catchBlock).toContain("Failed to materialize Shopify revenue records");
  });

  it("infers missing Shopify auth type without overriding saved auth type", () => {
    const routes = read(ROUTES_FILE);

    expect(routes).toContain("if (connected && !authType) {");
    expect(routes).toContain("/oauth/access_scopes.json");
    expect(routes).toContain('authType = "oauth";');
    expect(routes).toContain('authType = "token";');
  });

  it("starts new Shopify revenue connections from a clean OAuth-first state", () => {
    const wizard = read(SHOPIFY_WIZARD_FILE);

    expect(wizard).toContain('if (mode !== "edit") return "";');
    expect(wizard).toContain("const fetchStatus = async (applyExistingConnection = true) =>");
    expect(wizard).toContain('await fetchStatus(mode === "edit");');
    expect(wizard).toContain('setConnectMethod("oauth");');
    expect(wizard).not.toContain("Shopify doesn’t store LinkedIn campaign ids directly by default");
  });

  it("keeps users in OAuth when Shopify OAuth redirect is not configured", () => {
    const wizard = read(SHOPIFY_WIZARD_FILE);

    expect(wizard).toContain('json?.code === "SHOPIFY_OAUTH_REDIRECT_NOT_CONFIGURED"');
    expect(wizard).toContain("Shopify OAuth setup is incomplete");
    expect(wizard).toContain("Configure the Shopify app callback URL before connecting with OAuth.");
  });

  it("does not switch Shopify OAuth users to token mode when order reads are blocked", () => {
    const wizard = read(SHOPIFY_WIZARD_FILE);

    expect(wizard).toContain('json?.code === "SHOPIFY_PROTECTED_CUSTOMER_DATA_APPROVAL_REQUIRED"');
    expect(wizard).toContain("Shopify connected, but this OAuth app is not approved for protected customer data needed to read orders.");
    expect(wizard).not.toContain('if (connectMethod !== "token") setConnectMethod("token");');
  });

  it("uses clickable Shopify value rows as the crosswalk source of truth", () => {
    const wizard = read(SHOPIFY_WIZARD_FILE);

    expect(wizard).toContain('role="button"');
    expect(wizard).toContain('(step === "crosswalk" && selectedValues.length === 0)');
    expect(wizard).not.toContain("Map each Shopify value to a LinkedIn campaign. Unmapped values will be skipped.");
    expect(wizard).not.toContain('value={existing?.linkedinCampaignUrn || "__none__"}');
  });

  it("keeps Shopify revenue-to-date from being multiplied by LinkedIn conversions", () => {
    const routes = read(ROUTES_FILE);
    const linkedinRevenue = read(LINKEDIN_REVENUE_FILE);

    expect(routes).not.toContain("[Shopify Save Mappings] Persisted conversion value to LinkedIn connection");
    expect(routes).not.toContain("Also update the LinkedIn connection's conversionValue");
    expect(linkedinRevenue).toContain("const shouldIgnoreStoredConversionValue");
    expect(linkedinRevenue).toContain("importedRevenueToDate > 0 && !hasExplicitLinkedInConversionValueSource");
    expect(linkedinRevenue).toContain("if (shouldIgnoreStoredConversionValue) connCv = 0;");
    expect(linkedinRevenue).toContain("const sessionCv = shouldIgnoreStoredConversionValue ? 0 : sessionCvRaw;");
  });

  it("uses campaign total revenue before conversion value in LinkedIn dependent tabs", () => {
    const routes = read(ROUTES_FILE);
    const kpiRefresh = read(KPI_REFRESH_FILE);

    expect(routes).toContain("if (totalRevenueAll > 0 && totalConversionsAll > 0) return totalRevenueAll * (conv / totalConversionsAll);\n          if (conversionValueUsed > 0) return conv * conversionValueUsed;");
    expect(routes).toContain("if (totalRevenueAll > 0 && totalConversionsAll > 0) return totalRevenueAll * (conv / totalConversionsAll);\n        if (conversionValueUsed > 0) return conv * conversionValueUsed;");
    expect(routes).toContain("if (totalRevenueAll > 0 && totalAdConversions > 0) return totalRevenueAll * (conversions / totalAdConversions);\n        if (conversionValue > 0) return conversions * conversionValue;");
    expect(kpiRefresh).toContain("if (totalRevenueAll > 0 && totalConversionsOverall > 0) return totalRevenueAll * (c / totalConversionsOverall);\n      if (conversionValueUsed > 0) return c * conversionValueUsed;");
  });

  it("allocates LinkedIn ad revenue in cents so ad totals match campaign total revenue", () => {
    const routes = read(ROUTES_FILE);

    expect(routes).toContain("const allocatedAdRevenue = (() => {");
    expect(routes).toContain("const totalCents = Math.round(totalRevenueAll * 100);");
    expect(routes).toContain("let remaining = totalCents - rows.reduce((sum, row) => sum + row.cents, 0);");
    expect(routes).toContain("if (allocatedAdRevenue.length > 0) return allocatedAdRevenue[index] || 0;");
  });

  it("shows Shopify review revenue breakdown by selected campaign value", () => {
    const routes = read(ROUTES_FILE);
    const wizard = read(SHOPIFY_WIZARD_FILE);

    expect(routes).toContain("const campaignValueOrderCounts = new Map<string, number>();");
    expect(routes).toContain("campaignValueOrderCounts.set(v, (campaignValueOrderCounts.get(v) || 0) + 1);");
    expect(routes).toContain("campaignValueRevenueTotals: Array.from(campaignValueRevenueTotals.entries()).map");
    expect(routes).toContain("orderCount: campaignValueOrderCounts.get(campaignValue) || 0");
    expect(wizard).toContain("preview?.campaignValueRevenueTotals");
    expect(wizard).toContain("Revenue breakdown");
    expect(wizard).not.toContain('order${Number(row.orderCount) === 1 ? "" : "s"}');
  });

  it("uses exact mapped revenue in the LinkedIn campaign breakdown", () => {
    const routes = read(ROUTES_FILE);
    const linkedinAnalytics = read(LINKEDIN_ANALYTICS_FILE);

    expect(routes).toContain("const campaignValueRevenueByValue = new Map<string, number>();");
    expect(routes).toContain("campaignValueRevenueByValue.get(crmValue)");
    expect(linkedinAnalytics).toContain("const linkedinCampaignRevenueByUrn = useMemo");
    expect(linkedinAnalytics).toContain("Array.isArray(rawBreakdown)");
    expect(linkedinAnalytics).toContain("const mappedCampaignRevenue = campaign.urn ? linkedinCampaignRevenueByUrn[campaign.urn] : undefined;");
  });
});
