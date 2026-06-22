import { describe, expect, it } from "vitest";
import {
  computeBenchmarkThresholdResult,
  resolveBenchmarkThresholdPolicy,
} from "../shared/kpi-math";

describe("benchmark threshold math (shared)", () => {
  it("preserves generic 90% / 70% compatibility when explicitly requested", () => {
    expect(computeBenchmarkThresholdResult({
      metric: "Generic Benchmark",
      current: 90,
      benchmarkValue: 100,
      legacyRatioPolicy: true,
    }).status).toBe("on_track");
    expect(computeBenchmarkThresholdResult({
      metric: "Generic Benchmark",
      current: 80,
      benchmarkValue: 100,
      legacyRatioPolicy: true,
    }).status).toBe("needs_attention");
    expect(computeBenchmarkThresholdResult({
      metric: "Generic Benchmark",
      current: 60,
      benchmarkValue: 100,
      legacyRatioPolicy: true,
    }).status).toBe("behind");
  });

  it("allows a one-count miss on normal count benchmarks", () => {
    const result = computeBenchmarkThresholdResult({
      metric: "Conversions",
      unit: "count",
      current: 9,
      benchmarkValue: 10,
    });

    expect(result.policy).toMatchObject({ kind: "count", onTrackTolerancePct: 10, absoluteTolerance: 1 });
    expect(result.status).toBe("on_track");
    expect(result.pct).toBe(90);
  });

  it("does not mark zero performance as on track for tiny count benchmarks", () => {
    const result = computeBenchmarkThresholdResult({
      metric: "Conversions",
      unit: "count",
      current: 0,
      benchmarkValue: 1,
    });

    expect(result.policy).toMatchObject({ kind: "count", onTrackTolerancePct: 5, absoluteTolerance: 0 });
    expect(result.status).toBe("behind");
  });

  it("uses absolute percentage-point tolerance for rate benchmarks", () => {
    const result = computeBenchmarkThresholdResult({
      metric: "Conversion Rate",
      unit: "%",
      current: 4.8,
      benchmarkValue: 5,
    });

    expect(result.policy).toMatchObject({ kind: "rate", onTrackTolerancePct: 5, absoluteTolerance: 0.25 });
    expect(result.status).toBe("on_track");
  });

  it("uses default relative tolerance for revenue benchmarks", () => {
    const result = computeBenchmarkThresholdResult({
      metric: "Revenue",
      unit: "currency",
      current: 95000,
      benchmarkValue: 100000,
    });

    expect(result.policy).toMatchObject({ kind: "revenue", onTrackTolerancePct: 5, absoluteTolerance: 0 });
    expect(result.status).toBe("on_track");
  });

  it("keeps ROAS near misses on track as ratio benchmarks", () => {
    const result = computeBenchmarkThresholdResult({
      metric: "ROAS",
      unit: "ratio",
      current: 1.9,
      benchmarkValue: 2,
    });

    expect(result.policy).toMatchObject({ kind: "ratio", onTrackTolerancePct: 5 });
    expect(result.status).toBe("on_track");
  });

  it("classifies material ROI misses as behind", () => {
    const result = computeBenchmarkThresholdResult({
      metric: "ROI",
      unit: "%",
      current: 60,
      benchmarkValue: 100,
    });

    expect(result.policy.kind).toBe("ratio");
    expect(result.status).toBe("behind");
  });

  it("uses lower-is-better direction for CPA near misses", () => {
    const policy = resolveBenchmarkThresholdPolicy({
      metric: "CPA",
      unit: "currency",
      currentValue: 105,
      benchmarkValue: 100,
    });
    const result = computeBenchmarkThresholdResult({
      metric: "CPA",
      unit: "currency",
      current: 105,
      benchmarkValue: 100,
    });

    expect(policy).toMatchObject({ kind: "cost", direction: "lower_is_better", onTrackTolerancePct: 5 });
    expect(result.status).toBe("on_track");
  });

  it("classifies material CPA misses as behind", () => {
    const result = computeBenchmarkThresholdResult({
      metric: "CPA",
      unit: "currency",
      current: 150,
      benchmarkValue: 100,
    });

    expect(result.lowerIsBetter).toBe(true);
    expect(result.status).toBe("behind");
  });
});
