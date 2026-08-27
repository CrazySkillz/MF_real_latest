import { describe, expect, it } from "vitest";
import {
  buildExecutiveSummaryDailySnapshotInput,
  evaluateExecutiveSummaryTrajectory,
  type ExecutiveSummaryDailySnapshotInput,
} from "./utils/executive-summary-daily-snapshot";

const performanceSummary = (endDate: string, revenue: number) => ({
  version: "performance_summary_aggregate_v3",
  currentValueWindow: {
    mode: "initial_import_to_latest_completed_day",
    startDate: "2026-07-02",
    endDate,
    dataThroughDate: endDate,
    reportingTimeZone: "Europe/Amsterdam",
  },
  sources: [
    { id: "ga4", category: "web_analytics", connected: true, includedMetrics: ["users", "sessions", "conversions", "revenue"] },
    { id: "revenue_csv", category: "financial", connected: true, includedMetrics: ["revenue"] },
  ],
  totals: {
    users: { value: 1184, available: true, sources: ["ga4"] },
    sessions: { value: 1179, available: true, sources: ["ga4"] },
    conversions: { value: 251, available: true, sources: ["ga4"] },
    revenue: { value: revenue, available: true, sources: ["ga4", "revenue_csv"] },
    spend: { value: 2699.75, available: true, sources: ["canonical_spend_sources"] },
    cvr: { value: 21.29, available: true, sources: ["conversions", "sessions"] },
    cpa: { value: 10.76, available: true, sources: ["spend", "conversions"] },
    roas: { value: 26.95, available: true, sources: ["revenue", "spend"] },
    roi: { value: 2595.31, available: true, sources: ["revenue", "spend"] },
  },
});

const build = (endDate: string, revenue: number) => buildExecutiveSummaryDailySnapshotInput({
  campaignId: "campaign-1",
  currency: "usd",
  ga4PropertyId: "properties/542352127",
  ga4CampaignFilter: "spring_campaign",
  performanceSummary: performanceSummary(endDate, revenue),
});

const row = (snapshot: ExecutiveSummaryDailySnapshotInput): any => {
  const { campaignId, reportingDate, ...executiveSummaryDaily } = snapshot;
  return { campaignId, reportingDate, snapshotType: "executive_summary_daily", metrics: { executiveSummaryDaily } };
};

describe("Executive Summary daily snapshot", () => {
  it("copies the exact authoritative values and source contract", () => {
    const snapshot = build("2026-08-25", 72766.69);
    expect(snapshot.reportingDate).toBe("2026-08-25");
    expect(snapshot.currency).toBe("USD");
    expect(snapshot.ga4PropertyId).toBe("542352127");
    expect(snapshot.totals.revenue).toEqual({ value: 72766.69, available: true, sources: ["ga4", "revenue_csv"] });
    expect(snapshot.totals.roi.value).toBe(2595.31);
    expect(snapshot.sourceSignature).toEqual([
      "ga4:web_analytics:conversions:revenue:sessions:users",
      "revenue_csv:financial:revenue",
    ]);
  });

  it("classifies only an exact seven-day compatible comparison", () => {
    const result = evaluateExecutiveSummaryTrajectory(
      row(build("2026-08-25", 72766.69)),
      row(build("2026-08-18", 65000)),
    );
    expect(result.available).toBe(true);
    expect(result.trajectory).toBe("accelerating");
    expect(result.trendPercentage).toBeCloseTo(11.949, 3);
  });

  it("fails closed for missing or incompatible history", () => {
    const current = build("2026-08-25", 72766.69);
    expect(evaluateExecutiveSummaryTrajectory(row(current), null)).toMatchObject({ available: false, reason: "not_enough_history" });

    const incompatible = build("2026-08-18", 50000);
    incompatible.ga4PropertyId = "999999999";
    expect(evaluateExecutiveSummaryTrajectory(row(current), row(incompatible))).toMatchObject({ available: false, reason: "incompatible_history" });

    const wrongDay = build("2026-08-17", 50000);
    expect(evaluateExecutiveSummaryTrajectory(row(current), row(wrongDay))).toMatchObject({ available: false, reason: "incompatible_history" });
  });

  it("does not invent a trajectory when revenue history is unavailable", () => {
    const previous = build("2026-08-18", 50000);
    previous.totals.revenue = { value: null, available: false, sources: [] };
    expect(evaluateExecutiveSummaryTrajectory(row(build("2026-08-25", 72766.69)), row(previous)))
      .toMatchObject({ available: false, reason: "revenue_history_unavailable" });
  });
});
