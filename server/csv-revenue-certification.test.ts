import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import {
  findInvalidGa4CsvRevenueDateRows,
  isSupportedGa4CsvRevenueDate,
  isSupportedGa4CsvRevenueAmount,
  parseCsvText,
} from "./utils/csv";

const routes = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf8");
const storage = readFileSync(join(process.cwd(), "server", "storage.ts"), "utf8");
const modal = readFileSync(join(process.cwd(), "client", "src", "components", "AddRevenueWizardModal.tsx"), "utf8");
const scheduler = readFileSync(join(process.cwd(), "server", "auto-refresh-scheduler.ts"), "utf8");

const csvProcessRoute = () => {
  const start = routes.indexOf('"/api/campaigns/:id/revenue/csv/process"');
  const end = routes.indexOf('app.post("/api/campaigns/:id/revenue/sheets/preview"', start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return routes.slice(start, end);
};

describe("GA4 CSV Revenue current-main certification guards", () => {
  it("strictly parses UTF-8 BOM, semicolon exports, quoted delimiters, and quoted newlines", () => {
    const parsed = parseCsvText(
      '\uFEFFDate;Campaign;Revenue\r\n2026-09-01;"Alpha; North";1,234.56\r\n2026-09-02;"Beta\nSouth";25',
      5_000,
      { strict: true },
    );

    expect(parsed.headers).toEqual(["Date", "Campaign", "Revenue"]);
    expect(parsed.rows).toEqual([
      { Date: "2026-09-01", Campaign: "Alpha; North", Revenue: "1,234.56" },
      { Date: "2026-09-02", Campaign: "Beta\nSouth", Revenue: "25" },
    ]);
  });

  it("accepts exactly the configured data-row cap and rejects the next logical row without truncation", () => {
    const atLimit = `Revenue\n${Array.from({ length: 5_000 }, () => "1").join("\n")}`;
    expect(parseCsvText(atLimit, 5_000, { strict: true }).rows).toHaveLength(5_000);

    const overLimit = `${atLimit}\n1`;
    try {
      parseCsvText(overLimit, 5_000, { strict: true });
      throw new Error("expected the strict row cap to reject");
    } catch (error: any) {
      expect(error.code).toBe("CSV_TOO_LARGE");
      expect(error.message).toContain("5,000 data rows");
    }
  });

  it("rejects malformed or ambiguous file structures before mapping", () => {
    const invalid = [
      'Revenue,Campaign\n"100,Alpha',
      "Revenue,Revenue\n100,200",
      "Revenue,Campaign\n100,Alpha,extra",
      "Revenue,,Date\n100,Alpha,2026-09-01",
      "Revenue,Campaign;Date\n100,Alpha;2026-09-01",
      "Revenue\n100\u0000",
      "Revenue",
    ];
    for (const text of invalid) {
      expect(() => parseCsvText(text, 5_000, { strict: true }), text).toThrow();
    }
  });

  it("accepts only deterministic date keys or ISO-style timestamps", () => {
    for (const value of ["2026-09-01", "2026-09-01T12:30:45Z", "2026-09-01 12:30+0200"]) {
      expect(isSupportedGa4CsvRevenueDate(value), value).toBe(true);
    }
    for (const value of ["", "01/02/2026", "September 1, 2026", "2026-02-30", "2026-09-01garbage", "2026-09-01T25:00Z"]) {
      expect(isSupportedGa4CsvRevenueDate(value), value).toBe(false);
    }
  });

  it("accepts canonical amounts and rejects locale-ambiguous or partial numeric text", () => {
    for (const value of ["1234.56", ".50", "$1,234.56", "-$100", "$-100", "", 25]) {
      expect(isSupportedGa4CsvRevenueAmount(value, "USD"), String(value)).toBe(true);
    }
    for (const value of ["1.234,56", "12,34", "1 234.56", "100 USD", "100abc", "1e3", "€100", "1.234"]) {
      expect(isSupportedGa4CsvRevenueAmount(value, "USD"), value).toBe(false);
    }
    expect(isSupportedGa4CsvRevenueAmount("$100", "EUR")).toBe(false);
    expect(isSupportedGa4CsvRevenueAmount("100", "EUR")).toBe(true);
    expect(isSupportedGa4CsvRevenueAmount("9999999999.99", "USD")).toBe(true);
    expect(isSupportedGa4CsvRevenueAmount("10000000000.00", "USD")).toBe(false);
  });

  it("reports only selected positive-revenue rows with invalid dates", () => {
    expect(findInvalidGa4CsvRevenueDateRows([
      { Campaign: "Alpha", Revenue: "25", Date: "2026-09-01" },
      { Campaign: "Beta", Revenue: "30", Date: "01/02/2026" },
      { Campaign: "Alpha", Revenue: "40", Date: "01/02/2026" },
      { Campaign: "Alpha", Revenue: "0", Date: "" },
    ], {
      revenueColumn: "Revenue",
      dateColumn: "Date",
      campaignColumn: "Campaign",
      campaignValues: ["Alpha"],
    })).toEqual([4]);
  });

  it("validates structure, mapped headers, amounts, and dates before the GA4 transaction", () => {
    const route = csvProcessRoute();
    const parseIndex = route.indexOf('parseCsvText(csvText, MAX_CSV_ROWS_PROCESS, { strict: platformContext === "ga4" })');
    const headerIndex = route.indexOf("!parsedHeaders.includes(column)");
    const amountIndex = route.indexOf("findInvalidGa4CsvRevenueAmountRows(parsedRows");
    const dateIndex = route.indexOf("findInvalidGa4CsvRevenueDateRows(parsedRows");
    const totalLimitIndex = route.indexOf("validation.totalRevenue > GA4_CSV_MAX_REVENUE_TOTAL");
    const mutationIndex = route.indexOf("replaceGa4CsvRevenueSourceWithRecords(");

    for (const index of [parseIndex, headerIndex, amountIndex, dateIndex, totalLimitIndex, mutationIndex]) expect(index).toBeGreaterThan(-1);
    expect(parseIndex).toBeLessThan(headerIndex);
    expect(headerIndex).toBeLessThan(amountIndex);
    expect(amountIndex).toBeLessThan(dateIndex);
    expect(dateIndex).toBeLessThan(totalLimitIndex);
    expect(totalLimitIndex).toBeLessThan(mutationIndex);
    expect(route).toContain("use $ only for USD campaigns.");
    expect(route).toContain("Use YYYY-MM-DD or an ISO-style timestamp.");
  });

  it("guards duplicate adds, overlapping edits, campaign-scoped replacement, and post-commit responses", () => {
    const route = csvProcessRoute();
    const storageStart = storage.indexOf("async replaceGa4CsvRevenueSourceWithRecords(");
    const storageEnd = storage.indexOf("async replaceGa4HubspotRevenueSourceWithRecords(", storageStart);
    const replacement = storage.slice(storageStart, storageEnd);

    expect(routes).toContain("const inFlightGa4CsvRevenueAdds = new Set<string>();");
    expect(route).toContain(".update(file.buffer)");
    expect(route).toContain("inFlightGa4CsvRevenueAdds.has(addRequestKey)");
    expect(route).toContain("finally {");
    expect(route).toContain("inFlightGa4CsvRevenueAdds.delete(addRequestKey)");
    expect(route).toContain("existingSourceForEdit ? String(existingSourceForEdit.mappingConfig || \"\") : undefined");
    expect(replacement).toContain("eq(revenueSources.mappingConfig, expectedSourceMappingConfig)");
    expect(replacement).toContain('error.code = "CSV_REVENUE_SOURCE_CHANGED"');
    expect(replacement).toContain("eq(revenueRecords.campaignId, campaignId)");
    expect(replacement).toContain('sourceType: "csv"');
    expect(route).toContain("Post-import GA4 recompute failed after source commit");
    expect(routes).toContain("Post-delete GA4 recompute failed after source commit");
  });

  it("keeps the campaign filter optional and discovers values from all retained supported rows", () => {
    expect(modal).toContain('fd.append("platformContext", platformContext);');
    expect(routes).toContain('sampleRows: platformContext === "ga4" ? parsed.rows : parsed.rows.slice(0, 25)');
    expect(modal).toContain("const storedRows = Array.isArray(config?.csvStoredRevenueRows)");
    expect(modal).toContain('platformContext === "ga4" && storedRows.length > 0');
    expect(modal).toContain("[storedRevenueColumn, storedCampaignColumn, storedDateColumn].filter(Boolean)");
    expect(modal).toContain("const hasCampaignScope = Boolean(csvCampaignCol && csvCampaignValues.length > 0);");
    expect(modal).toContain("campaignColumn: hasCampaignScope ? csvCampaignCol : null");
    expect(modal).not.toContain('if (!csvCampaignCol) {\n      toast({ title: "Select a campaign column"');
    expect(modal).toContain("Campaign identifier (optional)");
  });

  it("opens an existing CSV source on the upload step before column mapping", () => {
    const csvEditStart = modal.indexOf('if (type === "csv")');
    const salesforceEditStart = modal.indexOf('if (type === "salesforce")', csvEditStart);
    const csvEdit = modal.slice(csvEditStart, salesforceEditStart);

    expect(csvEditStart).toBeGreaterThan(-1);
    expect(salesforceEditStart).toBeGreaterThan(csvEditStart);
    expect(csvEdit).toContain('setStep("csv")');
    expect(csvEdit).not.toContain('setStep("csv_map")');
    const csvPreviewStart = modal.indexOf("const handleCsvPreview = async");
    const csvProcessStart = modal.indexOf("const handleCsvProcess = async", csvPreviewStart);
    expect(modal.slice(csvPreviewStart, csvProcessStart)).toContain('setStep("csv_map")');
    expect(modal).toContain('step === "csv_map" ? (isEditing ? "Edit CSV revenue" : "Map CSV columns")');
  });

  it("rejects oversized GA4 files in the browser before preview or process requests", () => {
    const previewStart = modal.indexOf("const handleCsvPreview = async");
    const processStart = modal.indexOf("const handleCsvProcess = async", previewStart);
    const sheetsStart = modal.indexOf("const handleSheetsPreview = async", processStart);
    const preview = modal.slice(previewStart, processStart);
    const process = modal.slice(processStart, sheetsStart);

    expect(modal).toContain("const GA4_CSV_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;");
    expect(preview).toContain('platformContext === "ga4" && file.size > GA4_CSV_MAX_FILE_SIZE_BYTES');
    expect(process).toContain('platformContext === "ga4" && csvFile && csvFile.size > GA4_CSV_MAX_FILE_SIZE_BYTES');
    expect(preview.indexOf("GA4_CSV_MAX_FILE_SIZE_BYTES")).toBeLessThan(preview.indexOf("setCsvPreviewing(true)"));
    expect(process.indexOf("GA4_CSV_MAX_FILE_SIZE_BYTES")).toBeLessThan(process.indexOf("setCsvProcessing(true)"));
  });

  it("returns 413 for canonical oversized GA4 multipart requests without changing other platform errors", () => {
    const uploadStart = routes.indexOf("const uploadRevenueCsv =");
    const uploadEnd = routes.indexOf("const parseNum =", uploadStart);
    const upload = routes.slice(uploadStart, uploadEnd);
    const previewStart = modal.indexOf("const handleCsvPreview = async");
    const processStart = modal.indexOf("const handleCsvProcess = async", previewStart);
    const sheetsStart = modal.indexOf("const handleSheetsPreview = async", processStart);
    const preview = modal.slice(previewStart, processStart);
    const process = modal.slice(processStart, sheetsStart);
    const previewForm = preview.slice(preview.indexOf("const fd = new FormData()"));
    const processForm = process.slice(process.indexOf("const fd = new FormData()"));

    expect(upload).toContain('platformContext === "ga4" && error?.code === "LIMIT_FILE_SIZE"');
    expect(upload).toContain("res.status(413).json({ message: error.message })");
    expect(upload).toContain("return next(error)");
    expect(previewForm.indexOf('if (platformContext === "ga4")')).toBeLessThan(previewForm.indexOf('fd.append("file", file)'));
    expect(processForm.indexOf('if (platformContext === "ga4")')).toBeLessThan(processForm.indexOf('fd.append("file", csvFile)'));
    expect(previewForm.indexOf('if (platformContext !== "ga4")')).toBeGreaterThan(previewForm.indexOf('fd.append("file", file)'));
    expect(processForm.indexOf('if (platformContext !== "ga4")')).toBeGreaterThan(processForm.indexOf('fd.append("file", csvFile)'));
  });

  it("keeps CSV manual and outside all revenue refresh selections", () => {
    const sheetsRefreshStart = scheduler.indexOf("export async function runGoogleSheetsRevenueAutoRefreshOnce");
    const sheetsRefreshEnd = scheduler.indexOf("export async function runHubSpotPipelineAutoRefreshOnce", sheetsRefreshStart);
    const sheetsRefresh = scheduler.slice(sheetsRefreshStart, sheetsRefreshEnd);
    expect(sheetsRefresh).toContain('toLowerCase() === "google_sheets"');
    expect(sheetsRefresh).not.toContain('"csv"');
    expect(scheduler).not.toContain("reprocessCsv");
    expect(modal).toContain("Requires manual re-upload to update.");
    expect(modal).toContain("CSV data won't auto-update.");
  });
});
