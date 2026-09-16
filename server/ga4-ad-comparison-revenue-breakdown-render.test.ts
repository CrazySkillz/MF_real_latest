import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GA4AdComparison from "../client/src/pages/ga4-ad-comparison";

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

function renderRevenueBreakdown(
  revenueState: "loading" | "ready" | "stale" | "unavailable",
  revenueDisplaySources: Array<{
    sourceId: string; displayName: string; sourceType: string; revenue: number | null;
    mappingConfig?: unknown; materializedRevenueStatus?: "available" | "unavailable";
  }>,
) {
  return renderToStaticMarkup(React.createElement(GA4AdComparison, {
    campaignBreakdownAgg: nativeRows,
    chartCampaignRows: nativeRows,
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
  }));
}

describe("GA4 Ad Comparison Revenue Breakdown display states", () => {
  it("preserves a materialized zero source amount", () => {
    const html = renderRevenueBreakdown("ready", [{
      sourceId: "zero-source", displayName: "Exact zero source", sourceType: "csv",
      revenue: 0, materializedRevenueStatus: "available",
      mappingConfig: { campaignValueRevenueTotals: [{ campaignValue: "native_campaign", revenue: 0 }] },
    }]);

    expect(html).toContain("Revenue Breakdown");
    expect(html).toMatch(/GA4 Revenue \(imported to date\)<\/td>\s*<td[^>]*>\$0\.00<\/td>/);
    expect(html).toMatch(/Exact zero source<\/td>\s*<td[^>]*>\$0\.00<\/td>/);
    expect(html).toMatch(/native_campaign<\/td>\s*<td[^>]*>\$0\.00<\/td>/);
  });

  it("marks an unmaterialized source unavailable without using its saved config total", () => {
    const html = renderRevenueBreakdown("ready", [{
      sourceId: "missing-source", displayName: "Missing source", sourceType: "csv",
      revenue: null, materializedRevenueStatus: "unavailable",
      mappingConfig: { lastTotalRevenue: 999, campaignValueRevenueTotals: [{ campaignValue: "old", revenue: 999 }] },
    }]);

    expect(html).toMatch(/Missing source<\/td>\s*<td[^>]*>.*Unavailable/);
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
  });

  it("distinguishes loading and unavailable provenance from zero", () => {
    expect(renderRevenueBreakdown("loading", [])).toContain("Imported revenue provenance is loading.");
    expect(renderRevenueBreakdown("unavailable", [])).toContain("Imported revenue provenance is unavailable.");
    expect(renderRevenueBreakdown("ready", [])).toContain("No additional revenue sources");
  });
});
