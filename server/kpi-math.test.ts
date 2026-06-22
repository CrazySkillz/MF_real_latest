import { describe, it, expect } from "vitest";
import {
  classifyKpiBand,
  classifyKpiBandWithPolicy,
  computeAttainmentFillPct,
  computeAttainmentPct,
  computeDeltaPct,
  computeEffectiveDeltaPct,
  resolveKpiThresholdPolicy,
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

  it("preserves generic +/-5% policy behavior", () => {
    const policy = resolveKpiThresholdPolicy({ metric: "generic score", target: 100, current: 95 });

    expect(policy).toMatchObject({ kind: "generic", nearTargetBandPct: 5, absoluteTolerance: 0 });
    expect(classifyKpiBandWithPolicy({ current: 95, target: 100, lowerIsBetter: false, policy })).toBe("near");
    expect(classifyKpiBandWithPolicy({ current: 94, target: 100, lowerIsBetter: false, policy })).toBe("below");
    expect(classifyKpiBandWithPolicy({ current: 106, target: 100, lowerIsBetter: false, policy })).toBe("above");
  });

  it("allows one-count misses for normal count targets", () => {
    const policy = resolveKpiThresholdPolicy({ metric: "Conversions", unit: "count", target: 10, current: 9 });

    expect(policy).toMatchObject({ kind: "count", nearTargetBandPct: 10, absoluteTolerance: 1 });
    expect(classifyKpiBandWithPolicy({ current: 9, target: 10, lowerIsBetter: false, policy })).toBe("near");
  });

  it("requires exact performance for tiny count targets", () => {
    const policy = resolveKpiThresholdPolicy({ metric: "Conversions", unit: "count", target: 1, current: 0 });

    expect(policy).toMatchObject({ kind: "count", nearTargetBandPct: 5, absoluteTolerance: 0 });
    expect(classifyKpiBandWithPolicy({ current: 0, target: 1, lowerIsBetter: false, policy })).toBe("below");
  });

  it("uses rate tolerance for normal percentage targets", () => {
    const policy = resolveKpiThresholdPolicy({ metric: "Conversion Rate", unit: "%", target: 5, current: 4.8 });

    expect(policy).toMatchObject({ kind: "rate", nearTargetBandPct: 5, absoluteTolerance: 0.25 });
    expect(classifyKpiBandWithPolicy({ current: 4.8, target: 5, lowerIsBetter: false, policy })).toBe("near");
  });

  it("keeps revenue KPIs on the default relative tolerance", () => {
    const policy = resolveKpiThresholdPolicy({ metric: "Revenue", unit: "currency", target: 100000, current: 95000 });

    expect(policy).toMatchObject({ kind: "revenue", nearTargetBandPct: 5, absoluteTolerance: 0 });
    expect(classifyKpiBandWithPolicy({ current: 95000, target: 100000, lowerIsBetter: false, policy })).toBe("near");
  });

  it("treats ROI as a relative efficiency KPI even when displayed as a percent", () => {
    const policy = resolveKpiThresholdPolicy({ metric: "ROI", unit: "%", target: 2, current: 1.76 });

    expect(policy).toMatchObject({ kind: "ratio", nearTargetBandPct: 5, absoluteTolerance: 0 });
    expect(classifyKpiBandWithPolicy({ current: 1.76, target: 2, lowerIsBetter: false, policy })).toBe("below");
  });

  it("recognizes custom ratio units", () => {
    const policy = resolveKpiThresholdPolicy({ metric: "Custom Efficiency", unit: "ratio", target: 2, current: 1.95 });

    expect(policy).toMatchObject({ kind: "ratio", nearTargetBandPct: 5, absoluteTolerance: 0 });
    expect(classifyKpiBandWithPolicy({ current: 1.95, target: 2, lowerIsBetter: false, policy })).toBe("near");
  });

  it("recognizes campaign currency codes for custom currency KPIs", () => {
    const policy = resolveKpiThresholdPolicy({ metric: "Custom Pipeline Value", unit: "CAD", target: 1000, current: 950 });

    expect(policy).toMatchObject({ kind: "revenue", nearTargetBandPct: 5, absoluteTolerance: 0 });
    expect(classifyKpiBandWithPolicy({ current: 950, target: 1000, lowerIsBetter: false, policy })).toBe("near");
  });

  it("uses lower-is-better direction for CPA policy bands", () => {
    const worsePolicy = resolveKpiThresholdPolicy({ metric: "CPA", unit: "currency", target: 100, current: 105, lowerIsBetter: true });
    const betterPolicy = resolveKpiThresholdPolicy({ metric: "CPA", unit: "currency", target: 100, current: 95, lowerIsBetter: true });

    expect(worsePolicy).toMatchObject({ kind: "cost", nearTargetBandPct: 5, absoluteTolerance: 0 });
    expect(classifyKpiBandWithPolicy({ current: 105, target: 100, lowerIsBetter: true, policy: worsePolicy })).toBe("near");
    expect(classifyKpiBandWithPolicy({ current: 95, target: 100, lowerIsBetter: true, policy: betterPolicy })).toBe("near");
  });
});


