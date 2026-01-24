import { describe, it, expect } from "vitest";
import {
  computeCpaRounded,
  computeCpc,
  computeCpl,
  computeCpm,
  computeCtrPercent,
  computeCvrPercent,
  computeErPercent,
} from "../shared/linkedin-metrics-math";

describe("linkedin derived metrics math (shared)", () => {
  it("matches the golden fixture (2dp) for the provided LinkedIn test-mode campaign", () => {
    const impressions = 12901;
    const clicks = 6623;
    const engagements = 11646;
    const spend = 17900.15;
    const conversions = 5563;
    const leads = 18575;

    expect(computeCtrPercent(clicks, impressions)).toBeCloseTo(51.34, 2);
    expect(computeCpc(spend, clicks)).toBeCloseTo(2.70, 2);
    expect(computeCpm(spend, impressions)).toBeCloseTo(1387.50, 2);
    // conversions/clicks*100 = 83.995168... which rounds to 84.00 (2dp)
    expect(computeCvrPercent(conversions, clicks)).toBeCloseTo(84.00, 2);
    expect(computeCpaRounded(spend, conversions)).toBeCloseTo(3.22, 2);
    expect(computeCpl(spend, leads)).toBeCloseTo(0.96, 2);
    expect(computeErPercent(engagements, impressions)).toBeCloseTo(90.27, 2);
  });

  it("handles divide-by-zero safely", () => {
    expect(computeCtrPercent(10, 0)).toBe(0);
    expect(computeCpc(10, 0)).toBe(0);
    expect(computeCpm(10, 0)).toBe(0);
    expect(computeCvrPercent(10, 0)).toBe(0);
    expect(computeCpaRounded(10, 0)).toBe(0);
    expect(computeCpl(10, 0)).toBe(0);
    expect(computeErPercent(10, 0)).toBe(0);
  });
});


