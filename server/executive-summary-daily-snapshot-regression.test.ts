import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Executive Summary daily snapshot wiring", () => {
  it("keeps its storage identity isolated from existing snapshot consumers", () => {
    const schema = readFileSync(join(process.cwd(), "shared", "schema.ts"), "utf8");
    const storage = readFileSync(join(process.cwd(), "server", "storage.ts"), "utf8");
    const migration = readFileSync(join(process.cwd(), "migrations", "0015_add_executive_summary_daily_snapshot_identity.sql"), "utf8");
    expect(schema).toContain("metric_snapshots_executive_summary_day_unique");
    expect(migration).toContain("WHERE snapshot_type = 'executive_summary_daily' AND reporting_date IS NOT NULL");
    expect(storage).toContain("upsertExecutiveSummaryDailySnapshot");
    expect(storage).toContain("getExecutiveSummaryDailyComparisonData");
    expect(storage.match(/ne\(metricSnapshots\.snapshotType, 'executive_summary_daily'\)/g)).toHaveLength(5);
  });

  it("captures only the authoritative live aggregate and reads an exact comparison", () => {
    const routes = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf8");
    const outcomeStart = routes.indexOf('app.get("/api/campaigns/:id/outcome-totals"');
    const outcomeEnd = routes.indexOf('// New route: Get all GA4 connections', outcomeStart);
    const outcome = routes.slice(outcomeStart, outcomeEnd);
    expect(outcome).toContain('req.query.captureExecutiveSnapshot');
    expect(outcome).toContain("buildExecutiveSummaryDailySnapshotInput");
    expect(outcome).toContain("hasRefreshedGA4RowsForExecutiveSummarySnapshot");
    expect(outcome).toContain("if (!executiveGA4SnapshotRefreshReady)");
    expect(outcome).toContain("if (!executiveSnapshot.totals.revenue.available)");
    expect(outcome).toContain("upsertExecutiveSummaryDailySnapshot");
    expect(outcome.indexOf("const performanceSummary = buildCampaignPerformanceSummaryAggregate"))
      .toBeLessThan(outcome.indexOf("upsertExecutiveSummaryDailySnapshot"));
    expect(routes).toContain('app.get("/api/campaigns/:id/executive-summary/trajectory", requireCampaignAccessParamId');
    expect(routes).toContain("getExecutiveSummaryDailyComparisonData(campaignId, reportingDate, comparisonDate)");
    expect(routes).toContain("evaluateExecutiveSummaryTrajectory(snapshots.current, snapshots.previous)");
  });

  it("captures the same canonical aggregate automatically without external authentication", () => {
    const scheduler = readFileSync(join(process.cwd(), "server", "executive-summary-snapshot-scheduler.ts"), "utf8");
    const index = readFileSync(join(process.cwd(), "server", "index.ts"), "utf8");
    expect(scheduler).toContain("getInternalAutoRefreshToken()");
    expect(scheduler).toContain('"x-internal-auto-refresh-token": token');
    expect(scheduler).toContain("dateRange=90days&captureExecutiveSnapshot=1&executiveFinancialScope=campaign_to_date");
    expect(scheduler).toContain("setInterval(() => void captureExecutiveSummarySnapshots(baseUrl), DAY_MS)");
    expect(index).toContain("executiveSummarySnapshotScheduler.start(port)");
  });

  it("uses the isolated trajectory response in the live Executive Summary", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "executive-summary.tsx"), "utf8");
    expect(page).toContain("captureExecutiveSnapshot=1&executiveFinancialScope=campaign_to_date");
    expect(page).toContain("/executive-summary/trajectory?reportingDate=");
    expect(page).toContain("(executiveTrajectoryData as any)?.available === true");
    expect(page).not.toContain("const executiveTrajectory = hasAuthoritativeGA4Window ? null");
  });
});
