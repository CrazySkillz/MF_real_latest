import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), "utf8");

describe("GA4 connection lifecycle safety", () => {
  it("blocks silent deactivation and records durable lifecycle evidence", () => {
    const schema = read("shared", "schema.ts");
    const migration = read("migrations", "0019_add_ga4_connection_lifecycle_audit.sql");
    const startup = read("server", "index.ts");

    expect(schema).toContain('pgTable("ga4_connection_lifecycle_events"');
    expect(schema).toContain('subjectCampaignId: text("campaign_id")');
    for (const source of [migration, startup]) {
      expect(source).toContain("CREATE TABLE IF NOT EXISTS ga4_connection_lifecycle_events");
      expect(source).toContain("GA4_CONNECTION_DEACTIVATION_BLOCKED");
      expect(source).toContain("OLD.is_active = true AND NEW.is_active = false");
      expect(source).toContain("OLD.is_active = false AND NEW.is_active = true");
      expect(source).toContain("current_setting('app.ga4_connection_actor', true)");
      expect(source).toContain("current_setting('app.ga4_connection_reason', true)");
      expect(source).toContain("'connected'");
      expect(source).toContain("'reactivated'");
      expect(source).toContain("'disconnected'");
      expect(source).toContain("CREATE TRIGGER ga4_connection_lifecycle_guard");
    }
  });

  it("keeps successful campaigns moving through the daily pipeline when another campaign fails", () => {
    const scheduler = read("server", "ga4-daily-scheduler.ts");
    const processedLoop = scheduler.indexOf("for (const processedCampaignId of refreshResult.campaignIdsProcessed)");
    const finalFailure = scheduler.indexOf("if (refreshFailure || alignedRefreshFailures.length > 0)");

    expect(processedLoop).toBeGreaterThan(-1);
    expect(finalFailure).toBeGreaterThan(processedLoop);
    expect(scheduler.indexOf("await writeFinancialDailySnapshotIfReady", processedLoop)).toBeLessThan(finalFailure);
    expect(scheduler.indexOf("await recordCampaignMetrics(processedCampaignId", processedLoop)).toBeLessThan(finalFailure);
    expect(scheduler).toContain("Campaign-scoped alert check failed");
  });
});
