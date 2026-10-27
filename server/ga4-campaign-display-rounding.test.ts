import { describe, expect, it } from "vitest";
import { roundGA4CampaignRevenueForDisplay } from "../shared/ga4-campaign-breakdown";

describe("GA4 campaign revenue display rounding", () => {
  it.each([1, -1])("reconciles Promo's exact amounts, including refunds (sign %s)", sign => {
    const rows = [
      { name: "yesop_brand_search", revenue: 66625.346347 * sign, sessions: 2394, conversions: 250 },
      { name: "yesop_retargeting", revenue: 13808.508329999999 * sign, sessions: 1039, conversions: 66 },
    ];
    const original = structuredClone(rows);
    const displayed = roundGA4CampaignRevenueForDisplay(rows);
    expect(displayed.map(row => row.revenue)).toEqual([66625.34 * sign, 13808.51 * sign]);
    expect(Number(displayed.reduce((sum, row) => sum + row.revenue, 0).toFixed(2))).toBe(80433.85 * sign);
    expect(displayed.map(({ revenue, ...row }) => row)).toEqual(rows.map(({ revenue, ...row }) => row));
    expect(rows).toEqual(original);
  });
  it.each([1, -1])("reconciles a missing cent without changing source amounts (sign %s)", sign => {
    expect(roundGA4CampaignRevenueForDisplay([
      { name: "a", revenue: 3400.434193 * sign }, { name: "b", revenue: 4253.52214 * sign },
    ]).map(row => row.revenue)).toEqual([3400.44 * sign, 4253.52 * sign]);
  });
  it("uses stable campaign names to resolve equal fractional remainders", () => {
    const rows = [{ name: "b", revenue: 0.005 }, { name: "a", revenue: 0.005 }];
    const displayed = roundGA4CampaignRevenueForDisplay(rows);
    expect(displayed).toEqual([{ name: "b", revenue: 0.01 }, { name: "a", revenue: 0 }]);
    expect(roundGA4CampaignRevenueForDisplay([...rows].reverse()).reverse()).toEqual(displayed);
  });
  it("handles multiple cents while preserving row order and exact cent/zero rows", () => {
    const rows = [{ name: "d", revenue: 1.004 }, { name: "b", revenue: 1.004 },
      { name: "c", revenue: 1.004 }, { name: "a", revenue: 1.004 },
      { name: "zero", revenue: 0 }, { name: "exact", revenue: 12.25 }];
    expect(roundGA4CampaignRevenueForDisplay(rows).map(row => row.revenue)).toEqual([1, 1.01, 1, 1.01, 0, 12.25]);
  });
  it("handles positive and negative fractions in the same selection", () => {
    expect(roundGA4CampaignRevenueForDisplay([
      { name: "a", revenue: 0.006 }, { name: "b", revenue: 0.006 }, { name: "refund", revenue: -0.002 },
    ])).toEqual([{ name: "a", revenue: 0 }, { name: "b", revenue: 0.01 }, { name: "refund", revenue: 0 }]);
  });
  it("leaves already reconciled, empty and one-row selections alone", () => {
    const rows = [{ name: "a", revenue: 1.15 }, { name: "b", revenue: -1.14 }, { name: "zero", revenue: 0 }];
    expect(roundGA4CampaignRevenueForDisplay(rows)).toEqual(rows);
    expect(roundGA4CampaignRevenueForDisplay([])).toEqual([]);
    expect(roundGA4CampaignRevenueForDisplay([{ name: "a", revenue: 66625.346347 }])).toEqual([{ name: "a", revenue: 66625.35 }]);
  });
  it("does not turn invalid amounts into a valid total or add an exception to report generation", () => {
    const displayed = roundGA4CampaignRevenueForDisplay([{ name: "invalid", revenue: NaN }, { name: "valid", revenue: 1.006 }]);
    expect(displayed[0].revenue).toBeNaN();
    expect(displayed[1].revenue).toBe(1.01);
    expect(roundGA4CampaignRevenueForDisplay([{ name: "large", revenue: 1e16 }])[0].revenue).toBe(1e16);
  });
});
