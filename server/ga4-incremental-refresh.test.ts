import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  storage: {
    getCampaign: vi.fn(), getCampaigns: vi.fn(), getGA4Connections: vi.fn(), getGA4Connection: vi.fn(),
    getGA4OverviewSnapshot: vi.fn(), getGA4DailyMetrics: vi.fn(), getGA4PublicationVersion: vi.fn(),
    replaceGA4DailyMetricsWindow: vi.fn(), updateGA4ConnectionTokens: vi.fn(),
  },
  provider: {
    getTimeSeriesData: vi.fn(), getTrendsDailyPresenceWithToken: vi.fn(), getAcquisitionBreakdown: vi.fn(),
    getLandingPagesReport: vi.fn(), getConversionEventsReport: vi.fn(), withAbortSignal: vi.fn(),
  },
}));
vi.mock("./storage", () => ({ storage: mocks.storage }));
vi.mock("./analytics", () => ({ ga4Service: mocks.provider, GA4_CONVERSION_EVENTS_SNAPSHOT_VERSION: "test-v1" }));
vi.mock("./ga4-kpi-benchmark-jobs", () => ({}));
vi.mock("./kpi-scheduler", () => ({}));
vi.mock("./benchmark-notifications", () => ({}));
vi.mock("./utils/financial-daily-snapshot-writer", () => ({}));
vi.mock("./executive-summary-snapshot-scheduler", () => ({}));
vi.mock("./auto-refresh-scheduler", () => ({}));
vi.mock("./scheduler", () => ({}));

import { refreshAllGA4DailyMetrics } from "./ga4-daily-scheduler";
import { summarizeGA4TrafficRows } from "../shared/ga4-traffic-window";

describe("GA4 correction windows and full-history repair", () => {
  const start = "2026-06-01", end = "2026-10-17", recent = "2026-10-04";
  let campaign: any, connection: any, facts: any[], stored: any[], snapshot: any;
  const row = (date: string, sessions = 10) => ({
    campaignId: "campaign-a", propertyId: "12345", date, sessions, users: sessions - 1,
    engagedSessions: 5, pageviews: 15, conversions: 2, revenue: 20, engagementRate: 5 / sessions,
    revenueMetric: "totalRevenue", isSimulated: false,
  });
  const run = (date = "2026-10-18T12:00:00Z", opts: any = {}) =>
    refreshAllGA4DailyMetrics({ campaignId: campaign.id, ...opts }, new Date(date));
  const expected = () => facts.reduce((total, r) => ({ sessions: total.sessions + r.sessions,
    conversions: total.conversions + r.conversions, revenue: total.revenue + r.revenue,
  }), { sessions: 0, conversions: 0, revenue: 0 });
  const prime = async () => {
    expect((await run("2026-10-18T06:00:00Z")).campaignIdsFailed).toEqual([]);
    mocks.provider.getTimeSeriesData.mockClear(); mocks.storage.replaceGA4DailyMetricsWindow.mockClear();
  };
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("GA4_DAILY_LOOKBACK_DAYS", "90");
    campaign = { id: "campaign-a", ownerId: "owner-a", clientId: "client-a", status: "active", currency: "EUR",
      ga4CampaignFilter: "sale", reportingTimeZone: "Europe/Amsterdam" };
    connection = { id: "connection-a", campaignId: campaign.id, propertyId: "12345", isActive: true,
      isPrimary: true, importStartDate: start, accessToken: "test-token", method: "access_token" };
    facts = [row(start), row(recent), row(end)]; stored = []; snapshot = undefined;
    mocks.storage.getCampaign.mockImplementation(async () => campaign);
    mocks.storage.getGA4PublicationVersion.mockResolvedValue(null);
    mocks.storage.getGA4Connections.mockImplementation(async () => [connection]);
    mocks.storage.getGA4Connection.mockImplementation(async () => connection);
    mocks.storage.getGA4OverviewSnapshot.mockImplementation(async () => structuredClone(snapshot));
    mocks.storage.getGA4DailyMetrics.mockImplementation(async (_cid, _pid, from, to) => structuredClone(stored.filter(r => r.date >= from && r.date <= to)));
    mocks.provider.withAbortSignal.mockImplementation(() => mocks.provider);
    mocks.provider.getTimeSeriesData.mockImplementation(async (_cid, _storage, from, _pid, _filter, to) =>
      structuredClone(facts.filter(r => r.date >= from && r.date <= to)));
    mocks.provider.getTrendsDailyPresenceWithToken.mockImplementation(async (_pid, _token, _from, _to, _filter, _currency, _capture, series) =>
      ({ dailyRows: series, presentDates: series.map((r: any) => r.date) }));
    mocks.provider.getAcquisitionBreakdown.mockImplementation(async () => ({ rows: [], totals: expected(), meta: { currencyCode: campaign.currency } }));
    mocks.provider.getLandingPagesReport.mockResolvedValue({ rows: [], totals: {} });
    mocks.provider.getConversionEventsReport.mockImplementation(async () => ({ rows: [], totals: { conversions: expected().conversions } }));
    mocks.storage.replaceGA4DailyMetricsWindow.mockImplementation(async (_cid, _pid, from, to, rows, overview) => {
      stored = [...stored.filter(r => r.date < from || r.date > to), ...structuredClone(rows)].sort((a, b) => a.date.localeCompare(b.date));
      snapshot = { ...structuredClone(overview), updatedAt: new Date("2026-10-18T06:05:00Z") };
      return { replaced: rows.length };
    });
    for (const method of ["log", "warn", "error"] as const) vi.spyOn(console, method).mockImplementation(() => undefined);
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

  it("imports the entire fixed history, including dates older than the rolling lookback", async () => {
    const result = await run();
    expect(result.campaignIdsFailed).toEqual([]);
    expect(mocks.provider.getTimeSeriesData.mock.calls.map(args => args[2])).toEqual([start]);
    expect(stored[0]).toEqual(row(start));
    expect(stored.find(r => r.date === "2026-06-02")).toMatchObject({ sessions: 0, conversions: 0 });
    expect(summarizeGA4TrafficRows(stored)).toMatchObject({ sessions: 30, conversions: 6 });
  });

  it("checks 14 recent days on a later same-day run while keeping cumulative reports and history", async () => {
    await prime();
    const old = structuredClone(stored.filter(r => r.date < recent));
    facts[2] = { ...facts[2], sessions: 12, users: 11, conversions: 3, revenue: 25, engagementRate: 5 / 12 };
    expect((await run()).campaignIdsFailed).toEqual([]);
    expect(mocks.provider.getTimeSeriesData.mock.calls.map(args => args[2])).toEqual([recent]);
    expect(mocks.storage.replaceGA4DailyMetricsWindow.mock.calls[0][4]).toHaveLength(14);
    expect(stored.filter(r => r.date < recent)).toEqual(old);
    expect(summarizeGA4TrafficRows(stored)).toMatchObject({ sessions: 32, users: 29, conversions: 7 });
    expect(snapshot.campaignBreakdown.totals).toEqual(expected());
    expect(mocks.provider.getAcquisitionBreakdown.mock.lastCall?.[2]).toBe(start);
    expect(mocks.provider.getLandingPagesReport.mock.lastCall?.[2]).toBe(start);
    expect(mocks.provider.getConversionEventsReport.mock.lastCall?.[2]).toBe(start);
    expect(mocks.provider.getConversionEventsReport.mock.lastCall?.[8][start]).toBe(2);
  });

  it.each(["sessions", "conversions", "revenue"])("repairs an older %s correction before publishing", async metric => {
    await prime(); facts[0][metric] += 1;
    expect((await run()).campaignIdsFailed).toEqual([]);
    expect(mocks.provider.getTimeSeriesData.mock.calls.map(args => args[2])).toEqual([recent, start]);
    expect(mocks.storage.replaceGA4DailyMetricsWindow).toHaveBeenCalledTimes(1);
    expect(stored[0][metric]).toBe(facts[0][metric]);
    expect(snapshot.campaignBreakdown.totals).toEqual(expected());
  });

  it("rechecks older user/pageview/engagement changes on the next reporting day", async () => {
    await prime(); facts[0] = { ...facts[0], users: 8, pageviews: 16, engagedSessions: 6, engagementRate: 0.6 };
    expect((await run("2026-10-19T06:00:00Z")).campaignIdsFailed).toEqual([]);
    expect(mocks.provider.getTimeSeriesData.mock.calls.map(args => args[2])).toEqual([start]);
    expect(stored[0]).toEqual(facts[0]);
    expect(stored.at(-1)?.date).toBe("2026-10-18");
  });

  it.each(["gap", "duplicate", "invalid", "invalid date", "extra invalid date", "simulated", "foreign property", "foreign campaign"])("fully repairs %s in stored history", async kind => {
    await prime();
    if (kind === "gap") stored.splice(1, 1);
    if (kind === "duplicate") stored.push({ ...stored[0] });
    if (kind === "invalid") stored[0].sessions = -1;
    if (kind === "invalid date") stored[0].date = "2026-06-31";
    if (kind === "extra invalid date") stored.push({ ...stored[0], date: "2026-06-31" });
    if (kind === "simulated") stored[0].isSimulated = true;
    if (kind === "foreign property") stored[0].propertyId = "999";
    if (kind === "foreign campaign") stored[0].campaignId = "other";
    expect((await run()).campaignIdsFailed).toEqual([]);
    expect(mocks.provider.getTimeSeriesData.mock.calls.map(args => args[2])).toEqual([start]);
    expect(stored[0]).toEqual(facts[0]);
  });

  it.each(["filter", "property", "timezone", "currency", "owner", "connection", "import boundary", "legacy snapshot"])("requires a full check after a changed %s", async field => {
    await prime();
    if (field === "filter") campaign.ga4CampaignFilter = "another-sale";
    if (field === "property") { connection.propertyId = "67890"; facts.forEach(r => r.propertyId = "67890"); }
    if (field === "timezone") campaign.reportingTimeZone = "UTC";
    if (field === "currency") campaign.currency = "USD";
    if (field === "owner") campaign.ownerId = "other-owner";
    if (field === "connection") connection.id = "replacement-connection";
    if (field === "import boundary") connection.importStartDate = "2026-05-01";
    if (field === "legacy snapshot") delete snapshot.campaignBreakdown.meta.dailyHistoryRefresh;
    expect((await run()).campaignIdsFailed).toEqual([]);
    expect(mocks.provider.getTimeSeriesData.mock.calls.map(args => args[2])).toEqual([connection.importStartDate]);
  });

  it("uses the supported fixed boundary for legacy connections", async () => {
    delete connection.importStartDate; facts = facts.filter(r => r.date >= "2026-07-02");
    expect((await run()).campaignIdsFailed).toEqual([]);
    expect(mocks.provider.getTimeSeriesData.mock.calls[0][2]).toBe("2026-07-02");
  });

  it.each(["wrong day", "unknown version", "missing date", "invalid import date"])("does not shorten an unverified history: %s", async kind => {
    await prime();
    if (kind === "wrong day") snapshot.campaignBreakdown.meta.dailyHistoryRefresh.reportingDate = "2026-10-16";
    if (kind === "unknown version") snapshot.campaignBreakdown.meta.dailyHistoryRefresh.version = 0;
    if (kind === "missing date") stored = stored.filter(r => r.date !== recent);
    if (kind === "invalid import date") connection.importStartDate = "2026-02-30";
    const result = await run();
    if (kind === "invalid import date") {
      expect(result.campaignIdsFailed).toEqual([campaign.id]);
      expect(mocks.provider.getTimeSeriesData).not.toHaveBeenCalled();
      expect(mocks.storage.replaceGA4DailyMetricsWindow).not.toHaveBeenCalled();
    } else {
      expect(result.campaignIdsFailed).toEqual([]);
      expect(mocks.provider.getTimeSeriesData.mock.calls.map(args => args[2])).toEqual([start]);
    }
  });

  it("stops an aborted recent refresh before full-history repair or publication", async () => {
    await prime(); const previous = structuredClone({ stored, snapshot });
    const controller = new AbortController();
    mocks.provider.getAcquisitionBreakdown.mockImplementation(async () => {
      controller.abort(new Error("Canceled"));
      return { totals: { ...expected(), sessions: 999 }, meta: { currencyCode: "EUR" } };
    });
    expect((await run(undefined, { signal: controller.signal })).campaignIdsFailed).toEqual([campaign.id]);
    expect(mocks.provider.getTimeSeriesData).toHaveBeenCalledTimes(1);
    expect(mocks.storage.replaceGA4DailyMetricsWindow).not.toHaveBeenCalled();
    expect({ stored, snapshot }).toEqual(previous);
  });

  it("uses the campaign timezone's completed day across midnight", async () => {
    await prime();
    expect((await run("2026-10-18T22:05:00Z")).campaignIdsFailed).toEqual([]);
    expect(mocks.provider.getTimeSeriesData.mock.calls[0][2]).toBe(start);
    expect(mocks.provider.getTimeSeriesData.mock.calls[0][5]).toBe("2026-10-18");
    expect(snapshot.windowEnd).toBe("2026-10-18");
  });

  it("retains the existing lookback for an unfiltered legacy connection", async () => {
    campaign.ga4CampaignFilter = null;
    expect((await run()).campaignIdsFailed).toEqual([]);
    expect(mocks.provider.getTimeSeriesData.mock.calls[0][2]).toBe("2026-07-20");
    expect(mocks.provider.getAcquisitionBreakdown).not.toHaveBeenCalled();
  });

  it.each(["provider", "currency", "mismatch", "events", "publication", "ownership"])("retains the last publication on %s failure", async kind => {
    await prime(); const previous = structuredClone({ stored, snapshot });
    if (kind === "provider") mocks.provider.getTimeSeriesData.mockRejectedValue(new Error("TOKEN_EXPIRED"));
    if (kind === "currency") mocks.provider.getAcquisitionBreakdown.mockResolvedValue({ totals: expected(), meta: { currencyCode: "USD" } });
    if (kind === "mismatch") mocks.provider.getAcquisitionBreakdown.mockImplementation(async () => ({ totals: { ...expected(), sessions: 999 }, meta: { currencyCode: "EUR" } }));
    if (kind === "events") mocks.provider.getConversionEventsReport.mockRejectedValue(new Error("GA4_CONVERSION_EVENT_DAILY_RECONCILIATION_FAILED"));
    if (kind === "publication") mocks.storage.replaceGA4DailyMetricsWindow.mockRejectedValue(new Error("GA4_REFRESH_PUBLICATION_CHANGED"));
    const opts = kind === "ownership" ? { assertWorkOwnership: async () => { throw new Error("GA4_REFRESH_WORK_OWNERSHIP_LOST"); } } : {};
    expect((await run(undefined, opts)).campaignIdsFailed).toEqual([campaign.id]);
    expect({ stored, snapshot }).toEqual(previous);
    expect(mocks.provider.getTimeSeriesData.mock.calls.length).toBe(["mismatch", "events"].includes(kind) ? 2 : 1);
  });

  it("repairs before re-running event attribution against the corrected daily totals", async () => {
    await prime(); facts[0].conversions = 3;
    mocks.provider.getConversionEventsReport.mockImplementation(async (_cid, _storage, _start, _pid, _limit, _filter, _end, _retry, daily) => {
      if (daily[start] !== 3) throw new Error("GA4_CONVERSION_EVENT_DAILY_RECONCILIATION_FAILED");
      return { rows: [], totals: { conversions: expected().conversions } };
    });
    expect((await run()).campaignIdsFailed).toEqual([]);
    expect(mocks.storage.replaceGA4DailyMetricsWindow).toHaveBeenCalledTimes(1);
    expect(snapshot.campaignBreakdown.totals.conversions).toBe(7);
  });

  it("does not shorten a new draft import or an import under fourteen days", async () => {
    campaign.status = "draft"; connection.importStartDate = recent; facts = facts.filter(r => r.date >= recent);
    expect((await run(undefined, { includeTargetDraft: true })).campaignIdsFailed).toEqual([]);
    expect(mocks.provider.getTimeSeriesData.mock.calls[0][2]).toBe(recent);
    expect(stored).toHaveLength(14);
  });

  it("falls back to a full repair when a later full-window report advances", async () => {
    await prime();
    const read = mocks.provider.getTimeSeriesData.getMockImplementation()!;
    mocks.provider.getTimeSeriesData.mockImplementation(async (...args) => {
      const result = await read(...args);
      if (args[2] === recent) facts[2].sessions += 1;
      return result;
    });
    expect((await run()).campaignIdsFailed).toEqual([]);
    expect(mocks.provider.getTimeSeriesData.mock.calls.map(args => args[2])).toEqual([recent, start]);
    expect(summarizeGA4TrafficRows(stored).sessions).toBe(31);
  });
});
