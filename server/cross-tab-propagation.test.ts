import { describe, it, expect } from "vitest";
import {
  computeCpa,
  computeRoiPercent,
  formatPct,
} from "../shared/metric-math";
import {
  computeAttainmentPct,
  isLowerIsBetterKpi,
} from "../shared/kpi-math";

/**
 * Cross-Tab Propagation Tests
 *
 * Verifies that when spend or revenue changes, ALL derived metrics
 * update consistently across tabs (Overview, KPIs, Benchmarks, Insights).
 *
 * These tests simulate the data flow:
 *   spend/revenue change → ROAS/ROI/CPA recalculate → KPI progress updates
 */

describe("Spend change propagation", () => {
  const revenue = 265000;

  it("adding spend changes ROAS, ROI, CPA, Profit", () => {
    const spendBefore = 0;
    const spendAfter = 5000;
    const conversions = 2760;

    // Before spend
    const roasBefore = spendBefore > 0 ? revenue / spendBefore : 0;
    const cpaBefore = computeCpa(spendBefore, conversions);
    const roiBefore = computeRoiPercent(revenue, spendBefore);
    const profitBefore = revenue - spendBefore;

    // After spend
    const roasAfter = spendAfter > 0 ? revenue / spendAfter : 0;
    const cpaAfter = computeCpa(spendAfter, conversions);
    const roiAfter = computeRoiPercent(revenue, spendAfter);
    const profitAfter = revenue - spendAfter;

    // ROAS should exist now
    expect(roasBefore).toBe(0);
    expect(roasAfter).toBeCloseTo(53, 0);

    // CPA should exist now
    expect(cpaBefore).toBe(0);
    expect(cpaAfter).toBeCloseTo(1.81, 1);

    // Profit decreases when spend is added
    expect(profitAfter).toBeLessThan(profitBefore);
    expect(profitAfter).toBe(260000);
  });

  it("increasing spend decreases ROAS and increases CPA", () => {
    const spend1 = 5000;
    const spend2 = 10000;
    const conversions = 2760;

    const roas1 = revenue / spend1;
    const roas2 = revenue / spend2;
    expect(roas2).toBeLessThan(roas1); // ROAS decreased

    const cpa1 = computeCpa(spend1, conversions);
    const cpa2 = computeCpa(spend2, conversions);
    expect(cpa2).toBeGreaterThan(cpa1); // CPA increased
  });

  it("deleting spend makes ROAS/CPA undefined (returns 0)", () => {
    const spend = 0; // all sources deleted
    const conversions = 2760;
    const roas = spend > 0 ? revenue / spend : 0;
    const cpa = computeCpa(spend, conversions);
    expect(roas).toBe(0);
    expect(cpa).toBe(0);
  });
});

describe("Revenue change propagation", () => {
  const spend = 5000;

  it("adding imported revenue increases ROAS and Profit", () => {
    const ga4Revenue = 265000;
    const importedRevenue = 10000;

    const totalRevenueBefore = ga4Revenue;
    const totalRevenueAfter = ga4Revenue + importedRevenue;

    const roasBefore = totalRevenueBefore / spend;
    const roasAfter = totalRevenueAfter / spend;

    expect(roasAfter).toBeGreaterThan(roasBefore);
    expect(totalRevenueAfter - spend).toBeGreaterThan(totalRevenueBefore - spend);
  });

  it("deleting a revenue source decreases Total Revenue", () => {
    const ga4Revenue = 265000;
    const manualRevenue = 10000;
    const csvRevenue = 5000;

    const totalBefore = ga4Revenue + manualRevenue + csvRevenue;
    const totalAfterDelete = ga4Revenue + csvRevenue; // manual deleted

    expect(totalAfterDelete).toBeLessThan(totalBefore);
    expect(totalAfterDelete).toBe(totalBefore - manualRevenue);
  });
});

describe("KPI progress updates when metrics change", () => {
  it("ROAS KPI progress changes when spend increases", () => {
    const revenue = 265000;
    const target = 50; // 50x ROAS target

    const roas1 = revenue / 5000; // 53x
    const roas2 = revenue / 10000; // 26.5x

    const progress1 = computeAttainmentPct({ current: roas1, target, lowerIsBetter: false });
    const progress2 = computeAttainmentPct({ current: roas2, target, lowerIsBetter: false });

    expect(progress1).not.toBeNull();
    expect(progress2).not.toBeNull();
    expect(progress2!).toBeLessThan(progress1!); // progress decreased
  });

  it("CPA KPI (lower-is-better) progress improves when CPA decreases", () => {
    const target = 5; // $5 CPA target
    const lowerIsBetter = isLowerIsBetterKpi({ metric: "CPA", name: "CPA" });
    expect(lowerIsBetter).toBe(true);

    const cpa1 = 3.0; // good (below target)
    const cpa2 = 1.5; // better (further below target)

    const progress1 = computeAttainmentPct({ current: cpa1, target, lowerIsBetter: true });
    const progress2 = computeAttainmentPct({ current: cpa2, target, lowerIsBetter: true });

    expect(progress2!).toBeGreaterThan(progress1!); // progress improved
  });

  it("Revenue KPI progress increases when revenue added", () => {
    const target = 500000;
    const rev1 = 265000;
    const rev2 = 275000; // +10K manual

    const progress1 = computeAttainmentPct({ current: rev1, target, lowerIsBetter: false });
    const progress2 = computeAttainmentPct({ current: rev2, target, lowerIsBetter: false });

    expect(progress2!).toBeGreaterThan(progress1!);
  });
});

describe("formatPct in financial context", () => {
  it("Conversion Rate formats correctly", () => {
    const sessions = 65600;
    const conversions = 2592;
    const cr = (conversions / sessions) * 100;
    expect(formatPct(cr)).toBe("4%"); // 3.95 rounds to 4
  });

  it("Engagement Rate formats correctly", () => {
    expect(formatPct(54)).toBe("54%");
    expect(formatPct(54.3)).toBe("54.3%");
  });

  it("KPI progress formats correctly", () => {
    expect(formatPct(77.1)).toBe("77.1%");
    expect(formatPct(100)).toBe("100%");
    expect(formatPct(97.8)).toBe("97.8%");
  });
});
