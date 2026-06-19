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

  it("keeps live GA4 breakdown totals from being scaled down to zero when to-date/daily totals are empty", () => {
    const ga4Metrics = readClient("pages/ga4-metrics.tsx");

    expect(ga4Metrics).toContain("const ga4BreakdownTotals = useMemo(() => {");
    expect(ga4Metrics).toContain("dailySummedTotals.sessions, ga4BreakdownTotals.sessions");
    expect(ga4Metrics).toContain("dailySummedTotals.conversions, ga4BreakdownTotals.conversions");
    expect(ga4Metrics).toContain("dailySummedTotals.revenue, ga4BreakdownTotals.revenue");
    expect(ga4Metrics).toContain("dailySummedTotals.users || ga4BreakdownTotals.users");
    expect(ga4Metrics).toContain("const ga4RevenueForFinancials = Math.max(ga4RevenueFromToDate, dailySummedTotals.revenue, ga4BreakdownTotals.revenue);");
  });

  it("keeps GA4 Insights trend history requirements aligned to selected mode", () => {
    const ga4Metrics = readClient("pages/ga4-metrics.tsx");

    expect(ga4Metrics).toContain("const availableMonths = new Set(");
    expect(ga4Metrics).toContain('const minRequiredDays = insightsTrendMode === "daily" ? 2 : insightsTrendMode === "7d" ? 14 : insightsTrendMode === "30d" ? 60 : 0;');
    expect(ga4Metrics).toContain('const hasRequiredHistory = insightsTrendMode === "monthly" ? availableMonths >= 2 : dailyRows.length >= minRequiredDays;');
    expect(ga4Metrics).toContain('const requiredHistory = insightsTrendMode === "monthly" ? "2 calendar months" : `${minRequiredDays} days`;');
    expect(ga4Metrics).not.toContain("Need at least 2 days of GA4 daily history. Available: {dailyRows.length}.");
    expect(ga4Metrics).toContain('`${dailyRows.length} complete day${dailyRows.length === 1 ? "" : "s"}`');
    expect(ga4Metrics).toContain("Today's intraday GA4 data is excluded until it becomes a completed GA4 day.");
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
});
