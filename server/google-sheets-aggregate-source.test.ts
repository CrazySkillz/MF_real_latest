import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { buildGoogleSheetsPlatformSourceForAggregate } from "./utils/google-sheets-aggregate-source";

const readSource = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), "utf-8");

const sliceBetween = (source: string, startNeedle: string, endNeedle: string) => {
  const start = source.indexOf(startNeedle);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = source.indexOf(endNeedle, start);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
};

describe("Google Sheets aggregate source adapter", () => {
  it("builds one main Google Sheets source from active general connections only", () => {
    const source = buildGoogleSheetsPlatformSourceForAggregate(
      { platform: "Meta, Google Sheets" },
      [
        {
          id: "main-sheet",
          spreadsheetId: "sheet-main",
          spreadsheetName: "Main Sheet",
          sheetName: "Performance",
          purpose: "general",
          isActive: true,
          columnMappings: JSON.stringify([
            { targetFieldId: "clicks", sourceColumnIndex: 1 },
            { targetFieldId: "conversions", sourceColumnIndex: 2 },
            { targetFieldId: "revenue", sourceColumnIndex: 3 },
          ]),
          cachedData: {
            rows: [
              ["Campaign A", "10", "2", "1000"],
              ["Campaign B", "5", "3", "500"],
            ],
          },
          lastDataRefreshAt: "2026-06-01T12:00:00.000Z",
        },
        {
          id: "child-sheet",
          spreadsheetId: "sheet-child",
          spreadsheetName: "Child Revenue Sheet",
          purpose: "meta_revenue",
          isActive: true,
          columnMappings: JSON.stringify([{ targetFieldId: "clicks", sourceColumnIndex: 1 }]),
          cachedData: { rows: [["Campaign A", "999"]] },
        },
      ],
    ) as any;

    expect(source).toBeTruthy();
    expect(source.id).toBe("google_sheets");
    expect(source.label).toBe("Google Sheets");
    expect(source.category).toBe("custom");
    expect(source.freshness.connectionIds).toEqual(["main-sheet"]);
    expect(source.includedMetrics).toEqual(["clicks", "conversions"]);
    expect(source.metrics.clicks).toBe(15);
    expect(source.metrics.conversions).toBe(5);
    expect(source.metrics.revenue).toBeNull();
    expect(source.excludedMetrics).toContainEqual({
      metric: "revenue",
      reason: "Google Sheets confirmed revenue requires an active google_sheets-scoped revenue source",
    });
  });

  it("does not build a source when Google Sheets is only a child financial source", () => {
    const source = buildGoogleSheetsPlatformSourceForAggregate(
      { platform: "Meta" },
      [
        {
          id: "child-sheet",
          spreadsheetId: "sheet-child",
          purpose: "meta_revenue",
          isActive: true,
          cachedData: { rows: [["Campaign A", "999"]] },
        },
      ],
    );

    expect(source).toBeNull();
  });

  it("renders Google Sheets financial cards from scoped confirmed sources and CRM Pipeline Proxy only", () => {
    const page = readSource("client", "src", "pages", "google-sheets-data.tsx");

    expect(page).toContain("renderGoogleSheetsFinancialCards");
    expect(page).toContain("Total Revenue");
    expect(page).toContain("Total Spend");
    expect(page).toContain("Pipeline Proxy");
    expect(page).toContain("ROAS");
    expect(page).toContain("ROI");
    expect(page).toContain("renderGoogleSheetsCampaignScopeCard");
    expect(page).toContain("Selected Campaigns");
    expect(page).toContain("googleSheetsCampaignScopeValues");
    expect(page).toContain("cfg?.campaignDisplayName");
    expect(page).toContain("addValues(cfg?.campaignValues)");
    expect(page).toContain("addValues(cfg?.selectedValues)");
    expect(page).toContain("cfg?.campaignValueRevenueTotals");
    expect(page).not.toContain("sheetsData?.matchingInfo?.matchedCampaigns");
    expect(page).not.toContain("sheetsData?.matchingInfo?.campaignName");
    expect(page).toContain("Google Sheets metrics are scoped to these selected campaign values.");
    expect(page).toContain("AddSpendWizardModal");
    expect(page).toContain('platformContext="google_sheets"');
    expect(page).not.toContain('initialStep="sheets_choose"');
    expect(page).not.toContain("lockInitialStep");
    expect(page).toContain("Add spend source");
    expect(page).toContain("Google Sheets Spend Sources");
    expect(page).toContain("Sources contributing to Google Sheets Total Spend.");
    expect(page).toContain("setSpendWizardInitialSource");
    expect(page).toContain("deleteGoogleSheetsSpendSourceMutation");
    expect(page).toContain("/spend-totals?platformContext=google_sheets&dateRange=all");
    expect(page).toContain("/pipeline-proxy?platformContext=google_sheets");
    expect(page).toContain("googleSheetsFinancialCardsInitialLoading");
    expect(page).toContain("googleSheetsPipelineProxyInitialLoading");
    expect(page).toContain("renderGoogleSheetsCardValuePlaceholder()");
    expect(page).toContain("!googleSheetsFinancialCardsInitialLoading && activeGoogleSheetsRevenueSources.length > 0");
    expect(page).toContain("!googleSheetsFinancialCardsInitialLoading && activeGoogleSheetsSpendSources.length > 0");
    expect(page).toContain("!googleSheetsPipelineProxyInitialLoading && googleSheetsPipelineProxySourceEntries.length > 0");
    expect(page).toContain('String(googleSheetsRevenueCurrency || "").toUpperCase() === "USD"');
    expect(page).toContain("return `$${safeValue.toLocaleString");
    expect(page).toContain("Open CRM value only. Not counted in Total Revenue, ROI, or ROAS.");
    expect(page).toContain("Requires confirmed revenue and spend");
  });

  it("keeps Google Sheets Insights scoped to spreadsheet-generated insights", () => {
    const page = readSource("client", "src", "pages", "google-sheets-data.tsx");
    const insightsTab = sliceBetween(page, "INSIGHTS TAB", "REPORTS TAB");

    expect(insightsTab).toContain("sheetsData.insights.topPerformers");
    expect(insightsTab).toContain("sheetsData.insights.recommendations");
    expect(insightsTab).not.toContain("Goal Impact");
    expect(insightsTab).not.toContain("visibleGoogleSheetsKpisData");
    expect(insightsTab).not.toContain("visibleGoogleSheetsBenchmarksData");
  });

  it("uses metric direction for Google Sheets Performance and recommendation insights", () => {
    const routes = readSource("server", "routes-oauth.ts");
    const generator = sliceBetween(routes, "function generateInsights(", "// Google Trends API endpoint");

    expect(generator).toContain("const lowerIsBetter =");
    expect(generator).toContain("const neutralCostMetric =");
    expect(generator).toContain("return lowerIsBetter ? aValue - bValue : bValue - aValue;");
    expect(generator).toContain("return lowerIsBetter ? bValue - aValue : aValue - bValue;");
    expect(generator).toContain("!neutralCostMetric");
    expect(generator).toContain("most efficient segment");
    expect(generator).toContain("verify whether the change was planned");
    expect(generator).toContain("trend.adverseTrend");
  });

  it("filters Google Sheets spend totals by google_sheets platformContext for derived financial cards", () => {
    const routes = readSource("server", "routes-oauth.ts");
    const spendTotalsRoute = sliceBetween(
      routes,
      'app.get("/api/campaigns/:id/spend-totals"',
      '// Spend-to-date (campaign lifetime)'
    );

    expect(spendTotalsRoute).toContain('platformContext === "google_sheets"');
    expect(spendTotalsRoute).toContain('String(source?.platformContext || "").trim().toLowerCase() === "google_sheets"');
    expect(spendTotalsRoute).toContain("eligibleSourceIds.has");
    expect(spendTotalsRoute).toContain("totalSpend: Number(totalSpend.toFixed(2))");
    expect(spendTotalsRoute).toContain("sourcesWithDetails");
    expect(spendTotalsRoute).toContain("mappingConfig");
    expect(spendTotalsRoute).toContain("sources: sourcesWithDetails");
  });

  it("persists Google Sheets spend imports with google_sheets platformContext for ROAS and ROI unlocks", () => {
    const modal = readSource("client", "src", "components", "AddSpendWizardModal.tsx");
    expect(modal).toContain("platformContext?: SpendPlatformContext");
    expect(modal).toContain("initialStep?: Step");
    expect(modal).toContain("lockInitialStep?: boolean");
    expect((modal.match(/platformContext: props\.platformContext/g) || []).length).toBeGreaterThanOrEqual(5);
    expect(modal).toContain("fd.append(\"mapping\", JSON.stringify(mapping))");
    expect(modal).toContain("body: JSON.stringify({");

    const routes = readSource("server", "routes-oauth.ts");
    const sheetsSpendRoute = sliceBetween(
      routes,
      'app.post("/api/campaigns/:id/spend/sheets/process"',
      "// ---------------------------------------------------------------------------"
    );

    expect(sheetsSpendRoute).toContain("requestedPlatformContext");
    expect(sheetsSpendRoute).toContain('requestedPlatformContext !== "google_sheets"');
    expect(sheetsSpendRoute).toContain("platformContext: platformContext || null");
    expect(sheetsSpendRoute).toContain('String((s as any).platformContext || "").trim().toLowerCase() !== platformContext');

    const csvSpendRoute = sliceBetween(
      routes,
      'app.post("/api/campaigns/:id/spend/csv/process"',
      'app.post("/api/campaigns/:id/spend/sheets/preview"'
    );
    expect(csvSpendRoute).toContain("requestedPlatformContext");
    expect(csvSpendRoute).toContain('requestedPlatformContext !== "google_sheets"');
    expect(csvSpendRoute).toContain("platformContext: platformContext || null");
    expect(csvSpendRoute).toContain('String((existingSource as any)?.platformContext || "").trim().toLowerCase() !== platformContext');

    const linkedInSpendRoute = sliceBetween(
      routes,
      'app.post("/api/campaigns/:id/spend/linkedin/process"',
      "// ============================================================================"
    );
    expect(linkedInSpendRoute).toContain("requestedPlatformContext");
    expect(linkedInSpendRoute).toContain('requestedPlatformContext !== "google_sheets"');
    expect(linkedInSpendRoute).toContain("platformContext: platformContext || null");
    expect(linkedInSpendRoute).toContain('String((s as any).platformContext || "").trim().toLowerCase() !== platformContext');
  });

  it("keeps Google Sheets campaign display labels separate from source values", () => {
    const page = readSource("client", "src", "pages", "google-sheets-data.tsx");
    const revenueModal = readSource("client", "src", "components", "AddRevenueWizardModal.tsx");
    const spendModal = readSource("client", "src", "components", "AddSpendWizardModal.tsx");
    const hubspotWizard = readSource("client", "src", "components", "HubSpotRevenueWizard.tsx");
    const salesforceWizard = readSource("client", "src", "components", "SalesforceRevenueWizard.tsx");
    const shopifyWizard = readSource("client", "src", "components", "ShopifyRevenueWizard.tsx");
    const routes = readSource("server", "routes-oauth.ts");

    expect(page).toContain('const displayName = String(cfg?.campaignDisplayName || "").trim();');
    expect(page).toContain("addValue(displayName);");
    expect(page).toContain("addValues(cfg?.campaignValues);");
    expect(revenueModal).toContain("campaignDisplayName: hasCampaignScope ? (sheetsCampaignDisplayName.trim() || null) : null");
    expect(revenueModal).toContain("campaignDisplayName: csvCampaignValues.length > 0 ? (csvCampaignDisplayName.trim() || null) : null");
    expect((spendModal.match(/campaignDisplayName: hasCampaignScope \? \(campaignDisplayName\.trim\(\) \|\| null\) : null/g) || []).length).toBeGreaterThanOrEqual(2);
    expect(hubspotWizard).toContain("campaignDisplayName: selectedValues.length > 0 ? (campaignDisplayName.trim() || null) : null");
    expect(salesforceWizard).toContain("campaignDisplayName: selectedValues.length > 0 ? (campaignDisplayName.trim() || null) : null");
    expect(shopifyWizard).toContain("campaignDisplayName: selectedValues.length > 0 ? (campaignDisplayName.trim() || null) : null");
    expect((routes.match(/\.\.\.\(campaignDisplayName \? \{ campaignDisplayName \} : \{\}\)/g) || []).length).toBeGreaterThanOrEqual(8);
    expect(revenueModal).toContain("Selected Campaigns label");
    expect(spendModal).toContain("Selected Campaigns label");
    expect(spendModal).toContain('(step === "csv_map" || step === "sheets_map") && campaignKeyValues.length > 0');
  });

  it("opens Google Sheets add-source modals without prefilled create data", () => {
    const page = readSource("client", "src", "pages", "google-sheets-data.tsx");
    const revenueModal = readSource("client", "src", "components", "AddRevenueWizardModal.tsx");
    const spendModal = readSource("client", "src", "components", "AddSpendWizardModal.tsx");

    expect(page).toContain("setRevenueWizardInitialSource(null);");
    expect(page).toContain("setSpendWizardInitialSource(null);");
    expect(revenueModal).toContain("if (open && initialSource) return;");
    expect(revenueModal).toContain('const shouldAutoSelectExistingSheet = isEditing || (platformContext !== "google_sheets" && platformContext !== "tiktok");');
    expect(revenueModal).toContain("&& shouldAutoSelectExistingSheet");
    expect(revenueModal).toContain('const shouldShowGoogleSheetsCreatePicker = !isEditing && platformContext === "google_sheets" && !sheetsConnectionId;');
    expect(revenueModal).toContain("sheetsConnections.length === 0 || shouldShowGoogleSheetsCreatePicker");
    expect(revenueModal).toContain("if (!initialSource) return;");
    expect(spendModal).toContain("if (props.open && props.initialSource) return;");
    expect(spendModal).toContain('setSelectedSheetConnectionId("");');
    expect(spendModal).toContain("if (!props.initialSource) return;");
  });

  it("keeps Google Sheets Summary tab values display-safe for identifiers and non-additive metrics", () => {
    const page = readSource("client", "src", "pages", "google-sheets-data.tsx");
    const routes = readSource("server", "routes-oauth.ts");

    expect(routes).toContain("const isGoogleSheetsSummaryIdentifierColumn");
    expect(routes).toContain("const isGoogleSheetsSummaryBreakdownIdentifierColumn");
    expect(routes).toContain("const isGoogleSheetsSummaryCampaignBreakdownColumn");
    expect(routes).toContain("h !== 'campaign id' && isGoogleSheetsSummaryIdentifierColumn(header)");
    expect(routes).toContain("getGoogleSheetsSummaryDisplayValue");
    expect(routes).toContain("isGoogleSheetsSummaryIdentifierColumn(headerStr)");
    expect(routes).toContain("isGoogleSheetsSummaryBreakdownIdentifierColumn(headerStr)");
    expect(routes).toContain("const isCampaignBreakdownColumn = isGoogleSheetsSummaryCampaignBreakdownColumn(headerStr);");
    expect(routes).toContain("(!isCampaignBreakdownColumn && uniqueCount === rowsForSummary.length)");
    expect(routes).toContain("summaryValue: revenueTotal / spendTotal");
    expect(routes).toContain("derived_profit_per_spend_pct");
    expect(routes).toContain("derived_spend_per_customer");
    expect(routes).toContain("detectedColumns: campaignData.detectedColumns");
    expect(page).toContain("getSummaryMetricDisplayValue(col)");
    expect(page).toContain("getSummaryMetricBusinessPriority");
    expect(page).toContain("getExecutiveSummaryColumns");
    expect(page).toContain("!isSummaryIdentifierColumn(col?.name || \"\")");
    expect(page).toContain("{displayColumns.length} metrics");
    expect(page).toContain("return executiveColumns.length > 0 ? executiveColumns : candidates;");
    expect(page).toContain("Data Breakdown");
    expect(page).toContain("const categoricalColumns = section.categoricalColumns || [];");
    expect(page).toContain("No categorical breakdown column detected for this selected spreadsheet.");
    expect(page).toContain("n.includes('roi')");
    expect(page).toContain("n.includes('cac') || n.includes('cpl')");
  });

  it("persists a stable single Google Sheets analysis source scope for saved objects", () => {
    const page = readSource("client", "src", "pages", "google-sheets-data.tsx");
    const routes = readSource("server", "routes-oauth.ts");

    expect(page).toContain("type GoogleSheetsAnalysisSourceScope");
    expect(page).toContain("const getGoogleSheetsConnectionValue");
    expect(page).toContain("return `${spreadsheetId}:${connectionId}`;");
    expect(page).toContain("const parseGoogleSheetsConnectionValue");
    expect(page).toContain("const activeGoogleSheetsSourceScope = useMemo<GoogleSheetsAnalysisSourceScope | null>");
    expect(page).toContain('scopeType: "single"');
    expect(page).not.toContain('scopeType: "combined"');
    expect(page).not.toContain('<SelectItem value="combined">');
    expect(page).not.toContain('All Sheets (Combined)');
    expect(page).not.toContain('view=combined');
    expect(page).not.toContain('sheetBreakdown');
    expect(page).not.toContain('connectionIds: googleSheetsConnections.map');
    expect(routes).not.toContain("view === 'combined'");
    expect(routes).not.toContain("spreadsheetId: 'combined'");
    expect(routes).not.toContain('sheetBreakdown:');
    expect(page).toContain("connectionId: activeConn.id || null");
    expect(page).toContain("(identifier === null || conn.sheetName === identifier || conn.id === identifier)");
    expect(page).toContain("handleSheetChange(getGoogleSheetsConnectionValue(next))");
    expect(page).toContain("value={getGoogleSheetsConnectionValue(conn)}");
    expect(page).toContain("displayName: getGoogleSheetsConnectionDisplayName(activeConn)");
    expect((page.match(/sourceScope: activeGoogleSheetsSourceScope/g) || []).length).toBeGreaterThanOrEqual(3);
    expect(page).toContain("configuration: withGoogleSheetsSourceScope(overrides.configuration)");
    expect(page).toContain("const getSavedGoogleSheetsSourceScope = useCallback");
    expect(page).toContain("const googleSheetsRowMatchesActiveSource = useCallback");
    expect(page).toContain("const visibleGoogleSheetsKpisData = useMemo");
    expect(page).toContain("const visibleGoogleSheetsBenchmarksData = useMemo");
    expect(page).toContain("kpisData={visibleGoogleSheetsKpisData}");
    expect(page).toContain("benchmarksData={visibleGoogleSheetsBenchmarksData}");
    expect(page).toContain("Saved Google Sheets source scope is missing");
    expect(page).toContain("This KPI metric is not available from the saved Google Sheets source");
    expect(page).toContain("This Benchmark metric is not available from the saved Google Sheets source");
    expect(page).toContain("const reportMetricOptions = reportScopedMetrics.options");
    expect(page).toContain("Source: {resolved.sourceLabel || \"Saved Google Sheets source unavailable\"}");
    expect(page).toContain("Source: {reportSourceLabel}");
    expect(page).toContain("Active: {activeGoogleSheetsSourceScope?.displayName || 'Unknown'}");
    expect(page).toContain('Source: ${reportScopedMetrics.scope?.displayName || reportScopedMetrics.reason || activeGoogleSheetsSourceScope?.displayName || sheetsData?.spreadsheetName || "Google Sheets"}');
  });
});
