import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const persisted = vi.hoisted(() => ({
  getCampaign: vi.fn(), getCampaigns: vi.fn(), getGA4Connections: vi.fn(), getGA4Connection: vi.fn(),
  getGA4DailyMetrics: vi.fn(), replaceGA4DailyMetricsWindow: vi.fn(),
  getGA4OverviewSnapshot: vi.fn(),
  updateGA4ConnectionTokens: vi.fn(),
  getGA4PublicationVersion: vi.fn(),
}));
vi.mock("./storage", () => ({ storage: persisted }));
vi.mock("./ga4-kpi-benchmark-jobs", () => ({}));
vi.mock("./kpi-scheduler", () => ({}));
vi.mock("./benchmark-notifications", () => ({}));
vi.mock("./utils/financial-daily-snapshot-writer", () => ({}));
vi.mock("./executive-summary-snapshot-scheduler", () => ({}));
vi.mock("./auto-refresh-scheduler", () => ({}));
vi.mock("./scheduler", () => ({}));

import { ga4Service } from "./analytics";
import { refreshAllGA4DailyMetrics } from "./ga4-daily-scheduler";

// Actual daily provider parsing, fallback, presence, breakdown and scheduler code.
// Only HTTP/storage and the unrelated landing-page/event reports are simulated.
describe("GA4 shared daily traffic during provider revisions", () => {
  const campaign = {
    id: "campaign-a", ownerId: "owner-a", clientId: "client-a", status: "active", currency: "EUR",
    reportingTimeZone: "Europe/Amsterdam", ga4CampaignFilter: '["brand","retargeting"]',
  };
  const start = "2026-09-04", end = "2026-10-16";
  const names = ["brand", "retargeting"];
  let requests: any[];
  let revision: number;
  let financialRevision: number;
  let primary: "empty" | "complete" | "partial";
  let malformed: string;
  let currency: string;
  let empty: boolean;
  let purchaseOnly: boolean;
  let utmFinancials: boolean;
  let primaryBreakdown: boolean;
  const connection = () => ({
    id: "connection-a", campaignId: campaign.id, propertyId: "542352127", isActive: true,
    method: "access_token", accessToken: "test-token", importStartDate: start,
  });
  const daily = (name: string, updated: boolean) => name === "brand" ? [
    { date: "20260904", sessions: 1976, totalUsers: 1977, engagedSessions: 1436, screenPageViews: 2500,
      conversions: 208, totalRevenue: 54097.87, sessionKeyEventRate: 0.1 },
    { date: "20261016", sessions: 31 + (updated ? revision : 0), totalUsers: 31 + (updated ? revision : 0),
      engagedSessions: 16 + (updated ? revision : 0), screenPageViews: 47 + (updated ? 2 * revision : 0),
      conversions: 4 + (updated ? financialRevision : 0), totalRevenue: 957.54, sessionKeyEventRate: 0.08 },
  ] : [{ date: "20260904", sessions: 888, totalUsers: 888, engagedSessions: 636, screenPageViews: 1000,
    conversions: 40, totalRevenue: 8057.68, sessionKeyEventRate: 0.04 }];
  beforeEach(() => {
    vi.resetAllMocks(); requests = []; revision = 1; financialRevision = 0; primary = "empty"; malformed = ""; currency = "EUR";
    empty = false; purchaseOnly = false; utmFinancials = true; primaryBreakdown = false;
    vi.stubEnv("GA4_DAILY_LOOKBACK_DAYS", "90");
    persisted.getCampaign.mockResolvedValue(campaign); persisted.getCampaigns.mockResolvedValue([campaign]);
    persisted.getGA4PublicationVersion.mockResolvedValue(null);
    persisted.getGA4Connections.mockImplementation(async () => [connection()]);
    persisted.getGA4Connection.mockImplementation(async () => connection());
    persisted.getGA4DailyMetrics.mockResolvedValue([]);
    persisted.getGA4OverviewSnapshot.mockResolvedValue(undefined);
    persisted.replaceGA4DailyMetricsWindow.mockImplementation(async (_c, _p, _s, _e, rows) => ({ replaced: rows.length }));
    for (const method of ["log", "warn", "error"] as const) vi.spyOn(console, method).mockImplementation(() => undefined);
    vi.spyOn(ga4Service, "getLandingPagesReport").mockResolvedValue({ rows: [], totals: {} } as any);
    vi.spyOn(ga4Service, "getConversionEventsReport").mockResolvedValue({ rows: [], totals: { conversions: 252 } } as any);
    vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
      const body = JSON.parse(init.body); requests.push(body);
      const metrics = body.metrics.map((m: any) => m.name);
      const dimensions = body.dimensions.map((d: any) => d.name);
      const scope = JSON.stringify(body.dimensionFilter);
      const selected = names.filter(name => scope?.includes(name));
      const isDaily = metrics.includes("screenPageViews") && metrics.includes("conversions");
      const isPrimary = scope?.includes("sessionCampaignName");
      const isUtm = scope?.includes("pageLocation");
      const captureRequest = isDaily && isUtm && metrics.includes("sessionKeyEventRate");
      if (purchaseOnly && metrics.includes("totalRevenue")) return { ok: false, text: async () => "Unknown metric totalRevenue" };
      if (captureRequest && malformed === "provider") return { ok: false, text: async () => "Provider unavailable" };
      let rows: any[] = [];
      const legacyFinancials = !utmFinancials && scope?.includes('"campaignName"') && dimensions.length > 1;
      if (!empty && (isUtm || scope?.includes('"campaignName"') && dimensions.length === 1 || legacyFinancials ||
          isPrimary && (primary !== "empty" && isDaily || primaryBreakdown && dimensions.length > 1))) {
        rows = selected.flatMap(name => daily(name, !isDaily)).filter(row => {
          const date = row.date.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");
          return date >= body.dateRanges[0].startDate && date <= body.dateRanges[0].endDate &&
            !(isPrimary && primary === "partial" && row.date === "20261016");
        }).map(row => ({
          dimensionValues: dimensions.map((d: string) => ({ value: d === "date" ? row.date : selected[0] })),
          metricValues: metrics.map((m: string) => ({ value: String(
            legacyFinancials && ["sessions", "totalUsers", "engagedSessions"].includes(m) ? 0 :
              !utmFinancials && isUtm && ["conversions", "totalRevenue", "purchaseRevenue"].includes(m) ? 0 :
              m === "engagementRate" ? row.engagedSessions / row.sessions : (row as any)[m === "purchaseRevenue" ? "totalRevenue" : m] ?? 0,
          ) })),
        }));
      }
      // GA4 returns one row per requested dimension tuple, including one row per
      // date when several selected campaigns share that date.
      if (isDaily && isPrimary && rows.length) {
        const grouped = new Map<string, any>();
        for (const row of rows) {
          const key = row.dimensionValues[0].value;
          const existing = grouped.get(key);
          if (!existing) grouped.set(key, structuredClone(row));
          else for (let i = 0; i < 6; i++) existing.metricValues[i].value = String(Number(existing.metricValues[i].value) + Number(row.metricValues[i].value));
        }
        rows = Array.from(grouped.values());
        for (const row of rows) row.metricValues[6].value = String(Number(row.metricValues[5].value) / Number(row.metricValues[0].value));
      }
      if (captureRequest && malformed === "duplicate" && rows.length) rows.push(structuredClone(rows[0]));
      if (captureRequest && malformed === "date" && rows.length) rows[0].dimensionValues[0].value = "20270101";
      if (captureRequest && malformed === "rate" && rows.length) rows[0].metricValues[7] = { value: "" };
      const result = { rows, rowCount: rows.length + (captureRequest && malformed === "truncated" ? 1 : 0), metadata: { currencyCode: currency } };
      return { ok: true, json: async () => result };
    }));
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  const captureDaily = (capture: any, filter: string | string[] = names) => (ga4Service.getTrendsDailyPresenceWithToken as any)(
    "542352127", "test-token", start, end, filter, "EUR", capture,
  );
  const breakdown = (capture?: any, filter: string | string[] = names) => (ga4Service.getAcquisitionBreakdown as any)(
    campaign.id, persisted, start, "542352127", 10000, filter, end, false, false, "EUR", true, capture,
  );

  it("reproduces the captured one-session disagreement without shared traffic", async () => {
    const result = await captureDaily(undefined);
    expect(result.dailyRows.reduce((n: number, r: any) => n + r.sessions, 0)).toBe(2895);
    expect((await breakdown()).totals.sessions).toBe(2896);
  });

  it("uses the same real per-campaign traffic rows for both views despite a later provider revision", async () => {
    const capture: any = { campaignId: campaign.id };
    const result = await captureDaily(capture);
    const report = await breakdown(capture);
    expect(result.dailyRows.reduce((n: number, r: any) => n + r.sessions, 0)).toBe(2895);
    expect(report.totals).toMatchObject({ sessions: 2895, users: 2896, engagedSessions: 2088, conversions: 252, revenue: 63113.09 });
    expect(report.rows.map((r: any) => [r.campaign, r.sessions])).toEqual([["brand", 2007], ["retargeting", 888]]);
    expect(report.rows[0].sessionKeyEventRate).toBeCloseTo((1976 * 0.1 + 31 * 0.08) / 2007);
    expect(requests.filter(r => r.metrics.some((m: any) => m.name === "screenPageViews") && r.metrics.some((m: any) => m.name === "sessionKeyEventRate"))).toHaveLength(4);
  });

  it("publishes daily facts and matching Overview together through the actual scheduler", async () => {
    const series = vi.spyOn(ga4Service, "getTimeSeriesWithToken");
    const result = await refreshAllGA4DailyMetrics({ campaignId: campaign.id }, new Date("2026-10-17T06:10:00Z"));
    expect(result.campaignIdsFailed).toEqual([]);
    expect(persisted.replaceGA4DailyMetricsWindow).toHaveBeenCalledTimes(1);
    const [id, property, from, to, rows, overview] = persisted.replaceGA4DailyMetricsWindow.mock.calls[0];
    expect([id, property, from, to]).toEqual([campaign.id, "542352127", start, end]);
    expect(rows.reduce((n: number, r: any) => n + r.sessions, 0)).toBe(2895);
    expect(overview.campaignBreakdown.totals.sessions).toBe(2895);
    expect(rows.find((r: any) => r.date === end)).toMatchObject({ sessions: 31, users: 31, engagedSessions: 16, pageviews: 47 });
    expect(rows.find((r: any) => r.date === "2026-09-05").sessions).toBe(0);
    expect(series).toHaveBeenCalledTimes(1);
    expect(series.mock.calls[0]).toEqual(["542352127", "test-token", start, names, end, "EUR", expect.objectContaining({ campaignId: campaign.id })]);
    const dailyRequests = requests.filter(r => r.metrics.some((m: any) => m.name === "screenPageViews") && r.metrics.some((m: any) => m.name === "conversions"));
    expect(dailyRequests).toHaveLength(5); // One primary request and two date chunks for each of two campaigns.
    expect(dailyRequests.filter(r => r.metrics.some((m: any) => m.name === "sessionKeyEventRate"))).toHaveLength(4);
  });

  it("uses the full daily capture if primary attribution becomes available during the later report", async () => {
    const capture: any = { campaignId: campaign.id };
    await captureDaily(capture);
    primaryBreakdown = true;
    const report = await breakdown(capture);
    expect(report.meta.overviewCampaignAttribution).toMatchObject({ standardSessions: 2896, rebuiltSessions: 2895, selected: true });
    expect(report.totals.sessions).toBe(2895);
    expect(report.rows.map((r: any) => [r.campaign, r.sessions])).toEqual([["brand", 2007], ["retargeting", 888]]);
  });

  it.each(["empty primary", "complete primary", "partial primary", "purchaseRevenue", "supplemented", "zero"])(
    "returns the same series, presence and capture as the previous two-fetch sequence: %s", async mode => {
      if (mode === "complete primary") primary = "complete";
      if (mode === "partial primary") primary = "partial";
      purchaseOnly = mode === "purchaseRevenue";
      utmFinancials = mode !== "supplemented";
      empty = mode === "zero";
      const previousCapture: any = { campaignId: campaign.id };
      await ga4Service.getTimeSeriesData(campaign.id, persisted, start, "542352127", names, end, "EUR");
      const previousResult = await captureDaily(previousCapture);
      const dailyRequestCount = () => requests.filter(r => r.metrics.some((m: any) => m.name === "screenPageViews") && r.metrics.some((m: any) => m.name === "conversions")).length;
      const previousDailyRequests = dailyRequestCount();
      requests = [];
      const capture: any = { campaignId: campaign.id };
      const initialSeries = await ga4Service.getTimeSeriesData(campaign.id, persisted, start, "542352127", names, end, "EUR", capture);
      const result = await ga4Service.getTrendsDailyPresenceWithToken("542352127", "test-token", start, end, names, "EUR", capture, initialSeries);
      expect(result).toEqual(previousResult);
      expect(capture).toEqual(previousCapture);
      expect(dailyRequestCount() * 2).toBe(previousDailyRequests);
    },
  );

  it("keeps captured traffic and uses the renewed token for presence after an auth retry", async () => {
    let token = "expired-token";
    persisted.getGA4Connection.mockImplementation(async () => ({ ...connection(), accessToken: token, refreshToken: "refresh-token" }));
    persisted.updateGA4ConnectionTokens.mockImplementation(async (_id, update) => { token = update.accessToken; });
    const refresh = vi.spyOn(ga4Service, "refreshAccessToken").mockResolvedValue({ access_token: "renewed-token", expires_in: 3600 });
    const series = vi.spyOn(ga4Service, "getTimeSeriesWithToken").mockImplementationOnce(async (...args) => {
      args[6]!.captured = { propertyId: "stale", startDate: start, endDate: end, currencyCode: "EUR", campaigns: [] };
      throw new Error("401 UNAUTHENTICATED");
    });
    const result = await refreshAllGA4DailyMetrics({ campaignId: campaign.id }, new Date("2026-10-17T06:10:00Z"));
    expect(result.campaignIdsFailed).toEqual([]);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(series).toHaveBeenCalledTimes(2); // Failed authentication plus one successful series; no presence refetch.
    expect(series.mock.calls.map(args => args[1])).toEqual(["expired-token", "renewed-token"]);
    expect(series.mock.calls[0][6]).toBe(series.mock.calls[1][6]);
    expect(series.mock.calls[1][6]?.captured?.propertyId).toBe("542352127");
    expect(vi.mocked(fetch).mock.calls.every(([, init]) => (init!.headers as any).Authorization === "Bearer renewed-token")).toBe(true);
    expect(persisted.replaceGA4DailyMetricsWindow.mock.calls[0][5].campaignBreakdown.totals.sessions).toBe(2895);
  });

  it("preserves the hydrated service-account path with one daily-series fetch", async () => {
    persisted.getGA4Connections.mockResolvedValue([{ ...connection(), method: "service_account" }]);
    persisted.getGA4Connection.mockResolvedValue({ ...connection(), method: "service_account" });
    const series = vi.spyOn(ga4Service, "getTimeSeriesWithToken");
    const result = await refreshAllGA4DailyMetrics({ campaignId: campaign.id }, new Date("2026-10-17T06:10:00Z"));
    expect(result.campaignIdsFailed).toEqual([]);
    expect(series).toHaveBeenCalledTimes(1);
    expect(persisted.replaceGA4DailyMetricsWindow.mock.calls[0][5].campaignBreakdown.totals.sessions).toBe(2895);
  });

  it.each([
    { concurrent: false, sharedProperty: false },
    { concurrent: true, sharedProperty: false },
    { concurrent: true, sharedProperty: true },
  ])("keeps daily rows, credentials and filters isolated (concurrent=$concurrent, sharedProperty=$sharedProperty)", async ({ concurrent, sharedProperty }) => {
    const campaigns = [
      { ...campaign, ga4CampaignFilter: '["brand"]' },
      { ...campaign, id: "campaign-b", ownerId: "owner-b", clientId: "client-b", ga4CampaignFilter: '["retargeting"]' },
    ];
    const connections = campaigns.map((c, i) => ({ ...connection(), id: `connection-${i}`, campaignId: c.id,
      propertyId: String(542352127 + (sharedProperty ? 0 : i)), accessToken: `token-${c.id}` }));
    persisted.getCampaign.mockImplementation(async id => campaigns.find(c => c.id === id));
    persisted.getCampaigns.mockResolvedValue(campaigns);
    persisted.getGA4Connections.mockImplementation(async id => connections.filter(c => c.campaignId === id));
    persisted.getGA4Connection.mockImplementation(async (id, propertyId) => connections.find(c => c.campaignId === id && c.propertyId === propertyId));
    vi.mocked(ga4Service.getConversionEventsReport).mockImplementation(async id => {
      const conversions = id === campaign.id ? 212 : 40;
      return { rows: [{ eventName: "purchase", conversions }], totals: { conversions } } as any;
    });
    const series = vi.spyOn(ga4Service, "getTimeSeriesWithToken");
    const presence = vi.spyOn(ga4Service, "getTrendsDailyPresenceWithToken");
    const provider = vi.mocked(fetch).getMockImplementation()!;
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    vi.mocked(fetch).mockImplementation(async (url, init) => {
      const token = (init!.headers as any).Authorization;
      const i = connections.findIndex(c => token === `Bearer ${c.accessToken}`);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(String(url)).toContain(connections[i].propertyId);
      expect(JSON.stringify(JSON.parse(init!.body as string).dimensionFilter)).toContain(names[i]);
      if (concurrent && i === 0) await pending;
      return provider(url, init);
    });
    const now = new Date("2026-10-17T06:10:00Z");
    if (concurrent) {
      const first = refreshAllGA4DailyMetrics({ campaignId: campaigns[0].id }, now);
      try {
        const second = await refreshAllGA4DailyMetrics({ campaignId: campaigns[1].id }, now);
        expect(second.campaignIdsFailed).toEqual([]);
        expect(persisted.replaceGA4DailyMetricsWindow.mock.calls.map(args => args[0])).toEqual([campaigns[1].id]);
      } finally { release(); }
      expect((await first).campaignIdsFailed).toEqual([]);
    } else expect((await refreshAllGA4DailyMetrics({}, now)).campaignIdsFailed).toEqual([]);
    expect(series).toHaveBeenCalledTimes(2);
    expect(persisted.replaceGA4DailyMetricsWindow).toHaveBeenCalledTimes(2);
    for (const call of persisted.replaceGA4DailyMetricsWindow.mock.calls) {
      const [id, property, from, to, rows, overview] = call;
      const i = campaigns.findIndex(c => c.id === id);
      expect([id, property, from, to]).toEqual([campaigns[i].id, connections[i].propertyId, start, end]);
      expect(rows.every((r: any) => r.campaignId === id && r.propertyId === property)).toBe(true);
      expect(rows.reduce((n: number, r: any) => n + r.sessions, 0)).toBe(i === 0 ? 2007 : 888);
      expect(overview.campaignBreakdown.rows.map((r: any) => r.campaign)).toEqual([names[i]]);
      const presenceCall = presence.mock.calls.find(args => args[1] === connections[i].accessToken)!;
      const seriesIndex = series.mock.calls.findIndex(args => args[1] === connections[i].accessToken);
      expect(presenceCall[7]).toBe(await series.mock.results[seriesIndex].value);
    }
    expect(presence.mock.calls[0][7]).not.toBe(presence.mock.calls[1][7]);
  });

  it("fetches new values on the next attempt instead of caching the first attempt", async () => {
    const series = vi.spyOn(ga4Service, "getTimeSeriesWithToken");
    await refreshAllGA4DailyMetrics({ campaignId: campaign.id }, new Date("2026-10-17T06:10:00Z"));
    empty = true;
    vi.mocked(ga4Service.getConversionEventsReport).mockResolvedValue({ rows: [], totals: { conversions: 0 } } as any);
    const result = await refreshAllGA4DailyMetrics({ campaignId: campaign.id }, new Date("2026-10-17T12:10:00Z"));
    expect(result.campaignIdsFailed).toEqual([]);
    expect(series).toHaveBeenCalledTimes(2);
    expect(persisted.replaceGA4DailyMetricsWindow.mock.calls[0][5].campaignBreakdown.totals.sessions).toBe(2895);
    expect(persisted.replaceGA4DailyMetricsWindow.mock.calls[1][5].campaignBreakdown.totals.sessions).toBe(0);
    expect(persisted.replaceGA4DailyMetricsWindow.mock.calls[1][4].every((row: any) => row.sessions === 0)).toBe(true);
  });

  it.each([false, true])("reduces repeated daily requests with identical published values (purchaseRevenue=%s)", async purchase => {
    revision = 0; purchaseOnly = purchase;
    let savedRows: any[] = [], savedOverview: any;
    persisted.getGA4DailyMetrics.mockImplementation(async () => structuredClone(savedRows));
    persisted.getGA4OverviewSnapshot.mockImplementation(async () => structuredClone(savedOverview));
    persisted.replaceGA4DailyMetricsWindow.mockImplementation(async (_cid, _pid, from, to, rows, overview) => {
      savedRows = [...savedRows.filter(r => r.date < from || r.date > to), ...structuredClone(rows)];
      savedOverview = structuredClone(overview);
      return { replaced: rows.length };
    });
    expect((await refreshAllGA4DailyMetrics({ campaignId: campaign.id }, new Date("2026-10-17T06:10:00Z"))).campaignIdsFailed).toEqual([]);
    const baseline = { rows: structuredClone(savedRows), breakdown: structuredClone(savedOverview.campaignBreakdown) };
    const fullRequests = requests.length;
    requests = [];
    expect((await refreshAllGA4DailyMetrics({ campaignId: campaign.id }, new Date("2026-10-17T12:10:00Z"))).campaignIdsFailed).toEqual([]);
    expect(savedRows).toEqual(baseline.rows);
    expect(savedOverview.campaignBreakdown).toEqual(baseline.breakdown);
    expect(persisted.replaceGA4DailyMetricsWindow.mock.lastCall?.[4]).toHaveLength(14);
    expect(fullRequests - requests.length).toBe(purchase ? 4 : 2);
    expect(requests.filter(r => r.metrics.some((m: any) => m.name === "screenPageViews") && r.metrics.some((m: any) => m.name === "conversions")))
      .toHaveLength(purchase ? 6 : 3);
    vi.stubEnv("GA4_INCREMENTAL_REFRESH_ENABLED", "false"); requests = [];
    expect((await refreshAllGA4DailyMetrics({ campaignId: campaign.id }, new Date("2026-10-17T18:10:00Z"))).campaignIdsFailed).toEqual([]);
    expect(savedRows).toEqual(baseline.rows);
    expect(requests).toHaveLength(fullRequests);
  });

  it("rejects new presence-only activity rather than filling the missing date with zero", async () => {
    const provider = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (...args) => {
      const response = await provider(...args);
      const body = JSON.parse(args[1]!.body as string);
      if (body.dimensions.length === 1 && body.dimensions[0].name === "date" && body.metrics.length === 3) {
        return { ok: true, json: async () => ({ metadata: { currencyCode: "EUR" }, rows: [{ dimensionValues: [{ value: "20260905" }] }] }) } as any;
      }
      return response;
    });
    const series = vi.spyOn(ga4Service, "getTimeSeriesWithToken");
    const result = await refreshAllGA4DailyMetrics({ campaignId: campaign.id }, new Date("2026-10-17T06:10:00Z"));
    expect(series).toHaveBeenCalledTimes(1);
    expect(result.campaignIdsFailed).toEqual([campaign.id]);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining(`Refresh failed for campaign ${campaign.id}`), "GA4 reported activity for a date without a complete daily metric row");
    expect(persisted.replaceGA4DailyMetricsWindow).not.toHaveBeenCalled();
  });

  it("continues rejecting genuinely different financial values", async () => {
    financialRevision = 1;
    const result = await refreshAllGA4DailyMetrics({ campaignId: campaign.id }, new Date("2026-10-17T06:10:00Z"));
    expect(result.campaignIdsFailed).toEqual([campaign.id]);
    expect(persisted.replaceGA4DailyMetricsWindow).not.toHaveBeenCalled();
  });

  it.each(["duplicate", "date", "rate", "truncated", "provider"])("rejects an incomplete or invalid captured report: %s", async issue => {
    malformed = issue; revision = 0;
    const result = await refreshAllGA4DailyMetrics({ campaignId: campaign.id }, new Date("2026-10-17T06:10:00Z"));
    expect(result.campaignIdsFailed).toEqual([campaign.id]);
    expect(result.failureReasonsByCampaign[campaign.id][0]).toContain("daily_series:");
    expect(persisted.replaceGA4DailyMetricsWindow).not.toHaveBeenCalled();
  });

  it.each(["campaign", "property", "start", "end", "currency", "filter"])("rejects a capture belonging to another %s", async boundary => {
    const capture: any = { campaignId: campaign.id };
    await captureDaily(capture);
    if (boundary === "campaign") capture.campaignId = "other-campaign";
    if (boundary === "property") capture.captured.propertyId = "111111111";
    if (boundary === "start") capture.captured.startDate = "2026-09-05";
    if (boundary === "end") capture.captured.endDate = "2026-10-15";
    if (boundary === "currency") capture.captured.currencyCode = "USD";
    if (boundary === "filter") capture.captured.campaigns[0].name = "other-campaign-value";
    const requestCount = requests.length;
    await expect(breakdown(capture)).rejects.toThrow("GA4_DAILY_TRAFFIC_SCOPE_MISMATCH");
    expect(requests).toHaveLength(requestCount);
  });

  it("keeps separate captures isolated and replaces stale capture state on reuse", async () => {
    const one: any = { campaignId: campaign.id }, two: any = { campaignId: campaign.id };
    await captureDaily(one, "brand"); await captureDaily(two, "retargeting");
    expect((await breakdown(one, "brand")).totals.sessions).toBe(2007);
    expect((await breakdown(two, "retargeting")).totals.sessions).toBe(888);
    primary = "complete";
    await captureDaily(one, "brand");
    expect(one.captured).toBeUndefined();
    expect(two.captured.campaigns[0].name).toBe("retargeting");
  });

  it("repairs missing historical days instead of comparing a short window with cumulative Overview", async () => {
    vi.stubEnv("GA4_DAILY_LOOKBACK_DAYS", "30");
    const result = await refreshAllGA4DailyMetrics({ campaignId: campaign.id }, new Date("2026-10-17T06:10:00Z"));
    expect(result.campaignIdsFailed).toEqual([]);
    expect(persisted.replaceGA4DailyMetricsWindow.mock.lastCall?.[2]).toBe(start);
    expect(persisted.replaceGA4DailyMetricsWindow.mock.lastCall?.[5].campaignBreakdown.totals.sessions).toBe(2895);
    expect(requests.some(r => r.metrics.some((m: any) => m.name === "screenPageViews") && r.metrics.some((m: any) => m.name === "sessionKeyEventRate"))).toBe(true);
  });

  it("preserves the existing purchaseRevenue fallback with shared traffic", async () => {
    purchaseOnly = true;
    const capture: any = { campaignId: campaign.id };
    const result = await captureDaily(capture);
    const report = await breakdown(capture);
    expect(result.dailyRows.every((r: any) => r.revenueMetric === "purchaseRevenue")).toBe(true);
    expect(report.meta.revenueMetric).toBe("purchaseRevenue");
    expect(report.totals).toMatchObject({ sessions: 2895, conversions: 252, revenue: 63113.09 });
  });

  it("preserves campaignName financial supplementation when UTM financials are zero", async () => {
    utmFinancials = false;
    const capture: any = { campaignId: campaign.id };
    const result = await captureDaily(capture);
    const report = await breakdown(capture);
    expect(result.dailyRows.reduce((n: number, r: any) => n + r.sessions, 0)).toBe(2895);
    expect(report.totals).toMatchObject({ sessions: 2895, conversions: 252, revenue: 63113.09 });
  });

  it("publishes verified empty traffic as zero without inventing campaign rows", async () => {
    empty = true;
    vi.mocked(ga4Service.getConversionEventsReport).mockResolvedValue({ rows: [], totals: { conversions: 0 } } as any);
    const result = await refreshAllGA4DailyMetrics({ campaignId: campaign.id }, new Date("2026-10-17T06:10:00Z"));
    expect(result.campaignIdsFailed).toEqual([]);
    const [, , , , rows, overview] = persisted.replaceGA4DailyMetricsWindow.mock.calls[0];
    expect(rows.every((r: any) => r.sessions === 0 && r.conversions === 0 && Number(r.revenue) === 0)).toBe(true);
    expect(overview.campaignBreakdown.rows).toEqual([]);
    expect(overview.campaignBreakdown.totals.sessions).toBe(0);
    expect(overview.campaignBreakdown.totals.revenue).toBe(0);
    expect(overview.campaignBreakdown.meta.revenueMetric).toBe("totalRevenue");
  });

  it("does not bypass provider currency verification", async () => {
    currency = "USD";
    await expect(captureDaily({ campaignId: campaign.id })).rejects.toThrow("does not match requested currency EUR");
  });

  it.each(["complete", "partial"] as const)("does not reuse UTM-only traffic when primary daily coverage is %s", async mode => {
    primary = mode;
    const capture: any = { campaignId: campaign.id };
    await captureDaily(capture);
    expect(capture.captured).toBeUndefined();
    expect((await breakdown(capture)).totals.sessions).toBe(2896);
  });

  it.each(["complete", "partial"] as const)("retains the last publication when the %s primary branch advances independently", async mode => {
    primary = mode; primaryBreakdown = true;
    const result = await refreshAllGA4DailyMetrics({ campaignId: campaign.id }, new Date("2026-10-17T06:10:00Z"));
    expect(result.campaignIdsFailed).toEqual([campaign.id]);
    expect(result.failureReasonsByCampaign[campaign.id][0]).toContain("breakdown_sessions");
    expect(persisted.replaceGA4DailyMetricsWindow).not.toHaveBeenCalled();
  });

  it.each(["complete", "partial"] as const)("publishes the %s primary branch when exact reports agree", async mode => {
    primary = mode; primaryBreakdown = true; revision = 0;
    const result = await refreshAllGA4DailyMetrics({ campaignId: campaign.id }, new Date("2026-10-17T06:10:00Z"));
    expect(result.campaignIdsFailed).toEqual([]);
    const [, , , , rows, saved] = persisted.replaceGA4DailyMetricsWindow.mock.calls[0];
    expect(rows.reduce((sum: number, row: any) => sum + row.sessions, 0)).toBe(saved.campaignBreakdown.totals.sessions);
  });

  it("combines retained older days with the recent refresh only when full-window totals reconcile", async () => {
    vi.stubEnv("GA4_DAILY_LOOKBACK_DAYS", "30"); revision = 0;
    persisted.getGA4DailyMetrics.mockResolvedValue([{ date: start, sessions: 2864, conversions: 248, revenue: 62155.55 }]);
    const result = await refreshAllGA4DailyMetrics({ campaignId: campaign.id }, new Date("2026-10-17T06:10:00Z"));
    expect(result.campaignIdsFailed).toEqual([]);
    expect(persisted.replaceGA4DailyMetricsWindow.mock.calls[0][5].campaignBreakdown.totals.sessions).toBe(2895);
  });

  it("preserves the legacy unfiltered daily path without substituting a campaign-scoped Overview", async () => {
    persisted.getCampaign.mockResolvedValue({ ...campaign, ga4CampaignFilter: "" });
    const result = await refreshAllGA4DailyMetrics({ campaignId: campaign.id }, new Date("2026-10-17T06:10:00Z"));
    expect(result.campaignIdsFailed).toEqual([]);
    expect(persisted.getGA4OverviewSnapshot).not.toHaveBeenCalled();
    expect(persisted.replaceGA4DailyMetricsWindow.mock.calls[0][5]).toBeUndefined();
  });

  it("keeps a single campaign's native session key-event rate and counts", async () => {
    const capture: any = { campaignId: campaign.id };
    const result = await captureDaily(capture, "brand");
    const report = await breakdown(capture, "brand");
    expect(result.dailyRows.reduce((n: number, r: any) => n + r.sessions, 0)).toBe(2007);
    expect(report.totals.sessions).toBe(2007);
    expect(report.rows).toHaveLength(1);
  });
});
