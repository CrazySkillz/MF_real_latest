import { afterEach, describe, expect, it, vi } from "vitest";
import { GoogleAnalytics4Service } from "./analytics";
import { normalizeGA4InsightsDailyMetricValues } from "../shared/ga4-insights";

const date = "2026-10-18";
const storage = { getGA4Connection: async () => ({ propertyId: "123", accessToken: "fixture" }),
  getCampaign: async () => ({ currency: "EUR" }) };
const row = (values: number[], dimensions = ["20261018"]) => ({
  dimensionValues: dimensions.map(value => ({ value })), metricValues: values.map(value => ({ value: String(value) })),
});
const response = (rows: any[]) => new Response(JSON.stringify({ rowCount: rows.length, rows, metadata: { currencyCode: "EUR" } }));
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("V1-079 GA4 conversion credit", () => {
  it.each([0, 0.75, 0.000075, 2, 2.125])("retains primary daily and native total credit %s", async credit => {
    const service = new GoogleAnalytics4Service();
    const queries: any[] = [];
    vi.spyOn(service as any, "requestReport").mockImplementation(async (_url: any, options: any) => {
      const query = JSON.parse(options.body); queries.push(query);
      const values: Record<string, number> = { sessions: 10, totalUsers: 8, screenPageViews: 20,
        conversions: credit, totalRevenue: 100, engagedSessions: 5, engagementRate: 0.5 };
      return response([row(query.metrics.map(({ name }: any) => values[name] ?? 0))]);
    });
    vi.stubGlobal("fetch", (...args: any[]) => (service as any).requestReport(...args));
    const series = await service.getTimeSeriesWithToken("123", "fixture", date, undefined, date, "EUR");
    const totals = await service.getTotalsWithRevenue("123", "fixture", date, date, undefined, "EUR");
    expect(series[0]).toMatchObject({ conversions: credit, sessions: 10, revenue: 100 });
    expect(totals.totals).toMatchObject({ conversions: credit, sessions: 10, revenue: 100 });
    expect(normalizeGA4InsightsDailyMetricValues(series[0])?.conversions).toBe(credit);
    expect(queries.every(query => query.currencyCode === "EUR" && query.dateRanges[0].endDate === date)).toBe(true);
  });

  it.each([0.75, 0.000075, 2])("retains scoped supplemental credit %s without changing attribution filters", async credit => {
    const service = new GoogleAnalytics4Service(); const queries: any[] = [];
    vi.spyOn(service as any, "requestReport").mockImplementation(async (_url: any, options: any) => {
      const query = JSON.parse(options.body); queries.push(query);
      const supplemental = query.metrics.length === 2;
      const values: Record<string, number> = { sessions: 10, totalUsers: 8, screenPageViews: 20,
        conversions: supplemental ? credit : 0, totalRevenue: supplemental ? 100 : 0, engagedSessions: 5, engagementRate: 0.5 };
      return response([row(query.metrics.map(({ name }: any) => values[name] ?? 0))]);
    });
    vi.stubGlobal("fetch", (...args: any[]) => (service as any).requestReport(...args));
    expect((await service.getTimeSeriesWithToken("123", "fixture", date, ["sale"], date, "EUR"))[0].conversions).toBe(credit);
    expect((await service.getTotalsWithRevenue("123", "fixture", date, date, ["sale"], "EUR")).totals.conversions).toBe(credit);
    for (const query of queries) expect(query.dimensionFilter.filter).toMatchObject({
      fieldName: query.metrics.length === 2 ? "campaignName" : "sessionCampaignName", stringFilter: { matchType: "EXACT", value: "sale" },
    });
  });

  it("preserves nonzero primary credit and fills only matching zero dates", () => {
    const service: any = new GoogleAnalytics4Service();
    const primary = { rows: [row([0.75, 100]), row([0, 0], ["20261019"])] };
    const supplemental = { rows: [row([4.5, 200]), row([0.125, 25], ["20261019"]), row([99, 999], ["20261020"])] };
    expect(service.mergeDailyConversionRevenueTotals(primary, supplemental, 0, 1, 0, 1)).toEqual({ conversions: 0.875, revenue: 125 });
  });

  it.each(["landing", "events"])("preserves fractional credit in both %s comparison windows", async kind => {
    vi.stubGlobal("fetch", vi.fn(async () => response([kind === "landing"
      ? row([10, 20, 8, 9, 0.75, 0.125, 100, 25], ["/sale", "google", "cpc"])
      : row([0.75, 0.125, 4, 5, 2, 3, 100, 25], ["purchase"])])));
    const service = new GoogleAnalytics4Service();
    const result = kind === "landing" ? await service.getLandingPagesWoWReport("campaign", storage, "123", 50, "sale")
      : await service.getConversionEventsWoWReport("campaign", storage, "123", 50, "sale");
    expect(result.totals.last7.conversions).toBe(0.75);
    expect(result.totals.prev7.conversions).toBe(0.125);
  });

  it("preserves fractional credit in the retained metrics API", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => response([row([10, 20, 0.5, 10, 0.75, 8, 2, 5, 0.5, 20])])));
    const result = await new GoogleAnalytics4Service().getMetricsWithToken("123", "fixture", date, "sale");
    expect(result.conversions).toBe(0.75);
  });
});
