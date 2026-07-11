import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { aggregateCsvSpendRows, parseCsvText } from "./utils/csv";

const routes = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf8");
const storageSource = readFileSync(join(process.cwd(), "server", "storage.ts"), "utf8");
const spendModalSource = readFileSync(join(process.cwd(), "client", "src", "components", "AddSpendWizardModal.tsx"), "utf8");

const csvSpendRoute = () => {
  const start = routes.indexOf('app.post("/api/campaigns/:id/spend/csv/process"');
  const end = routes.indexOf('app.post("/api/campaigns/:id/spend/sheets/preview"', start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return routes.slice(start, end);
};

describe("GA4 Overview Upload CSV spend validation packet", () => {
  it.each([
    {
      name: "BOM and CRLF comma export with a quoted currency value",
      content: [
        String.fromCharCode(0xfeff) + "Date,Campaign,Spend",
        '2026-07-01,Alpha,"$1,200.50"',
        "",
      ].join(String.fromCharCode(13, 10)),
      mapping: { spendColumn: "Spend" },
      expectedHeaders: ["Date", "Campaign", "Spend"],
      expectedTotal: 1200.5,
    },
    {
      name: "semicolon export",
      content: [
        "Date;Campaign;Spend",
        "2026-07-01;Alpha;120.25",
        "2026-07-02;Beta;79.75",
        "",
      ].join(String.fromCharCode(10)),
      mapping: { spendColumn: "Spend" },
      expectedHeaders: ["Date", "Campaign", "Spend"],
      expectedTotal: 200,
    },
    {
      name: "tab export",
      content: [
        ["Date", "Campaign", "Spend"].join(String.fromCharCode(9)),
        ["2026-07-01", "Alpha", "45.50"].join(String.fromCharCode(9)),
        "",
      ].join(String.fromCharCode(10)),
      mapping: { spendColumn: "Spend" },
      expectedHeaders: ["Date", "Campaign", "Spend"],
      expectedTotal: 45.5,
    },
    {
      name: "pipe export",
      content: [
        "Date|Campaign|Spend",
        "2026-07-01|Alpha|30",
        "2026-07-02|Beta|20",
        "",
      ].join(String.fromCharCode(10)),
      mapping: { spendColumn: "Spend" },
      expectedHeaders: ["Date", "Campaign", "Spend"],
      expectedTotal: 50,
    },  ])("parses and totals $name", ({ content, mapping, expectedHeaders, expectedTotal }) => {
    const parsed = parseCsvText(content);

    expect(parsed.headers).toEqual(expectedHeaders);
    expect(aggregateCsvSpendRows(parsed.rows, mapping)).toMatchObject({
      keptRows: parsed.rows.length,
      totalSpend: expectedTotal,
      dailySpend: [],
    });
  });

  it("filters one or multiple exact campaign values without allocating other rows", () => {
    const rows = [
      { Campaign: "Alpha", Spend: "100" },
      { Campaign: "Beta", Spend: "200" },
      { Campaign: "Gamma", Spend: "300" },
    ];

    expect(aggregateCsvSpendRows(rows, {
      spendColumn: "Spend",
      campaignColumn: "Campaign",
      campaignValue: "Beta",
    })).toMatchObject({ keptRows: 1, totalSpend: 200 });

    expect(aggregateCsvSpendRows(rows, {
      spendColumn: "Spend",
      campaignColumn: "Campaign",
      campaignValues: ["Alpha", "Gamma"],
    })).toMatchObject({ keptRows: 2, totalSpend: 400 });
  });

  it("identifies selected Alpha spend that cannot be imported as dated records", () => {
    const rows = [
      { Date: "2026-07-01", Campaign: "Alpha", Spend: "100.25" },
      { Date: "2026-07-01", Campaign: "Alpha", Spend: "49.75" },
      { Date: "2026-07-02", Campaign: "Beta", Spend: "25" },
      { Date: "", Campaign: "Alpha", Spend: "500" },
      { Date: "not-a-date", Campaign: "Alpha", Spend: "600" },
    ];

    const result = aggregateCsvSpendRows(rows, {
      spendColumn: "Spend",
      dateColumn: "Date",
      campaignColumn: "Campaign",
      campaignValues: ["Alpha"],
    });

    expect(result).toEqual({
      keptRows: 4,
      totalSpend: 1250,
      dailySpend: [
        { date: "2026-07-01", spend: 150 },
      ],
      undatedSpend: 1100,
    });
    expect(result.dailySpend.reduce((sum, row) => sum + row.spend, result.undatedSpend)).toBe(result.totalSpend);
  });

  it("does not coerce numeric metric values into calendar years", () => {
    expect(aggregateCsvSpendRows([
      { Date: "500", Spend: "10" },
      { Date: "600", Spend: "20" },
    ], {
      spendColumn: "Spend",
      dateColumn: "Date",
    })).toEqual({
      keptRows: 2,
      totalSpend: 30,
      dailySpend: [],
      undatedSpend: 30,
    });
  });

  it("returns no accepted rows when the selected mapping has no valid positive spend", () => {
    expect(aggregateCsvSpendRows([
      { Date: "", Spend: "0" },
      { Date: "bad-date", Spend: "-10" },
      { Date: "2026-07-01", Spend: "invalid" },
    ], {
      spendColumn: "Spend",
      dateColumn: "Date",
    })).toEqual({ keptRows: 0, totalSpend: 0, dailySpend: [], undatedSpend: 0 });
  });

  it("wires validated aggregation into the route before source mutation", () => {
    const route = csvSpendRoute();

    expect(route).toContain('const requestedPlatformContext = rawPlatformContext === "ga4" ? "" : rawPlatformContext;');
    expect(route).toContain("const aggregation = aggregateCsvSpendRows(parsedRows");
    expect(route).toContain('if (kept === 0)');
    expect(route).toContain("if (dateCol && aggregation.undatedSpend > 0)");
    expect(route).toContain("Selected spend rows contain blank or invalid dates. Fix those dates or clear the Date mapping before importing.");
    expect(route).toContain('No valid spend rows found for the selected mapping');
    expect(route.indexOf("const aggregation = aggregateCsvSpendRows(parsedRows")).toBeLessThan(
      route.indexOf("const campaign = await storage.getCampaign(campaignId);"),
    );
    expect(route.indexOf('if (kept === 0)')).toBeLessThan(
      route.indexOf("storage.replaceCsvSpendSourceWithRecords"),
    );
    expect(route.indexOf("if (dateCol && aggregation.undatedSpend > 0)")).toBeLessThan(
      route.indexOf("const campaign = await storage.getCampaign(campaignId);"),
    );
    expect(route).not.toContain("dailySpendMap.set(today, (dailySpendMap.get(today) || 0) + aggregation.undatedSpend)");
  });

  it("rejects duplicate CSV date roles and removes them from the CSV Date options", () => {
    const route = csvSpendRoute();

    expect(route).toContain("if (dateCol && (dateCol === spendCol || dateCol === campaignCol))");
    expect(route).toContain("Date column must be different from the Spend and Campaign columns.");
    expect(route.indexOf("if (dateCol && (dateCol === spendCol || dateCol === campaignCol))")).toBeLessThan(
      route.indexOf("const aggregation = aggregateCsvSpendRows(parsedRows"),
    );
    expect(spendModalSource).toContain('const dateColumnHeaders = step === "csv_map"');
    expect(spendModalSource).toContain("if (header === spendColumn || header === effectiveCampaignColumn) return false;");
    expect(spendModalSource).toContain("if (isCsvDateLikeHeader(header)) return true;");
    expect(spendModalSource).toContain("return nonEmptyValues.every(isCsvDateLikeValue);");
    expect(spendModalSource).toContain('if (!raw || /^[+-]?(?:\\d+\\.?\\d*|\\.\\d+)$/.test(raw)) return false;');
    expect(spendModalSource).toContain("{dateColumnHeaders.map((h) => <SelectItem");
    expect(spendModalSource).toContain('if (step === "csv_map" && spendDateColumn === value) setSpendDateColumn("");');
    expect(spendModalSource).toContain('if (step === "csv_map" && spendDateColumn === v) setSpendDateColumn("");');
  });

  it("preserves stored-row edit mapping guards and stable source identity", () => {
    const route = csvSpendRoute();

    expect(route).toContain("Re-upload required when changing the spend column for a CSV source");
    expect(route).toContain("Re-upload required when changing the date column for a CSV source");
    expect(route).toContain("Re-upload required when changing the campaign identifier column for a CSV source");
    expect(route).toContain("const existingSource = await storage.getSpendSource(campaignId, existingSourceId);");
    expect(route).toContain("const source = await storage.replaceCsvSpendSourceWithRecords(");
    expect(route).toContain("existingSourceId ? String(existingSourceId) : null");
    expect(route).toContain("...(platformContext ? { platformContext } : {})");
    expect(route).not.toContain("delete mappingForStorage.sourceType");
  });

  it("atomically replaces the source and records before campaign recompute", () => {
    const route = csvSpendRoute();
    const methodStart = storageSource.indexOf("async replaceCsvSpendSourceWithRecords(");
    const methodEnd = storageSource.indexOf("async getSpendTotalForRange", methodStart);
    const method = storageSource.slice(methodStart, methodEnd);

    expect(methodStart).toBeGreaterThanOrEqual(0);
    expect(methodEnd).toBeGreaterThan(methodStart);
    expect(method).toContain("return await db.transaction(async (tx: any) => {");
    expect(method).toContain('eq(spendSources.sourceType, "csv")');
    expect(method).toContain("eq(spendSources.campaignId, campaignId)");
    expect(method.indexOf("await tx.delete(spendRecords)")).toBeLessThan(
      method.indexOf("await tx.insert(spendRecords)"),
    );
    expect(route).not.toContain('console.warn("[CSV Spend] Failed to create spend_record:"');
    expect(route.indexOf("await storage.replaceCsvSpendSourceWithRecords")).toBeLessThan(
      route.indexOf("await recalcCampaignSpend(campaignId);"),
    );
    expect(route).toContain('res.status(500).json({ success: false, error: e?.message || "Failed to process CSV spend" })');
  });
});
