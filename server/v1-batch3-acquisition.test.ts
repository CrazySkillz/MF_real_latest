import { afterEach, describe, expect, it, vi } from "vitest";
import { GoogleAnalytics4Service } from "./analytics";

const storage = { getGA4Connection: async () => ({ id: "connection-1", propertyId: "123", accessToken: "fixture" }),
  getCampaign: async () => ({ currency: "USD" }) };
const row = (dimensions: string[], values: number[]) => ({
  dimensionValues: dimensions.map(value => ({ value })), metricValues: values.map(value => ({ value: String(value) })),
});
const acquisitionRow = (campaign = "sale") => row(["20261018", "Paid Search", "google", "cpc", campaign, "desktop", "NL"], [10, 8, 2, 20, 5]);
const report = (rows: any[], totals?: number[]) => ({ metadata: { currencyCode: "USD" }, rowCount: rows.length, rows,
  ...(totals ? { totals: [{ metricValues: totals.map(value => ({ value: String(value) })) }] } : {}) });
const response = (body: any) => new Response(JSON.stringify(body), { status: 200 });
const run = (limit = 2000, insights = false) => new GoogleAnalytics4Service().getAcquisitionBreakdown(
  "campaign-1", storage, "2026-10-18", "123", limit, ["sale"], "2026-10-18", true, insights, "USD",
);
afterEach(() => vi.unstubAllGlobals());

describe("V1-033 acquisition completeness", () => {
  it.each([undefined, null, "NaN", Infinity, -1, 0, 0.5])("rejects nonempty rows with invalid or too-low rowCount %s without a fallback query", async (rowCount) => {
    const fetch = vi.fn(async () => response({ ...report([acquisitionRow()]), rowCount }));
    vi.stubGlobal("fetch", fetch);
    await expect(run(1)).rejects.toMatchObject({ isPaginationIncomplete: true });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("requests stable dimension tie-breakers and collects all tied pages", async () => {
    const bodies: any[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
      const body = JSON.parse(init.body); bodies.push(body);
      return response({ ...report([acquisitionRow(body.offset ? "sale-b" : "sale-a")]), rowCount: 2 });
    }));
    const result = await run(1);
    expect(result.rows.map(item => item.campaign)).toEqual(["sale-a", "sale-b"]);
    expect(result.totals.sessions).toBe(20);
    expect(bodies[1]).toEqual({ ...bodies[0], offset: 1 });
    expect(bodies[0].orderBys).toEqual([{ metric: { metricName: "sessions" }, desc: true },
      ...bodies[0].dimensions.map(({ name }: any) => ({ dimension: { dimensionName: name, orderType: "ALPHANUMERIC" }, desc: false }))]);
  });
  it.each(["duplicate", "changed-count", "missing-count", "empty", "oversized"])("rejects %s on a later page", async (scenario) => {
    vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
      const offset = JSON.parse(init.body).offset;
      if (!offset) return response({ ...report([acquisitionRow("sale-a")]), rowCount: 2 });
      return response({ ...report(scenario === "empty" ? [] : scenario === "oversized" ? [acquisitionRow("sale-b"), acquisitionRow("sale-c")] :
        [acquisitionRow(scenario === "duplicate" ? "sale-a" : "sale-b")]),
        rowCount: scenario === "missing-count" ? undefined : scenario === "changed-count" ? 3 : 2 });
    }));
    await expect(run(1)).rejects.toMatchObject({ isPaginationIncomplete: true });
  });
  it("accepts a genuinely empty protobuf response with an omitted zero count", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => response({ metadata: { currencyCode: "USD" } })));
    expect((await run()).rows).toEqual([]);
  });
});

function matches(url: string, expression: any): boolean {
  if (expression.andGroup) return expression.andGroup.expressions.every((child: any) => matches(url, child));
  if (expression.orGroup) return expression.orGroup.expressions.some((child: any) => matches(url, child));
  const filter = expression.filter.stringFilter;
  return filter.matchType === "FULL_REGEXP" ? new RegExp(`^(?:${filter.value})$`, filter.caseSensitive ? "" : "i").test(url)
    : url.toLowerCase().includes(filter.value.toLowerCase());
}
describe("V1-032 exact Insights channel coverage", () => {
  it.each([
    ["google", "google_ads", "cpc"], ["social + email", "social + email extra", "paid.cpc"],
    ["a(b)[c]", "a(b)[c]_extra", "paid+cpc"],
  ])("keeps the sources %s and %s separate", async (source, other, medium) => {
    const urls = [source, other].map(value => `https://fixture.invalid/?utm_campaign=sale&utm_source=${encodeURIComponent(value)}&utm_medium=${encodeURIComponent(medium)}`);
    vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
      const body = JSON.parse(init.body);
      const dimensions = body.dimensions.map((item: any) => item.name);
      if (dimensions.includes("sessionDefaultChannelGroup")) return response(report([
        row(["20261018", "Paid Search", source, medium, "sale", "desktop", "NL"], [10, 8, 0, 0, 5]),
      ], [10, 8, 0, 0, 5]));
      if (dimensions.includes("pageLocation")) return response(report(urls.map(url => row(["20261018", url], [20, 20, 10])), [40, 40, 20]));
      const selected = urls.filter(url => matches(url, body.dimensionFilter));
      // Boundaries must also reject a longer value and a different parameter name.
      expect(matches(`${urls[0]}_extra`, body.dimensionFilter)).toBe(false);
      expect(matches(urls[0].replace("utm_source=", "xutm_source="), body.dimensionFilter)).toBe(false);
      return response(report([row(["20261018"], [selected.length * 20, selected.length * 20, selected.length * 10])]));
    }));
    const result = await run(2000, true);
    expect(result.meta.insightsLandingCoverage).toMatchObject({ selected: true, landingSessions: 40, rowSessions: 40 });
    expect(result.totals.sessions).toBe(40);
    expect(result.rows.map(item => item.sessions)).toEqual([20, 20]);
  });
  it("retains standard attribution when channel coverage cannot preserve conversions", async () => {
    vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
      const body = JSON.parse(init.body);
      const dimensions = body.dimensions.map((item: any) => item.name);
      if (dimensions.includes("sessionDefaultChannelGroup")) return response(report([acquisitionRow()], [10, 8, 2, 20, 5]));
      if (dimensions.includes("pageLocation")) return response(report([
        row(["20261018", "/?utm_campaign=sale&utm_source=email&utm_medium=cpc"], [20, 20, 10]),
        row(["20261018", "/?utm_campaign=sale&utm_source=google_ads&utm_medium=cpc"], [20, 20, 10]),
      ], [30, 30, 15]));
      return response(report([row(["20261018"], [20, 20, 10])]));
    }));
    const result = await run(2000, true);
    expect(result.meta.insightsLandingCoverage).toMatchObject({ selected: false, reason: "conversion-total-mismatch" });
    expect(result.totals.sessions).toBe(10);
  });
});
