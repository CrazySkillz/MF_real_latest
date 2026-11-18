import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
import { resolvePerformanceLiveMetricValue, buildPerformanceRecommendedActions } from "../client/src/lib/performance-recommended-actions";
import { isGA4FinancialTotalsCandidate } from "../shared/ga4-financial-source";

const page = readFileSync("client/src/pages/campaign-performance.tsx", "utf8");
const compile = (code: string, values: Record<string, any>) => new Function(...Object.keys(values),
  ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText)(...Object.values(values));
const slice = (start: string, end: string) => page.slice(page.indexOf(start), page.indexOf(end, page.indexOf(start)));
const baseline = (end: string, range: string) => {
  const date = new Date(`${end}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - (range === "24h" ? 1 : 7));
  return date.toISOString().slice(0, 10);
};
const summary = () => ({
  startDate: "2026-10-19", endDate: "2026-11-18", dataThroughDate: "2026-11-18", overviewStartDate: "2026-09-04",
  overviewTotals: { sessions: 4472, users: 4496, conversions: 440 },
  usersComparisons: [{ startDate: "2026-09-04", endDate: "2026-11-11", sessions: 4329, users: 4374 }],
  data: Array.from({ length: 7 }, (_, index) => ({ date: `2026-11-${12 + index}`, sessions: index === 0 ? 122 : 0, conversions: index === 0 ? 13 : 0 })),
});
const movement = (response: any, metric = "sessions", range = "7d") => compile(
  slice("const getGA4MovementComparison =", "// Calculate what's changed") + "return getGA4MovementComparison(metric);",
  { performanceGA4SummaryResponse: response, timeRange: range, resolveSpendComparisonEndDate: baseline, metric });

describe("Performance Summary saved traffic comparisons", () => {
  it("uses the exact cumulative GA4 Sessions period instead of subtracting daily Sessions", () => {
    expect(movement(summary())).toEqual({ current: 4472, previous: 4329, baselineDate: "2026-11-11" });
    expect(movement(summary(), "users")?.previous).toBe(4374);
    expect((4472 - movement(summary())!.previous) / 4329 * 100).toBeCloseTo(3.3033, 4);
  });
  it.each(["absent", "other start", "other end", "null", "negative", "fraction", "duplicate"])("withholds an unverified %s native period", condition => {
    const data: any = summary();
    if (condition === "absent") data.usersComparisons = [];
    if (condition === "other start") data.usersComparisons[0].startDate = "2026-09-05";
    if (condition === "other end") data.usersComparisons[0].endDate = "2026-11-10";
    if (condition === "null") data.usersComparisons[0].sessions = null;
    if (condition === "negative") data.usersComparisons[0].sessions = -1;
    if (condition === "fraction") data.usersComparisons[0].sessions = 1.5;
    if (condition === "duplicate") data.usersComparisons.push({ ...data.usersComparisons[0] });
    expect(movement(data)).toBeNull();
  });
  it("preserves exact zero baselines and does not require daily addition for native Sessions", () => {
    const data = summary(); data.usersComparisons[0].sessions = 0; data.data = [];
    expect(movement(data)?.previous).toBe(0);
    expect(movement(summary(), "sessions", "24h")).toBeNull();
  });
  it("requires every calendar day for additive Conversions, including recorded zero days", () => {
    expect(movement(summary(), "conversions")).toEqual({ current: 440, previous: 427, baselineDate: "2026-11-11" });
    expect(movement(summary(), "conversions", "24h")?.previous).toBe(440);
    for (const index of [0, 3, 6]) {
      const data = summary(); data.data.splice(index, 1);
      expect(movement(data, "conversions")).toBeNull();
    }
  });
  it.each([null, undefined, NaN, Infinity, -1])("rejects invalid daily or current values: %s", value => {
    const data: any = summary(); data.data[0].conversions = value;
    expect(movement(data, "conversions")).toBeNull();
    data.overviewTotals.conversions = value;
    expect(movement(data, "conversions")).toBeNull();
  });
  it("rejects duplicate rows and provider warnings", () => {
    const data: any = summary(); data.data.push({ ...data.data[0] });
    expect(movement(data, "conversions")).toBeNull();
    data.providerRefreshWarning = "incomplete";
    expect(movement(data)).toBeNull();
  });
});

describe("Performance Summary native session conversion-rate scoring", () => {
  const scoring = (conversionRate: any) => compile(
    slice("const liveScoringTrafficTotals", "const scoringSessions") + "return { totals: scoringTrafficTotals, availability: scoringTrafficMetricAvailability };",
    { demoMode: false, performanceGA4SummaryResponse: { overviewTotals: { sessions: 4472, users: 4496, conversions: 440, pageviews: 7936, engagedSessions: 3246, conversionRate } } });
  it.each([9.593023255813954, 0, 100])("propagates native rate %s to health, priority and actions", rate => {
    const actual = scoring(rate);
    expect(actual.availability.conversion_rate).toBe(true);
    expect(resolvePerformanceLiveMetricValue({ item: { metric: "Conversion Rate" }, trafficTotals: actual.totals, financialRevenue: 0, financialSpend: 0, financialConversions: 440 })).toBe(Number(rate.toFixed(2)));
    const actions = buildPerformanceRecommendedActions({ kpis: [{ id: "rate", metric: "Conversion Rate", name: "Conversion Rate", targetValue: 12, priority: "high" }], benchmarks: [], kpiListState: "ready", benchmarkListState: "ready", trafficState: "ready", revenueState: "ready", spendState: "ready", financialConversionsState: "ready", trafficTotals: actual.totals, trafficMetricAvailability: actual.availability, financialRevenue: 0, financialSpend: 0, financialConversions: 440 });
    if (rate === 9.593023255813954) expect(JSON.stringify(actions)).toContain("9.59");
  });
  it.each([null, undefined, "9.6", NaN, Infinity, -1, 101])("does not invent a rate from counts when native rate is %s", rate => {
    const actual = scoring(rate);
    expect(actual.availability.conversion_rate).toBe(false);
    expect(resolvePerformanceLiveMetricValue({ item: { metric: "Conversion Rate" }, trafficTotals: actual.totals, financialRevenue: 0, financialSpend: 0, financialConversions: 440 })).toBeNull();
  });
});

const routes = ts.createSourceFile("routes-oauth.ts", readFileSync("server/routes-oauth.ts", "utf8"), ts.ScriptTarget.Latest, true);
let handler: ts.Node | undefined;
function visit(node: ts.Node) {
  if (ts.isCallExpression(node) && node.expression.getText(routes) === "app.get" && node.arguments[0]?.getText(routes) === '"/api/campaigns/:id/ga4-to-date"') handler = node.arguments.at(-1);
  ts.forEachChild(node, visit);
}
visit(routes);
const runRevenue = async (options: { endDate?: string; readOnly?: string; saved?: any; denied?: boolean; filter?: string } = {}) => {
  const connection = { campaignId: "campaign", propertyId: "123", method: "access_token", isActive: true, importStartDate: "2026-09-04", accessToken: "offline-only" };
  const totals = { sessions: 4472, users: 4496, conversions: 440, revenue: 114314.62 };
  const saved = options.saved === undefined ? { campaignId: "campaign", propertyId: "123", windowStart: "2026-09-04", windowEnd: "2026-11-18", campaignBreakdown: { totals, meta: { currencyCode: "EUR", revenueMetric: "totalRevenue" } } } : options.saved;
  const storage = { getGA4Connections: vi.fn(async () => [connection]), getGA4Connection: vi.fn(async () => connection), getGA4OverviewSnapshot: vi.fn(async () => saved), updateGA4ConnectionTokens: vi.fn() };
  const ga4Service = { getTotalsWithRevenue: vi.fn(async () => ({ totals, currencyCode: "EUR" })), refreshAccessToken: vi.fn() };
  const response: any = { statusCode: 200, setHeader: vi.fn(), status(code: number) { this.statusCode = code; return this; }, json(body: any) { this.body = body; return this; } };
  const execute = compile(`return (${handler!.getText(routes)});`, { storage, ga4Service, ensureCampaignAccess: async () => options.denied ? null : ({ currency: "EUR", ga4CampaignFilter: options.filter ?? '["promo"]', reportingTimeZone: "Europe/Amsterdam" }), parseGA4CampaignFilter: JSON.parse, isNoRevenueFilter: () => false, getReportingDateWindow: () => ({ dataThroughDate: "2026-11-18" }), normalizePropertyIdForMock: (x: string) => x.replace(/^properties\//, ""), isYesopMockProperty: () => false, isSupportedGA4ConnectionMethod: () => true, resolveGA4ImportToDateWindow: (startDate: string) => ({ startDate }), isGA4FinancialTotalsCandidate, assertGA4InsightsFinancialCurrencyScope: () => {} });
  await execute({ params: { id: "campaign" }, query: { propertyId: "123", readOnly: options.readOnly ?? "1", endDate: options.endDate ?? "2026-11-18" } }, response);
  return { response, storage, ga4Service };
};
describe("Performance Summary saved-only GA4 reads", () => {
  it("does not mount the auto-refreshing GA4 metrics query", () => {
    expect(page).not.toContain("/ga4-metrics`");
    expect(page).toContain("{ metrics: performanceGA4SummaryResponse.overviewTotals }");
  });
  it.each(["2026-11-18", "2026-11-17", "2026-11-11", "2026-10-18"])("never contacts GA4 or resolves credentials for a read-only period ending %s", async endDate => {
    const { response, storage, ga4Service } = await runRevenue({ endDate });
    expect(response.statusCode).toBe(endDate === "2026-11-18" ? 200 : 503);
    if (endDate === "2026-11-18") expect(response.body.totals.revenue).toBe(114314.62);
    expect(storage.getGA4Connections).toHaveBeenCalledWith("campaign", { migrateLegacyTokens: false, resolveRuntimeCredentials: false });
    expect(storage.getGA4Connection).not.toHaveBeenCalled();
    expect(storage.updateGA4ConnectionTokens).not.toHaveBeenCalled();
    expect(ga4Service.getTotalsWithRevenue).not.toHaveBeenCalled();
    expect(ga4Service.refreshAccessToken).not.toHaveBeenCalled();
  });
  it("preserves the non-read-only historical provider path", async () => {
    const { response, ga4Service } = await runRevenue({ endDate: "2026-11-11", readOnly: "0" });
    expect(response.statusCode).toBe(200);
    expect(ga4Service.getTotalsWithRevenue).toHaveBeenCalledOnce();
  });
  it.each(["campaign", "property", "start", "end", "currency", "invalid totals"])("rejects a mismatched saved %s without provider fallback", async condition => {
    const saved: any = { campaignId: "campaign", propertyId: "123", windowStart: "2026-09-04", windowEnd: "2026-11-18", campaignBreakdown: { totals: { sessions: 4472, users: 4496, conversions: 440, revenue: 114314.62 }, meta: { currencyCode: "EUR" } } };
    if (condition === "campaign") saved.campaignId = "other";
    if (condition === "property") saved.propertyId = "456";
    if (condition === "start") saved.windowStart = "2026-09-05";
    if (condition === "end") saved.windowEnd = "2026-11-17";
    if (condition === "currency") saved.campaignBreakdown.meta.currencyCode = "USD";
    if (condition === "invalid totals") saved.campaignBreakdown.totals.revenue = null;
    const result = await runRevenue({ saved });
    expect(result.response.statusCode).toBe(503);
    expect(result.ga4Service.getTotalsWithRevenue).not.toHaveBeenCalled();
  });
  it("fails closed for absent saved data, unfiltered campaigns and denied access", async () => {
    for (const filter of ['["promo"]', '[]']) {
      const result = await runRevenue({ saved: null, filter });
      expect(result.response.statusCode).toBe(503);
      expect(result.ga4Service.getTotalsWithRevenue).not.toHaveBeenCalled();
    }
    const denied = await runRevenue({ denied: true });
    expect(denied.storage.getGA4Connections).not.toHaveBeenCalled();
    expect(denied.ga4Service.getTotalsWithRevenue).not.toHaveBeenCalled();
  });
});
