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

    for (const table of [
      "mimosaas_tracking_attributions",
      "mimosaas_tracking_campaign_mappings",
      "mimosaas_tracking_configurations",
      "mimosaas_tracking_daily_metrics",
      "mimosaas_tracking_publication_runs",
      "mimosaas_tracking_daily_snapshots",
    ]) expect(cleanup).toContain(`deleteOptionalCampaignTable("${table}")`);

    expect(cleanup).toContain('deleteOptionalCampaignTable("mimosaas_tracking_events", "resolved_campaign_id")');
    expect(cleanup).toContain("SELECT to_regclass(${tableName}) AS table_name");
  });

  it("removes remaining client-owned tracker data before deleting its client", () => {
    const start = storage.indexOf("async deleteClientCascade");
    const end = storage.indexOf("// A/B Test methods", start);
    const cleanup = storage.slice(start, end);
    const attributionDelete = cleanup.indexOf('deleteOptionalClientTable("mimosaas_tracking_attributions")');
    const eventDelete = cleanup.indexOf('deleteOptionalClientTable("mimosaas_tracking_events")');
    const websiteDelete = cleanup.indexOf('deleteOptionalClientTable("mimosaas_website_connections", true)');
    const clientDelete = cleanup.indexOf("tx.delete(clients)");

    expect(attributionDelete).toBeGreaterThan(-1);
    expect(attributionDelete).toBeLessThan(eventDelete);
    expect(eventDelete).toBeLessThan(websiteDelete);
    expect(websiteDelete).toBeLessThan(clientDelete);
    expect(cleanup).toContain("SELECT to_regclass(${tableName}) AS table_name");
    expect(cleanup).toContain("client_id = ${clientId} AND owner_id = ${ownerId}");
  });

  it("keeps setup routes feature-flagged without exposing ingestion, UI, or the GA4 scheduler", () => {
    const routes = read("server", "routes-oauth.ts");
    expect(routes).toContain("requireMimosaasTrackingFeature");
    expect(routes).toContain("MIMOSAAS_TRACKING_ENABLED");
    expect(routes).not.toContain("createMimosaasTrackingEvent");
    expect(read("server", "ga4-daily-scheduler.ts")).not.toContain("mimosaasTracking");
    expect(read("client", "src", "pages", "campaigns.tsx")).not.toContain("mimosaas_tracking");
  });
});
