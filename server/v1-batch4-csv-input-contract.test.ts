import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
import * as csv from "./utils/csv";

const source = readFileSync(new URL("./routes-oauth.ts", import.meta.url), "utf8");
const ast = ts.createSourceFile("routes-oauth.ts", source, ts.ScriptTarget.Latest, true);
const date = "2026-10-21";

// Execute the registered handler from current code, with isolated storage/provider boundaries.
function fixture(kind: "spend" | "revenue", action = "process", currency = "EUR") {
  const route = `/api/campaigns/:id/${kind}/csv/${action}`;
  let registration = "";
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && node.expression.getText(ast) === "app.post"
      && ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text === route) registration = node.getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  if (!registration) throw new Error(`Missing route: ${route}`);
  let handler: any;
  const campaign = { id: "a", currency, reportingTimeZone: "Europe/Amsterdam" };
  const existing: any = { id: "source-a", campaignId: "a", sourceType: "csv", platformContext: "ga4", currency,
    mappingConfig: JSON.stringify({ spendColumn: "Spend", storedSpendColumn: "Spend", dateColumn: "Date", storedDateColumn: "Date",
      csvStoredSpendRows: [{ spendRaw: "20", dateRaw: date }], csvRowCount: 1 }) };
  const replace = vi.fn(async (..._args: any[]) => ({ id: "source-a" }));
  const storage = { getCampaign: vi.fn(async () => campaign), getSpendSource: vi.fn(async () => existing),
    getRevenueSource: vi.fn(async () => existing), replaceCsvSpendSourceWithRecords: replace, replaceGa4CsvRevenueSourceWithRecords: replace };
  const recompute = vi.fn();
  const dependencies: any = {
    ...csv, Buffer, createHash, storage, app: { post: (_path: string, ...callbacks: any[]) => { handler = callbacks.at(-1); } },
    importRateLimiter: () => {}, requireCampaignAccessParamId: () => {}, uploadCsv: { single: () => () => {} }, uploadRevenueCsv: () => {},
    MAX_CSV_ROWS_PREVIEW: 50_000, MAX_CSV_ROWS_PROCESS: 50_000,
    countLinesUpTo: (text: string) => text.split("\n").length,
    isSupportedScopedSpendPlatformContext: (context: string) => ["ga4", "linkedin"].includes(context),
    spendSourceMatchesPlatformContext: (value: any, context: string) => value.platformContext === context,
    parseCsvRevenuePlatformContext: (value: string, fallback: string) => value || fallback,
    zRevenueMapping: { safeParse: (data: any) => ({ success: true, data }) },
    normalizeOverviewInventoryConfigValue: (value: any) => value, inFlightGa4CsvRevenueAdds: new Set(),
    sendBadRequest: (res: any, error: string) => res.status(400).json({ success: false, error }),
    parseNum: (value: unknown) => Number.parseFloat(String(value).replace(/[$,]/g, "")),
    getReportingDateWindow: () => ({ endDate: date }), yesterdayUTC: () => date,
    googleAdsCampaignIdFromValueOrMapping: () => null, recalcCampaignSpend: vi.fn(), recomputeGA4SpendBeforeResponse: recompute,
    recomputeCampaignDerivedValues: recompute, devLog: () => {},
  };
  new Function(...Object.keys(dependencies), ts.transpileModule(registration, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText)(...Object.values(dependencies));
  const invoke = async (text?: string, mapping: any = {}) => {
    const res: any = { statusCode: 200, status(code: number) { this.statusCode = code; return this; }, json(body: any) { this.body = body; return this; } };
    await handler({ params: { id: "a" }, _campaign: campaign,
      body: { platformContext: "ga4", mapping: JSON.stringify({ [kind === "spend" ? "spendColumn" : "revenueColumn"]: kind === "spend" ? "Spend" : "Revenue", dateColumn: "Date", platformContext: "ga4", currency, ...mapping }) },
      ...(text === undefined ? {} : { file: { buffer: Buffer.from(text), originalname: "fixture.csv" } }) }, res);
    return res;
  };
  return { invoke, replace, recompute, existing, storage };
}

describe("Batch 4 CSV input contracts at the actual route boundary", () => {
  it.each(["preview", "process"])("retains all 50,000 data rows for spend %s and rejects row 50,001", async action => {
    const f = fixture("spend", action);
    const text = `Date,Spend\n${Array.from({ length: 50_000 }, () => `${date},1`).join("\n")}`;
    const result = await f.invoke(text);
    expect(result.statusCode, result.body?.error).toBe(200);
    expect(result.body.rowCount).toBe(50_000);
    if (action === "process") {
      expect(result.body.spendToDate).toBe(50_000);
      expect(f.replace.mock.calls[0][3]).toEqual([{ campaignId: "a", date, spend: "50000.00", currency: "EUR", sourceType: "csv" }]);
    }
    f.replace.mockClear();
    const rejected = await f.invoke(`${text}\n${date},1`);
    expect(rejected.statusCode).toBe(413);
    expect(rejected.body.code).toBe("CSV_TOO_LARGE");
    expect(f.replace).not.toHaveBeenCalled();
  });

  it.each(["preview", "process"])("rejects malformed spend structure before %s mutation", async action => {
    for (const text of ["Date,Spend,Spend\n2026-10-21,100,7", "Date,Spend\n2026-10-21,100,7", 'Date,Spend\n2026-10-21,"100', "Date,\n2026-10-21,100"]) {
      const f = fixture("spend", action);
      expect((await f.invoke(text)).statusCode, text).toBe(400);
      expect(f.replace).not.toHaveBeenCalled();
    }
  });

  it.each(["12oops", "-10", "$100", "1e3", "1.234", "12,34", "10000000000"])("rejects unsupported selected spend %s without replacing the saved source", async amount => {
    const f = fixture("spend");
    const result = await f.invoke(`Date;Spend\n${date};100\n${date};${amount}`, { sourceId: "source-a" });
    expect(result.statusCode, result.body?.error).toBe(400);
    expect(f.replace).not.toHaveBeenCalled();
    expect(f.recompute).not.toHaveBeenCalled();
  });

  it.each(["2026-02-30", "10/11/2026", "2026-10-21T25:00Z", "2026-10-21garbage"])("rejects ambiguous or invalid selected spend date %s", async value => {
    const f = fixture("spend");
    expect((await f.invoke(`Date,Spend\n${value},10`)).statusCode).toBe(400);
    expect(f.replace).not.toHaveBeenCalled();
  });

  it("rejects a missing mapped header and overflow of the combined total before mutation", async () => {
    const f = fixture("spend");
    expect((await f.invoke(`Date,Spend\n${date},10`, { dateColumn: "Missing" })).statusCode).toBe(400);
    expect((await f.invoke(`Date,Spend\n${date},9999999999.99\n${date},0.01`)).statusCode).toBe(400);
    expect(f.replace).not.toHaveBeenCalled();
  });

  it.each([{ campaignValue: "A" }, { campaignValues: ["A"] }])("validates only the exact selected campaign and retains source-derived preview metadata: %j", async selection => {
    const f = fixture("spend", "process", "USD");
    const result = await f.invoke(`Date;Campaign;Spend\n${date};A;$1,234.56\n${date};B;12oops`, {
      campaignColumn: "Campaign", ...selection, csvHeaders: ["forged"], csvRowCount: 999, csvSampleRows: [{ Spend: "999" }],
    });
    expect(result.statusCode, result.body?.error).toBe(200);
    expect(result.body.spendToDate).toBe(1234.56);
    const mapping = JSON.parse(f.replace.mock.calls[0][2].mappingConfig);
    expect(mapping.csvHeaders).toEqual(["Date", "Campaign", "Spend"]);
    expect(mapping.csvRowCount).toBe(2);
    expect(mapping.csvSampleRows[0].Spend).toBe("$1,234.56");
  });

  it("preserves valid zero beside positive spend and rejects a nonnumeric-only import", async () => {
    const f = fixture("spend");
    const result = await f.invoke(`Date,Spend\n${date},0\n${date},20`);
    expect(result.statusCode).toBe(200);
    expect(result.body.spendToDate).toBe(20);
    f.replace.mockClear();
    expect((await f.invoke(`Date,Spend\n${date},invalid`)).statusCode).toBe(400);
    expect(f.replace).not.toHaveBeenCalled();
  });

  it("validates raw stored spend on edits and preserves an undated legacy CSV", async () => {
    const f = fixture("spend");
    const mapping = JSON.parse(f.existing.mappingConfig);
    mapping.csvHeaders = ["Date", "Spend", "Note"];
    mapping.csvSampleRows = [{ Date: date, Spend: "20", Note: "original" }];
    f.existing.mappingConfig = JSON.stringify(mapping);
    expect((await f.invoke(undefined, { sourceId: "source-a" })).statusCode).toBe(200);
    expect(JSON.parse(f.replace.mock.calls[0][2].mappingConfig).csvSampleRows).toEqual(mapping.csvSampleRows);
    expect(JSON.parse(f.replace.mock.calls[0][2].mappingConfig).csvHeaders).toEqual(mapping.csvHeaders);
    f.replace.mockClear();
    f.existing.mappingConfig = JSON.stringify({ spendColumn: "Spend", csvStoredSpendRows: [{ spendRaw: "12oops" }] });
    expect((await f.invoke(undefined, { sourceId: "source-a", dateColumn: null })).statusCode).toBe(400);
    expect(f.replace).not.toHaveBeenCalled();
    f.existing.mappingConfig = JSON.stringify({ spendColumn: "Spend", csvStoredSpendRows: [{ spendRaw: "20" }] });
    expect((await f.invoke(undefined, { sourceId: "source-a", dateColumn: null })).body.spendToDate).toBe(20);
  });

  it.each(["-10", "-$10", "$-10"])("explicitly rejects unsupported signed revenue %s instead of silently dropping it", async amount => {
    const f = fixture("revenue", "process", "USD");
    const result = await f.invoke(`Date,Revenue\n${date},100\n${date},${amount}`);
    expect(result.statusCode, result.body?.error).toBe(400);
    expect(result.body.error).toContain("Negative adjustments are not supported");
    expect(f.replace).not.toHaveBeenCalled();
  });

  it("retains valid GA4 revenue and ignores an unselected negative adjustment", async () => {
    const f = fixture("revenue");
    const result = await f.invoke(`Date,Campaign,Revenue\n${date},A,100\n${date},B,-10`, { campaignColumn: "Campaign", campaignValue: "A" });
    expect(result.statusCode, result.body?.error).toBe(200);
    expect(f.replace.mock.calls[0][3]).toEqual([expect.objectContaining({ revenue: "100.00", date, currency: "EUR" })]);
  });
});
