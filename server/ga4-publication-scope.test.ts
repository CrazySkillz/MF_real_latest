import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

const mocks = vi.hoisted(() => {
  const state: any = { campaign: null, connection: null, previous: null, calls: [] };
  const transaction = vi.fn(async (fn: any) => {
    let read = 0;
    const tx = {
      execute: async () => ({ rows: [{ name: null }] }), // This fixture has no durable work table.
      update: () => ({ set: (value: any) => ({ where: async (query: any) => { state.invalidatedValue = value; state.invalidatedQuery = query; } }) }),
      select: () => ({ from: () => ({ where: () => {
        const value = [state.campaign, state.connection, state.previous][read++];
        const rows = value ? [value] : [];
        return { for: async (mode: string) => { state.calls.push(`lock:${mode}`); return rows; }, then: (resolve: any) => resolve(rows) };
      } }) }),
      delete: () => ({ where: async () => { state.calls.push("delete"); } }),
      insert: () => ({ values: (values: any) => ({ then: (resolve: any) => { state.calls.push("insert-daily"); state.batches.push(values); resolve(); }, onConflictDoUpdate: async () => { state.calls.push("insert-overview"); } }) }),
    };
    return fn(tx);
  });
  return { state, db: { transaction, update: () => ({ set: (value: any) => ({ where: async (query: any) => { state.invalidatedValue = value; state.invalidatedQuery = query; } }) }) } };
});
vi.mock("./db", () => ({ db: mocks.db, pool: null }));
import { DatabaseStorage } from "./storage";
const storage = new DatabaseStorage();
const campaign = { id: "c", ownerId: "owner", clientId: "client", status: "active", ga4CampaignFilter: "sale", currency: "EUR", reportingTimeZone: "Europe/Amsterdam" };
const connection = { id: "g", campaignId: "c", propertyId: "123", isActive: true, isPrimary: true, importStartDate: "2026-10-16" };
const overview = () => ({ windowStart: "2026-10-16", windowEnd: "2026-10-16", campaignBreakdown: {}, landingPages: {}, conversionEvents: {},
  refreshScope: { campaign: { ownerId: "owner", clientId: "client", status: "active", ga4CampaignFilter: "sale", currency: "EUR", reportingTimeZone: "Europe/Amsterdam" },
    connection: { id: "g", propertyId: "123", isPrimary: true, importStartDate: "2026-10-16" }, previousUpdatedAt: "2026-10-17T06:00:00.000Z" },
});
const row = { campaignId: "c", propertyId: "123", date: "2026-10-16", sessions: 10, users: 8, conversions: 2, pageviews: 20, engagedSessions: 5, engagementRate: 0.5, revenue: "100" };
const write = (snapshot = overview()) => storage.replaceGA4DailyMetricsWindow("c", "123", "2026-10-16", "2026-10-16", [row] as any, snapshot);

describe("GA4 atomic publication scope", () => {
  beforeEach(() => { mocks.state.campaign = { ...campaign }; mocks.state.connection = { ...connection }; mocks.state.previous = { updatedAt: new Date("2026-10-17T06:00:00Z") }; mocks.state.calls = []; mocks.state.batches = []; });
  it("locks and verifies the campaign and connection before replacing either publication", async () => {
    await expect(write()).resolves.toEqual({ replaced: 1 });
    expect(mocks.state.calls).toEqual(["lock:update", "lock:share", "delete", "insert-daily", "insert-overview"]);
  });
  it.each([0, 1, 90, 365, 500, 501])("bounds insert calls for %i rows and preserves their order", async count => {
    const rows = Array.from({ length: count }, (_, i) => ({ ...row,
      date: new Date(Date.UTC(2025, 0, 1 + i)).toISOString().slice(0, 10), revenue: String(i),
    }));
    await expect(storage.replaceGA4DailyMetricsWindow("c", "123", "2025-01-01", "2026-10-16", rows as any, overview()))
      .resolves.toEqual({ replaced: count });
    expect(mocks.state.batches.map((batch: any[]) => batch.length)).toEqual(count > 500 ? [500, count - 500] : count ? [count] : []);
    expect(mocks.state.batches.flat()).toEqual(rows.map(value => ({ ...value,
      revenueMetric: null, isSimulated: false, updatedAt: expect.any(Date),
    })));
    expect(mocks.state.calls.at(-1)).toBe("insert-overview");
  });
  it("invalidates only this campaign/date's GA4 readiness marker, preserving other notes and snapshots", async () => {
    await storage.invalidateExecutiveSummaryDailySnapshotAlignment("c", "2026-10-16");
    const query = new PgDialect().sqlToQuery(mocks.state.invalidatedQuery);
    expect(query.params).toEqual(["c", "executive_summary_daily", "2026-10-16"]);
    expect(query.sql).toContain("split_part"); expect(query.sql).toContain("'ga4_aligned_refresh_v1'");
    expect(mocks.state.invalidatedValue).toEqual({ notes: null });
  });
  it.each(["ownerId", "clientId", "status", "ga4CampaignFilter", "currency", "reportingTimeZone"])("rejects an in-flight %s change before deleting any data", async (key) => {
    mocks.state.campaign[key] = "changed";
    await expect(write()).rejects.toThrow("scope changed");
    expect(mocks.state.calls).not.toContain("delete");
  });
  it.each(["propertyId", "importStartDate", "isPrimary", "id"])("rejects a connection %s change", async (key) => {
    mocks.state.connection[key] = "changed";
    await expect(write()).rejects.toThrow("scope changed");
    expect(mocks.state.calls).not.toContain("delete");
  });
  it.each(["campaign deleted", "connection deleted", "connection disabled"])("rejects %s during a provider request", async (kind) => {
    if (kind === "campaign deleted") mocks.state.campaign = null;
    else if (kind === "connection deleted") mocks.state.connection = null;
    else mocks.state.connection.isActive = false;
    await expect(write()).rejects.toThrow("scope changed"); expect(mocks.state.calls).not.toContain("delete");
  });
  it("rejects a competing publication completed after this attempt captured its previous version", async () => {
    mocks.state.previous.updatedAt = new Date("2026-10-17T12:00:00Z");
    await expect(write()).rejects.toThrow("Another GA4 refresh"); expect(mocks.state.calls).not.toContain("delete");
  });
  it("allows an initial draft import with no previous snapshot", async () => {
    const snapshot = overview(); snapshot.refreshScope.campaign.status = "draft"; snapshot.refreshScope.previousUpdatedAt = null as any;
    mocks.state.campaign.status = "draft"; mocks.state.previous = null;
    await expect(write(snapshot)).resolves.toEqual({ replaced: 1 });
  });
});
