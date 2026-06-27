import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const readClient = (relativePath: string) =>
  readFileSync(join(process.cwd(), "client", "src", ...relativePath.split("/")), "utf-8");
const readServer = (relativePath: string) =>
  readFileSync(join(process.cwd(), "server", ...relativePath.split("/")), "utf-8");

describe("GA4 UI regression guard", () => {
  it("keeps the GA4 analytics header provenance compact and explicit", () => {
    const ga4Metrics = readClient("pages/ga4-metrics.tsx");
    const headerStart = ga4Metrics.indexOf("Back to main Campaign Overview");
    const headerEnd = ga4Metrics.indexOf("Connected Properties Management", headerStart);
    const headerSection = ga4Metrics.slice(headerStart, headerEnd);

    expect(headerStart).toBeGreaterThan(-1);
    expect(headerEnd).toBeGreaterThan(headerStart);
    expect(headerSection).toContain("Google Analytics");
    expect(headerSection).toContain("Client:");
    expect(headerSection).toContain("Campaign:");
    expect(headerSection).toContain("GA4 Property ID:");
    expect(headerSection).toContain("Property Campaigns:");
    expect(headerSection).not.toContain("Last updated:");
  });

  it("keeps revenue and spend source modals scrollable for many entries", () => {
    const ga4Metrics = readClient("pages/ga4-metrics.tsx");

    expect(ga4Metrics).toContain('<DialogTitle className="text-foreground">Revenue Sources</DialogTitle>');
    expect(ga4Metrics).toContain('<DialogTitle className="text-foreground">Spend Sources</DialogTitle>');
    expect(ga4Metrics).toContain('<div className="max-h-[65vh] space-y-2 overflow-y-auto pr-1">');
  });

  it("keeps Add Revenue source picker copy aligned with the production wording", () => {
    const revenueModal = readClient("components/AddRevenueWizardModal.tsx");

    expect(revenueModal).toContain("Import revenue from a connected Google Sheets tab");
    expect(revenueModal).toContain("Import revenue from a CSV. Requires manual re-upload to update.");
    expect(revenueModal).not.toContain("With a date column this behaves like daily history");
    expect(revenueModal).not.toContain("This is a one-time import and does not auto-sync");
  });

  it("shows active Google Sheets and CSV revenue status in the Add Revenue picker", () => {
    const revenueModal = readClient("components/AddRevenueWizardModal.tsx");

    expect(revenueModal).toContain("setImportSourceStatus({");
    expect(revenueModal).toContain('google_sheets: hasSource("google_sheets"),');
    expect(revenueModal).toContain('csv: hasSource("csv"),');
    expect(revenueModal).toContain("importSourceStatus.google_sheets");
    expect(revenueModal).toContain("importSourceStatus.csv");
    expect(revenueModal).toContain(">Uploaded</span>");
    expect(revenueModal).not.toContain("if (!open || hideCrmSources) return;");
  });

  it("keeps Google Sheets revenue chooser stable without visible connection-check text", () => {
    const revenueModal = readClient("components/AddRevenueWizardModal.tsx");
    const googleSheetsAuth = readClient("components/SimpleGoogleSheetsAuth.tsx");
    const chooseStart = revenueModal.indexOf('{step === "sheets_choose" && (');
    const mapStart = revenueModal.indexOf('{step === "sheets_map" && (', chooseStart);
    expect(chooseStart).toBeGreaterThan(-1);
    expect(mapStart).toBeGreaterThan(chooseStart);

    const chooseSection = revenueModal.slice(chooseStart, mapStart);
    expect(chooseSection).not.toContain("sheetsConnectionsLoading");
    expect(revenueModal).not.toContain("Checking connected Google Sheets");
    expect(googleSheetsAuth).not.toContain("Checking connection...");
  });

  it("keeps Add Spend source picker copy explicit about sync behavior", () => {
    const spendModal = readClient("components/AddSpendWizardModal.tsx");

    expect(spendModal).toContain("Import spend from a connected Google Sheet tab.");
    expect(spendModal).toContain("Import spend from a CSV. Requires manual re-upload to update.");
  });

  it("uses the selected GA4 lookback window when loading campaign values", () => {
    const campaignsPage = readClient("pages/campaigns.tsx");
    const ga4ConnectionFlow = readClient("components/GA4ConnectionFlow.tsx");

    expect(campaignsPage).toContain("const campaignDateRange = `${wizardLookbackDays}days`;");
    expect(campaignsPage).toContain("ga4-campaign-values?dateRange=${campaignDateRange}");
    expect(ga4ConnectionFlow).toContain("new URLSearchParams({ dateRange: `${lookbackDays}days`, limit: '200' })");
  });

  it("uses the selected GA4 Overview date range for Landing Pages and Conversion Events", () => {
    const ga4Metrics = readClient("pages/ga4-metrics.tsx");
    const routes = readServer("routes-oauth.ts");
    const landingStart = routes.indexOf('app.get("/api/campaigns/:id/ga4-landing-pages"');
    const conversionStart = routes.indexOf('app.get("/api/campaigns/:id/ga4-conversion-events"', landingStart);
    const breakdownStart = routes.indexOf('app.get("/api/campaigns/:id/ga4-breakdown"', conversionStart);
    const landingRoute = routes.slice(landingStart, conversionStart);
    const conversionRoute = routes.slice(conversionStart, breakdownStart);

    expect(landingStart).toBeGreaterThan(-1);
    expect(conversionStart).toBeGreaterThan(landingStart);
    expect(breakdownStart).toBeGreaterThan(conversionStart);
    expect(ga4Metrics).toContain('queryKey: ["/api/campaigns", campaignId, "ga4-landing-pages", dateRange, selectedGA4PropertyId]');
    expect(ga4Metrics).toContain('queryKey: ["/api/campaigns", campaignId, "ga4-conversion-events", dateRange, selectedGA4PropertyId]');
    expect(ga4Metrics).toContain("dateRange: String(dateRange),");
    expect(ga4Metrics).not.toContain("campaignStartDateISO");
    expect(ga4Metrics).not.toContain("params.set('startDate'");
    expect(landingRoute).toContain("const ga4DateRange = explicitStartDate || toGA4LookbackStartDate(dateRange, '90daysAgo');");
    expect(conversionRoute).toContain("const ga4DateRange = explicitStartDate || toGA4LookbackStartDate(dateRange, '90daysAgo');");
    expect(landingRoute).not.toContain("campaignStartDate");
    expect(conversionRoute).not.toContain("campaignStartDate");
  });

  it("keeps campaign-scoped GA4 mapping options limited to imported campaign values", () => {
    const routes = readServer("routes-oauth.ts");
    const routeStart = routes.indexOf('app.get("/api/campaigns/:id/ga4-campaign-values"');
    const routeEnd = routes.indexOf('app.get("/api/campaigns/:id/ga4-landing-pages"', routeStart);
    const route = routes.slice(routeStart, routeEnd);

    expect(routeStart).toBeGreaterThan(-1);
    expect(routeEnd).toBeGreaterThan(routeStart);
    expect(route).toContain("const savedCampaignScope = propertyId ? [] : getGA4CampaignFilterValues");
    expect(route).toContain("const applySavedCampaignScope = (campaigns: any[]) => {");
    expect(route).toContain("campaigns: applySavedCampaignScope(result.campaigns || [])");
  });

  it("keeps GA4 Overview totals on one coherent source before falling back to breakdown totals", () => {
    const ga4Metrics = readClient("pages/ga4-metrics.tsx");

    expect(ga4Metrics).toContain("const ga4BreakdownTotals = useMemo(() => {");
    expect(ga4Metrics).toContain("const hasDailyOverviewTotals =");
    expect(ga4Metrics).toContain("const hasToDateOverviewTotals =");
    expect(ga4Metrics).toContain("const overviewTotalsSource = hasDailyOverviewTotals");
    expect(ga4Metrics).toContain(": hasToDateOverviewTotals ? ga4ToDateOverviewTotals : ga4BreakdownTotals;");
    expect(ga4Metrics).toContain("sessions: Number(overviewTotalsSource.sessions || 0)");
    expect(ga4Metrics).toContain("conversions: Number(overviewTotalsSource.conversions || 0)");
    expect(ga4Metrics).toContain("revenue: Number(overviewTotalsSource.revenue || 0)");
    expect(ga4Metrics).not.toContain("Math.max(Number((ga4ToDateResp as any)?.totals?.sessions || 0), dailySummedTotals.sessions, ga4BreakdownTotals.sessions)");
    expect(ga4Metrics).not.toContain("const ga4RevenueForFinancials = Math.max(ga4RevenueFromToDate, dailySummedTotals.revenue, ga4BreakdownTotals.revenue);");
  });

  it("waits for GA4 breakdown totals before rendering Overview Summary numbers", () => {
    const ga4Metrics = readClient("pages/ga4-metrics.tsx");
    const summaryStart = ga4Metrics.indexOf("{/* Summary Cards */}");
    const revenueStart = ga4Metrics.indexOf("{/* Revenue & Financial */}", summaryStart);
    const summarySection = ga4Metrics.slice(summaryStart, revenueStart);

    expect(summaryStart).toBeGreaterThan(-1);
    expect(revenueStart).toBeGreaterThan(summaryStart);
    expect(ga4Metrics).toContain("const ga4SummaryTotalsInitializing =");
    expect(ga4Metrics).toContain("!hasDailyOverviewTotals");
    expect(ga4Metrics).toContain("!hasToDateOverviewTotals");
    expect(ga4Metrics).toContain("!ga4Breakdown &&");
    expect(ga4Metrics).toContain("breakdownLoading;");
    expect(ga4Metrics).toContain("const renderSummaryValue = (value: string) => ga4SummaryTotalsInitializing");
    expect(summarySection).toContain("formatNumber(financialConversions || 0)");
    expect(summarySection).toContain("renderSummaryValue(formatNumber(financialConversions || 0))");
  });

  it("keeps GA4 Overview detail tables traffic-focused without revenue columns", () => {
    const ga4Metrics = readClient("pages/ga4-metrics.tsx");
    const scheduledPdf = readServer("ga4-scheduled-report-pdf.ts");

    const liveStart = ga4Metrics.indexOf("{/* Landing Pages */}");
    const liveEnd = ga4Metrics.indexOf("{/* Conversion Events */}", liveStart);
    const liveSection = ga4Metrics.slice(liveStart, liveEnd);
    const liveEventsStart = liveEnd;
    const liveEventsEnd = ga4Metrics.indexOf("{/* Modals (rendered always) */}", liveEventsStart);
    const liveEventsSection = ga4Metrics.slice(liveEventsStart, liveEventsEnd);

    const browserPdfStart = ga4Metrics.indexOf("if (includeOverviewLandingPages) addSimpleTable");
    const browserPdfEnd = ga4Metrics.indexOf("if (includeOverviewConversionEvents) addSimpleTable", browserPdfStart);
    const browserPdfSection = ga4Metrics.slice(browserPdfStart, browserPdfEnd);
    const browserPdfEventsStart = browserPdfEnd;
    const browserPdfEventsEnd = ga4Metrics.indexOf("// ========== AD COMPARISON ==========", browserPdfEventsStart);
    const browserPdfEventsSection = ga4Metrics.slice(browserPdfEventsStart, browserPdfEventsEnd);

    const scheduledPdfStart = scheduledPdf.indexOf("if (includeLandingPages) {");
    const scheduledPdfEnd = scheduledPdf.indexOf("if (includeConversionEvents) {", scheduledPdfStart);
    const scheduledPdfSection = scheduledPdf.slice(scheduledPdfStart, scheduledPdfEnd);
    const scheduledPdfEventsStart = scheduledPdfEnd;
    const scheduledPdfEventsEnd = scheduledPdf.indexOf("if (sections.ads)", scheduledPdfEventsStart);
    const scheduledPdfEventsSection = scheduledPdf.slice(scheduledPdfEventsStart, scheduledPdfEventsEnd);

    expect(liveStart).toBeGreaterThan(-1);
    expect(liveEnd).toBeGreaterThan(liveStart);
    expect(liveEventsEnd).toBeGreaterThan(liveEventsStart);
    expect(browserPdfStart).toBeGreaterThan(-1);
    expect(browserPdfEnd).toBeGreaterThan(browserPdfStart);
    expect(browserPdfEventsEnd).toBeGreaterThan(browserPdfEventsStart);
    expect(scheduledPdfStart).toBeGreaterThan(-1);
    expect(scheduledPdfEnd).toBeGreaterThan(scheduledPdfStart);
    expect(scheduledPdfEventsEnd).toBeGreaterThan(scheduledPdfEventsStart);

    expect(liveSection).not.toContain("GA4 Revenue");
    expect(liveSection).not.toContain("formatMoney(Number(r?.revenue || 0))");
    expect(liveEventsSection).not.toContain("GA4 Revenue");
    expect(liveEventsSection).not.toContain("formatMoney(Number(r?.revenue || 0))");
    expect(browserPdfSection).not.toContain("GA4 REVENUE");
    expect(browserPdfSection).not.toContain("fC(Number(r?.revenue || 0))");
    expect(browserPdfEventsSection).not.toContain("GA4 REVENUE");
    expect(browserPdfEventsSection).not.toContain("fC(Number(r?.revenue || 0))");
    expect(scheduledPdfSection).not.toContain("GA4 REVENUE");
    expect(scheduledPdfSection).not.toContain("formatMoney(Number(row?.revenue || 0))");
    expect(scheduledPdfEventsSection).not.toContain("GA4 REVENUE");
    expect(scheduledPdfEventsSection).not.toContain("formatMoney(Number(row?.revenue || 0))");
  });

  it("lets mapped GA4 revenue sources create campaign breakdown rows when GA4 rows are missing", () => {
    const ga4Metrics = readClient("pages/ga4-metrics.tsx");
    const pdf = readServer("ga4-scheduled-report-pdf.ts");
    const aggStart = ga4Metrics.indexOf("const campaignBreakdownAgg = useMemo");
    const matchStart = ga4Metrics.indexOf("const campaignBreakdownMatchedExternalRevenue", aggStart);
    const clientAgg = ga4Metrics.slice(aggStart, matchStart);
    const pdfStart = pdf.indexOf("const filteredCampaignRows = Array.from(byCampaign.values())");
    const pdfMatchStart = pdf.indexOf("const rowNameByKey = new Map<string, string>();", pdfStart);
    const pdfAgg = pdf.slice(pdfStart, pdfMatchStart);

    expect(aggStart).toBeGreaterThan(-1);
    expect(matchStart).toBeGreaterThan(aggStart);
    expect(clientAgg).toContain("for (const source of revenueDisplaySources)");
    expect(clientAgg).toContain("const mappings = Array.isArray(cfg?.campaignMappings) ? cfg.campaignMappings : [];");
    expect(clientAgg).toContain('const name = String(mappedCampaignByValue.get(valueKey) || item?.campaignValue || "").trim();');
    expect(clientAgg).toContain("filteredRows.push(row);");
    expect(clientAgg).toContain("filteredRowsByKey.set(key, row);");
    expect(ga4Metrics).toContain("[ga4Breakdown, importedGA4CampaignNames, breakdownTotals, revenueDisplaySources]");
    expect(ga4Metrics).toContain("for (const f of selectedGa4CampaignFilterList)");
    expect(ga4Metrics).toContain("}, [selectedGa4CampaignFilterList]);");
    expect(ga4Metrics).not.toContain("const { data: allCampaigns }");
    expect(clientAgg).not.toContain("for (const c of (allCampaigns || []))");

    expect(pdfStart).toBeGreaterThan(-1);
    expect(pdfMatchStart).toBeGreaterThan(pdfStart);
    expect(pdfAgg).toContain("for (const source of revenueDisplaySources)");
    expect(pdfAgg).toContain("const mappings = Array.isArray(cfg?.campaignMappings) ? cfg.campaignMappings : [];");
    expect(pdfAgg).toContain('const name = String(mappedCampaignByValue.get(valueKey) || item?.campaignValue || "").trim();');
    expect(pdfAgg).toContain("filteredCampaignRows.push(row);");
    expect(pdfAgg).toContain("filteredCampaignRowsByKey.set(key, row);");
  });

  it("keeps GA4 Ad Comparison leader cards on one shared adjusted-row selector", () => {
    const adComparison = readClient("pages/ga4-ad-comparison.tsx");
    const ga4Metrics = readClient("pages/ga4-metrics.tsx");
    const scheduledPdf = readServer("ga4-scheduled-report-pdf.ts");
    const allocationStart = adComparison.indexOf("const allocationSummary = useMemo(() => {");
    const comparisonStart = adComparison.indexOf("const comparisonRows = useMemo(() => {", allocationStart);
    const cardSelectorStart = adComparison.indexOf("selectGA4AdComparisonLeaderCards(comparisonRows, selectedMetric)", comparisonStart);
    const allocationSection = adComparison.slice(allocationStart, comparisonStart);

    expect(allocationStart).toBeGreaterThan(-1);
    expect(comparisonStart).toBeGreaterThan(allocationStart);
    expect(cardSelectorStart).toBeGreaterThan(comparisonStart);
    expect(allocationSection).toContain("const mappings = Array.isArray(cfg?.campaignMappings) ? cfg.campaignMappings : [];");
    expect(allocationSection).toContain("const mappedCampaignByValue = new Map<string, string>();");
    expect(allocationSection).toContain("const key = normalizeCampaignKey(mappedCampaignByValue.get(valueKey) || campaignValue);");
    expect(adComparison).toContain("selectGA4AdComparisonLeaderCards(comparisonRows, selectedMetric)");
    expect(ga4Metrics).toContain("selectGA4AdComparisonLeaderCards(comparisonRows, selectedMetric)");
    expect(scheduledPdf).toContain("selectGA4AdComparisonLeaderCards(rows, selectedMetric)");
    expect(scheduledPdf).toContain("const selectedMetric = \"sessions\";");
    expect(adComparison).toContain("formatGA4AdComparisonCardPct(bestPerforming.conversionRate)");
    expect(adComparison).toContain("formatGA4AdComparisonCardPct(mostEfficient.conversionRate)");
    expect(adComparison).toContain("formatGA4AdComparisonCardPct(needsAttention.conversionRate)");
    expect(ga4Metrics).toContain("formatGA4AdComparisonCardPct(Number(bestPerforming?.conversionRate || 0))");
    expect(ga4Metrics).toContain("formatGA4AdComparisonCardPct(Number(mostEfficient?.conversionRate || 0))");
    expect(ga4Metrics).toContain("formatGA4AdComparisonCardPct(Number(needsAttention?.conversionRate || 0))");
    expect(scheduledPdf).toContain("formatGA4AdComparisonCardPct(mostEfficient?.conversionRate || 0)");
    expect(scheduledPdf).toContain("formatGA4AdComparisonCardPct(needsAttention?.conversionRate || 0)");
    expect(adComparison).not.toContain("needsAttention.name !== mostEfficient?.name");
    expect(ga4Metrics).not.toContain(".find((r: any) => String(r?.name || \"\") !== String(bestPerforming?.name || \"\"))");
    expect(scheduledPdf).not.toContain("const lowest = [...rows].sort((a: any, b: any) => Number(a?.sessions || 0) - Number(b?.sessions || 0))[0];");
    expect(adComparison).not.toContain("[...campaignBreakdownAgg]");
  });

  it("keeps GA4 Ad Comparison unallocated external revenue on imported-source residuals only", () => {
    const adComparison = readClient("pages/ga4-ad-comparison.tsx");
    const ga4Metrics = readClient("pages/ga4-metrics.tsx");
    const allocationStart = adComparison.indexOf("const allocationSummary = useMemo(() => {");
    const allocationEnd = adComparison.indexOf("const sourceRevenueBreakdowns = useMemo(() => {", allocationStart);
    const allocationSection = adComparison.slice(allocationStart, allocationEnd);
    const pdfAllocationStart = ga4Metrics.indexOf("let matchedExternalRevenue = 0;");
    const pdfAllocationEnd = ga4Metrics.indexOf("const comparisonRows = rows.map", pdfAllocationStart);
    const pdfAllocationSection = ga4Metrics.slice(pdfAllocationStart, pdfAllocationEnd);

    expect(adComparison).toContain("importedRevenue?: number;");
    expect(adComparison).toContain("const importedRevenueInput = importedRevenueTotal ?? (totalRevenue - ga4RevenueForBreakdown);");
    expect(ga4Metrics).toContain("importedRevenue={importedRevenueForFinancials}");
    expect(allocationSection).toContain("let unallocatedExternalRevenue = Math.max(0, Number((importedRevenue - matchedExternalRevenue).toFixed(2)));");
    expect(allocationSection).toContain("matchedExternalRevenue > 0 && unallocatedExternalRevenue <= REVENUE_ALLOCATION_RESIDUAL_THRESHOLD");
    expect(pdfAllocationSection).toContain("let unallocatedExternalRevenue = Math.max(0, Number((importedRevenueForFinancials - matchedExternalRevenue).toFixed(2)));");
    expect(pdfAllocationSection).toContain("matchedExternalRevenue > 0 && unallocatedExternalRevenue <= REVENUE_ALLOCATION_RESIDUAL_THRESHOLD");
  });

  it("keeps GA4 Ad Comparison Revenue Breakdown on source-level GA4 totals", () => {
    const adComparison = readClient("pages/ga4-ad-comparison.tsx");
    const ga4Metrics = readClient("pages/ga4-metrics.tsx");
    const breakdownStart = adComparison.indexOf("{/* Revenue Breakdown sub-table */}");
    const breakdownSection = adComparison.slice(breakdownStart);
    const pdfBreakdownStart = ga4Metrics.indexOf("if (includeAdsRevenueBreakdown && tableRevenueSummaryVisible) {");
    const pdfBreakdownSection = ga4Metrics.slice(pdfBreakdownStart, ga4Metrics.indexOf("sectionTitle(\"Revenue Breakdown\"", pdfBreakdownStart));

    expect(breakdownStart).toBeGreaterThan(-1);
    expect(adComparison).toContain("ga4RevenueTotal?: number;");
    expect(adComparison).toContain("const ga4RevenueForBreakdown = Number((Number.isFinite(ga4RevenueTotalValue) && ga4RevenueTotalValue > 0 ? ga4RevenueTotalValue : ga4Revenue).toFixed(2));");
    expect(ga4Metrics).toContain("ga4RevenueTotal={ga4RevenueForFinancials}");
    expect(breakdownSection).toContain("{formatMoney(ga4RevenueForBreakdown)}");
    expect(breakdownSection).toContain("{formatMoney(revenueBreakdownTotal)}");
    expect(breakdownSection).not.toContain("{formatMoney(ga4Revenue)}</td>");
    expect(pdfBreakdownSection).toContain('{ label: "GA4 Revenue", amount: fC(ga4RevenueForFinancials) }');
  });

  it("keeps GA4 Ad Comparison All Campaigns independent from the metric dropdown", () => {
    const adComparison = readClient("pages/ga4-ad-comparison.tsx");
    const ga4Metrics = readClient("pages/ga4-metrics.tsx");
    const tableStart = adComparison.indexOf("{/* Full comparison table */}");
    const breakdownStart = adComparison.indexOf("{/* Revenue Breakdown sub-table */}", tableStart);
    const tableSection = adComparison.slice(tableStart, breakdownStart);
    const browserPdfTableStart = ga4Metrics.indexOf("// All Campaigns table");
    const browserPdfTableEnd = ga4Metrics.indexOf("if (tableRevenueSummaryVisible && unallocatedExternalRevenue > 0)", browserPdfTableStart);
    const browserPdfTableSection = ga4Metrics.slice(browserPdfTableStart, browserPdfTableEnd);

    expect(tableStart).toBeGreaterThan(-1);
    expect(breakdownStart).toBeGreaterThan(tableStart);
    expect(browserPdfTableStart).toBeGreaterThan(-1);
    expect(browserPdfTableEnd).toBeGreaterThan(browserPdfTableStart);
    expect(tableSection).not.toContain("Full comparison sorted by");
    expect(tableSection).toContain("{comparisonRows.map((c, idx) => {");
    expect(tableSection).not.toContain("{sortedByMetric.map((c, idx) => {");
    expect(browserPdfTableSection).toContain("for (let i = 0; i < comparisonRows.length; i++)");
    expect(browserPdfTableSection).toContain("const r = comparisonRows[i] as any;");
    expect(browserPdfTableSection).not.toContain("const r = sortedByMetric[i] as any;");
  });

  it("keeps GA4 Ad Comparison summary labels and tooltips readable", () => {
    const adComparison = readClient("pages/ga4-ad-comparison.tsx");
    const summaryStart = adComparison.indexOf("const summaryMetricLabel =");
    const summarySection = adComparison.slice(summaryStart, adComparison.indexOf("if (breakdownLoading)", summaryStart));

    expect(summaryStart).toBeGreaterThan(-1);
    expect(summarySection).toContain("Overall Conversion Rate");
    expect(summarySection).not.toContain("Total Conversion Rate");
    expect(adComparison).toContain("User counts are approximate. GA4 users are non-additive - the same user visiting across multiple days");
    expect(adComparison).toContain("Approximate - users are non-additive across breakdown dimensions");
    expect(adComparison).not.toContain("Ã");
    expect(adComparison).not.toContain("â");
  });

  it("keeps the GA4 Ad Comparison metric selector in the header before leader cards", () => {
    const adComparison = readClient("pages/ga4-ad-comparison.tsx");
    const headerStart = adComparison.indexOf("{/* Header */}");
    const rankingsStart = adComparison.indexOf("{/* Performance Rankings */}", headerStart);
    const selectorStart = adComparison.indexOf("<Select value={selectedMetric}", headerStart);
    const headerSection = adComparison.slice(headerStart, rankingsStart);

    expect(headerStart).toBeGreaterThan(-1);
    expect(rankingsStart).toBeGreaterThan(headerStart);
    expect(selectorStart).toBeGreaterThan(headerStart);
    expect(selectorStart).toBeLessThan(rankingsStart);
    expect(adComparison.indexOf("<Select value={selectedMetric}", rankingsStart)).toBe(-1);
    expect(headerSection).toContain("md:grid md:grid-cols-3");
    expect(headerSection).toContain("md:justify-self-end");
  });

  it("keeps GA4 Insights trend history requirements aligned to selected mode", () => {
    const ga4Metrics = readClient("pages/ga4-metrics.tsx");

    expect(ga4Metrics).toContain("const availableMonths = new Set(");
    expect(ga4Metrics).toContain('const minRequiredDays = insightsTrendMode === "daily" ? 2 : insightsTrendMode === "7d" ? 14 : insightsTrendMode === "30d" ? 60 : 0;');
    expect(ga4Metrics).toContain('const hasRequiredHistory = insightsTrendMode === "monthly" ? availableMonths >= 2 : dailyRows.length >= minRequiredDays;');
    expect(ga4Metrics).toContain('const requiredHistory = insightsTrendMode === "monthly" ? "2 calendar months" : `${minRequiredDays} days`;');
    expect(ga4Metrics).not.toContain("Need at least 2 days of GA4 daily history. Available: {dailyRows.length}.");
    expect(ga4Metrics).toContain('const DEFAULT_GA4_TRENDS_REPORTING_TIME_ZONE = "UTC";');
    expect(ga4Metrics).toContain("const trendsReportingTimeZone = normalizeClientReportingTimeZone((ga4DailyResp as any)?.reportingTimeZone);");
    expect(ga4Metrics).toContain("const trendsReportingTimeZoneLabel = formatReportingTimeZoneLabel(trendsReportingTimeZone);");
    expect(ga4Metrics).not.toContain("const trendsRefreshScheduleTimeZone =");
    expect(ga4Metrics).toContain("const trendsExpectedRefreshLabel = formatReportingTimestampLabel((ga4DailyResp as any)?.expectedRefreshAt, trendsReportingTimeZone);");
    expect(ga4Metrics).toContain('const trendsLatestImportedDate = String(ga4ReportDate || "").trim();');
    expect(ga4Metrics).toContain('const trendsLatestImportedDateLabel = trendsLatestImportedDate ? formatReportingDateLabel(trendsLatestImportedDate) : "Not available";');
    expect(ga4Metrics).toContain("Completed-day cutoff <span");
    expect(ga4Metrics).toContain("Latest imported day");
    expect(ga4Metrics).toContain("Reporting timezone");
    expect(ga4Metrics).toContain("Last refreshed <span");
    expect(ga4Metrics).toContain("Expected refresh <span");
    expect(ga4Metrics).toContain("Daily history has not refreshed since the expected {trendsExpectedRefreshLabel} run.");
    expect(ga4Metrics).toContain('`${dailyRows.length} complete ${trendsReportingTimeZoneLabel} day${dailyRows.length === 1 ? "" : "s"}`');
    expect(ga4Metrics).toContain("Today's intraday GA4 data is excluded until it becomes a completed ${trendsReportingTimeZoneLabel} GA4 day.");
  });

  it("keeps GA4 Insights report exports aligned with Trends freshness metadata", () => {
    const ga4Metrics = readClient("pages/ga4-metrics.tsx");
    const pdf = readServer("ga4-scheduled-report-pdf.ts");

    expect(ga4Metrics).toContain("const renderInsightsFreshness = () => {");
    expect(ga4Metrics).toContain("Completed-day cutoff: ${trendsDataThroughLabel}");
    expect(ga4Metrics).toContain("Reporting timezone: ${trendsReportingTimeZoneLabel}");
    expect(ga4Metrics).toContain("Last refreshed: ${trendsLastRefreshedLabel}");

    expect(pdf).toContain('import { getReportingDateWindow } from "./utils/reporting-timezone";');
    expect(pdf).toContain("const reportingWindow = getReportingDateWindow(90, (campaign as any)?.reportingTimeZone);");
    expect(pdf).toContain("insightsFreshness: {");
    expect(pdf).toContain("lastRefreshedAt: lastDailyRefreshAt");
    expect(pdf).toContain("Completed-day cutoff: ${formatReportingDateLabel(payload.insightsFreshness.dataThroughDate)}");
    expect(pdf).toContain("Reporting timezone: ${formatReportingTimeZoneLabel(payload.insightsFreshness.reportingTimeZone)}");
    expect(pdf).toContain("Last refreshed: ${formatReportingTimestampLabel(payload.insightsFreshness.lastRefreshedAt, payload.insightsFreshness.reportingTimeZone)}");
  });

  it("keeps Google Sheets spend chooser stable without visible loading text during back/dropdown transitions", () => {
    const spendModal = readClient("components/AddSpendWizardModal.tsx");
    const chooseStart = spendModal.indexOf('{step === "sheets_choose" && (');
    const mapStart = spendModal.indexOf('{step === "csv" && (', chooseStart);
    const mapSectionStart = spendModal.indexOf('{(step === "csv_map" || step === "sheets_map") && (');
    const footerStart = spendModal.indexOf('onClick={step === "csv_map" ? processCsv : processSheets}', mapSectionStart);
    expect(chooseStart).toBeGreaterThan(-1);
    expect(mapStart).toBeGreaterThan(chooseStart);
    expect(mapSectionStart).toBeGreaterThan(mapStart);
    expect(footerStart).toBeGreaterThan(mapSectionStart);

    const chooseSection = spendModal.slice(chooseStart, mapStart);
    const mapSection = spendModal.slice(mapSectionStart, footerStart);
    expect(chooseSection).not.toContain("sheetsConnectionsLoading");
    expect(spendModal).not.toContain("Checking connected Google Sheets");
    expect(chooseSection).not.toContain("Loading your connected Google Sheets");
    expect(chooseSection).not.toContain("Loading...");
    expect(mapSection).not.toContain("Loading spreadsheet data");
  });

  it("keeps revenue and spend add-source modals vertically scrollable inside the viewport", () => {
    const revenueModal = readClient("components/AddRevenueWizardModal.tsx");
    const spendModal = readClient("components/AddSpendWizardModal.tsx");

    expect(revenueModal).toContain('h-[95vh] max-h-[95vh] p-0 flex flex-col min-h-0 overflow-hidden');
    expect(revenueModal).toContain("overflow-y-auto");
    expect(spendModal).toContain('h-[95vh] max-h-[95vh] p-0 flex flex-col min-h-0 overflow-hidden');
    expect(spendModal).toContain("overflow-y-auto");
  });

  it("shows clear Custom Report empty states when no GA4 KPIs or Benchmarks exist", () => {
    const ga4Metrics = readClient("pages/ga4-metrics.tsx");
    const customReportStart = ga4Metrics.indexOf("<h3 className=\"text-lg font-bold text-foreground mb-2\">Custom Report</h3>");
    const scheduleStart = ga4Metrics.indexOf("{/* Schedule Automated Reports for Custom */}", customReportStart);
    const customReportSection = ga4Metrics.slice(customReportStart, scheduleStart);

    expect(customReportStart).toBeGreaterThan(-1);
    expect(scheduleStart).toBeGreaterThan(customReportStart);
    expect(customReportSection).toContain("No KPIs created yet");
    expect(customReportSection).toContain("No Benchmarks created yet");
    expect(customReportSection).not.toContain("No KPIs selected for this report.");
    expect(customReportSection).not.toContain("No benchmarks selected for this report.");
  });

  it("keeps GA4 alert frequency scoped to email reminders", () => {
    const ga4Metrics = readClient("pages/ga4-metrics.tsx");
    const benchmarkEmailStart = ga4Metrics.indexOf('id="ga4-benchmark-email-notifications"');
    const benchmarkFrequencyStart = ga4Metrics.indexOf("<Label>Alert Frequency</Label>", benchmarkEmailStart);
    const benchmarkEnd = ga4Metrics.indexOf("<DialogFooter>", benchmarkEmailStart);
    const benchmarkSection = ga4Metrics.slice(benchmarkEmailStart, benchmarkEnd);
    const benchmarkEmailConditionalStart = ga4Metrics.indexOf("{newBenchmark.emailNotifications && (", benchmarkEmailStart);
    const benchmarkEmailFragmentStart = ga4Metrics.indexOf("<>", benchmarkEmailConditionalStart);
    const benchmarkEmailGridStart = ga4Metrics.indexOf('grid grid-cols-[max-content_1fr] items-center gap-x-3 gap-y-2', benchmarkEmailStart);
    const benchmarkEmailInputStart = ga4Metrics.indexOf("value={newBenchmark.emailRecipients}", benchmarkEmailStart);
    const benchmarkEmailConditionalEnd = ga4Metrics.indexOf("</>", benchmarkFrequencyStart);
    const kpiEmailStart = ga4Metrics.indexOf('id="kpi-email-notifications"');
    const kpiFrequencyStart = ga4Metrics.indexOf('<Label htmlFor="kpi-alert-frequency">Alert Frequency</Label>', kpiEmailStart);
    const kpiEnd = ga4Metrics.indexOf("<DialogFooter>", kpiEmailStart);
    const kpiSection = ga4Metrics.slice(kpiEmailStart, kpiEnd);
    const kpiEmailConditionalStart = ga4Metrics.indexOf('{kpiForm.watch("emailNotifications") && (', kpiEmailStart);
    const kpiEmailFragmentStart = ga4Metrics.indexOf("<>", kpiEmailConditionalStart);
    const kpiEmailGridStart = ga4Metrics.indexOf('grid grid-cols-[max-content_1fr] items-center gap-x-3 gap-y-2', kpiEmailStart);
    const kpiEmailInputStart = ga4Metrics.indexOf('value={kpiForm.watch("emailRecipients") || ""}', kpiEmailStart);
    const kpiEmailConditionalEnd = ga4Metrics.indexOf("</>", kpiFrequencyStart);

    expect(benchmarkEmailStart).toBeGreaterThan(-1);
    expect(benchmarkFrequencyStart).toBeGreaterThan(benchmarkEmailStart);
    expect(benchmarkEnd).toBeGreaterThan(benchmarkFrequencyStart);
    expect(benchmarkEmailConditionalStart).toBeGreaterThan(benchmarkEmailStart);
    expect(benchmarkEmailFragmentStart).toBeGreaterThan(benchmarkEmailConditionalStart);
    expect(benchmarkEmailGridStart).toBeGreaterThan(benchmarkEmailFragmentStart);
    expect(benchmarkEmailInputStart).toBeGreaterThan(benchmarkEmailGridStart);
    expect(benchmarkFrequencyStart).toBeGreaterThan(benchmarkEmailInputStart);
    expect(benchmarkEmailConditionalEnd).toBeGreaterThan(benchmarkFrequencyStart);
    expect(kpiEmailStart).toBeGreaterThan(-1);
    expect(kpiFrequencyStart).toBeGreaterThan(kpiEmailStart);
    expect(kpiEnd).toBeGreaterThan(kpiFrequencyStart);
    expect(kpiEmailConditionalStart).toBeGreaterThan(kpiEmailStart);
    expect(kpiEmailFragmentStart).toBeGreaterThan(kpiEmailConditionalStart);
    expect(kpiEmailGridStart).toBeGreaterThan(kpiEmailFragmentStart);
    expect(kpiEmailInputStart).toBeGreaterThan(kpiEmailGridStart);
    expect(kpiFrequencyStart).toBeGreaterThan(kpiEmailInputStart);
    expect(kpiEmailConditionalEnd).toBeGreaterThan(kpiFrequencyStart);
    expect(benchmarkSection).not.toContain('grid grid-cols-2 gap-4');
    expect(kpiSection).not.toContain('grid grid-cols-2 gap-4');
    expect(benchmarkSection).toContain('className="whitespace-nowrap">Email addresses *</Label>');
    expect(kpiSection).toContain('className="whitespace-nowrap">Email addresses *</Label>');
    expect(benchmarkSection).toContain("disabled={!newBenchmark.emailNotifications}");
    expect(benchmarkSection).toContain("This setting controls how often reminder emails are sent while the Benchmark is still breaching");
    expect(kpiSection).toContain('disabled={!kpiForm.watch("emailNotifications")}');
    expect(kpiSection).toContain("This setting controls how often reminder emails are sent while the KPI is still breaching");
  });

  it("visibly highlights GA4 KPI and Benchmark cards opened from alert deep links", () => {
    const ga4Metrics = readClient("pages/ga4-metrics.tsx");

    expect(ga4Metrics).toContain('import { useLocation, useRoute, useSearch } from "wouter";');
    expect(ga4Metrics).toContain("const search = useSearch();");
    expect(ga4Metrics).toContain("const nextSearchParams = new URLSearchParams(search);");
    expect(ga4Metrics).toContain("}, [location, search]);");
    expect(ga4Metrics).toContain("const [highlightedItemId, setHighlightedItemId] = useState<string>(initialHighlight);");
    expect(ga4Metrics).toContain('const isHighlightedKpi = String(highlightedItemId || "") === String(kpi.id || "");');
    expect(ga4Metrics).toContain('const isHighlightedBenchmark = String(highlightedItemId || "") === String(benchmark.id || "");');
    expect(ga4Metrics).toContain('${isHighlightedKpi ? "ring-2 ring-primary ring-offset-2 ring-offset-background shadow-lg bg-primary/5" : ""}');
    expect(ga4Metrics).toContain('${isHighlightedBenchmark ? "ring-2 ring-primary ring-offset-2 ring-offset-background shadow-lg bg-primary/5" : ""}');
    expect(ga4Metrics).toContain('window.scrollTo({ top, behavior: "smooth" });');
    expect(ga4Metrics).not.toContain('window.scrollTo({ top, behavior: "auto" });');
    expect(ga4Metrics).not.toContain('setHighlightedItemId(""), 3000');
  });
});
