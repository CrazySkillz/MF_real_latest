import { describe, expect, it, vi } from "vitest";

vi.mock("./storage", () => ({ storage: {} }));
vi.mock("./analytics", () => ({ ga4Service: {} }));

import { computeCampaignCurrentValueFromConfig } from "./utils/campaign-current-values";

const totals = {
  revenue: 350,
  ga4Revenue: 300,
  spend: 100,
  conversions: 10,
  financialConversions: 10,
  users: 0,
  sessions: 0,
  engagementRate: 0,
  revenueBySource: new Map([["hubspot-1", 50]]),
  spendBySource: new Map<string, number>(),
};

const value = (metric: string, inputs: Record<string, string[]>) =>
  computeCampaignCurrentValueFromConfig({ metric, inputs }, totals);

describe("campaign current financial formulas", () => {
  it("uses selected native GA4 and materialized HubSpot revenue without duplication", () => {
    expect(value("revenue", { revenue: ["ga4", "revenue-source:hubspot-1"] })).toBe(350);
    expect(value("revenue", { revenue: ["total_revenue"] })).toBe(350);
  });

  it("keeps Profit, ROAS, ROI, and CPA on the same selected totals", () => {
    const inputs = {
      revenue: ["total_revenue"],
      spend: ["total_spend"],
      conversions: ["total_conversions"],
    };
    expect(value("profit", inputs)).toBe(250);
    expect(value("roas", inputs)).toBe(3.5);
    expect(value("roi", inputs)).toBe(250);
    expect(value("cpa", inputs)).toBe(10);
  });
});
