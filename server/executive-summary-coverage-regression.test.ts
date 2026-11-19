import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { parseExecutiveSummaryStoredMetricValue } from "./utils/executive-summary-target-eligibility";

const routes = readFileSync("server/routes-oauth.ts", "utf8");
const start = routes.indexOf("// Fetch KPI progress", routes.indexOf('app.get("/api/campaigns/:id/executive-summary"'));
const block = routes.slice(start, routes.indexOf("// Fetch comparison data for trend analysis", start));
const evaluate = new Function("deps", ts.transpileModule(`
  const { storage, resolveAlertCurrentValueForDecision, parseExecutiveSummaryStoredMetricValue } = deps;
  const id = "scoped-campaign", hasGA4Connection = true;
  const resolveConnectedSourceMetric = (row: any) => row.metric;
  const parseNum = (value: any) => Number(value) || 0;
  const isLowerIsBetterKpi = () => false;
  const resolveKpiThresholdPolicy = () => ({});
  const classifyKpiBandWithPolicy = () => "above";
  const computeBenchmarkThresholdResult = () => ({ effectiveDeltaPct: -12, status: "needs_attention" });
  const console = { log() {} };
  return (async () => { ${block}; return { kpiProgress, benchmarkComparison, targetCoverage }; })();
`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText);

const target = { id: "target", name: "Sessions", metric: "sessions", platformType: "google_analytics", currentValue: 4472, targetValue: 4000, benchmarkValue: 500, __alertDecisionEligible: true };
async function run(kpis: any[] | Error, benchmarks: any[] | Error, resolverFails = false) {
  const calls: unknown[] = [];
  const read = (rows: any[] | Error) => async (platform: string, campaign: string) => {
    expect(platform).toBe("google_analytics"); expect(campaign).toBe("scoped-campaign");
    if (rows instanceof Error) throw rows;
    return rows;
  };
  const result = await evaluate({
    storage: { getPlatformKPIs: read(kpis), getPlatformBenchmarks: read(benchmarks) },
    parseExecutiveSummaryStoredMetricValue,
    resolveAlertCurrentValueForDecision: async (row: any, _cache: unknown, options: unknown) => {
      calls.push(options);
      if (resolverFails) throw new Error("saved source unavailable");
      return row;
    },
  });
  for (const options of calls) expect(options).toEqual({ useSavedOverview: true, allowCredentialRefresh: false, requireCurrentTrafficFreshness: true });
  return result;
}

describe("Executive Summary configured target coverage", () => {
  it("preserves evaluated values and reports complete coverage", async () => {
    const result = await run([target], [{ ...target, name: "Conversions", metric: "conversions", currentValue: 440 }]);
    expect(result.kpiProgress[0]).toMatchObject({ current: 4472, target: 4000, status: "above" });
    expect(result.benchmarkComparison[0]).toMatchObject({ yours: 440, benchmark: 500, status: "needs_attention" });
    for (const coverage of Object.values(result.targetCoverage)) expect(coverage).toEqual({ configured: 1, evaluated: 1, unavailable: 0, readFailed: false });
  });
  it("distinguishes a partial inventory from a completed clean assessment", async () => {
    const result = await run([target, { ...target, __alertDecisionEligible: false }], [{ ...target, currentValue: null }]);
    expect(result.targetCoverage.kpis).toEqual({ configured: 2, evaluated: 1, unavailable: 1, readFailed: false });
    expect(result.targetCoverage.benchmarks).toEqual({ configured: 1, evaluated: 0, unavailable: 1, readFailed: false });
  });
  it("does not confuse a failed target-list read with no configured targets", async () => {
    const result = await run(new Error("list unavailable"), []);
    expect(result.targetCoverage.kpis).toEqual({ configured: null, evaluated: 0, unavailable: null, readFailed: true });
    expect(result.targetCoverage.benchmarks).toEqual({ configured: 0, evaluated: 0, unavailable: 0, readFailed: false });
  });
  it("retains the configured inventory when resolving saved values fails", async () => {
    const result = await run([target], [target], true);
    for (const coverage of Object.values(result.targetCoverage)) expect(coverage).toEqual({ configured: 1, evaluated: 0, unavailable: 1, readFailed: true });
  });
  it("counts unsupported or invalid targets as unavailable but preserves measured zero", async () => {
    const result = await run([{ ...target, currentValue: 0 }, { ...target, metric: null }, { ...target, targetValue: 0 }], []);
    expect(result.kpiProgress[0].current).toBe(0);
    expect(result.targetCoverage.kpis).toEqual({ configured: 3, evaluated: 1, unavailable: 2, readFailed: false });
  });
});

describe("Executive Summary history and coverage presentation guards", () => {
  const page = readFileSync("client/src/pages/executive-summary.tsx", "utf8");
  it("sequences trajectory reads after same-day outcome reads and retains only same-scope placeholder data", () => {
    expect(page).toContain('"trajectory", executiveTrajectoryReportingDate, outcomeTotalsUpdatedAt]');
    expect(page).toContain('previousQuery?.queryKey[1] === campaignId');
    expect(page).toContain('previousQuery?.queryKey[4] === executiveTrajectoryReportingDate ? previousData : undefined');
  });
  it("keeps incomplete target coverage visible in the aggregate and individual risk rows", () => {
    expect(page).toContain('targetCoverageComplete ? "low" : "incomplete"');
    expect(page).toContain('!kpiCoverageComplete ? "Incomplete"');
    expect(page).toContain('!benchmarkCoverageComplete ? "Incomplete"');
  });
  it("selects the scoped GA4 history independently of Users or other metric capability", () => {
    const scope = page.slice(page.indexOf("const usesGA4ExecutiveHistory"), page.indexOf("const executiveWindowDescription"));
    expect(scope).not.toContain("includedMetrics");
    expect(page).toContain('const executiveTrajectory = usesGA4ExecutiveHistory');
    expect(page).toContain('hasAuthoritativeGA4Window && aggregateMetricAvailable("revenue")');
  });
});
