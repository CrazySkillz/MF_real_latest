import { describe, it, expect } from "vitest";
import {
  classifyKpiBand,
  computeAttainmentFillPct,
  computeAttainmentPct,
  computeDeltaPct,
  computeEffectiveDeltaPct,
} from "../shared/kpi-math";

describe("kpi math (shared)", () => {
  it("computes deltaPct correctly (higher-is-better example)", () => {
    expect(computeDeltaPct(110, 100)).toBeCloseTo(10, 6);
    expect(computeDeltaPct(90, 100)).toBeCloseTo(-10, 6);
    expect(computeDeltaPct(100, 100)).toBeCloseTo(0, 6);
  });

  it("returns null deltaPct when target is missing/invalid", () => {
    expect(computeDeltaPct(110, 0)).toBeNull();
    expect(computeDeltaPct(110, -5)).toBeNull();
  });

  it("computes attainment % (uncapped label) and fill % (capped) for higher-is-better", () => {
    const pct = computeAttainmentPct({ current: 110, target: 100, lowerIsBetter: false });
    expect(pct).toBeCloseTo(110, 6);
    expect(computeAttainmentFillPct(pct!)).toBe(100);
  });

  it("computes attainment % for lower-is-better KPIs (cost metrics)", () => {
    // Example: CPL current £0.96, target £1.00 => 1 / 0.96 => 104.166...%
    const pct = computeAttainmentPct({ current: 0.96, target: 1.0, lowerIsBetter: true });
    expect(pct).toBeCloseTo(104.1666667, 5);
    expect(computeAttainmentFillPct(pct!)).toBe(100);
  });

  it("classifies summary bands using effective delta (mutually exclusive, +/-10% near band)", () => {
    const nearBand = 5;

    if (process.env.PRINT_TEST_VECTORS === "1") {
      const vectors = [
        { label: "higher-better +6%", current: 106, target: 100, lowerIsBetter: false },
        { label: "higher-better +5% (boundary)", current: 105, target: 100, lowerIsBetter: false },
        { label: "lower-better worse (+20% raw)", current: 120, target: 100, lowerIsBetter: true },
        { label: "lower-better better (-4% raw)", current: 0.96, target: 1.0, lowerIsBetter: true },
      ].map((v) => {
        const eff = computeEffectiveDeltaPct({ current: v.current, target: v.target, lowerIsBetter: v.lowerIsBetter });
        const attainment = computeAttainmentPct({ current: v.current, target: v.target, lowerIsBetter: v.lowerIsBetter });
        return {
          case: v.label,
          current: v.current,
          target: v.target,
          lowerIsBetter: v.lowerIsBetter,
          rawDeltaPct: computeDeltaPct(v.current, v.target),
          effectiveDeltaPct: eff,
          band: eff === null ? null : classifyKpiBand({ effectiveDeltaPct: eff, nearTargetBandPct: nearBand }),
          progressPct: attainment,
          progressFillPct: attainment === null ? null : computeAttainmentFillPct(attainment),
        };
      });
      // eslint-disable-next-line no-console
      console.table(vectors);
    }

    // higher-is-better: +11% => above
    const eff1 = computeEffectiveDeltaPct({ current: 106, target: 100, lowerIsBetter: false })!;
    expect(classifyKpiBand({ effectiveDeltaPct: eff1, nearTargetBandPct: nearBand })).toBe("above");

    // higher-is-better: +5% => near (boundary inclusive)
    const eff2 = computeEffectiveDeltaPct({ current: 105, target: 100, lowerIsBetter: false })!;
    expect(classifyKpiBand({ effectiveDeltaPct: eff2, nearTargetBandPct: nearBand })).toBe("near");

    // lower-is-better: current 120, target 100 => raw +20% (worse) => effective -20% => below
    const eff3 = computeEffectiveDeltaPct({ current: 120, target: 100, lowerIsBetter: true })!;
    expect(classifyKpiBand({ effectiveDeltaPct: eff3, nearTargetBandPct: nearBand })).toBe("below");
  });
});


