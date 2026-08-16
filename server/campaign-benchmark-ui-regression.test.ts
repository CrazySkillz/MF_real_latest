import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("campaign Benchmark UI regression guard", () => {
  it("keeps available GA4 campaign-lifetime totals authoritative, including zero", () => {
    const campaignDetail = readFileSync(
      join(process.cwd(), "client", "src", "pages", "campaign-detail.tsx"),
      "utf-8"
    );
    const campaignBenchmarkSection = campaignDetail.slice(campaignDetail.indexOf("function CampaignBenchmarks"));

    expect(campaignBenchmarkSection).toContain("const hasBenchGA4ToDateTotals = Boolean(benchGA4ToDate?.totals");
    expect(campaignBenchmarkSection).toContain("sessions: hasBenchGA4ToDateTotals ? Number(totals?.sessions || 0) : daily.sessions");
    expect(campaignBenchmarkSection).toContain("return hasBenchGA4ToDateTotals ? ga4Revenue : ga4Revenue || parseNumSafe(ot?.ga4?.revenue);");
    expect(campaignBenchmarkSection).not.toContain("sessions: Math.max(Number(totals?.sessions || 0), daily.sessions)");
  });

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

  it("renders campaign benchmark current values from connected-platform calculations", () => {
    const campaignDetail = readFileSync(
      join(process.cwd(), "client", "src", "pages", "campaign-detail.tsx"),
      "utf-8"
    );

    expect(campaignDetail).toContain("const getBenchmarkCurrent = (benchmark: any): { value: number; unit: string } => {");
    expect(campaignDetail).toContain("const computed = computeCurrentFromBenchConfig(cfg);");
    expect(campaignDetail).toContain("const current = getBenchmarkCurrent(benchmark);");
    expect(campaignDetail).toContain("const current = getBenchmarkCurrent(b).value;");
  });

  it("uses ratio as the campaign Benchmark ROAS unit to match platform Benchmarks", () => {
    const campaignDetail = readFileSync(
      join(process.cwd(), "client", "src", "pages", "campaign-detail.tsx"),
      "utf-8"
    );

    expect(campaignDetail).toContain("{ name: 'ROAS', metric: 'roas', unit: 'ratio'");
    expect(campaignDetail).toContain("return { value: roas, unit: 'ratio' };");
  });
});
