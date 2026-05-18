import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("campaign alert current-value regression guard", () => {
  it("resolves campaign KPI alerts from connected-platform totals before threshold checks", () => {
    const scheduler = readFileSync(join(process.cwd(), "server", "kpi-scheduler.ts"), "utf-8");

    expect(scheduler).toContain('import { resolveCampaignCurrentValueForAlert } from "./utils/campaign-current-values";');
    expect(scheduler).toContain("const campaignMetricCache = new Map");
    expect(scheduler).toContain("const kpi = await resolveCampaignCurrentValueForAlert(rawKpi, campaignMetricCache);");
    expect(scheduler).toContain("shouldTriggerAlert(kpi)");
    expect(scheduler).toContain("await createKPIAlert(kpi)");
  });

  it("resolves campaign Benchmark alerts from connected-platform totals before threshold checks", () => {
    const notifications = readFileSync(join(process.cwd(), "server", "benchmark-notifications.ts"), "utf-8");

    expect(notifications).toContain('import { resolveCampaignCurrentValueForAlert } from "./utils/campaign-current-values";');
    expect(notifications).toContain("const campaignMetricCache = new Map");
    expect(notifications).toContain("const b = await resolveCampaignCurrentValueForAlert(rawBenchmark, campaignMetricCache);");
    expect(notifications).toContain("const currentRaw = b.currentValue;");
  });

  it("keeps the campaign alert resolver scoped to campaign-level calculation configs", () => {
    const resolver = readFileSync(join(process.cwd(), "server", "utils", "campaign-current-values.ts"), "utf-8");

    expect(resolver).toContain("const isCampaignLevel = (row: any)");
    expect(resolver).toContain('platformType === "campaign"');
    expect(resolver).toContain("!row?.calculationConfig");
    expect(resolver).toContain("computeCampaignCurrentValueFromConfig(row.calculationConfig, totals)");
    expect(resolver).toContain('if (metric === "roas")');
    expect(resolver).toContain('if (metric === "roi")');
    expect(resolver).toContain('if (metric === "conversion-rate-website")');
  });
});
