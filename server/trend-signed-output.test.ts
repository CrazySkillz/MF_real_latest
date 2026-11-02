import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { deriveTrendFinancialRatios, formatTrendComparison, resolveCompatibleTrendFinancialDaily } from "../client/src/lib/trend-analysis-cumulative";

function binding(file: string, name: string, env: Record<string, unknown>) {
  const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name && node.initializer) found.push(node.initializer.getText(source));
    ts.forEachChild(node, visit);
  };
  visit(source);
  expect(found).toHaveLength(1);
  return new Function(...Object.keys(env), ts.transpileModule(`return (${found[0]});`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText)(...Object.values(env));
}
const page = "client/src/pages/trend-analysis.tsx";
const input = (value: unknown) => ({ available: true, value, sources: ["fixture"] });
const window = { mode: "initial_import_to_latest_completed_day", startDate: "2026-10-01", endDate: "2026-10-16", dataThroughDate: "2026-10-16", reportingTimeZone: "Europe/Amsterdam" };
const snapshot = (revenue: unknown = -25) => ({ campaignId: "fixture", snapshotType: "financial_daily", reportingDate: window.endDate,
  metrics: { financialDaily: { version: "financial_daily_snapshot_v1", currency: "EUR", currentValueWindow: window,
    inputs: { revenue: input(revenue), spend: input(20), conversions: input(3) } } } });

describe("signed financial values survive Trend and report presentation", () => {
  it.each([-25, 0, 105])("keeps current and historical Revenue %s with the exact financial identity", revenue => {
    const saved = snapshot(revenue), financial = saved.metrics.financialDaily;
    const args = { snapshot: saved, campaignId: "fixture", comparisonDate: window.endDate, campaignCurrency: "EUR", currentValueWindow: window };
    expect(resolveCompatibleTrendFinancialDaily({ ...args, expectedInputs: financial.inputs })).toBe(financial);
    expect(resolveCompatibleTrendFinancialDaily(args)).toBe(financial);
    expect(binding(page, "financialSnapshotValue", {})(financial, "revenue")).toBe(revenue);
    expect(binding("server/report-scheduler.ts", "historicalTrendFinancialValue", { compatibleTrendFinancialDaily: financial })("revenue")).toBe(revenue);
    expect(binding(page, "aggregateMetricValue", { performanceSummary: { totals: { revenue: input(revenue) } } })("revenue")).toBe(revenue);
  });
  it.each(["revenue", "roas", "roi"])("preserves signed aggregate %s, without altering financial units", metric => {
    const value = { revenue: -25, roas: -1.25, roi: -225 }[metric]!;
    expect(binding(page, "aggregateMetricValue", { performanceSummary: { totals: { [metric]: input(value) } } })(metric)).toBe(value);
    const executive = binding("server/report-scheduler.ts", "executivePageMetric", {
      performanceSummary: { totals: {} }, performancePageTrafficTotals: { sessions: 400, conversions: 3, engagedSessions: 260 },
      performancePageTotals: { revenue: -25, spend: 20, revenueAvailable: true, spendAvailable: true },
      performanceFinancialConversionsAvailable: true, performanceFinancialConversions: 3,
    });
    expect(executive(metric)).toMatchObject({ available: true, value });
  });
  it.each(["spend", "conversions", "sessions", "users", "cpa"])("still rejects negative %s", metric => {
    expect(binding(page, "aggregateMetricValue", { performanceSummary: { totals: { [metric]: input(-1) } } })(metric)).toBeNull();
    if (["spend", "conversions"].includes(metric)) {
      expect(binding(page, "financialSnapshotValue", {})({ inputs: { [metric]: input(-1) } }, metric)).toBeNull();
    }
  });
  it.each([null, undefined, "", "invalid", NaN, Infinity])("does not turn missing or malformed Revenue %s into signed data", value => {
    expect(binding(page, "aggregateMetricValue", { performanceSummary: { totals: { revenue: input(value) } } })("revenue")).toBeNull();
    expect(binding(page, "financialSnapshotValue", {})({ inputs: { revenue: input(value) } }, "revenue")).toBeNull();
    const saved = snapshot();
    saved.metrics.financialDaily.inputs.revenue.value = value;
    expect(resolveCompatibleTrendFinancialDaily({ snapshot: saved, campaignId: "fixture", comparisonDate: window.endDate, campaignCurrency: "EUR", currentValueWindow: window, expectedInputs: saved.metrics.financialDaily.inputs })).toBeNull();
  });
  it.each(["campaign", "currency", "date", "timezone", "source", "amount", "availability"])("rejects a signed snapshot with a mismatched %s", kind => {
    const saved = snapshot(); const expected = structuredClone(saved.metrics.financialDaily.inputs);
    if (kind === "campaign") saved.campaignId = "other";
    if (kind === "currency") saved.metrics.financialDaily.currency = "USD";
    if (kind === "date") saved.reportingDate = "2026-10-15";
    if (kind === "timezone") saved.metrics.financialDaily.currentValueWindow = { ...window, reportingTimeZone: "UTC" };
    if (kind === "source") expected.revenue.sources = [];
    if (kind === "amount") expected.revenue.value = -24;
    if (kind === "availability") expected.revenue.available = false;
    expect(resolveCompatibleTrendFinancialDaily({ snapshot: saved, campaignId: "fixture", comparisonDate: window.endDate, campaignCurrency: "EUR", currentValueWindow: window, expectedInputs: expected })).toBeNull();
  });
  it("preserves signed ratios and the existing withheld negative-baseline comparison policy", () => {
    expect(deriveTrendFinancialRatios({ revenue: -25, spend: 20, conversions: 3 })).toEqual({ roas: -1.25, roi: -225, cpa: 20 / 3 });
    expect(formatTrendComparison({ current: -25, previous: -10, comparisonDate: "2026-10-01", kind: "count" })).toBeNull();
  });
});
