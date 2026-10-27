import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
import * as revenue from "./utils/revenue-record-total";
import { getReportingDateEndAt, isCreatedThroughReportingDate } from "./utils/reporting-timezone";
import { resolveCampaignCumulativeFinancials } from "./utils/campaign-cumulative-financials";
import { financialDailySnapshotInputSchema } from "../shared/schema";

// Execute the current storage method without importing the application's database.
// SQL selection is stubbed; ownership/date/currency predicates are unchanged by this fix.
const source = ts.createSourceFile("storage.ts", readFileSync("server/storage.ts", "utf8"), ts.ScriptTarget.Latest, true);
let method = "";
function visit(node: ts.Node) {
  if (ts.isMethodDeclaration(node) && node.name.getText(source) === "getRevenueTotalForRange") method = node.getText(source);
  ts.forEachChild(node, visit);
}
visit(source);
if (!method) throw new Error("Revenue storage method not found");
function storageFixture(rows: any[] = [], breakdown: any[] = []) {
  const table = new Proxy({}, { get: (_target, key) => String(key) });
  const predicate = () => true;
  const bindings = {
    db: { select: () => ({ from: () => ({ innerJoin: () => ({ where: async () => rows }) }) }) },
    revenueRecords: table, revenueSources: table, sql: predicate, eq: predicate, and: predicate,
    or: predicate, isNull: predicate, lte: predicate, getReportingDateEndAt, isCreatedThroughReportingDate,
    ...revenue, selectMaterializedRevenueTotal: (aggregate: number, attributed: number, hasAggregate: boolean) =>
      revenue.selectRevenueRecordTotal({ aggregate, attributed, hasAggregate }),
  };
  const code = ts.transpileModule(`class Fixture {${method}}\nreturn Fixture;`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const Storage = new Function(...Object.keys(bindings), code)(...Object.values(bindings));
  const storage = new Storage();
  storage.getCampaign = vi.fn().mockResolvedValue({ currency: "USD", reportingTimeZone: "UTC" });
  storage.getRevenueSources = vi.fn().mockResolvedValue([{ id: "source-1", isActive: true, createdAt: "2026-10-01T00:00:00Z" }]);
  storage.getRevenueBreakdownBySource = vi.fn().mockResolvedValue(breakdown);
  return storage;
}
const total = (storage: any) => storage.getRevenueTotalForRange("campaign-1", "1900-01-01", "2026-10-18", "ga4");

describe("V1-035 revenue materialization fallback", () => {
  it.each([0, 100, -10])("recognizes an out-of-window source with revenue %s without adding it to completed-day totals", async (value) => {
    const storage = storageFixture([], [{ sourceId: "source-1", revenue: value, currency: "USD" }]);
    expect(await total(storage)).toEqual({ totalRevenue: 0, currency: "USD", sourceIds: [] });
    expect(storage.getRevenueBreakdownBySource).toHaveBeenCalledWith("campaign-1", "1900-01-01", "2999-12-31", "ga4");
  });
  it.each([[], [{ sourceId: "source-2", revenue: 100 }], [{ sourceId: "source-1", revenue: null }],
    [{ sourceId: "source-1", revenue: "" }], [{ sourceId: "source-1", revenue: "NaN" }]].map(breakdown => ({ breakdown })))(
    "does not invent materialization from missing, unrelated or invalid values: $breakdown", async ({ breakdown }) => {
      await expect(total(storageFixture([], breakdown))).rejects.toMatchObject({
        code: "GA4_REVENUE_MATERIALIZATION_INCOMPLETE", sourceIds: ["source-1"],
      });
    },
  );
  it("retains valid completed-day totals and does not call fallback", async () => {
    const storage = storageFixture([{ revenueSourceId: "source-1", revenue: "-10.00", currency: "USD", sourceCurrency: "USD" }]);
    expect(await total(storage)).toEqual({ totalRevenue: -10, currency: "USD", sourceIds: ["source-1"] });
    expect(storage.getRevenueBreakdownBySource).not.toHaveBeenCalled();
  });
  it("propagates the all-date currency failure", async () => {
    const storage = storageFixture();
    storage.getRevenueBreakdownBySource.mockRejectedValue(Object.assign(new Error("Currency mismatch"), { code: "GA4_REVENUE_CURRENCY_INTEGRITY_ERROR" }));
    await expect(total(storage)).rejects.toMatchObject({ code: "GA4_REVENUE_CURRENCY_INTEGRITY_ERROR" });
  });
  it("requires materialization regardless of connection date without changing another platform's completeness policy", async () => {
    const storage = storageFixture();
    storage.getRevenueSources.mockResolvedValue([{ id: "future", createdAt: "2026-10-19T00:00:00Z" }]);
    await expect(total(storage)).rejects.toMatchObject({ code: 'GA4_REVENUE_MATERIALIZATION_INCOMPLETE', sourceIds: ['future'] });
    expect(storage.getRevenueBreakdownBySource).toHaveBeenCalledWith('campaign-1', '1900-01-01', '2999-12-31', 'ga4');
    storage.getRevenueBreakdownBySource.mockClear();
    expect(await storage.getRevenueTotalForRange("campaign-1", "1900-01-01", "2026-10-18", "linkedin"))
      .toMatchObject({ totalRevenue: 0, sourceIds: [] });
    expect(storage.getRevenueBreakdownBySource).not.toHaveBeenCalled();
  });
});

const signedInput = (nativeRevenue: number, importedRevenue: number) => ({
  campaignId: "campaign-1", currency: "USD", nativeRevenue, importedRevenue,
  performanceSummary: {
    version: "performance_summary_aggregate_v3", campaignId: "campaign-1",
    currentValueWindow: { mode: "initial_import_to_latest_completed_day", startDate: "2026-10-01",
      endDate: "2026-10-18", dataThroughDate: "2026-10-18", reportingTimeZone: "UTC" },
    totals: { spend: { value: 100, available: true, sources: ["spend-1"] },
      revenue: { value: nativeRevenue + importedRevenue, available: true, sources: ["ga4", "revenue-source:source-1"] },
      conversions: { value: 2, available: true, sources: ["ga4"] } },
  },
});
describe("V1-036 signed authoritative revenue", () => {
  it.each([[-10, 0], [0, -10], [-20, 10], [10, -20], [-10, 20], [20, -10], [10, 20], [0, 0]])(
    "preserves native %s and imported %s through the cumulative snapshot and formulas", (native, imported) => {
      const result = resolveCampaignCumulativeFinancials(signedInput(native, imported));
      const totalRevenue = native + imported;
      expect(result.snapshot.inputs.revenue).toMatchObject({ available: true, value: totalRevenue.toFixed(2) });
      expect(result.financials).toMatchObject({ nativeRevenue: native, importedRevenue: imported, totalRevenue,
        profit: totalRevenue - 100, roas: totalRevenue / 100, roi: ((totalRevenue - 100) / 100) * 100, cpa: 50 });
      expect(financialDailySnapshotInputSchema.safeParse(result.snapshot).success).toBe(true);
    },
  );
  it.each(["spend", "conversions"] as const)("still rejects negative %s", (metric) => {
    const input = signedInput(10, 0);
    input.performanceSummary.totals[metric].value = -1;
    expect(() => resolveCampaignCumulativeFinancials(input)).toThrow(/non-negative/);
  });
  it.each([null, undefined, "", " ", true, NaN, Infinity])("rejects unavailable numeric evidence %j when revenue is marked available", (value) => {
    const input = signedInput(0, 0) as any;
    input.performanceSummary.totals.revenue.value = value;
    expect(() => resolveCampaignCumulativeFinancials(input)).toThrow();
  });
  it("still requires matching components and authoritative sources", () => {
    const input = signedInput(-10, 0);
    expect(() => resolveCampaignCumulativeFinancials({ ...input, importedRevenue: 5 })).toThrow(/do not match/);
    input.performanceSummary.totals.revenue.sources = [];
    expect(() => resolveCampaignCumulativeFinancials(input)).toThrow(/authoritative sources/);
  });
  it("keeps negative spend invalid in the shared persisted snapshot contract", () => {
    const snapshot = resolveCampaignCumulativeFinancials(signedInput(10, 0)).snapshot;
    expect(financialDailySnapshotInputSchema.safeParse({ ...snapshot, inputs: { ...snapshot.inputs,
      spend: { value: "-1.00", available: true, sources: ["spend-1"] } } }).success).toBe(false);
  });
});
