import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("campaign Benchmark UI regression guard", () => {
  it("formats count benchmark edit values without persisted decimal suffixes", () => {
    const campaignDetail = readFileSync(
      join(process.cwd(), "client", "src", "pages", "campaign-detail.tsx"),
      "utf-8"
    );

    expect(campaignDetail).toContain("const formatBenchmarkFormValue = (value: any, unit: any): string => {");
    expect(campaignDetail).toContain("if (normalizedUnit !== 'count') return raw;");
    expect(campaignDetail).toContain("benchmarkValue: formatBenchmarkFormValue(benchmark.benchmarkValue, unit),");
    expect(campaignDetail).toContain("currentValue: formatBenchmarkFormValue(benchmark.currentValue, unit),");
  });

  it("formats currency benchmark edit values with thousands separators", () => {
    const campaignDetail = readFileSync(
      join(process.cwd(), "client", "src", "pages", "campaign-detail.tsx"),
      "utf-8"
    );

    expect(campaignDetail).toContain("if (normalizedUnit === '$') return formatInputNumber(raw);");
  });
});
