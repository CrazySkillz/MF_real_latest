import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { addGA4InsightsDateDays, buildGA4InsightsRollups } from "../shared/ga4-insights";

describe("GA4 Insights findings use imported campaign daily history", () => {
  it("does not let the separate live Trends recheck suppress complete imported windows", () => {
    const content = readFileSync(join(process.cwd(), "client/src/pages/ga4-metrics.tsx"), "utf8");
    const source = ts.createSourceFile("ga4-metrics.tsx", content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const findingMemo = content.slice(content.indexOf("const insights = useMemo<InsightItem[]>(() => {"), content.indexOf("const insightsActionDescription = useMemo"));
    let selectedRollups = "";
    let sevenDayReady = "";
    let threeDayReady = "";
    let correlatedDrop = "";
    let topChannelReady = "";
    const visit = (node: ts.Node) => {
      if (ts.isVariableDeclaration(node)) {
        const name = node.name.getText(source);
        if (name === "findingRollups") selectedRollups = node.initializer?.getText(source) || "";
        if (name === "sevenDayComparisonReady") sevenDayReady = node.initializer?.getText(source) || "";
        if (name === "correlatedVolumeDrop") correlatedDrop = node.initializer?.getText(source) || "";
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
    expect(selectedRollups).toBe("insightsRollups");
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
    const ready = new Function("findingRollups", "trendsRefreshIsStale", `const insightsRollups = findingRollups; return { seven: ${sevenDayReady}, three: ${threeDayReady} };`) as
      (rows: ReturnType<typeof buildGA4InsightsRollups>, stale: boolean) => { seven: boolean; three: boolean };
    expect(ready(sparse, false)).toEqual({ seven: false, three: true });
    expect(ready(complete, false)).toEqual({ seven: true, three: true }); // The 7-day branch takes precedence.
    expect(ready(complete, true)).toEqual({ seven: false, three: false });
    const validZero = buildGA4InsightsRollups(dates.map(date => row(date, 0)), "2026-09-17");
    expect(ready(validZero, false).seven).toBe(true);

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
    expect(findingMemo).toContain('confidence: getInsightConfidence(item)');
    const showChannel = new Function("recommendationChannelAnalysis", `return (${topChannelReady});`) as
      (value: unknown) => boolean;
    expect(showChannel({ topSessionChannel: { label: "Email" }, channelCount: 2, topSessionShare: 69 })).toBe(false);
    expect(showChannel({ topSessionChannel: { label: "Email" }, channelCount: 2, topSessionShare: 71 })).toBe(true);
  });
});
