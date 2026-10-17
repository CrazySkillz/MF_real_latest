import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { computeCpa, computeRoiPercent } from "../shared/metric-math";
import { resolveGA4OverviewFinancialRefreshWarning } from "../shared/ga4-financial-source";
import { resolveGA4InsightsExecutiveFinancials } from "../client/src/lib/ga4-insights-executive-financials";

const source = readFileSync("client/src/pages/ga4-metrics.tsx", "utf8");
const file = ts.createSourceFile("ga4-metrics.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const component = file.statements.find((node): node is ts.FunctionDeclaration =>
  ts.isFunctionDeclaration(node) && node.name?.text === "GA4Metrics")!;
const declarations = component.body!.statements.flatMap((statement) =>
  ts.isVariableStatement(statement) ? [...statement.declarationList.declarations] : []);
const reportingHelpers = file.statements.flatMap((statement) =>
  ts.isVariableStatement(statement) ? [...statement.declarationList.declarations] : []).filter((node) =>
  ["DEFAULT_GA4_TRENDS_REPORTING_TIME_ZONE", "normalizeClientReportingTimeZone", "formatReportingTimestampLabel"].includes(node.name.getText(file)));
let executiveCard: ts.JsxElement | undefined;
const visit = (node: ts.Node) => {
  if (ts.isJsxElement(node) && node.openingElement.attributes.properties.some((attr) =>
    ts.isJsxAttribute(attr) && attr.name.getText(file) === "data-testid" &&
    attr.initializer && ts.isStringLiteral(attr.initializer) && attr.initializer.text === "insights-executive-financials")) {
    executiveCard = node;
  }
  ts.forEachChild(node, visit);
};
visit(file);
if (!executiveCard) throw new Error("Missing Executive Financials card");
let section: ts.Node = executiveCard;
while (!ts.isCallExpression(section)) section = section.parent;

const fixture = (): Record<string, any> => ({
  campaignId: "campaign-a", campaignCurrency: "EUR", selectedGA4PropertyId: "123", primaryGA4PropertyId: "123",
  ga4ConnectionUsable: true, ga4DailyPlaceholder: false,
  ga4DailyResp: {
    propertyId: "123", overviewStartDate: "2026-09-01", latestStoredDailyDate: "2026-10-15",
    reportingTimeZone: "Europe/Amsterdam", lastUpdated: "2026-10-16T12:05:00.000Z",
  },
  financialDailySnapshotLoading: false, financialDailySnapshotError: false, kpiTrafficInputState: "ready",
  financialDailySnapshotResp: { success: true, snapshot: {
    campaignId: "campaign-a", reportingDate: "2026-10-15", recordedAt: "2026-10-16T06:06:00.000Z",
    metrics: { financialDaily: {
      currency: "EUR",
      currentValueWindow: { startDate: "2026-09-01", endDate: "2026-10-15", reportingTimeZone: "Europe/Amsterdam" },
      inputs: {
        revenue: { available: true, value: "1000.00", sources: ["ga4", "revenue-source:revenue-old"] },
        spend: { available: true, value: "200.00", sources: ["canonical_spend_sources"] },
        conversions: { available: true, value: 10, sources: ["ga4"] },
      },
    } },
  } },
  // The separate live responses have advanced beyond the saved financial update.
  financialRevenue: 9000, financialSpend: 600, financialROAS: 15, financialROI: 1400,
  financialRevenueAvailable: true, financialSpendAvailable: true,
  financialRevenueLoading: false, financialSpendLoading: false,
  spendKpiInputState: "ready", revenueKpiInputState: "ready", hasSpendSources: true,
  ga4HasRevenueMetric: true, ga4NoCompletedWindow: false, ga4RevenueWindowState: {},
  spendMetricAvailable: true, revenueMetricAvailable: true,
  spendToDateResp: { spendToDate: 600, sourceIds: ["spend-new"] },
  spendBreakdownResp: { totalSpend: 600, sources: [{ sourceId: "spend-new" }] },
  spendDisplaySources: [{ sourceId: "spend-new", displayName: "New Spend" }],
  spendSourcesResp: { sources: [{ id: "spend-new", displayName: "New Spend" }] },
  spendSourcesError: false, spendBreakdownError: false,
  importedRevenueToDateResp: { totalRevenue: 8000, sourceIds: ["revenue-new"] },
  revenueDisplaySources: [
    { sourceId: "revenue-old", displayName: "Saved Revenue" },
    { sourceId: "revenue-new", displayName: "New Revenue" },
  ],
  revenueSourcesError: false, revenueBreakdownError: false,
});

// Render the actual page section and its production value/state declarations.
// Only the surrounding UI primitives and query responses are replaced.
function render(input = fixture()) {
  const bindings = {
    ...input, React, computeCpa, computeRoiPercent, resolveGA4OverviewFinancialRefreshWarning,
    resolveGA4InsightsExecutiveFinancials,
    Card: (props: any) => React.createElement("section", props),
    CardHeader: (props: any) => React.createElement("header", props),
    CardTitle: (props: any) => React.createElement("h3", props),
    CardContent: (props: any) => React.createElement("div", props),
    AlertTriangle: () => React.createElement("span"),
    formatMoney: (value: number) => `EUR ${value.toFixed(2)}`,
    formatPercentage: (value: number) => `${value.toFixed(1)}%`,
  };
  const selected = declarations.filter((node) =>
    /^(overviewFinancial|getFinancialSnapshotKpiInputState|snapshot.*KpiInputState|renderFinancialValue)/.test(node.name.getText(file)));
  const text = [...reportingHelpers, ...selected].map((node) => `const ${node.getText(file)};`).join("\n");
  const code = ts.transpileModule(`${text}\nreturn (${section.getText(file)});`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React },
  }).outputText;
  const element = new Function(...Object.keys(bindings), code)(...Object.values(bindings));
  return renderToStaticMarkup(element);
}

const valueCard = (html: string, metric: string) => html.match(new RegExp(
  `<section[^>]*data-testid="insights-financial-${metric}"[^>]*>([\\s\\S]*?)</section>`,
))?.[1] || "";

const assertValues = (html: string, values: Record<string, string>) => {
  for (const [metric, value] of Object.entries(values)) expect(valueCard(html, metric), metric).toContain(value);
};

describe("Insights Executive Financials saved update", () => {
  it("retains all five saved figures when independent financial responses advance after partial refresh", () => {
    const input = fixture();
    const before = JSON.stringify(input);
    const html = render(input);
    assertValues(html, { revenue: "EUR 1000.00", spend: "EUR 200.00", profit: "EUR 800.00", roas: "5.00x", roi: "400.0%" });
    expect(html).toContain("last saved update");
    expect(html).not.toContain("EUR 9000.00");
    expect(JSON.stringify(input)).toBe(before);
  });

  it("uses only saved Revenue contributors and does not invent Spend contributor names", () => {
    const html = render();
    expect(html).toContain("GA4 native revenue, Saved Revenue");
    expect(html).toContain("Source details unavailable");
    expect(html).not.toContain("New Revenue");
    expect(html).not.toContain("New Spend");
  });

  it("updates all five values together when the next saved response arrives", () => {
    const input = fixture();
    const snapshot = input.financialDailySnapshotResp.snapshot;
    snapshot.recordedAt = "2026-10-16T12:06:00.000Z";
    snapshot.metrics.financialDaily.inputs.revenue = { available: true, value: "1800.00", sources: ["ga4", "revenue-source:revenue-new"] };
    snapshot.metrics.financialDaily.inputs.spend.value = "300.00";
    const html = render(input);
    assertValues(html, { revenue: "EUR 1800.00", spend: "EUR 300.00", profit: "EUR 1500.00", roas: "6.00x", roi: "500.0%" });
    expect(html).not.toContain("last saved update");
    expect(html).toContain("New Revenue");
    expect(html).not.toContain("Saved Revenue");
  });

  it("keeps native-only Revenue without requiring external Revenue or Spend sources", () => {
    const input = fixture();
    const inputs = input.financialDailySnapshotResp.snapshot.metrics.financialDaily.inputs;
    inputs.revenue.sources = ["ga4"];
    inputs.spend = { available: false, value: null, sources: [] };
    const html = render(input);
    assertValues(html, { revenue: "EUR 1000.00", spend: "Unavailable", profit: "Unavailable", roas: "Unavailable", roi: "Unavailable" });
    expect(html).toContain("GA4 native revenue");
    expect(html).not.toContain("New Revenue");
    expect(html).not.toContain("Saved Revenue");
    expect(html).not.toContain("Imported source details unavailable");
  });

  it("preserves genuine zero Revenue and negative Profit/ROI", () => {
    const input = fixture();
    input.financialDailySnapshotResp.snapshot.metrics.financialDaily.inputs.revenue.value = "0.00";
    const html = render(input);
    assertValues(html, { revenue: "EUR 0.00", spend: "EUR 200.00", profit: "EUR -200.00", roas: "0.00x", roi: "-100.0%" });
    expect(valueCard(html, "profit")).toContain("text-red-600");
  });

  it("keeps connected zero Spend distinct from missing Spend and withholds zero-denominator ratios", () => {
    const input = fixture();
    input.financialDailySnapshotResp.snapshot.metrics.financialDaily.inputs.spend.value = "0.00";
    const html = render(input);
    assertValues(html, { revenue: "EUR 1000.00", spend: "EUR 0.00", profit: "EUR 1000.00", roas: "—", roi: "—" });
    expect(html).not.toContain("New Spend");
  });

  it("keeps valid Spend when Revenue is unavailable", () => {
    const input = fixture();
    input.financialDailySnapshotResp.snapshot.metrics.financialDaily.inputs.revenue = { available: false, value: null, sources: [] };
    assertValues(render(input), { spend: "EUR 200.00", revenue: "Unavailable", profit: "Unavailable", roas: "Unavailable", roi: "Unavailable" });
  });

  it.each(["missing", "snapshot_error", "campaign", "currency", "property", "start", "timezone", "timestamps"])(
    "withholds unverified financial values instead of falling back to live inputs: %s", (failure) => {
      const input = fixture();
      const snapshot = input.financialDailySnapshotResp.snapshot;
      if (failure === "missing") input.financialDailySnapshotResp.snapshot = null;
      if (failure === "snapshot_error") { input.financialDailySnapshotResp = undefined; input.financialDailySnapshotError = true; }
      if (failure === "campaign") snapshot.campaignId = "campaign-b";
      if (failure === "currency") snapshot.metrics.financialDaily.currency = "USD";
      if (failure === "property") { input.selectedGA4PropertyId = "456"; input.ga4DailyResp.propertyId = "456"; }
      if (failure === "start") snapshot.metrics.financialDaily.currentValueWindow.startDate = "2026-09-02";
      if (failure === "timezone") snapshot.metrics.financialDaily.currentValueWindow.reportingTimeZone = "UTC";
      if (failure === "timestamps") snapshot.recordedAt = "invalid";
      const html = render(input);
      assertValues(html, { revenue: "Unavailable", spend: "Unavailable", profit: "Unavailable", roas: "Unavailable", roi: "Unavailable" });
      expect(html).not.toContain("New Revenue");
      expect(html).not.toContain("Saved Revenue");
      expect(valueCard(html, "profit")).not.toContain("text-emerald-600");
    },
  );

  it("retains the saved figures after a cached snapshot read fails", () => {
    const input = fixture();
    input.financialDailySnapshotResp.snapshot.recordedAt = "2026-10-16T12:06:00.000Z";
    input.financialDailySnapshotError = true;
    const html = render(input);
    assertValues(html, { revenue: "EUR 1000.00", spend: "EUR 200.00", profit: "EUR 800.00" });
    expect(html).toContain("last saved update");
  });

  it("does not make saved values depend on failed live total or source-detail requests", () => {
    const input = fixture();
    input.financialDailySnapshotResp.snapshot.recordedAt = "2026-10-16T12:06:00.000Z";
    input.financialRevenueAvailable = input.financialSpendAvailable = false;
    input.spendToDateResp = input.spendBreakdownResp = input.importedRevenueToDateResp = undefined;
    input.revenueDisplaySources = input.spendDisplaySources = [];
    input.spendSourcesError = input.revenueSourcesError = true;
    input.spendKpiInputState = input.revenueKpiInputState = "unavailable";
    const html = render(input);
    assertValues(html, { revenue: "EUR 1000.00", spend: "EUR 200.00", profit: "EUR 800.00", roas: "5.00x", roi: "400.0%" });
    expect(html).toContain("Imported source details unavailable (1 source)");
  });

  it.each(["snapshot", "property"])("preserves loading state without showing a live zero during %s loading", (loading) => {
    const input = fixture();
    if (loading === "snapshot") { input.financialDailySnapshotResp = undefined; input.financialDailySnapshotLoading = true; }
    else { input.ga4DailyPlaceholder = true; input.kpiTrafficInputState = "loading"; }
    const html = render(input);
    expect(html).not.toMatch(/EUR \d/);
    expect(valueCard(html, "revenue")).toContain("animate-pulse");
  });
});
