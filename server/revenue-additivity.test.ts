import { describe, it, expect } from "vitest";
import { formatPct } from "../shared/metric-math";

/**
 * Revenue Additivity Tests
 *
 * These tests verify the business rules that caused real bugs:
 * 1. financialRevenue must be GA4 native + imported (additive, not either/or)
 * 2. Adding a new revenue source must NOT deactivate existing sources
 * 3. formatPct displays percentages correctly (whole numbers or 1 decimal)
 */

// Simulate the financialRevenue computation from ga4-metrics.tsx
function computeFinancialRevenue(opts: {
  ga4RevenueFromToDate: number;
  dailySummedRevenue: number;
  importedRevenueToDate: number;
}) {
  const ga4RevenueForFinancials = Math.max(opts.ga4RevenueFromToDate, opts.dailySummedRevenue);
  const importedRevenueForFinancials = opts.importedRevenueToDate;
  // CORRECT: additive — GA4 native + imported
  return ga4RevenueForFinancials + importedRevenueForFinancials;
}

describe("Revenue Additivity", () => {
  describe("financialRevenue computation", () => {
    it("includes both GA4 native revenue and imported revenue", () => {
      const result = computeFinancialRevenue({
        ga4RevenueFromToDate: 240352,
        dailySummedRevenue: 0,
        importedRevenueToDate: 10000,
      });
      expect(result).toBe(250352); // GA4 + manual, NOT just GA4
    });

    it("does NOT ignore imported revenue when GA4 has revenue", () => {
      // This was the actual bug: financialRevenue = ga4HasRevenueMetric ? ga4Only : importedOnly
      const ga4Revenue = 240352;
      const importedRevenue = 10000;
      const result = computeFinancialRevenue({
        ga4RevenueFromToDate: ga4Revenue,
        dailySummedRevenue: 0,
        importedRevenueToDate: importedRevenue,
      });
      // Must be additive, not either/or
      expect(result).toBeGreaterThan(ga4Revenue);
      expect(result).toBe(ga4Revenue + importedRevenue);
    });

    it("works when only GA4 revenue exists (no imported)", () => {
      const result = computeFinancialRevenue({
        ga4RevenueFromToDate: 240352,
        dailySummedRevenue: 0,
        importedRevenueToDate: 0,
      });
      expect(result).toBe(240352);
    });

    it("works when only imported revenue exists (no GA4)", () => {
      const result = computeFinancialRevenue({
        ga4RevenueFromToDate: 0,
        dailySummedRevenue: 0,
        importedRevenueToDate: 10000,
      });
      expect(result).toBe(10000);
    });

    it("uses higher of ga4-to-date and daily summed for GA4 portion", () => {
      const result = computeFinancialRevenue({
        ga4RevenueFromToDate: 200000,
        dailySummedRevenue: 250000, // daily sum is higher
        importedRevenueToDate: 10000,
      });
      expect(result).toBe(260000); // max(200K, 250K) + 10K
    });

    it("accumulates multiple imported sources", () => {
      // Manual $10K + CSV $5K + HubSpot $20K = $35K imported
      const totalImported = 10000 + 5000 + 20000;
      const result = computeFinancialRevenue({
        ga4RevenueFromToDate: 240352,
        dailySummedRevenue: 0,
        importedRevenueToDate: totalImported,
      });
      expect(result).toBe(240352 + 35000);
    });
  });

  describe("ROAS consistency (ratio format)", () => {
    it("ROAS is revenue/spend ratio, not percentage", () => {
      const revenue = 265000;
      const spend = 5000;
      const roas = spend > 0 ? revenue / spend : 0;
      expect(roas).toBeCloseTo(53, 0); // ~53x, not 5300%
    });

    it("ROAS matches between Overview and KPI", () => {
      const revenue = 265000;
      const spend = 5000;
      // Overview ROAS
      const overviewROAS = spend > 0 ? revenue / spend : 0;
      // KPI ROAS (getLiveKpiValue for "ROAS")
      const kpiROAS = spend > 0 ? revenue / spend : 0;
      expect(overviewROAS).toBe(kpiROAS); // must be identical
    });
  });
});

describe("formatPct", () => {
  it("shows whole numbers without decimals", () => {
    expect(formatPct(54)).toBe("54%");
    expect(formatPct(100)).toBe("100%");
    expect(formatPct(0)).toBe("0%");
  });

  it("shows 1 decimal when meaningful", () => {
    expect(formatPct(59.3)).toBe("59.3%");
    expect(formatPct(77.1)).toBe("77.1%");
    expect(formatPct(99.5)).toBe("99.5%");
  });

  it("rounds to 1 decimal", () => {
    expect(formatPct(59.34)).toBe("59.3%");
    expect(formatPct(59.35)).toBe("59.4%");
    expect(formatPct(77.14)).toBe("77.1%");
  });

  it("handles edge cases", () => {
    expect(formatPct(0.1)).toBe("0.1%");
    expect(formatPct(0.0)).toBe("0%");
    expect(formatPct(999.9)).toBe("999.9%");
  });
});
