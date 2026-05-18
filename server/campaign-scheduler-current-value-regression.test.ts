import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("campaign scheduler current-value regression guard", () => {
  it("reconciles campaign KPI and Benchmark current values from the GA4 scheduler recompute path", () => {
    const ga4Jobs = readFileSync(join(process.cwd(), "server", "ga4-kpi-benchmark-jobs.ts"), "utf-8");

    expect(ga4Jobs).toContain('import { refreshCampaignCurrentValuesForCampaign } from "./utils/campaign-current-values";');
    expect(ga4Jobs).toContain("await refreshCampaignCurrentValuesForCampaign(campaignId);");
  });

  it("updates campaign-level KPI and Benchmark rows from connected-platform calculation configs", () => {
    const resolver = readFileSync(join(process.cwd(), "server", "utils", "campaign-current-values.ts"), "utf-8");

    expect(resolver).toContain("export async function refreshCampaignCurrentValuesForCampaign");
    expect(resolver).toContain("storage.getCampaignKPIs(id)");
    expect(resolver).toContain("storage.getCampaignBenchmarks(id)");
    expect(resolver).toContain("computeCampaignCurrentValueFromConfig((kpi as any).calculationConfig, totals)");
    expect(resolver).toContain("await storage.updateKPI(String((kpi as any).id), { currentValue: String(round2(currentValue)) } as any);");
    expect(resolver).toContain("computeCampaignCurrentValueFromConfig((benchmark as any).calculationConfig, totals)");
    expect(resolver).toContain("await storage.updateBenchmark(String((benchmark as any).id), { currentValue: String(round2(currentValue)) } as any);");
  });

  it("keeps revenue and spend source-refresh jobs on the shared scheduler recompute hook", () => {
    const autoRefresh = readFileSync(join(process.cwd(), "server", "auto-refresh-scheduler.ts"), "utf-8");
    const dailyScheduler = readFileSync(join(process.cwd(), "server", "ga4-daily-scheduler.ts"), "utf-8");

    expect(autoRefresh).toContain("await runGA4DailyKPIAndBenchmarkJobs({ campaignId }).catch");
    expect(dailyScheduler).toContain("await runGA4DailyKPIAndBenchmarkJobs();");
  });
});
