import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { aggregateCsvRevenueRows, normalizeFinancialSourceDateKey } from "./utils/csv";
import { GOOGLE_SHEETS_REVENUE_MAX_CAMPAIGN_VALUES, selectGoogleSheetsRevenuePreviewRows } from "./utils/google-sheets-revenue-preview";
import { buildGoogleSheetsRevenueRowRanges, GOOGLE_SHEETS_REVENUE_MAX_ROWS, resolveGoogleSheetsRevenueGrid } from "./utils/google-sheets-revenue-ranges";

const routes = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf8");
const scheduler = readFileSync(join(process.cwd(), "server", "auto-refresh-scheduler.ts"), "utf8");
const storage = readFileSync(join(process.cwd(), "server", "storage.ts"), "utf8");
const revenueModal = readFileSync(join(process.cwd(), "client", "src", "components", "AddRevenueWizardModal.tsx"), "utf8");
const ga4Page = readFileSync(join(process.cwd(), "client", "src", "pages", "ga4-metrics.tsx"), "utf8");
const kpiJobs = readFileSync(join(process.cwd(), "server", "ga4-kpi-benchmark-jobs.ts"), "utf8");
const alertValues = readFileSync(join(process.cwd(), "server", "utils", "ga4-alert-current-value.ts"), "utf8");
const scheduledReport = readFileSync(join(process.cwd(), "server", "ga4-scheduled-report-pdf.ts"), "utf8");

const sheetsRevenueRoute = () => {
  const start = routes.indexOf('app.post("/api/campaigns/:id/revenue/sheets/process"');
  const end = routes.indexOf('app.post("/api/campaigns/:id/spend/sheets/preview"', start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return routes.slice(start, end);
};

const sheetsRevenuePreviewRoute = () => {
  const start = routes.indexOf('app.post("/api/campaigns/:id/revenue/sheets/preview"');
  const end = routes.indexOf('app.post("/api/campaigns/:id/revenue/sheets/process"', start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return routes.slice(start, end);
};

describe("GA4 Overview Google Sheets revenue deterministic validation", () => {
  it("supports exact filtered dated and snapshot fixtures", () => {
    const rows = [
      { Date: "2026-07-01", Campaign: "Alpha", Revenue: "$100.25" },
      { Date: "2026-07-02", Campaign: "Alpha", Revenue: "49.75" },
      { Date: "2026-07-03", Campaign: "Beta", Revenue: "25" },
    ];
    expect(aggregateCsvRevenueRows(rows, {
      revenueColumn: "Revenue", dateColumn: "Date", campaignColumn: "Campaign", campaignValues: ["Alpha"],
    })).toEqual({
      keptRows: 2,
      totalRevenue: 150,
      dailyRevenue: [
        { date: "2026-07-01", revenue: 100.25 },
        { date: "2026-07-02", revenue: 49.75 },
      ],
      undatedRevenue: 0,
    });
    expect(aggregateCsvRevenueRows(rows, {
      revenueColumn: "Revenue", campaignColumn: "Campaign", campaignValues: ["Alpha"],
    }).totalRevenue).toBe(150);
  });

  it("identifies blank, invalid, and numeric mapped dates across selected positive rows", () => {
    expect(aggregateCsvRevenueRows([
      { Date: "", Revenue: "100" },
      { Date: "not-a-date", Revenue: "200" },
      { Date: "700", Revenue: "300" },
    ], { revenueColumn: "Revenue", dateColumn: "Date" })).toEqual({
      keptRows: 3,
      totalRevenue: 600,
      dailyRevenue: [],
      undatedRevenue: 600,
    });
  });

  it("preserves the explicit source calendar date for offset timestamps", () => {
    expect(normalizeFinancialSourceDateKey("2026-08-01T23:30:00-05:00")).toBe("2026-08-01");
  });

  it("plans bounded full-width chunks from the exact tab metadata", () => {
    const grid = resolveGoogleSheetsRevenueGrid([
      { properties: { title: "Hidden", index: 0, hidden: true, gridProperties: { rowCount: 9000 } } },
      { properties: { title: "Revenue's Data", index: 1, hidden: false, gridProperties: { rowCount: 6000 } } },
    ], null);
    expect(grid).toEqual({ sheetName: "Revenue's Data", rowCount: 6000 });
    expect(resolveGoogleSheetsRevenueGrid([
      { properties: { title: "Hidden", index: 0, hidden: true, gridProperties: { rowCount: 9000 } } },
      { properties: { title: "Revenue", index: 1, hidden: false, gridProperties: { rowCount: 6000 } } },
    ], "Hidden")).toEqual({ sheetName: "Hidden", rowCount: 9000 });
    expect(resolveGoogleSheetsRevenueGrid([
      { properties: { title: "Revenue", index: 0, hidden: false, gridProperties: { rowCount: 6000 } } },
    ], "Missing")).toBeNull();
    expect(resolveGoogleSheetsRevenueGrid([
      { properties: { title: "Revenue ", index: 0, hidden: false, gridProperties: { rowCount: 6000 } } },
    ], "Revenue ")).toEqual({ sheetName: "Revenue ", rowCount: 6000 });
    expect(buildGoogleSheetsRevenueRowRanges(grid!.sheetName, grid!.rowCount)).toEqual([
      "'Revenue''s Data'!1:5000",
      "'Revenue''s Data'!5001:6000",
    ]);
    const maximumRanges = buildGoogleSheetsRevenueRowRanges("Revenue", GOOGLE_SHEETS_REVENUE_MAX_ROWS);
    expect(maximumRanges).toHaveLength(10);
    expect(maximumRanges.at(-1)).toBe("'Revenue'!45001:50000");
    expect(() => buildGoogleSheetsRevenueRowRanges("Revenue", GOOGLE_SHEETS_REVENUE_MAX_ROWS + 1)).toThrow("at most 50,000 rows");
  });

  it("discovers bounded campaign values from the complete preview rows", () => {
    const rows = Array.from({ length: 100 }, (_, index) => ({
      Campaign: index === 99 ? "Later" : index % 2 === 0 ? "Frequent" : "Other",
      Revenue: String(index + 1),
    }));
    const standardPreview = selectGoogleSheetsRevenuePreviewRows(rows);
    expect(standardPreview.success).toBe(true);
    if (standardPreview.success) expect(standardPreview.sampleRows).toHaveLength(25);
    const selection = selectGoogleSheetsRevenuePreviewRows(rows, "Campaign");
    expect(selection.success).toBe(true);
    if (selection.success) {
      expect(selection.sampleRows.map((row) => row.Campaign)).toEqual(["Frequent", "Other", "Later"]);
    }

    const maximum = Array.from({ length: GOOGLE_SHEETS_REVENUE_MAX_CAMPAIGN_VALUES }, (_, index) => ({ Campaign: `Campaign ${index}` }));
    expect(selectGoogleSheetsRevenuePreviewRows(maximum, "Campaign")).toMatchObject({ success: true });
    const tooMany = [...maximum, { Campaign: `Campaign ${GOOGLE_SHEETS_REVENUE_MAX_CAMPAIGN_VALUES}` }];
    expect(selectGoogleSheetsRevenuePreviewRows(tooMany, "Campaign")).toMatchObject({ success: false });

    const preview = sheetsRevenuePreviewRoute();
    expect(preview).toContain("campaignColumn: z.string().trim().min(1).optional()");
    expect(preview).toContain("selectGoogleSheetsRevenuePreviewRows(rows, campaignColumn)");
    expect(preview).toContain("res.status(413).json({ success: false, error: previewSelection.error })");
    expect(revenueModal).toContain("campaignColumn: requestedCampaignColumn");
    expect(revenueModal).toContain("sheetsPreviewRequestRef.current");
    expect(revenueModal).toContain("return sheetsCampaignValues.length === 0;");
  });

  it("fails metadata and chunk reads closed before revenue can be shown or saved", () => {
    const preview = sheetsRevenuePreviewRoute();
    const process = sheetsRevenueRoute();
    const schedulerStart = scheduler.indexOf("async function reprocessGoogleSheetsRevenue(");
    const schedulerEnd = scheduler.indexOf("export async function runGoogleSheetsSpendSourceRefreshForValidation", schedulerStart);
    const schedulerRevenue = scheduler.slice(schedulerStart, schedulerEnd);
    const helperStart = routes.indexOf("const readGoogleSheetsRevenueChunks = async");
    const helperEnd = routes.indexOf("// Request validation helpers", helperStart);
    const helper = routes.slice(helperStart, helperEnd);

    expect(routes).toContain("const readGoogleSheetsRevenueChunks = async");
    expect(helper).toContain("for (const range of ranges)");
    expect(helper.indexOf("if (!response.ok)")).toBeLessThan(helper.indexOf("return { success: true, values }"));
    expect(preview).toContain("readGoogleSheetsRevenueChunks(conn, accessToken, resp)");
    expect(process.indexOf("readGoogleSheetsRevenueChunks(conn, accessToken, resp)")).toBeLessThan(process.indexOf("storage.replaceRevenueSourceWithRecords"));
    expect(schedulerRevenue).toContain("buildGoogleSheetsRevenueRowRanges(grid.sheetName, grid.rowCount)");
    expect(schedulerRevenue).toContain("for (const range of ranges)");
    expect(schedulerRevenue.indexOf("chunk fetch failed")).toBeLessThan(schedulerRevenue.indexOf("storage.replaceRevenueSourceWithRecords"));
  });

  it("fails the GA4 foreground path before source mutation", () => {
    const route = sheetsRevenueRoute();
    const validation = route.indexOf("const validation = aggregateCsvRevenueRows(rows");
    const firstMutation = route.indexOf("storage.createRevenueSource");
    expect(route).toContain("if (campaignCol === revenueCol)");
    expect(route).toContain("if (dateCol && (dateCol === revenueCol || dateCol === campaignCol))");
    expect(route).toContain("if (validation.keptRows === 0)");
    expect(route).toContain("if (dateCol && validation.undatedRevenue > 0)");
    expect(validation).toBeGreaterThanOrEqual(0);
    expect(validation).toBeLessThan(firstMutation);
  });

  it("fails the GA4 scheduler path before atomic source replacement", () => {
    const start = scheduler.indexOf("async function reprocessGoogleSheetsRevenue(");
    const end = scheduler.indexOf("export async function runGoogleSheetsSpendSourceRefreshForValidation", start);
    const fn = scheduler.slice(start, end);
    expect(fn).toContain('=== "ga4"');
    expect(fn).toContain("const validation = aggregateCsvRevenueRows(mappedRows.map");
    expect(fn.indexOf("validation.keptRows === 0")).toBeLessThan(fn.indexOf("storage.replaceRevenueSourceWithRecords"));
    expect(fn.indexOf("validation.undatedRevenue > 0")).toBeLessThan(fn.indexOf("storage.replaceRevenueSourceWithRecords"));
    expect(fn).toContain("normalizeFinancialSourceDateKey(dateStr)");
    expect(fn).toContain('if (platformContext === "ga4" && requestedCurrency !== campaignCurrency) return false;');
    expect(fn).toContain("const campaignValueRevenueTotals = new Map<string, number>();");
    expect(fn).toContain("campaignValueRevenueTotals: campaignCol");
  });

  it("refreshes token-only connections and rejects stale source replacement", () => {
    const route = sheetsRevenueRoute();
    const start = scheduler.indexOf("async function reprocessGoogleSheetsRevenue(");
    const end = scheduler.indexOf("export async function runGoogleSheetsSpendSourceRefreshForValidation", start);
    const fn = scheduler.slice(start, end);
    expect(fn).toContain("if (!accessToken)");
    expect(fn).toContain("await refreshAccessToken()");
    expect(fn).toContain("tokens.refresh_token ? { refreshToken: tokens.refresh_token }");
    expect(fn).toContain('records as any, String(source.mappingConfig || "")');
    expect(route.indexOf("const existingSheetsSource")).toBeLessThan(route.indexOf("https://sheets.googleapis.com"));
    expect(route).toContain('e?.code === "REVENUE_SOURCE_CHANGED" ? 409 : 500');
    expect(storage).toContain("eq(revenueSources.mappingConfig, expectedSourceMappingConfig)");
    expect(storage).toContain("error.code = 'REVENUE_SOURCE_CHANGED'");
  });

  it("feeds the exact materialized source through current GA4 consumers", () => {
    const route = sheetsRevenueRoute();
    const replacement = route.indexOf("await storage.replaceRevenueSourceWithRecords(");
    const recompute = route.indexOf("await recomputeCampaignDerivedValues(campaignId, { platformContext });", replacement);
    const recomputeCatch = route.indexOf("} catch (error: any) {", recompute);
    const committedSourceLog = route.indexOf("[Google Sheets Revenue] Post-commit derived recompute failed; source data remains committed:", recomputeCatch);
    const response = route.indexOf("return res.json({ success: true, mode: 'revenue_to_date'", committedSourceLog);
    expect(route).toContain("sourceType: 'google_sheets'");
    expect(replacement).toBeGreaterThanOrEqual(0);
    expect(recompute).toBeGreaterThan(replacement);
    expect(recomputeCatch).toBeGreaterThan(recompute);
    expect(committedSourceLog).toBeGreaterThan(recomputeCatch);
    expect(response).toBeGreaterThan(committedSourceLog);

    expect(kpiJobs).toContain('storage.getRevenueTotalForRange(campaignId, financialSourceWindow.startDate, financialSourceWindow.endDate, "ga4")');
    expect(alertValues).toContain('storage.getRevenueTotalForRange(campaignId, financialWindow.startDate, financialWindow.endDate, "ga4")');
    expect(scheduledReport).toContain('storage.getRevenueBreakdownBySource(campaignId, importedRevenueStartDate, importedRevenueEndDate, "ga4")');
    expect(ga4Page).toContain("const financialRevenue = ga4RevenueForFinancials + importedRevenueForFinancials;");
    expect(ga4Page).toContain("const totals = Array.isArray(cfg?.campaignValueRevenueTotals) ? cfg.campaignValueRevenueTotals : [];");

    const invalidationStart = revenueModal.indexOf("const invalidateAfterRevenueChange");
    const invalidationEnd = revenueModal.indexOf("const resetAll = () =>", invalidationStart);
    const invalidation = revenueModal.slice(invalidationStart, invalidationEnd);
    expect(invalidation).toContain("/revenue-to-date");
    expect(invalidation).toContain("/revenue-sources");
    expect(invalidation).toContain("/revenue-breakdown");
    expect(invalidation).toContain("/outcome-totals");
  });

  it("rejects an identical concurrent GA4 add without changing additive edit semantics", () => {
    const route = sheetsRevenueRoute();
    expect(routes).toContain("const inFlightGoogleSheetsRevenueAdds = new Set<string>();");
    expect(route).toContain('if (platformContext === "ga4" && !existingSourceId)');
    expect(route).toContain("inFlightGoogleSheetsRevenueAdds.has(addRequestKey)");
    expect(route).toContain('res.status(409).json({ success: false, error: "This Google Sheets revenue import is already processing." })');
    expect(route).toContain("if (addRequestKey) inFlightGoogleSheetsRevenueAdds.delete(addRequestKey)");
  });

  it("limits only GA4 Google Sheets Date choices and clears stale selections", () => {
    expect(revenueModal).toContain('if (platformContext !== "ga4") return sheetsHeaders;');
    expect(revenueModal).toContain("if (header === sheetsRevenueCol || header === sheetsCampaignCol) return false;");
    expect(revenueModal).toContain("{sheetsDateColumnHeaders.map((h) => (");
    expect(revenueModal).toContain("sheetsDateCol && !sheetsDateColumnHeaders.includes(sheetsDateCol)");
  });
});
