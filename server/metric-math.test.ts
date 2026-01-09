import { describe, it, expect } from "vitest";
import {
  computeCpa,
  computeConversionRatePercent,
  computeProgress,
  computeRoiPercent,
  computeRoasPercent,
} from "../shared/metric-math";

describe("metric math (shared)", () => {
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


