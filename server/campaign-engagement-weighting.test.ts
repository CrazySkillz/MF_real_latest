import { readFileSync } from "node:fs";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { summarizeGA4TrafficRows } from "../shared/ga4-traffic-window";

const storageMock = vi.hoisted(() => Object.fromEntries([
  "getGA4OverviewSnapshot", "getCampaign", "getGA4Connections", "getGA4DailyMetrics", "getRevenueTotalForRange", "getSpendTotalForRange",
  "getRevenueBreakdownBySource", "getSpendBreakdownBySource", "getGA4PublicationVersion", "getCampaignKPIs",
  "getCampaignBenchmarks", "updateKPI", "updateBenchmark",
].map(name => [name, vi.fn()])));
vi.mock("./storage", () => ({ storage: storageMock }));
vi.mock("./analytics", () => ({ ga4Service: {} }));
import { getCampaignMetricTotals, refreshCampaignCurrentValuesForCampaign, resolveCampaignCurrentValueForAlert } from "./utils/campaign-current-values";

const rows = (engaged = [20, 240], withRate = true) => [100, 300].map((sessions, i) => ({
  campaignId: "c", propertyId: "123", date: `2026-10-${15 + i}`, sessions, users: i ? 210 : 80,
  pageviews: i ? 450 : 150, conversions: i ? 1.75 : 1.25, revenue: i ? "-25.00" : "100.00",
  engagedSessions: engaged[i], ...(withRate ? { engagementRate: engaged[i] / sessions } : {}),
}));
const goal = (id: string) => ({ id, campaignId: "c", platformType: "campaign", currentValue: "99",
  calculationConfig: { metric: "engagementRate", inputs: { engagementRate: ["total_engagement_rate"] } } });

describe("campaign engagement uses the same weighted GA4 inputs", () => {
  beforeEach(() => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-17T08:00:00Z"));
    Object.values(storageMock).forEach(mock => mock.mockReset());
    storageMock.getGA4OverviewSnapshot.mockResolvedValue({ propertyId: "123", campaignBreakdown: { meta: { propertyId: "123", distinctUsers: { version: 1, metric: "totalUsers", propertyId: "123", startDate: "2026-10-15", endDate: "2026-10-16", total: 290, windows: [] } } } });
    storageMock.getCampaign.mockResolvedValue({ id: "c", currency: "EUR", reportingTimeZone: "Europe/Amsterdam", ga4CampaignFilter: '["selected"]' });
    storageMock.getGA4Connections.mockResolvedValue([{ campaignId: "c", propertyId: "123", isPrimary: true, isActive: true, importStartDate: "2026-10-15" }]);
    storageMock.getGA4DailyMetrics.mockResolvedValue(rows());
    storageMock.getRevenueTotalForRange.mockResolvedValue({ totalRevenue: 0, sourceIds: [] });
    storageMock.getSpendTotalForRange.mockResolvedValue({ totalSpend: 20, sourceIds: ["spend"] });
    storageMock.getRevenueBreakdownBySource.mockResolvedValue([]);
    storageMock.getSpendBreakdownBySource.mockResolvedValue([{ sourceId: "spend", spend: 20 }]);
    storageMock.getGA4PublicationVersion.mockResolvedValue(null);
    storageMock.getCampaignKPIs.mockResolvedValue([goal("kpi")]);
    storageMock.getCampaignBenchmarks.mockResolvedValue([goal("benchmark")]);
  });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it.each([[20, 240, 65], [0, 240, 60], [0, 0, 0], [50, 150, 50]])("weights %s and %s engaged sessions as %s percent through goals and alerts", async (first, second, expected) => {
    storageMock.getGA4DailyMetrics.mockResolvedValue(rows([first, second]));
    const totals = await getCampaignMetricTotals("c", false, true);
    expect(totals).toMatchObject({ sessions: 400, users: 290, conversions: 3, revenue: 75, spend: 20, engagementRate: expected });
    expect(storageMock.getGA4DailyMetrics).toHaveBeenCalledWith("c", "123", "2026-10-15", "2026-10-16");
    expect(await refreshCampaignCurrentValuesForCampaign("c", true)).toEqual({ kpisUpdated: 1, benchmarksUpdated: 1 });
    const change = { currentValue: String(expected), publicationVersion: { campaignId: "c", version: null } };
    expect(storageMock.updateKPI).toHaveBeenCalledWith("kpi", change);
    expect(storageMock.updateBenchmark).toHaveBeenCalledWith("benchmark", change);
    expect((await resolveCampaignCurrentValueForAlert(goal("kpi"), new Map(), true)).currentValue).toBe(String(expected));
  });
  it("uses explicit engaged counts even when daily rates are absent", async () => {
    storageMock.getGA4DailyMetrics.mockResolvedValue(rows(undefined, false));
    expect((await getCampaignMetricTotals("c", false, true))?.engagementRate).toBe(65);
  });
  it("weights retained daily percent values when engaged counts are absent", async () => {
    storageMock.getGA4DailyMetrics.mockResolvedValue(rows().map(({ engagedSessions, ...row }) => ({ ...row, engagementRate: row.engagementRate! * 100 })));
    expect((await getCampaignMetricTotals("c", false, true))?.engagementRate).toBe(65);
  });
  it("preserves measured no-session zero and blocks failed stored reads", async () => {
    storageMock.getGA4DailyMetrics.mockResolvedValue([{ ...rows()[0], sessions: 0, engagedSessions: 0, engagementRate: 0 }]);
    expect((await getCampaignMetricTotals("c", false, true))?.engagementRate).toBe(0);
    storageMock.getGA4DailyMetrics.mockRejectedValue(new Error("unavailable"));
    expect(await getCampaignMetricTotals("c", false, true)).toBeNull();
    expect((await resolveCampaignCurrentValueForAlert(goal("kpi"), new Map(), true) as any).__alertDecisionEligible).toBe(false);
  });
});

// Execute the retained #benchmarks page's actual useMemo callback, without a browser or copied formula.
const page = ts.createSourceFile("campaign-detail.tsx", readFileSync("client/src/pages/campaign-detail.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let initializer: ts.Expression | undefined;
const visit = (node: ts.Node) => { if (ts.isVariableDeclaration(node) && node.name.getText(page) === "benchGA4MetricTotals") initializer = node.initializer; ts.forEachChild(node, visit); };
visit(page);
if (!initializer) throw new Error("Benchmark input binding is missing");
const body = ts.transpileModule(`return (${initializer.getText(page)});`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const resolvePreview = new Function("benchGA4DailyResp", "benchGA4ToDate", "useMemo", "summarizeGA4TrafficRows", body);
const preview = (daily: any[], totals = {}) => resolvePreview({ data: daily }, { totals }, (read: () => any) => read(), summarizeGA4TrafficRows);

describe("retained campaign Benchmark preview", () => {
  it.each([[20, 240, 65], [0, 240, 60], [0, 0, 0], [50, 150, 50]])("weights %s and %s engaged sessions as %s percent", (first, second, expected) => {
    expect(preview(rows([first, second]))).toMatchObject({ engagementRate: expected, sessions: 400, users: 290, conversions: 3, revenue: 75 });
  });
  it("uses explicit engaged counts without daily rates", () => { expect(preview(rows(undefined, false)).engagementRate).toBe(65); });
  it.each([0, 0.01, 0.8, 1])("preserves the authoritative aggregate rate %s", rate => {
    expect(preview(rows(), { engagementRate: rate }).engagementRate).toBe(rate * 100);
  });
  it("weights the legacy percentage fallback", () => {
    expect(preview(rows().map(({ engagedSessions, ...row }) => ({ ...row, engagementRate: row.engagementRate! * 100 }))).engagementRate).toBe(65);
  });
});
