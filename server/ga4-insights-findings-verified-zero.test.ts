import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { addGA4InsightsDateDays, buildGA4InsightsRollups } from "../shared/ga4-insights";

describe("GA4 Insights findings daily-history verification", () => {
  it("uses verified zero days and withholds daily findings on an explicit provider mismatch", () => {
    const content = readFileSync(join(process.cwd(), "client/src/pages/ga4-metrics.tsx"), "utf8");
    const source = ts.createSourceFile("ga4-metrics.tsx", content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let coverageCheck = "";
    let mismatchCheck = "";
    let selectedRollups = "";
    let comparisonReady = "";
    let shortComparisonReady = "";
    let historyNeededReady = "";
    let dailyInfoReady = "";
    let revenueSummaryReady = "";
    let guardedTargetLoops = 0;
    const visit = (node: ts.Node) => {
      if (ts.isVariableDeclaration(node) && node.name.getText(source) === "findingCoverageVerified") {
        coverageCheck = node.initializer?.getText(source) || "";
      }
      if (ts.isVariableDeclaration(node) && node.name.getText(source) === "findingRollups") {
        selectedRollups = node.initializer?.getText(source) || "";
      }
      if (ts.isVariableDeclaration(node) && node.name.getText(source) === "findingDailyHistoryMismatch") {
        mismatchCheck = node.initializer?.getText(source) || "";
      }
      if (ts.isVariableDeclaration(node) && node.name.getText(source) === "sevenDayComparisonReady") {
        comparisonReady = node.initializer?.getText(source) || "";
      }
      if (ts.isIfStatement(node)) {
        const body = node.thenStatement.getText(source);
        if (body.includes('id: "info:short_window"')) shortComparisonReady = node.expression.getText(source);
        if (body.includes('id: "anomaly:not-enough-history"')) historyNeededReady = node.expression.getText(source);
        if (body.includes('id: "info:avg_sessions"') && node.expression.getText(source).includes("findingRollups.last7.complete")) dailyInfoReady = node.expression.getText(source);
        if (body.includes('id: "info:revenue_summary"')) revenueSummaryReady = node.expression.getText(source);
      }
      if (ts.isForOfStatement(node) && /id: [`]?(?:kpi:|bench:|positive:kpi:)/.test(node.statement.getText(source))) {
        if (node.statement.getText(source).includes("if (findingDailyHistoryMismatch) continue;")) guardedTargetLoops++;
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    expect(coverageCheck && mismatchCheck && selectedRollups && comparisonReady && shortComparisonReady && historyNeededReady && dailyInfoReady).toBeTruthy();
    const evaluate = new Function("activeTab", "trendsZeroDaysVerified", "ga4TrendsCoverageError", "ga4TrendsCoverage", "trendsRollups", "insightsRollups", "trendsRefreshIsStale",
      `const findingCoverageVerified = ${coverageCheck}; const findingDailyHistoryMismatch = ${mismatchCheck}; const findingRollups = ${selectedRollups}; const sevenDayComparisonReady = ${comparisonReady}; return { findingRollups, sevenDayComparisonReady, findingDailyHistoryMismatch };`) as
      (tab: string, verified: boolean, error: unknown, coverage: unknown, trends: ReturnType<typeof buildGA4InsightsRollups>, stored: ReturnType<typeof buildGA4InsightsRollups>, stale: boolean) =>
        { findingRollups: ReturnType<typeof buildGA4InsightsRollups>; sevenDayComparisonReady: boolean; findingDailyHistoryMismatch: boolean };

    const endDate = "2026-09-17";
    const zeroDates = new Set(["2026-09-04", "2026-09-11"]);
    const dates = Array.from({ length: 14 }, (_, index) => addGA4InsightsDateDays(endDate, index - 13));
    const row = (date: string, sessions: number) => ({ date, sessions, users: sessions, conversions: 0, revenue: 0, pageviews: sessions, engagedSessions: 0, engagementRate: 0 });
    const stored = buildGA4InsightsRollups(dates.filter(date => !zeroDates.has(date)).map(date => row(date, 10)), endDate);
    const trends = buildGA4InsightsRollups(dates.map(date => row(date, zeroDates.has(date) ? 0 : 10)), endDate);
    expect([stored.last7.days, stored.prior7.days, trends.last7.days, trends.prior7.days]).toEqual([6, 6, 7, 7]);
    expect(trends.last7.sessions).toBe(stored.last7.sessions);
    expect(evaluate("insights", false, null, null, trends, stored, false)).toEqual({ findingRollups: stored, sevenDayComparisonReady: false, findingDailyHistoryMismatch: false });
    expect(evaluate("insights", true, null, { verified: true }, trends, stored, false)).toEqual({ findingRollups: trends, sevenDayComparisonReady: true, findingDailyHistoryMismatch: false });
    expect(evaluate("reports", true, null, { verified: true }, trends, stored, false)).toEqual({ findingRollups: stored, sevenDayComparisonReady: false, findingDailyHistoryMismatch: false });
    expect(evaluate("insights", true, new Error("refresh failed"), null, trends, stored, false)).toEqual({ findingRollups: stored, sevenDayComparisonReady: false, findingDailyHistoryMismatch: false });
    expect(evaluate("insights", true, null, { verified: true }, trends, stored, true).sevenDayComparisonReady).toBe(false);
    expect(evaluate("insights", false, null, null, trends, trends, false).sevenDayComparisonReady).toBe(true);
    const mismatched = evaluate("insights", false, null, { verified: false, reason: "stored_daily_history_differs_from_ga4" }, trends, trends, false);
    expect(mismatched.findingDailyHistoryMismatch).toBe(true);
    expect(mismatched.sevenDayComparisonReady).toBe(false);
    expect(evaluate("insights", false, null, { verified: false, reason: "provider_verification_unavailable" }, trends, trends, false).sevenDayComparisonReady).toBe(true);
    const evaluateDailyGate = new Function("trendsRefreshIsStale", "findingDailyHistoryMismatch", "findingRollups", "ga4InsightsDailyResp", `return { short: ${shortComparisonReady}, historyNeeded: ${historyNeededReady}, info: ${dailyInfoReady} };`) as
      (stale: boolean, mismatch: boolean, rows: ReturnType<typeof buildGA4InsightsRollups>, response: unknown) => { short: boolean; historyNeeded: boolean; info: boolean };
    expect(evaluateDailyGate(false, false, stored, {})).toEqual({ short: true, historyNeeded: true, info: false });
    expect(evaluateDailyGate(false, true, stored, {})).toEqual({ short: false, historyNeeded: false, info: false });
    expect(evaluateDailyGate(false, false, trends, {})).toEqual({ short: true, historyNeeded: true, info: true });
    expect(evaluateDailyGate(false, true, trends, {})).toEqual({ short: false, historyNeeded: false, info: false });
    expect(content).toContain('ga4TrendsCoverage === undefined && !ga4TrendsCoverageError');
    expect(guardedTargetLoops).toBe(3);
    expect(revenueSummaryReady).toContain("!findingDailyHistoryMismatch");
  });
});
