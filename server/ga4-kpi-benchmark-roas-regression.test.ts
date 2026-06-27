import { describe, expect, it, vi } from "vitest";

vi.mock("./storage", () => ({ storage: {} }));
vi.mock("./analytics", () => ({ ga4Service: {} }));

import { computeKpiValue } from "./ga4-kpi-benchmark-jobs";

const inputs = {
  users: 0,
  sessions: 0,
  pageviews: 0,
  conversions: 5,
  ga4Revenue: 1000,
  importedRevenue: 0,
  spend: 100,
  engagementRate: 0,
};

describe("GA4 KPI/Benchmark persisted ROAS current value", () => {
  it("stores ROAS as revenue/spend ratio, not percent", () => {
    expect(computeKpiValue("ROAS", inputs)).toBe(10);
  });

  it("uses additive GA4 plus imported revenue for ROAS", () => {
    expect(computeKpiValue("roas", { ...inputs, importedRevenue: 500 })).toBe(15);
  });

  it("keeps ROI as percent and CPA as currency-style value", () => {
    expect(computeKpiValue("ROI", inputs)).toBe(900);
    expect(computeKpiValue("CPA", inputs)).toBe(20);
  });
});
