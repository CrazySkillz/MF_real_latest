import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { aggregateCsvSpendRows } from "./utils/csv";

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), "utf8");
const routes = read("server", "routes-oauth.ts");
const storage = read("server", "storage.ts");
const scheduler = read("server", "auto-refresh-scheduler.ts");
const overview = read("client", "src", "pages", "ga4-metrics.tsx");
const wizard = read("client", "src", "components", "AddSpendWizardModal.tsx");
const jobs = read("server", "ga4-kpi-benchmark-jobs.ts");
const currentValues = read("server", "utils", "campaign-current-values.ts");
const snapshots = read("server", "utils", "financial-daily-snapshot-writer.ts");
const scheduledPdf = read("server", "ga4-scheduled-report-pdf.ts");

const slice = (source: string, startText: string, endText: string) => {
  const start = source.indexOf(startText);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = source.indexOf(endText, start);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
};

const csvRoute = slice(
  routes,
  'app.post("/api/campaigns/:id/spend/csv/process"',
  'app.post("/api/campaigns/:id/spend/sheets/preview"',
);
const sheetsRoute = slice(
  routes,
  'app.post("/api/campaigns/:id/spend/sheets/process"',
  "// Salesforce PKCE support",
);

describe("GA4 Overview Spend readiness contract", () => {
  it("rejects GA4 CSV and Google Sheets currency mismatches before replacement", () => {
    for (const { route, replacement } of [
      { route: csvRoute, replacement: "storage.replaceCsvSpendSourceWithRecords" },
      { route: sheetsRoute, replacement: "storage.replaceSpendSourceWithRecords" },
    ]) {
      expect(route).toContain('code: "SPEND_CURRENCY_MISMATCH"');
      expect(route).toContain('const campaignCurrency = String((campaign as any)?.currency || "USD").trim().toUpperCase();');
      expect(route.indexOf('code: "SPEND_CURRENCY_MISMATCH"')).toBeLessThan(route.indexOf(replacement));
    }
    expect(csvRoute).toContain("Currency mismatch: CSV spend is in");
    expect(sheetsRoute).toContain("Currency mismatch: Google Sheets spend is in");
  });

  it("preserves last-good Google Sheets data when mapped headers disappear or become ambiguous", () => {
    expect(sheetsRoute).toContain('code: "SHEET_MAPPING_CHANGED"');
    expect(sheetsRoute).toContain("headers.filter((candidate) => candidate === header).length !== 1");
    expect(sheetsRoute.indexOf('code: "SHEET_MAPPING_CHANGED"')).toBeLessThan(
      sheetsRoute.indexOf("storage.replaceSpendSourceWithRecords"),
    );
    expect(sheetsRoute.indexOf("if (!resp.ok) {")).toBeLessThan(
      sheetsRoute.indexOf("storage.replaceSpendSourceWithRecords"),
    );
    expect(sheetsRoute).not.toContain("if (kept === 0)");
  });

  it("requires unambiguous campaign, spend, and date roles on both manual import paths", () => {
    for (const { route, replacement } of [
      { route: csvRoute, replacement: "storage.replaceCsvSpendSourceWithRecords" },
      { route: sheetsRoute, replacement: "storage.replaceSpendSourceWithRecords" },
    ]) {
      expect(route).toContain('error: "campaignColumn is required when campaign values are selected"');
      expect(route.indexOf("campaignColumn is required when campaign values are selected")).toBeLessThan(
        route.indexOf(replacement),
      );
    }
    expect(csvRoute).toContain('error: "Spend and Campaign columns must be different."');
    expect(csvRoute).toContain("Date column must be different from the Spend and Campaign columns.");
    expect(sheetsRoute).toContain("Spend, Date, and Campaign columns must be different.");
    expect(wizard).toContain(': headers.filter((header: string) => header !== spendColumn && header !== effectiveCampaignColumn);');
    expect(wizard).toContain("headers.filter((h) => h !== spendColumn && h !== spendDateColumn).map");
  });

  it("aggregates exact selected CSV rows and preserves explicit source dates", () => {
    const result = aggregateCsvSpendRows([
      { Date: "2026-09-01T23:30:00-05:00", Campaign: "Alpha", Spend: "$100.25" },
      { Date: "2026-09-02", Campaign: "Beta", Spend: "999" },
      { Date: "2026-09-03", Campaign: "Alpha", Spend: "49.75" },
    ], {
      spendColumn: "Spend",
      dateColumn: "Date",
      campaignColumn: "Campaign",
      campaignValues: ["Alpha"],
    });

    expect(result).toEqual({
      keptRows: 2,
      totalSpend: 150,
      dailySpend: [
        { date: "2026-09-01", spend: 100.25 },
        { date: "2026-09-03", spend: 49.75 },
      ],
      undatedSpend: 0,
    });
  });

  it("keeps replacement and deletion inside campaign, type, context, and record boundaries", () => {
    const csvReplacement = slice(storage, "async replaceCsvSpendSourceWithRecords(", "async getSpendTotalForRange");
    const sheetsReplacement = slice(storage, "async replaceSpendSourceWithRecords(", "async replaceSpendRecordsForSource");
    const deletion = slice(storage, "async deleteSpendSourceWithRecords(", "async hardDeleteInactiveSpendSource");

    expect(csvReplacement).toContain("return await db.transaction");
    expect(csvReplacement).toContain("spendPlatformContextPredicate(platformContext)");
    expect(csvReplacement).toContain("eq(spendSources.campaignId, campaignId)");
    expect(csvReplacement).toContain("eq(spendSources.sourceType, \"csv\")");
    expect(csvReplacement).toContain("eq(spendRecords.campaignId, campaignId)");
    expect(sheetsReplacement).toContain("return await db.transaction");
    expect(sheetsReplacement).toContain("contextCondition");
    expect(sheetsReplacement).toContain("eq(spendSources.campaignId, campaignId)");
    expect(deletion).toContain("return await db.transaction");
    expect(deletion).toContain("eq(spendRecords.campaignId, campaignId)");
  });

  it("uses stable source identity for edit and Sheets refresh without scheduling CSV", () => {
    expect(csvRoute).toContain("existingSourceId ? String(existingSourceId) : null");
    expect(sheetsRoute).toContain("replaceSpendSourceWithRecords(campaignId, existingSourceId, 'google_sheets', 'ga4'");
    const spendTimer = slice(
      scheduler,
      "export async function runGoogleSheetsSpendAutoRefreshOnce",
      "export async function runGoogleSheetsRevenueAutoRefreshOnce",
    );
    expect(spendTimer).toContain('mappingConfig.platformContext = String(mappingConfig?.platformContext || source?.platformContext || "ga4")');
    expect(spendTimer).toContain("reprocessGoogleSheetsSpend(campaignId, source, mappingConfig)");
    expect(spendTimer).not.toContain('sourceType || "") === "csv"');
    expect(scheduler).toContain('mapping: { ...(mappingConfig || {}), sourceId: String(source?.id || "") },');
  });

  it("reconciles the Overview source list, source count, and Total Spend from one GA4 boundary", () => {
    expect(routes).toContain('app.get("/api/campaigns/:id/spend-sources", requireCampaignAccessParamId');
    expect(routes).toContain('app.get("/api/campaigns/:id/spend-to-date", requireCampaignAccessParamId');
    expect(routes).toContain('storage.getSpendBreakdownBySource(campaignId, startDate, endDate, platformContext)');
    expect(routes).toContain('assertGA4InsightsFinancialCurrencyScope(campaign, sourceDefinitions, null, "Spend")');
    expect(overview).toContain('queryKey: [`/api/campaigns/${campaignId}/spend-sources?platformContext=ga4`]');
    expect(overview).toContain('queryKey: [`/api/campaigns/${campaignId}/spend-to-date?platformContext=ga4`]');
    expect(overview).toContain('queryKey: [`/api/campaigns/${campaignId}/spend-breakdown?platformContext=ga4`]');
    expect(overview).toContain("const spendSourcesCount = spendDisplaySources.length;");
  });

  it("withholds Spend and dependent Performance when source details are unavailable", () => {
    const availability = slice(overview, "const financialSpendAvailable =", "const financialSpendLoading =");
    expect(availability).toContain("hasSpendSources &&");
    expect(availability).toContain("spendMetricAvailable");
    const evaluate = new Function(
      "hasSpendSources", "spendBreakdownResp", "spendToDateResp",
      "spendSourceDefinitionsKnownEmpty", "spendMetricAvailable",
      `${availability} return financialSpendAvailable;`,
    ) as (hasSources: boolean, breakdown: unknown, toDate: unknown, knownEmpty: boolean, metricAvailable: boolean) => boolean;
    expect(evaluate(false, undefined, { spendToDate: 338, sourceIds: ["sheet"] }, false, true)).toBe(false);
    expect(evaluate(true, undefined, { spendToDate: 0 }, false, true)).toBe(true);
    expect(evaluate(true, { totalSpend: 338 }, undefined, false, true)).toBe(true);
    expect(evaluate(true, { totalSpend: 338 }, { spendToDate: 338 }, false, true)).toBe(true);
    const cards = slice(overview, "{/* Total Spend */}", "{/* Campaign Breakdown */}");
    expect(cards).toContain("renderFinancialValue(financialSpendLoading, financialSpendAvailable");
    expect(cards).toContain("financialRevenueAvailable && financialSpendAvailable");
  });

  it("propagates GA4 Spend to KPI, aggregate, snapshot, report, and UI refresh consumers", () => {
    expect(jobs).toContain('getSpendTotalForRange(campaignId, spendSourceWindow.startDate, spendSourceWindow.endDate, "ga4")');
    expect(currentValues).toContain('storage.getSpendBreakdownBySource(campaignId, spendSourceStartDate, endDate, "ga4")');
    expect(snapshots).toContain('dependencies.getSpendTotalForRange(campaignId, "1900-01-01", reportingDate, "ga4")');
    expect(scheduledPdf).toContain('storage.getSpendSources(campaignId, "ga4")');
    expect(scheduledPdf).toContain('storage.getSpendBreakdownBySource(campaignId, spendSourceStartDate, financialEndDate, "ga4")');
    const successRefresh = slice(overview, "<AddSpendWizardModal", "<AddRevenueWizardModal");
    for (const query of ["kpis", "benchmarks", "reports"]) expect(successRefresh).toContain(query);
    expect(successRefresh).toContain("refreshNotificationQueries()");
  });
});
