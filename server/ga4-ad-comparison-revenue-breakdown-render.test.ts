import React from "react";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GA4AdComparison from "../client/src/pages/ga4-ad-comparison";
import { resolveExactGA4CampaignBreakdownRevenue, roundGA4CampaignRevenueForDisplay } from "../shared/ga4-campaign-breakdown";
import { getGA4PeriodTraffic } from "../shared/ga4-traffic-window";

vi.mock("@/components/ui/card", async () => {
  const React = await import("react");
  const wrap = ({ children }: { children?: React.ReactNode }) => React.createElement("div", null, children);
  return { Card: wrap, CardContent: wrap, CardDescription: wrap, CardHeader: wrap, CardTitle: wrap };
});
vi.mock("@/components/ui/select", async () => {
  const React = await import("react");
  const wrap = ({ children }: { children?: React.ReactNode }) => React.createElement("div", null, children);
  return { Select: wrap, SelectContent: wrap, SelectItem: wrap, SelectTrigger: wrap, SelectValue: wrap };
});
vi.mock("@/components/ui/tooltip", async () => {
  const React = await import("react");
  const wrap = ({ children }: { children?: React.ReactNode }) => React.createElement("div", null, children);
  return { Tooltip: wrap, TooltipContent: wrap, TooltipProvider: wrap, TooltipTrigger: wrap };
});

beforeEach(() => vi.stubGlobal("React", React));
afterEach(() => vi.unstubAllGlobals());

const nativeRows = [{
  name: "native_campaign", sessions: 1, users: 1, conversions: 0,
  revenue: 0, conversionRate: 0, revenuePerSession: 0,
}];

describe("saved native campaign revenue provenance", () => {
  const page = readFileSync("client/src/pages/ga4-metrics.tsx", "utf8");
  const start = page.indexOf("const adComparisonNativeCampaignRevenueRows = useMemo(() => {");
  const end = page.indexOf("const overviewGA4ReportingTimeZone", start);
  const report = { propertyId: "425831989", startDate: "2025-11-20", endDate: "2026-11-28", lastUpdated: "2026-11-28T14:03:17.411Z" };
  function resolve(overrides: Record<string, unknown> = {}) {
    const bindings = { useMemo: (fn: () => unknown) => fn(), ga4ConnectionUsable: true, breakdownPlaceholder: false,
      adComparisonBreakdownPlaceholder: false, campaignBreakdownRevenueVerified: true,
      overviewGA4ReportingStartDate: report.startDate, overviewGA4ReportingDate: report.endDate,
      ga4Breakdown: report, adComparisonBreakdown: report, selectedGA4PropertyId: report.propertyId,
      campaignBreakdownNativeRows: [{ revenue: 40.5 }, { revenue: 0 }],
      campaignBreakdownAgg: [{ name: "coffee_bags", revenue: 40.5, unroundedRevenue: 40.5 }, { name: "served_here", revenue: 0, unroundedRevenue: 0 }],
      adComparisonNativeRevenue: 40.5, ...overrides };
    expect(start).toBeGreaterThan(0); expect(end).toBeGreaterThan(start);
    const before = JSON.stringify(bindings);
    const result = new Function(...Object.keys(bindings), ts.transpileModule(page.slice(start, end) +
      "return adComparisonNativeCampaignRevenueRows;", { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText)(...Object.values(bindings));
    expect(JSON.stringify(bindings)).toBe(before);
    return result;
  }
  it("accepts the complete same-property annual saved publication and recorded zero", () => {
    expect(resolve()).toEqual([{ name: "coffee_bags", revenue: 40.5, unroundedRevenue: 40.5 }, { name: "served_here", revenue: 0, unroundedRevenue: 0 }]);
  });
  it.each([
    { ga4ConnectionUsable: false }, { breakdownPlaceholder: true }, { adComparisonBreakdownPlaceholder: true },
    { campaignBreakdownRevenueVerified: false }, { overviewGA4ReportingStartDate: "" }, { overviewGA4ReportingDate: "" },
    { selectedGA4PropertyId: "another-property" }, { adComparisonNativeRevenue: 39 },
    { ga4Breakdown: undefined }, { adComparisonBreakdown: undefined },
    ...["ga4Breakdown", "adComparisonBreakdown"].flatMap(key => [
      { [key]: { ...report, propertyId: "another-property" } }, { [key]: { ...report, startDate: "2026-09-23" } },
      { [key]: { ...report, endDate: "2026-11-27" } }, { [key]: { ...report, lastUpdated: "" } },
      { [key]: { ...report, lastUpdated: "2026-11-28T14:00:00.000Z" } },
    ]),
    ...[null, undefined, "40.5", Number.NaN, Number.POSITIVE_INFINITY].map(revenue => ({ campaignBreakdownNativeRows: [{ revenue }] })),
  ])("withholds detail for unverified, mismatched or malformed inputs %#", overrides => {
    expect(resolve(overrides)).toBeUndefined();
  });
  it("uses full saved detail beyond 2000 rows and withholds it when the unchanged native subtotal is incomplete", () => {
    const rows = Array.from({ length: 2001 }, (_, i) => ({ revenue: i === 2000 ? 40.5 : 0 }));
    expect(resolve({ campaignBreakdownNativeRows: rows })).toHaveLength(2);
    expect(resolve({ campaignBreakdownNativeRows: rows, adComparisonNativeRevenue: 0 })).toBeUndefined();
  });
  it("reconciles signed amounts before rounding without altering per-campaign display precision", () => {
    const rows = [{ revenue: -1.006 }, { revenue: 0.006 }];
    const agg = rows.map((row, i) => ({ name: String(i), revenue: Number(row.revenue.toFixed(2)), unroundedRevenue: row.revenue }));
    expect(resolve({ campaignBreakdownNativeRows: rows, campaignBreakdownAgg: agg, adComparisonNativeRevenue: -1 })).toEqual(agg);
  });
});

function renderRevenueBreakdown(
  revenueState: "loading" | "ready" | "stale" | "unavailable",
  revenueDisplaySources: Array<{
    sourceId: string; displayName: string; sourceType: string; revenue: number | null;
    mappingConfig?: unknown; materializedRevenueStatus?: "available" | "unavailable";
  }>,
  chartCampaignRows = nativeRows,
  campaignBreakdownAgg = nativeRows,
  nativeRevenue?: number,
  chartOptions: Partial<React.ComponentProps<typeof GA4AdComparison>> = {},
) {
  return renderToStaticMarkup(React.createElement(GA4AdComparison, {
    campaignBreakdownAgg,
    ...(nativeRevenue === undefined ? {} : { nativeRevenue }),
    chartCampaignRows,
    breakdownLoading: false,
    chartBreakdownLoading: false,
    chartBreakdownUnavailable: false,
    chartBreakdownStale: false,
    revenueState,
    selectedMetric: "sessions",
    onMetricChange: () => {},
    formatNumber: (value: number) => String(value),
    formatMoney: (value: number) => `$${value.toFixed(2)}`,
    revenueDisplaySources,
    ...chartOptions,
  }));
}

describe("GA4 Ad Comparison Revenue Breakdown display states", () => {
  it("shows native campaign revenue for the imported dates without double-counting or including mapped source revenue", () => {
    const rows = [{ ...nativeRows[0], name: "coffee_bags", revenue: 40.5 }, { ...nativeRows[0], name: "served_here" }];
    const sources = [{ sourceId: "crm", displayName: "CRM", sourceType: "hubspot", revenue: 100 }];
    const chart = rows.map(row => ({ ...row, revenue: row.revenue + 50 }));
    const options = { nativeCampaignRevenueRows: rows, comparisonStartDate: "2025-11-20", comparisonEndDate: "2026-11-28" };
    const original = JSON.stringify({ rows, sources, chart });
    for (const state of ["ready", "stale", "loading", "unavailable"] as const) {
      const html = renderRevenueBreakdown(state, sources, chart, rows, 40.5, options);
      const detail = html.match(/<tr[^>]*data-testid="ga4-campaign-revenue-row"[^>]*>[\s\S]*?<\/tr>/g)!;
      expect(detail).toHaveLength(2);
      expect(detail[0]).toContain("coffee_bags</td>"); expect(detail[0]).toContain("$40.50</td>");
      expect(detail[1]).toContain("served_here</td>"); expect(detail[1]).toContain("$0.00</td>");
      expect(html).toContain("GA4 revenue by campaign: 2025-11-20 → 2026-11-28.");
      expect(html).toMatch(/GA4 Revenue<\/td>\s*<td[^>]*>\$40\.50<\/td>/);
      const total = html.slice(html.indexOf("TOTAL</td>"));
      expect(total).toContain(state === "ready" || state === "stale" ? "$140.50" : "Unavailable");
    }
    expect(JSON.stringify({ rows, sources, chart })).toBe(original);
  });
  it("does not cap campaign detail at the chart limit and preserves signed revenue without allocating rounding cents", () => {
    const rows = Array.from({ length: 31 }, (_, i) => ({ ...nativeRows[0], name: `campaign-${i}`, revenue: i === 30 ? -1.01 : 0 }));
    const html = renderRevenueBreakdown("ready", [], rows, rows, -1, { nativeCampaignRevenueRows: rows });
    expect(html.match(/data-testid="ga4-campaign-revenue-row"/g)).toHaveLength(31);
    expect(html).toMatch(/campaign-30<\/td>\s*<td[^>]*>\$-1\.01<\/td>/);
    expect(html).toMatch(/TOTAL<\/td>\s*<td[^>]*>\$-1\.00<\/td>/);
  });
  it("keeps existing source totals while explicitly withholding unverified campaign detail", () => {
    const html = renderRevenueBreakdown("ready", [], nativeRows, nativeRows, 40.5);
    expect(html).not.toContain('data-testid="ga4-campaign-revenue-row"');
    expect(html).toContain("Per-campaign GA4 revenue is unavailable for these imported dates.");
    expect(html).toMatch(/TOTAL<\/td>\s*<td[^>]*>\$40\.50<\/td>/);
  });
  it("adds quantity cards below the four rankings only when verified quantities were supplied", () => {
    const rows = [{ ...nativeRows[0], name: "coffee_bags", sessions: 109, revenue: 40.5, conversionRate: 0.92 }, { ...nativeRows[0], name: "served_here", sessions: 24 }];
    const base = { campaignBreakdownAgg: rows, chartCampaignRows: rows, breakdownLoading: false, chartBreakdownLoading: false,
      chartBreakdownUnavailable: false, chartBreakdownStale: false, selectedMetric: "sessions", onMetricChange: () => {}, formatNumber: String, formatMoney: String };
    const original = renderToStaticMarkup(React.createElement(GA4AdComparison, base));
    expect(original).not.toContain("Highest Units Sold"); expect(original).not.toContain("Fewest Units Sold");
    const html = renderToStaticMarkup(React.createElement(GA4AdComparison, { ...base, unitsSoldRankings: [
      { title: "Highest Units Sold", units: 6, names: ["coffee_bags"] }, { title: "Fewest Units Sold", units: 0, names: ["served_here"] },
    ] }));
    expect(html).toContain("6 units sold"); expect(html).toContain("0 units sold");
    expect(html.indexOf("Highest Units Sold")).toBeGreaterThan(html.indexOf("Lowest Conversion Rate"));
    expect(html.slice(html.indexOf("Top Campaigns by"))).toBe(original.slice(original.indexOf("Top Campaigns by")));
    for (const title of ["Highest Revenue", "Highest Conversion Rate", "Lowest Revenue", "Lowest Conversion Rate"]) {
      expect(html).toContain(title); expect(original).toContain(title);
    }
  });
  it("matches Overview's unavailable overall rate when no sessions exist", () => {
    const rows = [{ ...nativeRows[0], sessions: 0 }];
    const html = renderRevenueBreakdown("ready", [], rows, rows, 0, { selectedMetric: "conversionRate" });
    expect(html).not.toContain("Overall Conversion Rate");
  });
  it.each([0, 0.125, 2])("matches Overview conversion counts and rates, including fractional and repeated conversions (factor %s)", factor => {
    const page = readFileSync("client/src/pages/ga4-metrics.tsx", "utf8");
    const start = page.indexOf("const campaignBreakdownAgg = useMemo(() => {");
    const end = page.indexOf("const sourceRevenueBreakdowns = useMemo(() => {", start);
    const rows = [
      { campaign: "sale", sessions: 40, users: 20, conversions: 30 * factor, revenue: 10, sessionKeyEventRate: 0.1 },
      { campaign: "sale", sessions: 10, users: 5, conversions: 10 * factor, revenue: 5, sessionKeyEventRate: 0.2 },
      { campaign: "SALE", sessions: 50, users: 25, conversions: 20 * factor, revenue: 10, sessionKeyEventRate: 0.3 },
      { campaign: "empty", sessions: 0, users: 0, conversions: 0, revenue: 0, sessionKeyEventRate: 0 },
      { campaign: "unselected", sessions: 1000, conversions: 1000, revenue: 1000, sessionKeyEventRate: 1 },
    ];
    const before = JSON.stringify(rows);
    const bindings = { getGA4PeriodTraffic: (_report: unknown, _start: unknown, _end: unknown, name: string) => ({ conversionRate: name === "sale" ? 10 : 0 }), getGA4DistinctUsers: () => 344, useMemo: (fn: () => unknown) => fn(), ga4Breakdown: { rows }, breakdownPlaceholder: false,
      adComparisonBreakdown: { rows }, adComparisonBreakdownPlaceholder: false,
      importedGA4CampaignNames: new Set(["sale", "empty"]), normalizeCampaignKey: (name: string) => name.trim().toLowerCase(),
      campaignCurrency: "EUR", revenueDisplaySources: [], resolveExactGA4CampaignBreakdownRevenue, roundGA4CampaignRevenueForDisplay };
    const aggregate = new Function(...Object.keys(bindings), ts.transpileModule(page.slice(start, end) +
      "return adComparisonChartRows;", { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText)(...Object.values(bindings));
    expect(aggregate.map((row: any) => row.conversionRate)).toEqual([10, 0]);
    expect(aggregate.reduce((sum: number, row: any) => sum + row.conversions, 0)).toBe(60 * factor);
    const html = renderRevenueBreakdown("ready", [], aggregate, aggregate, 25, { selectedMetric: "conversionRate", chartConversionRate: 10 });
    expect(html).not.toContain("Overall Conversion Rate");
    const countHtml = renderRevenueBreakdown("ready", [], aggregate, aggregate, 25, { selectedMetric: "conversions" });
    expect(countHtml).not.toContain("Total Conversions");
    expect(html).not.toContain("unselected");
    expect(JSON.stringify(rows)).toBe(before);
  });
  it("reconciles Promo's displayed campaign rows to its precise total with an unmapped CSV", () => {
    const page = readFileSync("client/src/pages/ga4-metrics.tsx", "utf8");
    const start = page.indexOf("const campaignBreakdownAgg = useMemo(() => {");
    const end = page.indexOf("const sourceRevenueBreakdowns = useMemo(() => {", start);
    const rows = [
      { campaign: "yesop_brand_search", sessions: 2394, users: 2395, conversions: 250, revenue: 66625.346347 },
      { campaign: "yesop_retargeting", sessions: 1039, users: 1039, conversions: 66, revenue: 13808.508329999999 },
    ];
    const sources = [{ sourceId: "csv", displayName: "CSV", sourceType: "csv", currency: "EUR", revenue: 250,
      mappingConfig: { campaignColumn: "Campaign" } }];
    const before = JSON.stringify({ rows, sources });
    const bindings = { getGA4PeriodTraffic, getGA4DistinctUsers: () => 344, useMemo: (fn: () => unknown) => fn(), ga4Breakdown: { rows }, breakdownPlaceholder: false,
      adComparisonBreakdown: { rows }, adComparisonBreakdownPlaceholder: false,
      importedGA4CampaignNames: new Set(rows.map(row => row.campaign)), normalizeCampaignKey: (name: string) => name.trim().toLowerCase(),
      campaignCurrency: "EUR", revenueDisplaySources: sources, resolveExactGA4CampaignBreakdownRevenue, roundGA4CampaignRevenueForDisplay };
    const aggregate = new Function(...Object.keys(bindings), ts.transpileModule(page.slice(start, end) +
      "return { rows: adComparisonChartRows, subtotal: adComparisonChartRevenue, native: adComparisonNativeRevenue };",
      { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText)(...Object.values(bindings));
    expect(aggregate).toMatchObject({ subtotal: 80433.85, native: 80433.85 });
    expect(aggregate.rows.map((row: any) => row.revenue)).toEqual([66625.34, 13808.51]);
    expect(Number(aggregate.rows.reduce((sum: number, row: any) => sum + row.revenue, 0).toFixed(2))).toBe(80433.85);
    const html = renderRevenueBreakdown("ready", sources, aggregate.rows, aggregate.rows, aggregate.native,
      { selectedMetric: "revenue", chartRevenue: aggregate.subtotal });
    expect(html).not.toContain("Campaign Breakdown Revenue");
    expect(html).toMatch(/TOTAL<\/td>\s*<td[^>]*>\$80683\.85<\/td>/);
    expect(JSON.stringify({ rows, sources })).toBe(before);
  });
  it.each([1, -1, 0].flatMap(sign => [false, true].map(mapped => ({ sign, mapped }))))("totals chart revenue before rounding, with signed native amounts and mapped=$mapped (sign $sign)", ({ sign, mapped }) => {
    const page = readFileSync("client/src/pages/ga4-metrics.tsx", "utf8");
    const start = page.indexOf("const campaignBreakdownAgg = useMemo(() => {");
    const end = page.indexOf("const sourceRevenueBreakdowns = useMemo(() => {", start);
    expect(start).toBeGreaterThan(0); expect(end).toBeGreaterThan(start);
    const rows = [
      { campaign: "campaign-a", sessions: 173, users: 172, conversions: 9.5, revenue: 1700.2170965 * sign, sessionKeyEventRate: 0.05 },
      { campaign: "campaign-a", sessions: 173, users: 172, conversions: 9.5, revenue: 1700.2170965 * sign, sessionKeyEventRate: 0.05 },
      { campaign: "campaign-b", sessions: 258, users: 258, conversions: 21, revenue: 4253.52214 * sign, sessionKeyEventRate: 0.08 },
      { campaign: "unselected", sessions: 1, revenue: 999999 },
    ];
    const sources = [{ sourceId: "crm", displayName: "CRM", sourceType: "hubspot", currency: "EUR", revenue: 250, mappingConfig: {
      pipelineEnabled: true, pipelineTotalToDate: 3200,
      campaignMappings: mapped ? [{ crmValue: "deal-a", linkedinCampaignName: "campaign-a" }] : [],
      campaignValueRevenueTotals: [{ campaignValue: "deal-a", revenue: 250 }],
    } }, { sourceId: "unmapped", displayName: "Unmapped", sourceType: "salesforce", currency: "EUR", revenue: 100 }];
    const before = JSON.stringify({ rows, sources });
    const bindings = { getGA4PeriodTraffic, getGA4DistinctUsers: () => 344, useMemo: (fn: () => unknown) => fn(), ga4Breakdown: { rows }, breakdownPlaceholder: false,
      adComparisonBreakdown: { rows: [{ campaign: "campaign-a", revenue: 999 }] }, adComparisonBreakdownPlaceholder: false,
      importedGA4CampaignNames: new Set(["campaign-a", "campaign-b"]), normalizeCampaignKey: (name: string) => name.trim().toLowerCase(),
      campaignCurrency: "EUR", revenueDisplaySources: sources, resolveExactGA4CampaignBreakdownRevenue, roundGA4CampaignRevenueForDisplay };
    const aggregate = new Function(...Object.keys(bindings), ts.transpileModule(page.slice(start, end) + `return {
      rows: adComparisonChartRows, subtotal: typeof adComparisonChartRevenue === "undefined" ? adComparisonChartRows.reduce((s, r) => s + r.revenue, 0) : adComparisonChartRevenue,
    };`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText)(...Object.values(bindings));
    const expected = Number((7653.956333 * sign + (mapped ? 250 : 0)).toFixed(2));
    expect(Number(aggregate.subtotal.toFixed(2))).toBe(expected);
    const html = renderRevenueBreakdown("ready", sources, aggregate.rows, nativeRows, 999, { selectedMetric: "revenue", chartRevenue: aggregate.subtotal });
    expect(html).not.toContain("Campaign Breakdown Revenue");
    expect(aggregate.rows.map((row: any) => row.revenue)).toEqual([3400.44 * sign + (mapped ? 250 : 0), 4253.52 * sign]);
    expect(JSON.stringify({ rows, sources })).toBe(before);
  });

  it.each([
    [1, "7653.96", "8003.96"], [-1, "-7653.96", "-7303.96"], [0, "0.00", "350.00"],
  ])("sums full-precision selected campaign amounts before rounding (sign %s)", (sign, native, total) => {
    const page = readFileSync("client/src/pages/ga4-metrics.tsx", "utf8");
    const start = page.indexOf("const adComparisonBreakdownAgg = useMemo(() => {");
    const end = page.indexOf("const campaignBreakdownMatchedExternalRevenue", start);
    expect(start).toBeGreaterThan(0); expect(end).toBeGreaterThan(start);
    const rows = [
      { campaign: "yesop_prospecting", revenue: 1700.2170965 * Number(sign), sessions: 173, users: 172, conversions: 9.5 },
      { campaign: "yesop_prospecting", revenue: 1700.2170965 * Number(sign), sessions: 173, users: 172, conversions: 9.5 },
      { campaign: "yesop_paid_social", revenue: 4253.52214 * Number(sign), sessions: 258, users: 258, conversions: 21 },
      { campaign: "unselected_campaign", revenue: 999999, sessions: 1, users: 1, conversions: 1 },
    ];
    const before = JSON.stringify(rows);
    const bindings = { getGA4PeriodTraffic, getGA4DistinctUsers: () => 344, useMemo: (fn: () => unknown) => fn(), adComparisonBreakdown: { rows }, adComparisonBreakdownPlaceholder: false,
      importedGA4CampaignNames: new Set(["yesop_prospecting", "yesop_paid_social"]), normalizeCampaignKey: (name: string) => name.trim().toLowerCase(), roundGA4CampaignRevenueForDisplay };
    const aggregate = new Function(...Object.keys(bindings), ts.transpileModule(page.slice(start, end) + 'return { rows: adComparisonBreakdownAgg, native: typeof adComparisonNativeRevenue === "undefined" ? undefined : adComparisonNativeRevenue };', {
      compilerOptions: { target: ts.ScriptTarget.ES2022 },
    }).outputText)(...Object.values(bindings));
    const html = renderRevenueBreakdown("ready", [
      { sourceId: "hubspot", displayName: "HubSpot", sourceType: "hubspot", revenue: 250 },
      { sourceId: "salesforce", displayName: "Salesforce", sourceType: "salesforce", revenue: 100 },
    ], nativeRows, aggregate.rows, aggregate.native);
    expect(html).toContain(`$${native}`);
    expect(html).toMatch(new RegExp(`TOTAL</td>\\s*<td[^>]*>\\$${String(total).replace(".", "\\.")}</td>`));
    expect(aggregate.rows.map((row: any) => row.name)).toEqual(["yesop_prospecting", "yesop_paid_social"]);
    expect(aggregate.rows[0]).toMatchObject({ sessions: 346, users: 344, conversions: 19 });
    expect(aggregate.rows.map((row: any) => row.revenue)).toEqual([3400.44 * Number(sign), 4253.52 * Number(sign)]);
    expect(JSON.stringify(rows)).toBe(before);
    expect(html).not.toContain("unselected_campaign");
  });

  it("keeps both retained subsections together without the retired table", () => {
    const html = renderRevenueBreakdown("ready", [], [
      { ...nativeRows[0], name: "campaign-a", sessions: 10, conversions: 2, conversionRate: 20 },
      { ...nativeRows[0], name: "campaign-b", sessions: 20, conversions: 0, conversionRate: 0 },
    ]);

    for (const title of ["Highest Revenue", "Highest Conversion Rate", "Lowest Revenue", "Lowest Conversion Rate"]) expect(html).toContain(title);
    expect(html).toContain("Top Campaigns by Sessions");
    expect(html).not.toContain("Campaigns Compared");
    expect(html).not.toContain("Total Sessions");
    expect(html).toContain("Revenue Breakdown");
    expect(html).not.toContain("All Campaigns");
  });

  it("omits a completed-day zero and undated saved-config details", () => {
    const html = renderRevenueBreakdown("ready", [{
      sourceId: "zero-source", displayName: "Exact zero source", sourceType: "csv",
      revenue: 0, materializedRevenueStatus: "available",
      mappingConfig: { campaignValueRevenueTotals: [{ campaignValue: "latest_value_not_in_cutoff", revenue: 999 }] },
    }]);

    expect(html).toContain("Revenue Breakdown");
    expect(html).toContain("Top Campaigns by Sessions");
    expect(html).not.toContain("All Campaigns");
    expect(html).toMatch(/GA4 Revenue<\/td>\s*<td[^>]*>\$0\.00<\/td>/);
    expect(html).not.toContain("Exact zero source");
    expect(html).toContain("No additional revenue sources");
    expect(html).toMatch(/TOTAL<\/td>\s*<td[^>]*>\$0\.00<\/td>/);
    expect(html).not.toContain("latest_value_not_in_cutoff");
    expect(html).not.toContain("$999.00");
  });

  it("marks an unmaterialized source unavailable without using its saved config total", () => {
    const html = renderRevenueBreakdown("ready", [{
      sourceId: "missing-source", displayName: "Missing source", sourceType: "csv",
      revenue: null, materializedRevenueStatus: "unavailable",
      mappingConfig: { lastTotalRevenue: 999, campaignValueRevenueTotals: [{ campaignValue: "old", revenue: 999 }] },
    }]);

    expect(html).toMatch(/Missing source<\/td>\s*<td[^>]*>.*Unavailable/);
    expect(html).toMatch(/TOTAL<\/td>\s*<td[^>]*>.*Unavailable/);
    expect(html).not.toContain("$999.00");
    expect(html).not.toContain(">old<");
  });

  it("labels retained source values stale after refresh failure", () => {
    const html = renderRevenueBreakdown("stale", [{
      sourceId: "stale-source", displayName: "Last-good source", sourceType: "csv",
      revenue: 12, materializedRevenueStatus: "available",
    }]);

    expect(html).toMatch(/Last-good source<\/td>\s*<td[^>]*>\$12\.00<\/td>/);
    expect(html).toContain("Imported source amounts are last-good values; the latest refresh failed.");
    expect(html).toMatch(/TOTAL<\/td>\s*<td[^>]*>\$12\.00<\/td>/);
  });

  it("totals native GA4 revenue and every confirmed imported source amount", () => {
    const html = renderRevenueBreakdown("ready", [
      { sourceId: "sheet", displayName: "Google Sheets", sourceType: "google_sheets", revenue: 30340, materializedRevenueStatus: "available" },
      { sourceId: "hubspot", displayName: "HubSpot", sourceType: "hubspot", revenue: 10000, materializedRevenueStatus: "available" },
      { sourceId: "csv", displayName: "CSV", sourceType: "csv", revenue: 250, materializedRevenueStatus: "available" },
      { sourceId: "salesforce", displayName: "Salesforce", sourceType: "salesforce", revenue: 75, materializedRevenueStatus: "available" },
      { sourceId: "shopify", displayName: "Shopify", sourceType: "shopify", revenue: 785.95, materializedRevenueStatus: "available" },
    ], nativeRows, [{ ...nativeRows[0], revenue: 37518.74 }]);

    expect(html).toMatch(/TOTAL<\/td>\s*<td[^>]*>\$78969\.69<\/td>/);
  });

  it("distinguishes loading and unavailable provenance from zero", () => {
    expect(renderRevenueBreakdown("loading", [])).toContain("Imported revenue provenance is loading.");
    expect(renderRevenueBreakdown("unavailable", [])).toContain("Imported revenue provenance is unavailable.");
    expect(renderRevenueBreakdown("ready", [])).toContain("No additional revenue sources");
  });
});
