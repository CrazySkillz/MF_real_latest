import { describe, it, expect } from "vitest";
import {
  computeCpa,
  computeConversionRatePercent,
  computeProgress,
  computeRoiPercent,
  computeRoasPercent,
  conversionCreditsMatch,
  formatConversionCredit,
} from "../shared/metric-math";

describe("metric math (shared)", () => {
  it("preserves fractional conversion display and accepts only numeric summation error", () => {
    expect(formatConversionCredit(0.75)).toBe("0.75");
    expect(formatConversionCredit(0.000075)).toBe("0.000075");
    expect(formatConversionCredit(1e-21)).not.toBe("0");
    expect(formatConversionCredit(2977)).toBe("2,977");
    expect(formatConversionCredit(NaN)).toBe("Unavailable");
    expect(conversionCreditsMatch(0.1 + 0.2, 0.3, 2)).toBe(true);
    for (const [a, b] of [[0, 0.000075], [0.3, 0.300000001], [1, 2], [NaN, NaN], [Infinity, Infinity], [-1, -1]]) {
      expect(conversionCreditsMatch(a, b, 1000)).toBe(false);
    }
    expect(conversionCreditsMatch(0, 0)).toBe(true);
  });
  it("computes conversion rate (%) safely", () => {
    expect(computeConversionRatePercent(10, 100)).toBeCloseTo(10, 6);
    expect(computeConversionRatePercent(0, 100)).toBeCloseTo(0, 6);
    expect(computeConversionRatePercent(10, 0)).toBeCloseTo(0, 6);
  });

  it("computes ROAS (%) and ROI (%) safely", () => {
    expect(computeRoasPercent(200, 100)).toBeCloseTo(200, 6); // 2x => 200%
    expect(computeRoiPercent(200, 100)).toBeCloseTo(100, 6); // (200-100)/100 => 100%
    expect(computeRoasPercent(200, 0)).toBeCloseTo(0, 6);
    expect(computeRoiPercent(200, 0)).toBeCloseTo(0, 6);
  });

  it("computes CPA safely", () => {
    expect(computeCpa(100, 10)).toBeCloseTo(10, 6);
    expect(computeCpa(100, 0)).toBeCloseTo(0, 6);
  });

  it("computes progress for higher-is-better", () => {
    const p1 = computeProgress({ current: 50, target: 100, lowerIsBetter: false });
    expect(p1.ratio).toBeCloseTo(0.5, 6);
    expect(p1.pct).toBeCloseTo(50, 6);
    expect(p1.status).toBe("behind");

    const p2 = computeProgress({ current: 90, target: 100, lowerIsBetter: false });
    expect(p2.status).toBe("on_track");
  });

  it("computes progress for lower-is-better (e.g., CPA)", () => {
    // target=100, current=120 => 100/120=0.833 => needs_attention
    const p = computeProgress({ current: 120, target: 100, lowerIsBetter: true });
    expect(p.ratio).toBeCloseTo(0.8333333, 5);
    expect(p.status).toBe("needs_attention");
  });

  it("clamps progress pct to 0..100 to avoid misleading >100% labels", () => {
    const p = computeProgress({ current: 1000, target: 100, lowerIsBetter: false });
    expect(p.pct).toBe(100);
  });
});


