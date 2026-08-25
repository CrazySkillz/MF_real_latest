import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  deriveExactCumulativeGA4Traffic,
  deriveTrendFinancialRatios,
  filterTrendRowsToCalendarWindow,
  formatExactTrendCount,
  formatTrendComparison,
  resolveCompatibleTrendFinancialDaily,
  resolveTrendConsumerMode,
  resolveTrendComparisonDate,
} from "../client/src/lib/trend-analysis-cumulative";

describe("Trend Analysis Overview regression guard", () => {
  it("reads KPI targets from GA4 and preserves GA4 ROAS ratio semantics", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "trend-analysis.tsx"), "utf-8");

    expect(page).toContain('queryKey: [`/api/platforms/google_analytics/kpis`, campaignId]');
    expect(page).toContain('fetch(`/api/platforms/google_analytics/kpis?campaignId=${encodeURIComponent(String(campaignId))}`)');
    expect(page).not.toContain('queryKey: [`/api/campaigns/${campaignId}/kpis`]');
    expect(page).toContain('y={kpiTargets.roas}');
    expect(page).toContain('y={kpiTargets.roas} ifOverflow="extendDomain"');
    expect(page).toContain('y={kpiTargets.revenue} ifOverflow="extendDomain"');
    expect(page).not.toContain('y={kpiTargets.roas / 100}');
    expect(page).toContain("const candidates: Record<'revenue' | 'conversions' | 'roas', number[]>");
    expect(page).toContain("if (candidates[metric].length === 1) targets[metric] = candidates[metric][0];");
    expect(page).not.toContain("targets.revenue = parseFloat(k.targetValue)");
  });

  it("wires the Overview tab to the source-aware trend aggregate contract", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "trend-analysis.tsx"), "utf-8");
    const overviewStart = page.indexOf('<TabsContent value="overview"');
    const overviewEnd = page.indexOf('<TabsContent value="efficiency"', overviewStart);
    const overview = page.slice(overviewStart, overviewEnd);

    expect(page).toContain('<Tabs value="overview" className="space-y-6">');
    expect(page).not.toContain("<TabsList");
    expect(page).not.toContain("<TabsTrigger");
    expect(page).toContain('queryKey: [`/api/campaigns/${campaignId}/trend-analysis`, trendDateRange, perfDays]');
    expect(page).toContain("trend-analysis?dateRange=${trendDateRange}&days=${perfDays * 2}");
    expect(page).toContain("const responseTrendAggregate = (trendAnalysisResponse as any)?.trendAnalysis;");
    expect(page).toContain("responseTrendAggregate?.campaignId === campaignId");
    expect(page).toContain("responseTrendAggregate?.dateRange === trendDateRange");
    expect(page).toContain("const overviewTrendData = useMemo<any>(() => {");
    expect(page).toContain("normalizeRateToPercent");
    expect(overview).toContain("overviewTrendData.availableSeries.map");
    expect(overview).toContain("overviewVisibleSeries.has('sessions')");
    expect(overview).toContain("overviewVisibleSeries.has('users')");
    expect(overview).toContain("overviewVisibleSeries.has('revenue')");
    expect(overview).toContain("No connected source trend data available");
    expect(overview).not.toContain("crossPlatformData");
    expect(overview).not.toContain("Connect a platform (GA4, LinkedIn, Meta, or Google Ads) to see performance trends.");
  });

  it("holds the executive render until campaign source scope resolves", () => {
    expect(resolveTrendConsumerMode({
      outcomeTotalsFetched: false,
      performanceSummary: undefined,
      campaignId: "campaign-1",
    })).toBe("pending");
    expect(resolveTrendConsumerMode({
      outcomeTotalsFetched: true,
      performanceSummary: { campaignId: "campaign-2", version: "performance_summary_aggregate_v3", sources: [] },
      campaignId: "campaign-1",
    })).toBe("unavailable");
    expect(resolveTrendConsumerMode({
      outcomeTotalsFetched: true,
      performanceSummary: {
        campaignId: "campaign-1",
        version: "performance_summary_aggregate_v3",
        sources: [{ id: "ga4", connected: true, category: "web_analytics" }],
      },
      campaignId: "campaign-1",
    })).toBe("cumulative_ga4");
    expect(resolveTrendConsumerMode({
      outcomeTotalsFetched: true,
      performanceSummary: {
        campaignId: "campaign-1",
        version: "performance_summary_aggregate_v3",
        sources: [
          { id: "ga4", connected: true, category: "web_analytics" },
          { id: "meta", connected: true, category: "paid_media" },
        ],
      },
      campaignId: "campaign-1",
    })).toBe("aggregate");
  });

  it("uses cumulative current values and exact-date history only for the compatible GA4 consumer", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "trend-analysis.tsx"), "utf-8");
    const overviewStart = page.indexOf("const overviewTrendData = useMemo<any>(() => {");
    const overviewEnd = page.indexOf("const overviewVisibleSeries", overviewStart);
    const overviewModel = page.slice(overviewStart, overviewEnd);

    expect(page).toContain("ga4-connections?readOnly=1");
    expect(page).toContain("ga4-daily?days=${TREND_GA4_DAILY_DAYS}&propertyId=${encodeURIComponent(trendGA4PropertyId)}&readOnly=1");
    expect(page).toContain('queryKey: [`/api/campaigns/${campaignId}/outcome-totals`, "90days", "live"]');
    expect(page).toContain("snapshotType=financial_daily&comparisonDate=${trendComparisonDate}");
    expect(page).toContain('performanceSummary?.version === "performance_summary_aggregate_v3"');
    expect(page).toContain("performanceSummary?.campaignId === campaignId");
    expect(page).toContain('const usesCumulativeGA4Consumer = trendConsumerMode === "cumulative_ga4";');
    expect(page).toContain('if (trendConsumerMode === "pending" || trendConsumerMode === "unavailable") return null;');
    expect(page).toContain("ga4Daily?.providerRefreshAttempted === false");
    expect(page).toContain('String(ga4Daily?.propertyId || "") === trendGA4PropertyId');
    expect(page).toContain('const fmtTrendCurrency = (value: number) => fmtCur(value, usesCumulativeGA4Consumer ? campaignCurrency : "USD");');
    expect(overviewModel).toContain("const current = usesCumulativeGA4Consumer ? authoritativeTrendCurrent : buildSummary(currentPeriod);");
    expect(overviewModel).toContain("const previous = usesCumulativeGA4Consumer ? authoritativeTrendPrevious : buildSummary(previousPeriod);");
    expect(overviewModel).toContain("(!usesCumulativeGA4Consumer || Number(previousValue) > 0)");
    expect(overviewModel).toContain('hasPrevious: Object.values(comparison).some((value) => typeof value === "number")');
    expect(overviewModel).toContain("currentPeriodDays: currentPeriod.length");
    expect(overviewModel).toContain("requestedPeriodDays: perfDays");
    expect(page).toContain("Current cumulative values are not being reused as historical values.");
    const cumulativeQueryStart = page.indexOf("data: ga4Daily");
    const cumulativeQueryEnd = page.indexOf("const { data: linkedinDaily", cumulativeQueryStart);
    expect(page.slice(cumulativeQueryStart, cumulativeQueryEnd)).not.toContain("placeholderData: keepPreviousData");
    const trendQueryStart = page.indexOf("data: trendAnalysisResponse");
    const trendQueryEnd = page.indexOf("// Unified Cross-Platform Data Layer", trendQueryStart);
    expect(page.slice(trendQueryStart, trendQueryEnd)).not.toContain("placeholderData: keepPreviousData");
    expect(page).toContain('|| trendConsumerMode === "pending"');
    expect(page).toContain("|| cumulativeConsumerLoading");
  });

  it("derives exact cumulative GA4 traffic and fails closed on incompatible coverage", () => {
    const response = {
      validationReadOnly: true,
      overviewStartDate: "2026-07-02",
      startDate: "2026-05-24",
      endDate: "2026-08-22",
      dataThroughDate: "2026-08-22",
      overviewTotals: { users: 1184, sessions: 1183, conversions: 152, engagedSessions: 809 },
      data: [
        { date: "2026-08-08", users: 108, sessions: 108, conversions: 14, engagedSessions: 74 },
        { date: "2026-08-09", users: 106, sessions: 106, conversions: 14, engagedSessions: 72 },
        { date: "2026-08-10", users: 103, sessions: 103, conversions: 14, engagedSessions: 71 },
      ],
    };

    expect(resolveTrendComparisonDate("2026-08-22", 7)).toBe("2026-08-15");
    expect(resolveTrendComparisonDate("2026-08-22", 30)).toBe("2026-07-23");
    expect(resolveTrendComparisonDate("2026-08-22", 90)).toBe("2026-05-24");
    expect(resolveTrendComparisonDate("2026-02-30", 7)).toBe("");

    const exact = deriveExactCumulativeGA4Traffic(response, "2026-07-23");
    expect(exact?.current).toMatchObject({ users: 1184, sessions: 1183, conversions: 152, engagedSessions: 809 });
    expect(exact?.current.engagementRate).toBeCloseTo((809 / 1183) * 100, 10);
    expect(exact?.current.cvr).toBeCloseTo((152 / 1183) * 100, 10);
    expect(exact?.previous).toMatchObject({ users: 867, sessions: 866, conversions: 110, engagedSessions: 592 });
    expect(exact?.previous.engagementRate).toBeCloseTo((592 / 866) * 100, 10);
    expect(exact?.previous.cvr).toBeCloseTo((110 / 866) * 100, 10);
    expect(deriveExactCumulativeGA4Traffic(response, "2026-08-08")?.previous)
      .toMatchObject({ users: 975, sessions: 974, conversions: 124, engagedSessions: 666 });
    expect(deriveExactCumulativeGA4Traffic(response, "2026-08-15")?.previous)
      .toMatchObject({ users: 1184, sessions: 1183, conversions: 152, engagedSessions: 809 });
    expect(deriveExactCumulativeGA4Traffic(response, "2026-07-01")).toBeNull();
    expect(deriveExactCumulativeGA4Traffic({ ...response, providerRefreshWarning: "stale" }, "2026-07-23")).toBeNull();
    expect(deriveExactCumulativeGA4Traffic({ ...response, startDate: "2026-08-22" }, "2026-07-23")).toBeNull();
    expect(deriveExactCumulativeGA4Traffic({ ...response, data: [...response.data, response.data[1]] }, "2026-07-23")).toBeNull();
    expect(deriveExactCumulativeGA4Traffic({ ...response, overviewTotals: { ...response.overviewTotals, users: null } }, "2026-07-23")).toBeNull();
    expect(deriveExactCumulativeGA4Traffic({ ...response, data: [{ ...response.data[0], engagedSessions: null }] }, "2026-07-23")).toBeNull();
  });

  it("uses calendar windows and accepts only an exact compatible financial snapshot", () => {
    const rows = ["2026-08-14", "2026-08-16", "2026-08-20", "2026-08-22", "2026-08-23"].map((date) => ({ date }));
    expect(filterTrendRowsToCalendarWindow(rows, "2026-08-22", 7).map((row) => row.date))
      .toEqual(["2026-08-16", "2026-08-20", "2026-08-22"]);

    const currentValueWindow = {
      startDate: "2026-07-02",
      reportingTimeZone: "Europe/Amsterdam",
    };
    const snapshot = {
      campaignId: "campaign-1",
      snapshotType: "financial_daily",
      reportingDate: "2026-08-15",
      metrics: {
        financialDaily: {
          version: "financial_daily_snapshot_v1",
          currency: "USD",
          currentValueWindow: {
            mode: "initial_import_to_latest_completed_day",
            startDate: "2026-07-02",
            endDate: "2026-08-15",
            dataThroughDate: "2026-08-15",
            reportingTimeZone: "Europe/Amsterdam",
          },
          inputs: { spend: { available: true, value: 10, sources: ["sheet"] } },
        },
      },
    };
    const args = { snapshot, campaignId: "campaign-1", comparisonDate: "2026-08-15", campaignCurrency: "USD", currentValueWindow };
    expect(resolveCompatibleTrendFinancialDaily(args)).toBe(snapshot.metrics.financialDaily);
    expect(resolveCompatibleTrendFinancialDaily({ ...args, comparisonDate: "2026-08-14" })).toBeNull();
    expect(resolveCompatibleTrendFinancialDaily({ ...args, campaignCurrency: "EUR" })).toBeNull();
    expect(resolveCompatibleTrendFinancialDaily({ ...args, campaignId: "campaign-2" })).toBeNull();

    const ratios = deriveTrendFinancialRatios({ spend: 2699.75, revenue: 72766.69, conversions: 251 });
    expect(ratios.roas).toBeCloseTo(72766.69 / 2699.75, 10);
    expect(ratios.roi).toBeCloseTo(((72766.69 - 2699.75) / 2699.75) * 100, 10);
    expect(ratios.cpa).toBeCloseTo(2699.75 / 251, 10);
    expect(deriveTrendFinancialRatios({ spend: 0, revenue: 72766.69, conversions: 0 }))
      .toEqual({ roas: null, roi: null, cpa: null });
  });

  it("presents exact counts and unambiguous cumulative comparisons", () => {
    expect(formatExactTrendCount(1183)).toBe("1,183");
    expect(formatExactTrendCount(1184)).toBe("1,184");
    expect(formatTrendComparison({ current: 1183, previous: 866, comparisonDate: "2026-07-23", kind: "count" }))
      .toEqual({ value: "+317 (+36.6%)", context: "vs cumulative - Jul 23, 2026" });
    expect(formatTrendComparison({ current: 12.8486897718, previous: 12.7020785219, comparisonDate: "2026-07-23", kind: "rate" }))
      .toEqual({ value: "+0.15 percentage points", context: "vs cumulative - Jul 23, 2026" });
    expect(formatTrendComparison({ current: 68.3854606932, previous: 68.3602771363, comparisonDate: "2026-07-23", kind: "rate" }))
      .toEqual({ value: "+0.03 percentage points", context: "vs cumulative - Jul 23, 2026" });
    expect(formatTrendComparison({ current: 10, previous: 0, comparisonDate: "2026-07-23", kind: "count" })).toBeNull();

    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "trend-analysis.tsx"), "utf-8");
    expect(page).toContain("formatExactTrendCount(overviewTrendData.current.sessions)");
    expect(page).toContain("formatExactTrendCount(overviewTrendData.current.users)");
    expect(page).toContain("const cumulativeComparison = usesCumulativeGA4Consumer && comparisonKey && trendComparisonDate");
    expect(page).toContain('<div className="text-xs text-muted-foreground mt-1 leading-tight">');
    expect(page).toContain("<div>{cumulativeComparison.context}</div>");
    const cumulativeRenderStart = page.indexOf("cumulativeComparison ? (");
    const cumulativeRenderEnd = page.indexOf(") : (", cumulativeRenderStart);
    expect(page.slice(cumulativeRenderStart, cumulativeRenderEnd)).not.toContain("ArrowUpRight");
    expect(page.slice(cumulativeRenderStart, cumulativeRenderEnd)).not.toContain("text-green-600");
    expect(page).not.toContain("const isFinancialCard");
    expect(page).toContain('usesCumulativeGA4Consumer && comparisonDateLabel && typeof card.change !== "number"');
    expect(page).toContain("<div>Comparison unavailable</div>");
    expect(page).toContain("<div>vs cumulative - {comparisonDateLabel}</div>");
    expect(page).not.toContain("Financial KPIs are campaign-to-date");
    expect(page).not.toContain("current campaign-to-date financial KPIs remain visible");
    expect(page).not.toContain("Traffic cards are cumulative from the initial import");
  });

  it("wires the Efficiency Metrics tab to aggregate-backed derived metrics", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "trend-analysis.tsx"), "utf-8");
    const efficiencyStart = page.indexOf('<TabsContent value="efficiency"');
    const efficiencyEnd = page.indexOf('<TabsContent value="funnel"', efficiencyStart);
    const efficiency = page.slice(efficiencyStart, efficiencyEnd);

    expect(page).toContain("const efficiencyTrendData = useMemo<any>(() => {");
    expect(page).toContain("roas: toMetric(metrics.roas)");
    expect(page).toContain("roi: toMetric(metrics.roi)");
    expect(page).toContain("cpa: toMetric(metrics.cpa)");
    expect(page).toContain("engagementRate === null ? null : normalizeRateToPercent(engagementRate)");
    expect(page).toContain("hasCompleteCurrentPeriod: usesCumulativeGA4Consumer ? Boolean(authoritativeTrendCurrent) : currentPeriod.length >= perfDays");
    expect(page).toContain('hasFinancialEfficiency: !usesCumulativeGA4Consumer && (hasValue("roas") || hasValue("roi"))');
    expect(page).toContain("Daily ROAS and ROI trends are unavailable because no compatible cumulative financial series exists.");
    expect(page).toContain("if (usesCumulativeGA4Consumer && !authoritativeTrendCurrent) return null;");
    expect(page).toContain("Validate full-period efficiency trends after enough daily history exists.");
    expect(efficiency).toContain("No connected source efficiency metrics available");
    expect(efficiency).toContain("ROAS and ROI require both spend and revenue from connected source data.");
    expect(efficiency).not.toContain("crossPlatformData");
    expect(efficiency).not.toContain("Avg ROAS");
  });

  it("wires the Conversion Funnel tab to aggregate-backed source capabilities", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "trend-analysis.tsx"), "utf-8");
    const funnelStart = page.indexOf('<TabsContent value="funnel"');
    const funnelEnd = page.indexOf('<TabsContent value="platforms"', funnelStart);
    const funnel = page.slice(funnelStart, funnelEnd);

    expect(page).toContain("const conversionFunnelData = useMemo<any>(() => {");
    expect(page).toContain('paidAvailable: usesCumulativeGA4Consumer ? false : hasMetric("impressions") || hasMetric("clicks")');
    expect(funnel).toContain("Web Analytics Funnel");
    expect(funnel).toContain("Paid-Media Funnel");
    expect(funnel).toContain("Paid-media funnel metrics require a connected paid-media source with impressions or clicks.");
    expect(funnel).toContain("Validate full-period funnel trends after enough daily history exists.");
    expect(funnel).not.toContain("crossPlatformData");
    expect(funnel).not.toContain("Connect an ad platform to see conversion funnel trends.");
  });

  it("wires the Platform Breakdown tab to aggregate-backed connected sources", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "trend-analysis.tsx"), "utf-8");
    const platformsStart = page.indexOf('<TabsContent value="platforms"');
    const platformsEnd = page.indexOf('<TabsContent value="market"', platformsStart);
    const platforms = page.slice(platformsStart, platformsEnd);

    expect(page).toContain("const platformBreakdownData = useMemo<any>(() => {");
    expect(page).toContain("const sources = Array.isArray(aggregate?.sources) ? aggregate.sources : [];");
    expect(platforms).toContain("platformBreakdownData.sources.map");
    expect(platforms).toContain("No connected main source provides source-level spend for this selection.");
    expect(platforms).toContain("CPA and CPC require source-level spend plus conversions or clicks from a connected main source.");
    expect(platforms).toContain("p.unavailable.join");
    expect(platforms).not.toContain("crossPlatformData");
    expect(platforms).not.toContain("Connect at least one ad platform to see breakdown analysis.");
    expect(platforms).not.toContain("li_${platformMetric}");
  });

  it("presents one comprehensive executive view without duplicate tab navigation", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "trend-analysis.tsx"), "utf-8");
    const overviewStart = page.indexOf('<TabsContent value="overview"');
    const overviewEnd = page.indexOf('<TabsContent value="efficiency"', overviewStart);
    const executiveView = page.slice(overviewStart, overviewEnd);

    expect(page).not.toContain("activeTab");
    expect(page).not.toContain("setActiveTab");
    expect(page).not.toContain("<TabsList");
    expect(page).not.toContain("<TabsTrigger");
    expect(page).toContain("<Select value={perfPeriod} onValueChange={setPerfPeriod}>");
    expect(page).toContain("const trendInsights = useMemo<any[]>(() => {");
    expect(page).toContain("const executiveTrendInsights = trendInsights");
    expect(page).toContain("overviewTrendData?.hasPrevious");
    expect(page).toContain("efficiencyTrendData?.cards?.length");
    expect(page).toContain("conversionFunnelData?.webAvailable");
    expect(page).toContain("platformBreakdownData?.sources?.length === 1");
    expect(page).toContain('Source: {overviewTrendData.connectedSources.join(", ")}');
    expect(executiveView).not.toContain("Connected source coverage");
    expect(executiveView).not.toContain("Available decision signals");
    expect(executiveView).not.toContain("Unavailable as a comparable daily series");
    expect(executiveView).toContain("Campaign Performance Trend");
    expect(executiveView.indexOf("Campaign Performance Trend")).toBeLessThan(executiveView.indexOf("Metric Toggle Row"));
    expect(executiveView.match(/Campaign Performance Trend/g)).toHaveLength(1);
    expect(executiveView).toContain('card.key === "roi"');
    expect(executiveView).toContain('card.key === "cpc"');
    expect(executiveView).toContain('card.key === "cpm"');
    expect(executiveView).not.toContain("formatPct(overviewTrendData.current.roi)");
    expect(executiveView).not.toContain("fmtTrendCurrency(overviewTrendData.current.cpc)");
    expect(executiveView).not.toContain("fmtTrendCurrency(overviewTrendData.current.cpm)");
    expect(executiveView).toContain("Efficiency Trends");
    expect(executiveView).toContain("Conversion Quality Trend");
    expect(executiveView).toContain("Current campaign-to-date financial totals remain shown above.");
    expect(executiveView).not.toContain("financial KPIs above");
    expect(executiveView).toContain("<Legend />");
    expect(executiveView).toContain('<Card className="lg:col-span-2">');
    expect(executiveView).toContain('label={{ value: "ROAS Target"');
    expect(executiveView).toContain("Paid Acquisition Funnel");
    expect(executiveView).toContain("Website Engagement &amp; Conversion Summary");
    expect(executiveView).toContain("Cumulative from initial import through {cumulativeDataThroughLabel}.");
    expect(executiveView).toContain("Engaged Sessions");
    expect(executiveView).toContain("formatExactTrendCount(conversionFunnelData.current.sessions)");
    expect(executiveView).toContain("Conversions per 100 sessions");
    expect(executiveView).not.toContain("Session conversion rate");
    expect(executiveView).not.toContain("index < stages.length - 1");
    expect(executiveView).toContain("Source Contribution");
    expect(executiveView).toContain("Coverage notes");
    expect(executiveView).toContain("source.unavailable.join");
    expect(executiveView).toContain("Contribution Over Time");
    expect(executiveView).toContain("Executive Recommendations");
    expect(executiveView).toContain("executiveTrendInsights.map");
    expect(page).toContain("Cumulative Comparison Context");
    expect(page).toContain("ROAS Requires Business Context");
    expect(page).toContain("Conversion Volume Requires Context");
    expect(page).toContain("conversions per 100 sessions");
    expect(executiveView).not.toContain("Prioritized actions based on");
    expect(executiveView).not.toContain("efficiencyTrendData.cards.map");
    expect(executiveView).not.toContain("Web Analytics Funnel");
    expect(executiveView).not.toContain("Platform Performance Comparison");
    expect(executiveView).not.toContain("Conversion Funnel");
    expect(page).toContain('? ["users", "sessions", "conversions"]');
    expect(executiveView).toContain("isAnimationActive={false}");
  });

  it("stores scheduler snapshots with the Trend Analysis aggregate contract", () => {
    const scheduler = readFileSync(join(process.cwd(), "server", "scheduler.ts"), "utf-8");

    expect(scheduler).toContain('import { buildTrendAnalysisAggregate }');
    expect(scheduler).toContain("const includeTrendAnalysis = options.includeTrendAnalysis !== false;");
    expect(scheduler).toContain("const trendAnalysis = includeTrendAnalysis ? buildTrendAnalysisAggregate({");
    expect(scheduler).toContain('dateRange: "90days"');
    expect(scheduler).toContain("financialDailyRows: trendFinancialDailyRows");
    expect(scheduler).toContain("storage.getGA4DailyMetrics(campaignId");
    expect(scheduler).toContain("storage.getLinkedInDailyMetrics(campaignId, startDate, endDate)");
    expect(scheduler).toContain("storage.getMetaDailyMetrics(campaignId, startDate, endDate)");
    expect(scheduler).toContain("storage.getGoogleAdsDailyMetrics(campaignId, startDate, endDate)");
    expect(scheduler).toContain("storage.getInstagramDailyMetrics(campaignId, startDate, endDate)");
    expect(scheduler).toContain('id: "instagram"');
    expect(scheduler).toContain("trendAnalysis,");
  });

  it("keeps mock GA4 Trend Analysis rows aligned with the GA4 mock source path", () => {
    const routes = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");
    const routeStart = routes.indexOf('app.get("/api/campaigns/:id/trend-analysis"');
    const routeEnd = routes.indexOf("// Limits + timeouts", routeStart);
    const route = routes.slice(routeStart, routeEnd);

    expect(route).toContain("isYesopMockProperty(primaryGA4PropertyId)");
    expect(route).toContain('days >= 90 ? "90days" : days >= 60 ? "60days" : days >= 14 ? "30days" : "7days"');
    expect(route).toContain("const sim = simulateGA4({");
    expect(route).toContain("const simDates = new Set(simRows.map((row: any) => String(row.date)));");
    expect(route).toContain("ga4Rows = simRows.map((row: any) => {");
    expect(route).toContain("if (row?.date && !simDates.has(String(row.date))) ga4Rows.push(row);");
  });
});
