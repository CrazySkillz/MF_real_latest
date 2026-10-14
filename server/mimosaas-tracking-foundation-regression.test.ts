import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const read = (...parts: string[]) => fs.readFileSync(path.join(process.cwd(), ...parts), "utf8");

describe("Mimosaas Tracking Phase 2 foundation", () => {
  const schema = read("shared", "schema.ts");
  const migration = read("migrations", "0020_add_mimosaas_tracking_foundation.sql");
  const storage = read("server", "storage.ts");

  it("defines isolated website, configuration, event, attribution, aggregate, run, and snapshot records", () => {
    for (const table of [
      "mimosaas_website_connections",
      "mimosaas_tracking_configurations",
      "mimosaas_tracking_campaign_mappings",
      "mimosaas_tracking_events",
      "mimosaas_tracking_attributions",
      "mimosaas_tracking_daily_metrics",
      "mimosaas_tracking_publication_runs",
      "mimosaas_tracking_daily_snapshots",
    ]) {
      expect(schema).toContain(`pgTable("${table}"`);
      expect(migration).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
  });

  it("retains the required raw event evidence without accepting revenue", () => {
    const start = schema.indexOf('export const mimosaasTrackingEvents = pgTable("mimosaas_tracking_events"');
    const end = schema.indexOf("export const mimosaasTrackingAttributions", start);
    const eventTable = schema.slice(start, end);

    for (const field of [
      "eventId:", "clientId:", "websiteConnectionId:", "resolvedCampaignId:",
      "campaignResolutionStatus:", "eventTime:", "receivedAt:", "anonymousVisitorId:",
      "sessionId:", "eventName:", "url:", "referrer:", "utmSource:", "utmMedium:",
      "utmCampaign:", "utmTerm:", "utmContent:", "gclid:",
    ]) expect(eventTable).toContain(field);

    expect(eventTable).not.toContain("revenue:");
    expect(migration).toContain("mimosaas_tracking_events_event_id_unique");
    expect(migration).toContain("mimosaas_tracking_events_immutable");
  });

  it("keeps daily publication idempotent and published snapshots immutable", () => {
    expect(migration).toContain("mimosaas_tracking_daily_metrics_campaign_day_unique");
    expect(migration).toContain("mimosaas_tracking_publication_runs_campaign_day_unique");
    expect(migration).toContain("mimosaas_tracking_daily_snapshots_campaign_day_unique");
    expect(migration).toContain("mimosaas_tracking_daily_snapshots_immutable");
    expect(migration).toContain("revenue_status IN ('available', 'unavailable')");
    expect(migration).toContain("spend_status IN ('available', 'unavailable')");
  });

  it("deletes only campaign-scoped tracker children in the campaign transaction", () => {
    const start = storage.indexOf("private async deleteCampaignChildren");
    const end = storage.indexOf("async deleteCampaignCascade", start);
    const cleanup = storage.slice(start, end);

    for (const symbol of [
      "mimosaasTrackingAttributions",
      "mimosaasTrackingCampaignMappings",
      "mimosaasTrackingConfigurations",
      "mimosaasTrackingDailyMetrics",
      "mimosaasTrackingPublicationRuns",
      "mimosaasTrackingDailySnapshots",
    ]) expect(cleanup).toContain(`tx.delete(${symbol}).where(eq(${symbol}.campaignId, campaignId))`);

    expect(cleanup).toContain("tx.delete(mimosaasTrackingEvents).where(eq(mimosaasTrackingEvents.resolvedCampaignId, campaignId))");
  });

  it("removes remaining client-owned tracker data before deleting its client", () => {
    const start = storage.indexOf("async deleteClientCascade");
    const end = storage.indexOf("// A/B Test methods", start);
    const cleanup = storage.slice(start, end);
    const attributionDelete = cleanup.indexOf("tx.delete(mimosaasTrackingAttributions)");
    const eventDelete = cleanup.indexOf("tx.delete(mimosaasTrackingEvents)");
    const websiteDelete = cleanup.indexOf("tx.delete(mimosaasWebsiteConnections)");
    const clientDelete = cleanup.indexOf("tx.delete(clients)");

    expect(attributionDelete).toBeGreaterThan(-1);
    expect(attributionDelete).toBeLessThan(eventDelete);
    expect(eventDelete).toBeLessThan(websiteDelete);
    expect(websiteDelete).toBeLessThan(clientDelete);
    expect(cleanup).toContain("eq(mimosaasWebsiteConnections.ownerId, ownerId)");
  });

  it("does not expose the foundation through routes, UI, or the GA4 scheduler", () => {
    expect(read("server", "routes-oauth.ts")).not.toContain("mimosaasTracking");
    expect(read("server", "ga4-daily-scheduler.ts")).not.toContain("mimosaasTracking");
    expect(read("client", "src", "pages", "campaigns.tsx")).not.toContain("mimosaas_tracking");
  });
});
