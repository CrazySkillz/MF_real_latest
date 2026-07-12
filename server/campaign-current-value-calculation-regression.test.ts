import { describe, expect, it } from "vitest";
import { computeCampaignCurrentValueFromConfig } from "./utils/campaign-current-values";

describe("campaign current-value calculation regression guard", () => {
  const totals = (overrides: Record<string, unknown> = {}) => ({
    revenue: 1200,
    ga4Revenue: 1200,
    spend: 300,
    conversions: 60,
    financialConversions: 60,
    users: 1000,
    sessions: 2000,
    engagementRate: 50,
    revenueBySource: new Map(),
    spendBySource: new Map(),
    ...overrides,
  }) as any;

  it("updates campaign KPI values when connected-platform revenue or spend totals change", () => {
    const roasConfig = {
      metric: "roas",
      inputs: {
        revenue: ["total_revenue"],
        spend: ["total_spend"],
      },
    };

    expect(computeCampaignCurrentValueFromConfig(roasConfig, totals())).toBe(4);
    expect(computeCampaignCurrentValueFromConfig(roasConfig, totals({ revenue: 1800 }))).toBe(6);
  });

  it("updates campaign Benchmark values when connected-platform spend or financial conversion totals change", () => {
    const cpaConfig = {
      metric: "cpa",
      inputs: {
        spend: ["total_spend"],
        conversions: ["total_conversions"],
      },
    };

    expect(computeCampaignCurrentValueFromConfig(cpaConfig, totals())).toBe(5);
    expect(computeCampaignCurrentValueFromConfig(cpaConfig, totals({ spend: 480 }))).toBe(8);
    expect(computeCampaignCurrentValueFromConfig(cpaConfig, totals({ financialConversions: 75 }))).toBe(4);
  });
});
