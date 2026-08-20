import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { getReportingComparisonBoundary } from "./utils/reporting-timezone";
import { selectStableExactDateSpendSnapshot } from "./storage";
import { resolvePerformanceConfiguredMetricValue, resolvePerformanceLiveMetricValue, resolvePerformancePriorityRank } from "../client/src/lib/performance-recommended-actions";
import { classifyKpiBandWithPolicy, computeEffectiveDeltaPct, isLowerIsBetterKpi, resolveKpiThresholdPolicy } from "../shared/kpi-math";
import { resolveGA4InsightTargetPeriodCompatibility } from "../shared/ga4-kpi-consumer-state";

describe("campaign Performance Summary consolidated view regression guard", () => {
  it("selects comparison days using the campaign reporting timezone", () => {
    const now = new Date("2026-08-19T12:00:00.000Z");
    const routes = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");
    const storage = readFileSync(join(process.cwd(), "server", "storage.ts"), "utf-8");

    expect(getReportingComparisonBoundary("yesterday", "Europe/Amsterdam", now)).toMatchObject({
      comparisonDate: "2026-08-18",
      endAt: new Date("2026-08-18T21:59:59.999Z"),
    });
    expect(getReportingComparisonBoundary("last_week", "Europe/Amsterdam", now)).toMatchObject({
      comparisonDate: "2026-08-12",
      endAt: new Date("2026-08-12T21:59:59.999Z"),
    });
    expect(getReportingComparisonBoundary("last_month", "Europe/Amsterdam", now)).toMatchObject({
      comparisonDate: "2026-07-19",
      endAt: new Date("2026-07-19T21:59:59.999Z"),
    });
    expect(getReportingComparisonBoundary("last_month", "Europe/Amsterdam", new Date("2026-03-31T12:00:00.000Z"))).toMatchObject({
      comparisonDate: "2026-02-28",
      endAt: new Date("2026-02-28T22:59:59.999Z"),
    });
    expect(routes).toContain("(req as any)._campaign?.reportingTimeZone");
    expect(storage).toContain("const comparisonBoundary = getReportingComparisonBoundary(comparisonType, reportingTimeZone);");
  });

  it("reads KPI and Benchmark target rows directly from the campaign's GA4 configuration", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "campaign-performance.tsx"), "utf-8");
    const scoringBlock = page.slice(page.indexOf("const liveScoringTrafficTotals"), page.indexOf("// Score only verified GA4 records"));

    expect(page).toContain('fetch(`/api/platforms/google_analytics/kpis?campaignId=${encodeURIComponent(String(campaignId))}`)');
    expect(page).toContain('fetch(`/api/platforms/google_analytics/benchmarks?campaignId=${encodeURIComponent(String(campaignId))}`)');
    expect(page).not.toContain('queryKey: [`/api/campaigns/${campaignId}/kpis`]');
    expect(page).not.toContain('queryKey: [`/api/campaigns/${campaignId}/benchmarks`]');
    expect(scoringBlock).toContain("const getLiveScoringValue = (item: any) => resolvePerformanceConfiguredMetricValue(item) ?? resolvePerformanceLiveMetricValue({");
    expect(scoringBlock).toContain("const current = currentOverride === undefined ? getLiveScoringValue(kpi) : currentOverride;");
    expect(scoringBlock).toContain("const current = currentOverride === undefined ? getLiveScoringValue(benchmark) : currentOverride;");
    expect(scoringBlock).toContain("const getScoringTrafficInputState = (item: any): GA4KpiInputState => {");
    expect(scoringBlock).not.toContain("getFreshPersistedScoringValue");
    expect(page).not.toContain("performance-summary-scoring-read-only");
    expect(page).toContain("performanceGA4SummaryResponse?.overviewTotals");
    expect(scoringBlock).toContain("resolvePerformanceConfiguredMetricValue(kpi)");
    expect(scoringBlock).toContain("resolvePerformanceConfiguredMetricValue(benchmark)");
  });

  it("reads GA4 traffic outcomes from the read-only GA4 Summary response while retaining aggregate spend", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "campaign-performance.tsx"), "utf-8");
    const keyOutcomesStart = page.indexOf('data-testid="performance-key-outcomes"');
    const keyOutcomesEnd = page.indexOf('data-testid="performance-campaign-health"', keyOutcomesStart);
    const keyOutcomes = page.slice(keyOutcomesStart, keyOutcomesEnd);

    expect(page).toContain('const performanceSummary = outcomeTotals?.performanceSummary;');
    expect(page).toContain("const PERFORMANCE_SUMMARY_REFRESH_MS = 30000;");
    expect(page).toContain("const { data: outcomeTotals, isLoading: outcomeTotalsLoading, isError: outcomeTotalsError } = useQuery<any>({");
    expect(page).toContain("const performanceSummaryPending = !!campaignId && !performanceSummary && outcomeTotalsLoading;");
    expect(page).toContain('queryKey: [`/api/campaigns/${campaignId}/outcome-totals`, "90days"');
    expect(page).toContain("outcome-totals?dateRange=90days");
    expect(page).toContain("refetchInterval: PERFORMANCE_SUMMARY_REFRESH_MS");
    expect(page).toContain("refetchIntervalInBackground: false");
    expect(page).toContain("refetchOnWindowFocus: true");
    expect(page).toContain("if (performanceSummaryPending) {");
    expect(page).toContain("return { available: true, value: null, sources: [], unavailableReasons: [], pending: true };");
    expect(page).toContain('if (metric?.pending) return "";');
    expect(page).toContain("{!performanceSummaryPending && (");
    expect(keyOutcomes).not.toContain("Preparing Overview");
    expect(keyOutcomes).not.toContain("Preparing aggregate metrics");
    expect(page).toContain('fetch(`/api/campaigns/${campaignId}/ga4-connections?readOnly=1`)');
    expect(page).toContain('const PERFORMANCE_GA4_DAILY_DAYS = 31;');
    expect(page).toContain('ga4-daily?days=${PERFORMANCE_GA4_DAILY_DAYS}&propertyId=${encodeURIComponent(performanceGA4PropertyId)}&readOnly=1');
    expect(page).toContain('performanceGA4SummaryResponse?.overviewTotals?.[metricName]');
    expect(page).toContain('const overviewSessions = getGA4SummaryMetric("sessions", webSessions);');
    expect(page).toContain('const overviewUsers = getGA4SummaryMetric("users", parseNum(effectiveGA4?.metrics?.users));');
    expect(page).toContain('const overviewConversions = getGA4SummaryMetric("conversions", totalConversions);');
    expect(page).toContain('const overviewSpend = getOverviewMetric("spend", totalSpend);');
    expect(keyOutcomes).toContain("formatOverviewValue(overviewUsers");
    expect(keyOutcomes).toContain("formatOverviewValue(overviewSessions");
    expect(keyOutcomes).toContain("formatOverviewValue(overviewConversions");
    expect(keyOutcomes).toContain("formatOverviewValue(overviewSpend");
    expect(keyOutcomes).toContain("Total Users");
    expect(keyOutcomes).not.toContain("Total Impressions");
    expect(keyOutcomes).toContain("overviewSourceLabel(overviewConversions");
    expect(keyOutcomes).not.toContain("LinkedIn: {linkedinConversions.toLocaleString()} | CI: {ciConversions.toLocaleString()}");
  });

  it("adds Total Revenue from the same read-only native and imported GA4 financial inputs", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "campaign-performance.tsx"), "utf-8");
    const keyOutcomesStart = page.indexOf('data-testid="performance-key-outcomes"');
    const keyOutcomesEnd = page.indexOf('data-testid="performance-campaign-health"', keyOutcomesStart);
    const keyOutcomes = page.slice(keyOutcomesStart, keyOutcomesEnd);

    expect(page).toContain('ga4-to-date?propertyId=${encodeURIComponent(performanceGA4PropertyId)}&insightsScope=1&readOnly=1');
    expect(page).toContain('revenue-to-date?platformContext=ga4');
    expect(page).toContain('spend-to-date?platformContext=ga4&endDate=${encodeURIComponent(performanceGA4FinancialEndDate)}');
    expect(page).toContain('performanceGA4RevenueResponse?.native?.endDate !== performanceGA4FinancialEndDate');
    expect(page).toContain('performanceGA4SpendResponse?.endDate !== performanceGA4FinancialEndDate');
    expect(page).toContain("const scoringSpend = demoMode ? totalSpend : scoringSpendToDate;");
    expect(page).toContain("value: nativeRevenue + importedRevenue");
    expect(page).toContain('const overviewRevenue = getGA4TotalRevenueMetric();');
    expect(keyOutcomes).toContain("Total Revenue");
    expect(keyOutcomes).toContain("formatOverviewValue(overviewRevenue");
    expect(keyOutcomes).toContain("overviewSourceLabel(overviewRevenue");
    expect(keyOutcomes).toContain("lg:grid-cols-5");
  });

  it("selects top priority from lagging GA4 KPIs before Benchmark fallback", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "campaign-performance.tsx"), "utf-8");

    expect(page).toContain("const hasPriorityActionMetrics = performanceSummary");
    expect(page).toContain("Object.values(performanceSummary?.totals || {}).some((metric: any) => metric?.available === true && metric?.value !== null)");
    expect(page).toContain("No connected-source metrics available. Connect a source to generate a priority action.");
    expect(page).toContain("if (!scoringListsUnavailable && configuredMetricCount === 0) {");
    expect(page).toContain("No GA4 KPI or Benchmark targets configured. Add them in View Detailed Analytics to generate a priority action.");
    expect(page).toContain("Configured GA4 KPI and Benchmark targets are currently unavailable or unscorable.");
    expect(page).toContain("if (excludedMetricCount > 0) {");
    expect(page).toContain("currently have verified inputs.");
    expect(page).toContain("const targetSetupAction = recommendedActions.find");
    expect(page).toContain("priority.type === 'success' ? 'text-green-700 dark:text-green-400' : 'text-muted-foreground'");
    expect(page).not.toContain("const priorityTrafficWindow");
    expect(page).toContain("if (configuredCurrent !== null) return configuredCurrent;");
    expect(page).toContain("const getPriorityScoringValue = (item: any) => {");
    expect(page).toContain("return getLiveScoringValue(item);");
    expect(page).toContain("const isPriorityPeriodComparable = (item: any) => demoMode || resolveGA4InsightTargetPeriodCompatibility({");
    expect(page).toContain("const priorityScoredKpis = effectiveKpis");
    expect(page).toContain(".filter(isPriorityPeriodComparable)");
    expect(page).toContain("score: getKpiScore(item, getPriorityScoringValue(item))");
    expect(page).not.toContain("score: getKpiScore(item, resolvePerformanceAggregateMetricValue(item, performanceSummary?.totals)");
    expect(page).toContain("const laggingKPIs = priorityScoredKpis");
    expect(page).toContain('.filter((entry: any) => entry.score.band === "below")');
    expect(page).toContain("const laggingBenchmarks = priorityScoredBenchmarks");
    expect(page).toContain('.filter((entry: any) => entry.score.status !== "on_track")');
    expect(page).toContain("priorityRank: resolvePerformancePriorityRank(entry.item?.priority)");
    expect(page).toContain("const topLaggingKPI = laggingKPIs.sort((a: any, b: any) => a.priorityRank - b.priorityRank || b.severity - a.severity)[0];");
    expect(page).toContain("if (topLaggingKPI) {");
    expect(page).toContain("const topCandidate: any = laggingBenchmarks.sort((a: any, b: any) => b.severity - a.severity)[0];");
    expect(page).not.toContain("const priorityCandidate = [...laggingKPIs, ...laggingBenchmarks]");
    expect(page).not.toContain("const gapA = parseNum(a.targetValue) - parseNum(a.currentValue);");
  });

  it("ranks every standard target against the refreshed KPI current values", () => {
    const rows = [
      { name: "Total Sessions", metric: "Total Sessions", currentValue: 1_183, targetValue: 950, unit: "count", priority: "medium", timeframe: "monthly", trackingPeriod: 30 },
      { name: "Total Users", metric: "Total Users", currentValue: 1_184, targetValue: 820, unit: "count", priority: "medium", timeframe: "monthly", trackingPeriod: 30 },
      { name: "Engagement Rate", metric: "Engagement Rate", currentValue: 68.39, targetValue: 89, unit: "%", priority: "medium", timeframe: "monthly", trackingPeriod: 30 },
      { name: "Conversion Rate", metric: "Conversion Rate", currentValue: 12.85, targetValue: 15, unit: "%", priority: "medium", timeframe: "monthly", trackingPeriod: 30 },
      { name: "CPA", metric: "CPA", currentValue: 17.76, targetValue: 9, unit: "USD", priority: "medium", timeframe: "monthly", trackingPeriod: 30 },
    ];
    const ranked = rows.map((item) => {
      const current = Number(resolvePerformanceConfiguredMetricValue(item));
      const target = Number(item.targetValue);
      const lowerIsBetter = isLowerIsBetterKpi(item);
      const policy = resolveKpiThresholdPolicy({ ...item, current, target, lowerIsBetter });
      const band = classifyKpiBandWithPolicy({ current, target, lowerIsBetter, policy });
      const effectiveDeltaPct = computeEffectiveDeltaPct({ current, target, lowerIsBetter })!;
      const comparable = resolveGA4InsightTargetPeriodCompatibility(item).comparable;
      return { item, current, band, comparable, severity: Math.abs(effectiveDeltaPct), priorityRank: resolvePerformancePriorityRank(item.priority) };
    });
    expect(ranked.find((entry) => entry.item.name === "CPA")).toMatchObject({ current: 17.76, comparable: true, band: "below" });
    const comparableLagging = ranked.filter((entry) => entry.comparable && entry.band === "below")
      .sort((a, b) => a.priorityRank - b.priorityRank || b.severity - a.severity);

    expect(comparableLagging.map((entry) => [entry.item.name, entry.current, Number(entry.severity.toFixed(2))])).toEqual([
      ["CPA", 17.76, 97.33],
      ["Engagement Rate", 68.39, 23.16],
      ["Conversion Rate", 12.85, 14.33],
    ]);
  });

  it("formats Top Priority Action currency values with thousands separators and two decimals", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "campaign-performance.tsx"), "utf-8");

    expect(page).toContain("parseNum(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })");
    expect(page).toContain("const rounded = Math.round(parseNum(value) * 100) / 100;");
    expect(page).toContain("maximumFractionDigits: 2,");
    expect(page).not.toContain("const rounded = Math.round(parseNum(value) * 10) / 10;");
    expect(page).toContain("if (!unit || normalizedUnit === 'count') return parseNum(value).toLocaleString('en-US', { maximumFractionDigits: 0 });");
    expect(page).toContain("if (normalizedUnit === 'ratio') return parseNum(value).toLocaleString('en-US', { maximumFractionDigits: 2 });");
    expect(page).not.toContain("parseNum(value).toFixed(2)");
    expect(page).not.toContain("return `${value}${unit}`;");
  });

  it("counts campaign health from on-track GA4 KPI and Benchmark status bands", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "campaign-performance.tsx"), "utf-8");

    expect(page).toContain('from "@shared/kpi-math";');
    expect(page).toContain('from "@shared/ga4-kpi-consumer-state";');
    expect(page).toContain("const consumerState = resolveGA4KpiConsumerState({");
    expect(page).toContain("const sufficiency = resolveKpiDataSufficiency({");
    expect(page).toContain("const sufficiency = resolveBenchmarkDataSufficiency({");
    expect(page).toContain("const band = classifyKpiBandWithPolicy({ current, target, lowerIsBetter, policy });");
    expect(page).toContain("const result = computeBenchmarkThresholdResult({ metric, name, unit: benchmark?.unit, current, benchmarkValue });");
    expect(page).toContain("const getLiveScoringValue = (item: any) => resolvePerformanceConfiguredMetricValue(item) ?? resolvePerformanceLiveMetricValue({");
    expect(page).not.toContain("hasOneCompatiblePerformanceScoringTarget");
    expect(page).toContain("resolvePerformanceConfiguredMetricValue(kpi)");
    expect(page).toContain('const kpisOnTrackOrAbove = scoredKpis.filter((entry: any) => entry.score.band === "above" || entry.score.band === "near").length;');
    expect(page).toContain('const benchmarksOnTrack = scoredBenchmarks.filter((entry: any) => entry.score.status === "on_track").length;');
    expect(page).toContain("const healthCoverage = resolvePerformanceHealthCoverage({");
    expect(page).toContain("const excludedMetricCount = healthCoverage.excludedMetricCount;");
    expect(page).toContain("const scoringListsUnavailable = !demoMode && (kpisLoading || benchmarksLoading || kpisError || benchmarksError);");
    expect(page).toContain("const totalOnTrackMetrics = healthCoverage.totalOnTrackMetrics;");
    expect(page).toContain("`${totalMetrics} of ${configuredMetricCount} configured metrics verified`");
    expect(page).toContain('data-testid="performance-campaign-health"');
    expect(page).toContain("{kpisOnTrackOrAbove}/{effectiveKpis.length} KPIs on track");
    expect(page).toContain("{benchmarksOnTrack}/{effectiveBenchmarks.length} Benchmarks on track");
    expect(page).toContain("configured metric{excludedMetricCount === 1 ? '' : 's'} awaiting verification");
    expect(page).not.toContain("const isLowerBetterMetric");
    expect(page).not.toContain("const getBenchmarkProgressPct");
    expect(page).not.toContain("metrics above target");
    expect(page).not.toContain(">= effectiveKpis.length / 2 ? \"Majority On Track\"");
    expect(page).not.toContain("`${kpi.currentValue}${kpi.unit}`");
    expect(page).not.toContain("`${benchmark.currentValue}${benchmark.unit}`");
  });

  it("keeps Recent Movement comparisons source-compatible and labels snapshot timing accurately", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "campaign-performance.tsx"), "utf-8");
    const start = page.indexOf("const getChanges = () => {");
    const end = page.indexOf("const changeData = getChanges();", start);
    const getChanges = page.slice(start, end);

    expect(page).toContain("const aggregateMetricSourceIds = (aggregate: any, metricName: string) => {");
    expect(page).toContain("sources.map((sourceId: any) => String(sourceId || \"\").trim()).filter(Boolean).sort()");
    expect(page).toContain("Array.from(new Set(aggregateMetricSourceIds(aggregate, metricName).map((sourceId) => sourceLabelForId(sourceId))))");
    expect(getChanges).toContain("const currentSourceIds = aggregateMetricSourceIds(performanceSummary, config.key);");
    expect(getChanges).toContain("const baselineSourceIds = aggregateMetricSourceIds(baselineAggregate, config.key);");
    expect(getChanges).toContain('currentSourceIds.join("\\u0000") !== baselineSourceIds.join("\\u0000")');
    expect(getChanges).toContain("const pctChange = prevVal > 0 ? ((change / prevVal) * 100) : null;");
    expect(page).toContain('<SelectItem value="7d">Compare with 7 days ago</SelectItem>');
    expect(page).toContain("item.pctChange === null ? ''");
  });

  it("derives GA4 traffic movement from Summary totals and a valid GA4 daily window", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "campaign-performance.tsx"), "utf-8");
    const start = page.indexOf('const ga4MovementMetricKeys = new Set(["sessions", "users", "conversions"]);');
    const end = page.indexOf("const changeData = getChanges();", start);
    const movement = page.slice(start, end);

    expect(movement).toContain('performanceGA4SummaryResponse?.overviewTotals?.[metricName]');
    expect(movement).toContain('performanceGA4SummaryResponse?.dataThroughDate');
    expect(movement).toContain('performanceGA4SummaryResponse?.data');
    expect(movement).toContain('const baselineDate = resolveSpendComparisonEndDate(dataThroughDate, timeRange);');
    expect(movement).toContain('new Date(`${baselineDate}T00:00:00.000Z`).getTime()');
    expect(movement).toContain('if (!Number.isInteger(comparisonDays) || comparisonDays < 1) return null;');
    expect(movement).toContain('responseWindowCoversComparison');
    expect(movement).toContain('if (!responseWindowCoversComparison || performanceGA4SummaryResponse?.providerRefreshWarning) return null;');
    expect(movement).toContain('date < responseStartDate || date > responseEndDate');
    expect(movement).toContain('if (rowsByDate.has(date)) return null;');
    expect(movement).toContain('continue;');
    expect(movement).toContain('if (!Number.isFinite(value)) return null;');
    expect(movement).toContain('const previous = current - recentTotal;');
    expect(movement).toContain('if (!Number.isFinite(previous) || previous < 0) return null;');
    expect(movement).toContain('return { current, previous, baselineDate };');
    expect(movement).not.toContain('getCalendarMonthComparisonDays');
    expect(movement).toContain('if (!demoMode && performanceGA4PropertyId && ga4MovementMetricKeys.has(config.key))');
    expect(movement).toContain('const current = Number(performanceGA4SummaryResponse?.overviewTotals?.[config.key]);');
    expect(movement).toContain('comparisonUnavailable: true');
    expect(movement).toContain('sourceLabel: "Sources: Google Analytics"');
    expect(movement).toContain('if (!demoMode && performanceGA4PropertyId && (ga4MovementMetricKeys.has(config.key) || config.key === "spend" || config.key === "revenue")) return;');
    expect(movement).toContain('= [...ga4Changes];');
    expect(page).toContain('Comparison unavailable — incomplete GA4 daily history');
    expect(page).toContain('{!item.comparisonUnavailable && (');
    expect(page).not.toContain('Available comparisons use data from');
    expect(page).not.toContain('Current values compared to {new Date(changeData.baselineTimestamp).toLocaleDateString()}');
    expect(page).toContain('<SelectContent data-performance-movement-select>');
    expect(page).toContain('body[data-scroll-locked]:has([data-performance-movement-select]) { margin-right: 0 !important; }');
  });

  it("compares Spend with the compatible Performance Summary snapshot recorded on the exact historical date", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "campaign-performance.tsx"), "utf-8");
    const routes = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");
    const storage = readFileSync(join(process.cwd(), "server", "storage.ts"), "utf-8");
    const routeStart = routes.indexOf('app.get("/api/campaigns/:id/snapshots/comparison"');
    const routeEnd = routes.indexOf("// Get campaign snapshots by time period", routeStart);
    const comparisonRoute = routes.slice(routeStart, routeEnd);
    const storageStart = storage.indexOf("async getComparisonData(");
    const storageEnd = storage.indexOf("async getBenchmarkAnalytics", storageStart);
    const comparisonStorage = storage.slice(storageStart, storageEnd);

    expect(page).toContain('resolveSpendComparisonEndDate(String(performanceGA4SummaryResponse?.dataThroughDate || ""), timeRange)');
    expect(page).toContain('snapshots/comparison?type=${comparisonType}&comparisonDate=${encodeURIComponent(spendComparisonEndDate)}');
    expect(page).not.toContain('spend-to-date?platformContext=ga4&endDate=${encodeURIComponent(spendComparisonEndDate)}');
    expect(page).toContain('historicalSpendComparison?.comparisonDate === spendComparisonEndDate');
    expect(page).toContain('aggregateSnapshotMetricAvailable(historicalSpendSummary, "spend")');
    expect(page).toContain('JSON.stringify(currentSpendSourceIds) === JSON.stringify(historicalSpendSourceIds)');
    expect(page).toContain('const previous = aggregateSnapshotMetricValue(historicalSpendSummary, "spend");');
    expect(comparisonRoute).toContain('comparisonDate > latestComparisonDate');
    expect(comparisonRoute).toContain('comparisonDate || undefined');
    expect(comparisonStorage).toContain("to_char(timezone(${comparisonBoundary.reportingTimeZone}, timezone('UTC', ${metricSnapshots.recordedAt})), 'YYYY-MM-DD') = ${exactComparisonDate}");
    expect(comparisonStorage).toContain('sql`${metricSnapshots.recordedAt} <= ${targetDate}`');
    expect(comparisonStorage).toContain("selectStableExactDateSpendSnapshot(previousSnapshots)");
    expect(page).toContain('ga4MovementMetricKeys.has(config.key) || config.key === "spend"');
  });

  it("uses the stable exact-day Spend value instead of one incomplete outlier", () => {
    const snapshot = (value: number) => ({
      totalSpend: value,
      metrics: { performanceSummary: { totals: { spend: { available: true, value, sources: ["canonical_spend_sources"] } } } },
    });

    expect(selectStableExactDateSpendSnapshot([snapshot(2000), snapshot(2699.75), snapshot(2699.75)])?.totalSpend).toBe(2699.75);
    expect(selectStableExactDateSpendSnapshot([snapshot(2300)])?.totalSpend).toBe(2300);
    expect(selectStableExactDateSpendSnapshot([snapshot(2000), snapshot(2699.75)])).toBeUndefined();
  });

  it("requires Recent Movement Total Revenue to use same-source exact-date totals", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "campaign-performance.tsx"), "utf-8");
    const routes = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");
    const revenueRouteStart = routes.indexOf('app.get("/api/campaigns/:id/revenue-to-date"');
    const revenueRouteEnd = routes.indexOf("// Revenue breakdown by source", revenueRouteStart);
    const ga4RouteStart = routes.indexOf('app.get("/api/campaigns/:id/ga4-to-date"');
    const ga4RouteEnd = routes.indexOf("// Benchmark-read-only GA4 input validation", ga4RouteStart);
    const movementStart = page.indexOf("const getChanges = () => {");
    const movementEnd = page.indexOf("const changeData = getChanges();", movementStart);
    const revenueRoute = routes.slice(revenueRouteStart, revenueRouteEnd);
    const ga4Route = routes.slice(ga4RouteStart, ga4RouteEnd);
    const movement = page.slice(movementStart, movementEnd);

    expect(revenueRoute).toContain("req.query.endDate");
    expect(revenueRoute).toContain("requestedEndDate > latestCompletedEndDate");
    expect(ga4Route).toContain("req.query.endDate");
    expect(ga4Route).toContain("requestedEndDate > latestCompletedEndDate");
    expect(ga4Route).toContain("Exact-date simulated GA4 revenue is unavailable");
    expect(page).toContain("const revenueComparisonEndDate = resolveSpendComparisonEndDate");
    expect(page).toContain("ga4-to-date?propertyId=${encodeURIComponent(performanceGA4PropertyId)}&insightsScope=1&readOnly=1&endDate=${encodeURIComponent(revenueComparisonEndDate)}");
    expect(page).toContain("revenue-to-date?platformContext=ga4&endDate=${encodeURIComponent(revenueComparisonEndDate)}");
    expect(page).toContain('const recentMovementMetricOrder = ["Sessions", "Conversions", "Spend", "Total Revenue"]');
    expect(movement).toContain('metric: "Total Revenue"');
    expect(movement).toContain("comparisonUnavailable: true");
    expect(movement).toContain("currentRevenueSourceIds");
    expect(movement).toContain("historicalRevenueSourceIds");
  });

  it("renders one streamlined live view without repeated tabs, detail lists, source cards, or trend charts", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "campaign-performance.tsx"), "utf-8");

    expect(page).not.toContain("TabsTrigger");
    expect(page).not.toContain("<Tabs");
    expect(page).toContain('data-testid="performance-key-outcomes"');
    expect(page).toContain('data-testid="performance-campaign-health"');
    expect(page).toContain('data-testid="performance-top-priority"');
    expect(page).toContain('data-testid="performance-recent-movement"');
    expect(page).toContain('data-testid="performance-recommended-actions"');
    expect(page).toContain('<Link href={`/campaigns/${campaign.id}/trend-analysis`}>');
    expect(page).toContain("recentMovementChanges.map");
    expect(page).not.toContain("changeData.changes.slice(0, 4).map");
    expect(page).toContain("const recommendedInsights = recommendedActions;");
    expect(page).toContain("buildPerformanceRecommendedActions({");
    expect(page).not.toContain("<CardTitle>Key Performance Indicators (KPIs)</CardTitle>");
    expect(page).not.toContain("<CardTitle>Benchmarks</CardTitle>");
    expect(page).not.toContain("<CardTitle>Data Sources</CardTitle>");
    expect(page).toContain("{false && (() => {");
    expect(page).toContain("snapshots?period=${trendPeriod}");
  });
});
