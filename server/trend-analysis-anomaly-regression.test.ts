import { describe, expect, it } from "vitest";
import { detectTrendAnomalies } from "../client/src/lib/trend-analysis-cumulative";

const conversionSeries = (values: Array<number | null>) => values.map((value, index) => ({
  date: `2026-09-${String(index + 1).padStart(2, "0")}`,
  label: `Sep ${index + 1}`,
  conversions: value,
}));

describe("Trend Analysis anomaly detection", () => {
  it("classifies warning and critical changes against the previous seven comparable values", () => {
    const baseline = [4, 5, 6, 5, 4, 6, 5];
    expect(detectTrendAnomalies(conversionSeries([...baseline, 7]), ["conversions"]))
      .toMatchObject([{ value: 7, expected: 5, severity: "warning" }]);
    expect(detectTrendAnomalies(conversionSeries([...baseline, 8]), ["conversions"]))
      .toMatchObject([{ value: 8, expected: 5, severity: "critical" }]);
  });

  it("treats a verified zero after activity as a drop without flagging pre-activity zeros", () => {
    const values = [0, 0, 5, 4, 6, 5, 4, 5, 5, 0];
    const anomalies = detectTrendAnomalies(conversionSeries(values), ["conversions"]);
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0]).toMatchObject({ date: "2026-09-10", value: 0, severity: "critical" });
    expect(anomalies[0].expected).toBeCloseTo(34 / 7, 8);
  });

  it("fails closed for missing baselines, short history, and zero-variance history", () => {
    expect(detectTrendAnomalies(conversionSeries([4, 5, 6, 5, 4, 6, 9]), ["conversions"])).toEqual([]);
    expect(detectTrendAnomalies(conversionSeries([4, 5, null, 5, 4, 6, 5, 20]), ["conversions"])).toEqual([]);
    expect(detectTrendAnomalies(conversionSeries([5, 5, 5, 5, 5, 5, 5, 20]), ["conversions"])).toEqual([]);
  });
});
