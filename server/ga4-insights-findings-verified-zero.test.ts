import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { addGA4InsightsDateDays, buildGA4InsightsRollups, normalizeGA4InsightsDailyRows } from "../shared/ga4-insights";

describe("GA4 Insights findings use imported campaign daily history", () => {
  it("uses all imported campaign history, verified zeros, and confirmed mismatch withholding", () => {
    const content = readFileSync(join(process.cwd(), "client/src/pages/ga4-metrics.tsx"), "utf8");
    const source = ts.createSourceFile("ga4-metrics.tsx", content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const findingMemo = content.slice(content.indexOf("const insights = useMemo<InsightItem[]>(() => {"), content.indexOf("const insightsActionDescription = useMemo"));
    let selectedRollups = "";
    let findingsRows = "";
    let sevenDayReady = "";
    let threeDayReady = "";
    let correlatedDrop = "";
    let topChannelReady = "";
    let scopedChannel = "";
    let coverageScope = "";
    let zeroVerification = "";
    let mismatchScope = "";
    const visit = (node: ts.Node) => {
      if (ts.isVariableDeclaration(node)) {
        const name = node.name.getText(source);
        if (name === "findingRollups") selectedRollups = node.initializer?.getText(source) || "";
        if (name === "findingsDailyRows") findingsRows = node.initializer?.getText(source) || "";
        if (name === "sevenDayComparisonReady") sevenDayReady = node.initializer?.getText(source) || "";
        if (name === "correlatedVolumeDrop") correlatedDrop = node.initializer?.getText(source) || "";
        if (name === "findingChannelAnalysis") scopedChannel = node.initializer?.getText(source) || "";
        if (name === "findingsCoverageMatchesDaily") coverageScope = node.initializer?.getText(source) || "";
        if (name === "findingsZeroDaysVerified") zeroVerification = node.initializer?.getText(source) || "";
        if (name === "findingsHistoryMismatch") mismatchScope = node.initializer?.getText(source) || "";
      }
      if (ts.isIfStatement(node) && node.thenStatement.getText(source).includes('id: "anomaly:volume:3d"') && node.expression.getText(source).includes("findingRollups.last3.complete")) {
        threeDayReady = node.expression.getText(source);
      }
      if (ts.isIfStatement(node) && node.thenStatement.getText(source).includes('id: "info:top_channel"')) {
        topChannelReady = node.expression.getText(source);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    expect(selectedRollups).toBe("findingsRollups");
    expect(content).toContain("buildGA4InsightsRollups(findingsDailyRows, trendsDataThroughDate)");
    expect(findingsRows).toContain("ga4InsightsTimeSeries");
    expect(findingsRows).toContain("normalizeGA4InsightsDailyRows(ga4TrendsCoverage.dailyRows");
    expect(findingsRows).toContain("ga4TrendsCoverage.zeroDates");
    expect(findingsRows).toContain("ga4InsightsDailyResp");
    expect(findingsRows).not.toContain("trendsCampaignStartDate");
    expect(coverageScope).not.toContain("trendsCampaignStartDate");
    expect(coverageScope).not.toContain("startDate || \"\") >=");
    expect(sevenDayReady && threeDayReady && correlatedDrop && topChannelReady).toBeTruthy();
    expect(findingMemo).not.toContain("ga4TrendsCoverage");
    expect(findingMemo).not.toContain("trendsRollups");
    expect(findingMemo).not.toContain('id: "integrity:daily_history_mismatch"');
    expect(findingMemo).not.toContain('id: "info:ga4_revenue_and_imported_revenue_included"');
    expect(findingMemo).not.toContain('id: "info:revenue_summary"');
    expect(findingMemo).not.toContain('id: "info:avg_sessions"');
    expect(findingMemo).not.toContain('id: "info:engagement_rate"');

    const row = (date: string, sessions: number, conversions = 0, revenue = 0) => ({
      date, sessions, users: sessions, conversions, revenue, pageviews: sessions, engagedSessions: 0, engagementRate: 0,
    });
    const dates = Array.from({ length: 14 }, (_, i) => addGA4InsightsDateDays("2026-09-17", i - 13)!);
    const missingDate = "2026-09-11";
    const sparse = buildGA4InsightsRollups(dates.filter(date => date !== missingDate).map(date => row(date, 10)), "2026-09-17");
    const complete = buildGA4InsightsRollups(dates.map(date => row(date, date === missingDate ? 0 : 10)), "2026-09-17");
    const ready = new Function("findingRollups", "trendsRefreshIsStale", "findingsHistoryMismatch", `return { seven: ${sevenDayReady}, three: ${threeDayReady} };`) as
      (rows: ReturnType<typeof buildGA4InsightsRollups>, stale: boolean, mismatch?: boolean) => { seven: boolean; three: boolean };
    expect(ready(sparse, false)).toEqual({ seven: false, three: true });
    expect(ready(complete, false)).toEqual({ seven: true, three: true }); // The 7-day branch takes precedence.
    expect(ready(complete, true)).toEqual({ seven: false, three: false });
    expect(ready(complete, false, true)).toEqual({ seven: false, three: false });
    const validZero = buildGA4InsightsRollups(dates.map(date => row(date, 0)), "2026-09-17");
    expect(ready(validZero, false).seven).toBe(true);

    const historyBeforeCreation = dates.filter(date => date >= "2026-09-08").map(date => row(date, 10));
    expect(ready(buildGA4InsightsRollups(historyBeforeCreation, "2026-09-17"), false)).toEqual({ seven: false, three: true });
    const rowsJs = ts.transpileModule(`const value = ${findingsRows};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    const selectFindingRows = new Function("useMemo", "normalizeGA4InsightsDailyRows", "ga4InsightsTimeSeries", "ga4TrendsCoverage", "ga4InsightsDailyResp", "findingsZeroDaysVerified", "trendsDataThroughDate", `${rowsJs} return value;`) as
      (memo: (callback: () => ReturnType<typeof row>[]) => ReturnType<typeof row>[], normalize: typeof normalizeGA4InsightsDailyRows, rows: ReturnType<typeof row>[], coverage: unknown, daily: unknown, verified: boolean, cutoff: string) => ReturnType<typeof row>[];
    const saved = dates.filter(date => date !== "2026-09-08" && date !== missingDate).map(date => row(date, 10));
    const zeroCoverage = { startDate: "2026-06-01", zeroDates: ["2026-07-19", "2026-09-08", missingDate, "2026-09-18"], dailyRows: saved.map(item => item.date === "2026-09-17" ? row(item.date, 12) : item) };
    const selected = selectFindingRows(callback => callback(), normalizeGA4InsightsDailyRows, saved, zeroCoverage, { startDate: "2026-07-20" }, true, "2026-09-17");
    expect(selected.some(item => item.date === "2026-09-04" && item.sessions === 10)).toBe(true);
    expect(selected.some(item => item.date === "2026-09-17" && item.sessions === 12)).toBe(true);
    expect(selected.filter(item => item.date === missingDate)).toEqual([row(missingDate, 0)]);
    expect(selected.some(item => item.date === "2026-07-19" || item.date === "2026-09-18")).toBe(false);
    expect(ready(buildGA4InsightsRollups(selected, "2026-09-17"), false).seven).toBe(true);
    expect(selectFindingRows(callback => callback(), normalizeGA4InsightsDailyRows, saved, zeroCoverage, { startDate: "2026-07-20" }, false, "2026-09-17")).toEqual(saved);
    const laterDates = Array.from({ length: 14 }, (_, i) => addGA4InsightsDateDays("2026-09-21", i - 13)!);
    const verifiedZeroDate = "2026-09-10";
    const laterSparse = laterDates.filter(date => date !== verifiedZeroDate).map(date => row(date, 10));
    expect(ready(buildGA4InsightsRollups(laterSparse, "2026-09-21"), false).seven).toBe(false);
    expect(ready(buildGA4InsightsRollups([...laterSparse, row(verifiedZeroDate, 0)], "2026-09-21"), false).seven).toBe(true);

    const imported = buildGA4InsightsRollups([
      row("2026-09-12", 48, 8, 1552.30), row("2026-09-13", 47, 8, 1552.30), row("2026-09-14", 47, 8, 1552.30),
      row("2026-09-15", 32, 6, 1000), row("2026-09-16", 33, 5, 1000), row("2026-09-17", 8, 2, 419.68),
    ], "2026-09-17");
    expect(imported.last3).toMatchObject({ complete: true, sessions: 73, conversions: 13, revenue: 2419.68 });
    expect(imported.prior3).toMatchObject({ complete: true, sessions: 142, conversions: 24, revenue: 4656.9 });
    expect(ready(imported, false)).toEqual({ seven: false, three: true });
    const correlated = new Function("findingRollups", "sessionsDelta3", "revenueDelta3", "convDelta3", "crA3", "crB3",
      "ANOMALY_SHORT_SESSIONS_DROP_PCT", "ANOMALY_SHORT_REVENUE_DROP_PCT", "ANOMALY_SHORT_CONVERSIONS_DROP_PCT", `return (${correlatedDrop});`) as
      (...args: any[]) => boolean;
    const isCorrelated = (rows: ReturnType<typeof buildGA4InsightsRollups>) => correlated(
      rows, rows.deltas.sessions3, rows.deltas.revenue3, rows.deltas.conversions3, rows.last3.cr, rows.prior3.cr, -30, -35, -30,
    );
    expect(isCorrelated(imported)).toBe(true);
    expect(isCorrelated(validZero)).toBe(false);
    expect(findingMemo).toContain('id: "anomaly:volume:3d"');
    expect(findingMemo).toContain('id: "integrity:daily_history_outdated"');
    expect(findingMemo).toContain('confidence: getInsightConfidence(item)');
    const showChannel = new Function("findingChannelAnalysis", `return (${topChannelReady});`) as
      (value: unknown) => boolean;
    expect(showChannel({ topSessionChannel: { label: "Email" }, channelCount: 2, topSessionShare: 69 })).toBe(false);
    expect(showChannel({ topSessionChannel: { label: "Email" }, channelCount: 2, topSessionShare: 71 })).toBe(true);
    const selectedChannel = new Function("recommendationChannelAnalysis", "findingRollups", "insightsDataSummaryTotals", `return (${scopedChannel});`) as
      (channel: unknown, findings: unknown, summary: unknown) => unknown;
    const channel = { topSessionChannel: { label: "Email" }, channelCount: 2, topSessionShare: 71 };
    expect(selectedChannel(channel, { last30: { sessions: 100, conversions: 5 } }, { sessions: 100, conversions: 5 })).toBe(channel);
    expect(selectedChannel(channel, { last30: { sessions: 101, conversions: 5 } }, { sessions: 100, conversions: 5 })).toBeNull();
    expect(selectedChannel(channel, { last30: { sessions: 100, conversions: 6 } }, { sessions: 100, conversions: 5 })).toBeNull();
    const scopeJs = ts.transpileModule(`const value = (${coverageScope});`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    const matchesDaily = new Function("ga4TrendsCoverage", "selectedGA4PropertyId", "trendsDataThroughDate", "ga4InsightsDailyResp", `${scopeJs} return value;`) as
      (coverage: unknown, property: string, cutoff: string, daily: unknown) => boolean;
    const verifiedZeroDays = new Function("findingsCoverageMatchesDaily", "ga4TrendsCoverage", `return (${zeroVerification});`) as
      (matches: boolean, coverage: unknown) => boolean;
    const mismatch = new Function("findingsCoverageMatchesDaily", "ga4TrendsCoverage", `return (${mismatchScope});`) as
      (matches: boolean, coverage: unknown) => boolean;
    const daily = { startDate: "2026-07-20", reportingTimeZone: "Europe/Amsterdam" };
    const coverage = { reason: "stored_daily_history_differs_from_ga4", propertyId: "542352127", startDate: "2026-06-01", endDate: "2026-09-17", reportingTimeZone: "Europe/Amsterdam" };
    expect(matchesDaily(coverage, "542352127", "2026-09-17", daily)).toBe(true);
    expect(matchesDaily({ ...coverage, propertyId: "other" }, "542352127", "2026-09-17", daily)).toBe(false);
    expect(matchesDaily({ ...coverage, endDate: "2026-09-16" }, "542352127", "2026-09-17", daily)).toBe(false);
    expect(matchesDaily({ ...coverage, reportingTimeZone: "UTC" }, "542352127", "2026-09-17", daily)).toBe(false);
    expect(mismatch(true, coverage)).toBe(true);
    expect(mismatch(false, coverage)).toBe(false);
    expect(mismatch(true, { ...coverage, reason: "provider_verification_unavailable" })).toBe(false);
    expect(verifiedZeroDays(true, { ...coverage, verified: true, dailyRows: [] })).toBe(true);
    expect(verifiedZeroDays(true, { ...coverage, verified: true })).toBe(false);
  });
});
