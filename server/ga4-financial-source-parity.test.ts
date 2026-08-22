import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { selectGA4FinancialTotalsSource } from "../shared/ga4-financial-source";

const read = (path: string) => readFileSync(path, "utf8");

describe("GA4 downstream financial-source parity", () => {
  it("keeps campaign-to-date authoritative instead of selecting the greatest incompatible-window revenue", () => {
    const toDate = { revenue: 100, conversions: 4, source: "to-date" };
    const daily = { revenue: 250, conversions: 9, source: "daily" };
    const breakdown = { revenue: 175, conversions: 30, source: "breakdown" };
    expect(selectGA4FinancialTotalsSource([toDate, daily, breakdown], toDate)).toBe(toDate);
  });

  it("preserves valid zero and negative campaign-to-date adjustments", () => {
    const zero = { revenue: 0, conversions: 0, source: "zero-to-date" };
    const negative = { revenue: -25, conversions: 1, source: "negative-to-date" };
    const daily = { revenue: 250, conversions: 9, source: "daily" };
    expect(selectGA4FinancialTotalsSource([zero, daily], daily)).toBe(zero);
    expect(selectGA4FinancialTotalsSource([negative, daily], daily)).toBe(negative);
  });

  it("falls through provider-empty candidates in declared order", () => {
    const daily = { revenue: 0, conversions: 0, source: "daily" };
    const breakdown = { revenue: 175, conversions: 30, source: "breakdown" };
    expect(selectGA4FinancialTotalsSource([{}, { sessions: 20, users: 10 }, { revenue: "", conversions: "" }, { revenue: false, conversions: [] }, null, daily, breakdown], breakdown)).toBe(daily);
  });

  it("uses the shared ordered selector in Overview, outcome totals, campaign current values, and scheduled aggregates", () => {
    const overview = read("client/src/pages/ga4-metrics.tsx");
    const outcome = read("server/routes-oauth.ts");
    const campaign = read("server/utils/campaign-current-values.ts");
    const scheduler = read("server/scheduler.ts");
    expect(overview).toContain("selectGA4FinancialTotalsSource(ga4FinancialCandidates");
    for (const source of [outcome, campaign]) expect(source).toContain("selectGA4FinancialTotalsSource([");
    expect(scheduler).toContain("getCampaignMetricTotals(campaignId, true)");
    expect(overview.indexOf("(ga4ToDateResp as any)?.totals,")).toBeLessThan(overview.indexOf("ga4DailyRows.length > 0 ? dailySummedTotals : null"));
    expect(outcome.indexOf("toDateFinancialCandidate,")).toBeLessThan(outcome.indexOf("persistedFinancialCandidate,"));
    expect(campaign.indexOf("toDateCandidate,")).toBeLessThan(campaign.indexOf("financialRows?.length > 0 ? dailyCandidate : null"));
  });

  it("makes the browser runner preserve zero and negative first candidates and fall through incomplete ones", () => {
    const runner = read("client/public/ga4-overview-validation-runner.js");
    const selectorSource = runner.slice(
      runner.indexOf("function firstOverviewFinancialNumber("),
      runner.indexOf("function normalizeFinancialMetricKey("),
    );
    const select = new Function(
      "rowsOf",
      "firstNumber",
      "money",
      "sumRows",
      `${selectorSource}\nreturn overviewFinancialSourceTotals;`,
    )(
      (data: any) => Array.isArray(data) ? data : Array.isArray(data?.rows) ? data.rows : [],
      (data: any, keys: string[]) => {
        for (const key of keys) {
          const value = data?.[key];
          if (value !== null && value !== undefined && Number.isFinite(Number(value))) return Number(value);
        }
        return null;
      },
      (value: any) => Number.isFinite(Number(value)) ? Math.round(Number(value) * 100) / 100 : null,
      (rows: any[], keys: string[]) => rows.reduce((sum, row) => {
        const value = keys.map((key) => row?.[key]).find((item) => item !== null && item !== undefined && Number.isFinite(Number(item)));
        return sum + (value === undefined ? 0 : Number(value));
      }, 0),
    );

    expect(select({ totals: { revenue: 0, conversions: 0 } }, { totals: { revenue: 300, conversions: 8 } }, [{ revenue: 200, conversions: 4 }]).source).toBe("ga4-to-date");
    expect(select({ totals: { revenue: -25, conversions: 1 } }, { totals: { revenue: 300, conversions: 8 } }, [{ revenue: 200, conversions: 4 }]).source).toBe("ga4-to-date");
    expect(select({ totals: { revenue: 100 } }, { totals: { revenue: 300, conversions: 8 } }, [{ revenue: 200, conversions: 4 }]).source).toBe("ga4-daily");
    expect(select(null, { totals: { revenue: 300, conversions: 8 } }, []).source).toBe("ga4-breakdown");
  });

  it("parses spendToDate without converting a missing financial total to zero", () => {
    const runner = read("client/public/ga4-overview-validation-runner.js");
    const functionSource = (name: string, nextName: string) => runner.slice(
      runner.indexOf(`function ${name}(`),
      runner.indexOf(`function ${nextName}(`),
    );
    const buildTotals = new Function(
      "rowsOf",
      "sumRows",
      `${functionSource("numberOrNull", "formattedNumberOrNull")}
${functionSource("money", "closeMoney")}
${functionSource("firstNumber", "rowsOf")}
${runner.slice(runner.indexOf("function buildTotals("), runner.indexOf("async function snapshot("))}
return buildTotals;`,
    )(
      (data: any) => Array.isArray(data) ? data : Array.isArray(data?.rows) ? data.rows : [],
      (rows: any[], keys: string[]) => rows.reduce((sum, row) => {
        const value = keys.map((key) => row?.[key]).find((item) =>
          item !== null && item !== undefined && item !== "" && Number.isFinite(Number(item))
        );
        return sum + (value === undefined ? 0 : Number(value));
      }, 0),
    );

    const matching = buildTotals({
      revenueToDate: { data: { totalRevenue: 16700 } },
      revenueBreakdown: { data: { totalRevenue: 16700 } },
      spendToDate: { data: { spendToDate: 2698.75 } },
      spendBreakdown: { data: { totalSpend: 2698.75 } },
    });
    expect(matching).toEqual({
      revenueToDate: 16700,
      revenueBreakdownTotal: 16700,
      spendToDate: 2698.75,
      spendBreakdownTotal: 2698.75,
    });

    const missing = buildTotals({
      revenueToDate: { data: { totalRevenue: 0 } },
      revenueBreakdown: { data: { totalRevenue: 0 } },
      spendToDate: { data: {} },
      spendBreakdown: { data: { totalSpend: 0 } },
    });
    expect(missing.spendToDate).toBeNull();
    expect(missing.spendBreakdownTotal).toBe(0);
  });

  it("keeps read-only runner and Benchmark validation on the same ordered complete-source contract", () => {
    const runner = read("client/public/ga4-overview-validation-runner.js");
    const routes = read("server/routes-oauth.ts");
    const runnerVersion = runner.match(/var VERSION = "([^"]+)";/)?.[1];
    const runnerSelector = runner.slice(
      runner.indexOf("function overviewFinancialSourceTotals("),
      runner.indexOf("function normalizeFinancialMetricKey("),
    );
    const reportHelper = runner.slice(
      runner.indexOf("async function hubspotReportValuePack("),
      runner.indexOf("function hubspotPortabilityUniqueSorted("),
    );
    const providerRouteStart = routes.indexOf('app.get("/api/campaigns/:id/ga4-benchmark-provider-validation"');
    const providerValidation = routes.slice(
      providerRouteStart,
      routes.indexOf("  // ============================================================================", providerRouteStart),
    );

    expect(runnerSelector.indexOf('source: "ga4-to-date"')).toBeLessThan(runnerSelector.indexOf('source: "ga4-daily"'));
    expect(runnerSelector.indexOf('source: "ga4-daily"')).toBeLessThan(runnerSelector.indexOf('source: "ga4-breakdown"'));
    expect(runnerSelector).toContain('return ["revenue", "conversions"].every');
    expect(runnerSelector).not.toContain("reduce(function (best, current)");
    expect(reportHelper).toContain("var reportFinancialSource = overviewFinancialSourceTotals(");
    expect(reportHelper).not.toContain("Math.max(Number(ga4ToDateRevenue");
    expect(providerValidation).toContain("selectGA4FinancialTotalsSource(");
    expect(providerValidation.indexOf("uiFinancialProviderCandidate,")).toBeLessThan(providerValidation.indexOf("uiFinancialDailyCandidate],"));
    expect(providerValidation).not.toContain("reduce((best: any, current: any)");
    expect(runnerVersion).toBeTruthy();
    expect(runner).toContain(`await import('/ga4-overview-validation-runner.js?v=${runnerVersion}')`);
  });

  it("limits provider candidate reads to campaign financial metrics and isolates cache variants", () => {
    const campaign = read("server/utils/campaign-current-values.ts");
    expect(campaign).toContain('["revenue", "profit", "roas", "roi", "cpa"]');
    expect(campaign).toContain("} else if (useFullFinancialCandidate) {");
    expect(campaign).toContain('useFullFinancialCandidate ? "financial" : "base"');
    expect(campaign).toContain('storage.getRevenueTotalForRange(campaignId, financialSourceStartDate, endDate, "ga4")');
    expect(campaign).toContain('storage.getSpendTotalForRange(campaignId, spendSourceStartDate, endDate, "ga4")');
    expect(campaign).not.toContain("pipelineTotalToDate");
  });

  it("keeps all five financial formulas on selected native plus materialized imported revenue", () => {
    const campaign = read("server/utils/campaign-current-values.ts");
    expect(campaign).toContain("revenue: round2(ga4Revenue + parseNum((revenueTotals as any)?.totalRevenue))");
    expect(campaign).toContain('if (sourceId === "ga4" && inputKey === "revenue") return totals.ga4Revenue');
    expect(campaign).toContain('["revenue", "spend", "conversions", "users", "sessions", "engagementRate"].includes(metric)');
    expect(campaign).toContain('if (metric === "profit")');
    expect(campaign).toContain('if (metric === "roas")');
    expect(campaign).toContain('if (metric === "roi")');
    expect(campaign).toContain('if (metric === "cpa")');
    expect(campaign).toContain("sumSelectedFinancialConversions(cfg?.inputs?.conversions, totals)");
    const outcome = read("server/routes-oauth.ts");
    const cumulativeFinancials = read("server/utils/campaign-cumulative-financials.ts");
    const deepDive = read("client/src/pages/campaign-detail.tsx");
    expect(outcome).toContain("resolveCampaignCumulativeFinancials({");
    expect(outcome).toContain("nativeRevenue: onsiteRevenue");
    expect(outcome).toContain("importedRevenue: offsiteRevenueTotal");
    expect(cumulativeFinancials).toContain("round2(nativeRevenue + importedRevenue) - round2(revenue.value)");
    expect(cumulativeFinancials).toContain("const profit = round2(revenue.value - spend.value)");
    expect(cumulativeFinancials).toContain("roas: spend.value > 0 ? revenue.value / spend.value : 0");
    expect(cumulativeFinancials).toContain("roi: spend.value > 0 ? ((revenue.value - spend.value) / spend.value) * 100 : 0");
    expect(cumulativeFinancials).toContain("cpa: conversions.value > 0 ? spend.value / conversions.value : 0");
    expect(deepDive).toContain("(outcomeTotals as any)?.financials?.totalRevenue");
    expect(deepDive).toContain("financials?.nativeRevenue");
  });
});
