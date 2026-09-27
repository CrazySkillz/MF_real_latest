import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), "utf8");
const between = (source: string, start: string, end: string) => {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThan(-1);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
};

describe("GA4 Overview scheduler snapshot contract", () => {
  it("creates one campaign/property snapshot in schema, migration, and startup compatibility SQL", () => {
    const schema = read("shared", "schema.ts");
    const migration = read("migrations", "0018_add_ga4_overview_scheduler_snapshots.sql");
    const startup = read("server", "index.ts");
    for (const source of [schema, migration, startup]) {
      expect(source).toContain("ga4_overview_snapshots");
      expect(source).toContain("campaign_id");
      expect(source).toContain("property_id");
      expect(source).toContain("campaign_breakdown");
      expect(source).toContain("landing_pages");
      expect(source).toContain("conversion_events");
      expect(source).toContain("ga4_overview_snapshots_campaign_property_unique");
    }
  });

  it("commits daily facts and the complete Overview payload in one transaction", () => {
    const scheduler = read("server", "ga4-daily-scheduler.ts");
    const storage = read("server", "storage.ts");
    const method = between(storage, "async replaceGA4DailyMetricsWindow", "async getGA4DailyMetrics");
    expect(scheduler).toContain("const revenueRoundingTolerance = overviewRows.length * 0.005 + 1e-9");
    expect(scheduler).toContain("expected.revenue) > revenueRoundingTolerance");
    expect(method).toContain("await db.transaction");
    expect(method).toContain("await tx.delete(ga4DailyMetrics)");
    expect(method).toContain("await tx.insert(ga4DailyMetrics)");
    expect(method).toContain("await tx.insert(ga4OverviewSnapshots)");
    expect(method).toContain("onConflictDoUpdate");
    expect(method).toContain("overviewSnapshot.windowEnd !== end");
  });

  it("serves all three Overview table variants from the synchronized snapshot", () => {
    const routes = read("server", "routes-oauth.ts");
    const landing = between(routes, 'app.get("/api/campaigns/:id/ga4-landing-pages"', 'app.get("/api/campaigns/:id/ga4-conversion-events"');
    const events = between(routes, 'app.get("/api/campaigns/:id/ga4-conversion-events"', 'app.get("/api/campaigns/:id/ga4-breakdown"');
    const breakdown = between(routes, 'app.get("/api/campaigns/:id/ga4-breakdown"', "// Geographic breakdown endpoint");
    expect(landing).toContain("snapshot.landingPages");
    expect(events).toContain("snapshot.conversionEvents");
    expect(breakdown).toContain("snapshot.campaignBreakdown");
    for (const route of [landing, events, breakdown]) {
      expect(route).toContain("getSynchronizedGA4OverviewSnapshot");
      expect(route).toContain("GA4_OVERVIEW_SNAPSHOT_UNAVAILABLE");
    }
    const client = read("client", "src", "pages", "ga4-metrics.tsx");
    expect(client).toContain("ga4OverviewExpectedEndDate");
    expect(client.match(/snapshotEndDate/g)).toHaveLength(3);
    expect(client).toContain('previousKey?.[5] === ga4OverviewExpectedEndDate');
  });

  it("invalidates the snapshot when campaign scope or its GA4 connection is changed or deleted", () => {
    const storage = read("server", "storage.ts");
    expect(storage).toContain("await tx.delete(ga4OverviewSnapshots).where(eq(ga4OverviewSnapshots.campaignId, id))");
    expect(storage).toContain("invalidatesOverviewSnapshot");
    expect(storage).toContain("await tx.delete(ga4OverviewSnapshots).where(and(");
    expect(storage).toContain("await tx.delete(ga4OverviewSnapshots).where(eq(ga4OverviewSnapshots.campaignId, campaignId))");
  });
});
