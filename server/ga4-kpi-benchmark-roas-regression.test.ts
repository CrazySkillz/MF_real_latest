import { describe, expect, it, vi } from "vitest";

vi.mock("./storage", () => ({ storage: {} }));
vi.mock("./analytics", () => ({ ga4Service: {} }));

import { computeKpiValue } from "./ga4-kpi-benchmark-jobs";
import {
  buildKpiProgressRepairRows,
  computePersistedRoasRatio,
  extractAutoGa4DailyDate,
  isGa4RoasRecord,
} from "./ga4-roas-persisted-cleanup";

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

  it("bounds persisted ROAS cleanup to exact GA4 ROAS rows", () => {
    expect(isGa4RoasRecord({ platformType: "google_analytics", metric: "ROAS" })).toBe(true);
    expect(isGa4RoasRecord({ platformType: "google_analytics", name: "roas" })).toBe(true);
    expect(isGa4RoasRecord({ platformType: "google_analytics", metric: "ROI" })).toBe(false);
    expect(isGa4RoasRecord({ platformType: "campaign", metric: "ROAS" })).toBe(false);
    expect(computePersistedRoasRatio(1250, 250)).toBe(5);
  });

  it("repairs only auto GA4 daily KPI progress rows from strict notes", () => {
    expect(extractAutoGa4DailyDate("auto:ga4_daily:2026-06-26")).toBe("2026-06-26");
    expect(extractAutoGa4DailyDate("manual adjustment")).toBeNull();
    expect(extractAutoGa4DailyDate("auto:ga4_daily")).toBeNull();

    const rows = [
      { id: "manual-1", value: "2", recordedAt: new Date("2026-06-25T23:59:59.000Z"), notes: "manual" },
      { id: "auto-1", value: "1000", recordedAt: new Date("2026-06-26T23:59:59.000Z"), notes: "auto:ga4_daily:2026-06-26" },
      { id: "auto-2", value: "500", recordedAt: new Date("2026-06-27T23:59:59.000Z"), notes: "auto:ga4_daily:2026-06-27" },
    ];

    const repairs = buildKpiProgressRepairRows(rows, new Map([
      ["auto-1", 10],
      ["auto-2", 4],
    ]));

    expect(repairs).toEqual([
      { id: "auto-1", value: 10, rollingAverage7d: 6, rollingAverage30d: 6, trendDirection: "up" },
      { id: "auto-2", value: 4, rollingAverage7d: 5.33, rollingAverage30d: 5.33, trendDirection: "down" },
    ]);
  });
});
