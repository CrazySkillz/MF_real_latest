import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const storageMock = vi.hoisted(() => ({
  getCampaign: vi.fn(),
  getGA4Connections: vi.fn(),
  getGA4Connection: vi.fn(),
  getGA4DailyMetrics: vi.fn(),
  getRevenueTotalForRange: vi.fn(),
  getSpendTotalForRange: vi.fn(),
  updateGA4ConnectionTokens: vi.fn(),
}));
const ga4ServiceMock = vi.hoisted(() => ({
  getTotalsWithRevenue: vi.fn(),
  getAcquisitionBreakdown: vi.fn(),
  refreshAccessToken: vi.fn(),
}));

vi.mock("./storage", () => ({ storage: storageMock }));
vi.mock("./analytics", () => ({ ga4Service: ga4ServiceMock }));

import { isAlertDecisionBreached } from "./utils/alert-decision";
import { resolveAlertCurrentValueForDecision } from "./utils/ga4-alert-current-value";

const campaign = {
  id: "campaign-alert-contract",
  createdAt: "2026-07-01T00:00:00.000Z",
  startDate: "2026-07-01T00:00:00.000Z",
  reportingTimeZone: "UTC",
  ga4CampaignFilter: "scoped_campaign",
};
const connection = {
  id: "ga4-alert-contract",
  campaignId: campaign.id,
  propertyId: "properties/123",
  method: "stored",
  isPrimary: true,
  lookbackDays: 30,
  importStartDate: "2026-07-01",
};
const sourceRow = {
  date: "2026-07-31",
  users: 0,
  sessions: 0,
  pageviews: 0,
  conversions: 0,
  revenue: "0",
  engagedSessions: 0,
  engagementRate: 0,
};
const row = (metric: string) => ({
  id: `kpi-${metric}`,
  campaignId: campaign.id,
  platformType: "google_analytics",
  metric,
  name: metric,
  currentValue: "99",
  alertThreshold: "100",
  alertCondition: "below",
  alertsEnabled: true,
});

describe("GA4 KPI Commit 6 alert/notification contract", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-01T12:00:00.000Z"));
    for (const mock of Object.values(storageMock)) mock.mockReset();
    for (const mock of Object.values(ga4ServiceMock)) mock.mockReset();
    storageMock.getCampaign.mockResolvedValue(campaign);
    storageMock.getGA4Connections.mockResolvedValue([connection]);
    storageMock.getGA4Connection.mockResolvedValue(connection);
    storageMock.getGA4DailyMetrics.mockResolvedValue([sourceRow]);
    storageMock.getRevenueTotalForRange.mockResolvedValue({ totalRevenue: 0, sourceIds: [] });
    storageMock.getSpendTotalForRange.mockResolvedValue({ totalSpend: 100, sourceIds: ["spend-source"] });
    ga4ServiceMock.getAcquisitionBreakdown.mockRejectedValue(new Error("unavailable"));
  });
  afterEach(() => vi.useRealTimers());

  it.each(["roas", "revenue"])("overlaps independent source reads for %s without returning before they finish", async (metric) => {
    const delayed = (value: any, ms: number) => new Promise((resolve) => setTimeout(() => resolve(value), ms));
    storageMock.getCampaign.mockImplementation(() => delayed(campaign, 100));
    storageMock.getGA4Connections.mockImplementation(() => delayed([connection], 100));
    storageMock.getGA4DailyMetrics.mockImplementation(() => delayed([sourceRow], 100));
    storageMock.getGA4Connection.mockImplementation(() => delayed(connection, 100));
    storageMock.getRevenueTotalForRange.mockImplementation(() => delayed({ totalRevenue: 0, sourceIds: [] }, 300));
    storageMock.getSpendTotalForRange.mockImplementation(() => delayed({ totalSpend: 100, sourceIds: ["spend-source"] }, 300));
    let completed = false;
    const pending = resolveAlertCurrentValueForDecision(row(metric)).then((result) => { completed = true; return result; });
    await vi.advanceTimersByTimeAsync(100);
    expect(storageMock.getGA4DailyMetrics).toHaveBeenCalledTimes(1);
    expect(storageMock.getGA4Connection).toHaveBeenCalledTimes(1);
    expect(storageMock.getRevenueTotalForRange).toHaveBeenCalledTimes(1);
    expect(storageMock.getSpendTotalForRange).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(299);
    expect(completed).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(completed).toBe(true);
    expect(await pending).toMatchObject({ currentValue: "0", __alertDecisionEligible: true });
  });

  it("handles an early financial-read rejection while daily facts are still pending", async () => {
    storageMock.getGA4DailyMetrics.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve([sourceRow]), 100)));
    storageMock.getRevenueTotalForRange.mockRejectedValue(new Error("source read failed"));
    const pending = resolveAlertCurrentValueForDecision(row("revenue"));
    await vi.advanceTimersByTimeAsync(100);
    expect(await pending).toMatchObject({ currentValue: "99", __alertDecisionEligible: false, __alertDecisionReason: "unavailable" });
    expect(storageMock.updateGA4ConnectionTokens).not.toHaveBeenCalled();
  });

  it.each(["campaign", "connection"])("does not start source reads when %s scope is unavailable", async (missing) => {
    if (missing === "campaign") storageMock.getCampaign.mockResolvedValue(undefined);
    else storageMock.getGA4Connections.mockRejectedValue(new Error("connection unavailable"));
    expect(await resolveAlertCurrentValueForDecision(row("revenue"))).toMatchObject({ __alertDecisionEligible: false, __alertDecisionReason: "unavailable" });
    expect(storageMock.getGA4DailyMetrics).not.toHaveBeenCalled();
    expect(storageMock.getRevenueTotalForRange).not.toHaveBeenCalled();
    expect(storageMock.getSpendTotalForRange).not.toHaveBeenCalled();
    expect(ga4ServiceMock.getTotalsWithRevenue).not.toHaveBeenCalled();
  });

  const enableProvider = () => {
    const oauth = { ...connection, method: "access_token", accessToken: "access-token" };
    storageMock.getGA4Connections.mockResolvedValue([oauth]);
    storageMock.getGA4Connection.mockResolvedValue(oauth);
    ga4ServiceMock.getTotalsWithRevenue.mockResolvedValue({
      totals: { users: 100, sessions: 200, pageviews: 300, conversions: 10, revenue: 1000 },
    });
    return oauth;
  };

  it.each([
    ["sessions", "20"], ["Total Sessions", "20"], ["users", "12"], ["totalUsers", "12"],
    ["pageviews", "40"], ["conversions", "5"], ["totalConversions", "5"],
    ["conversionRate", "25"], ["engagement_rate", "50"],
  ])("does not wait for unused financial reads for %s", async (metric, expected) => {
    storageMock.getGA4DailyMetrics.mockResolvedValue([{ ...sourceRow, sessions: 20, users: 12,
      pageviews: 40, conversions: 5, engagedSessions: 10, engagementRate: 0.5 }]);
    storageMock.getRevenueTotalForRange.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve({ totalRevenue: 1000, sourceIds: [] }), 1000)));
    storageMock.getGA4Connection.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve(connection), 1000)));
    let result: any;
    const pending = resolveAlertCurrentValueForDecision(row(metric)).then((value) => { result = value; });
    await vi.advanceTimersByTimeAsync(1);
    expect(result).toMatchObject({ currentValue: expected, __alertDecisionEligible: true });
    await pending;
    expect(storageMock.getRevenueTotalForRange).not.toHaveBeenCalled();
    expect(storageMock.getGA4Connection).not.toHaveBeenCalled();
    expect(ga4ServiceMock.getTotalsWithRevenue).not.toHaveBeenCalled();
  });

  it.each(["CPA", "ROAS", "ROI", "Cost Per Acquisition"])("preserves legacy spend sufficiency for a traffic rule named %s", async (name) => {
    storageMock.getGA4DailyMetrics.mockResolvedValue([{ ...sourceRow, sessions: 20, conversions: 5 }]);
    const trafficRule = { ...row("sessions"), name };
    expect(await resolveAlertCurrentValueForDecision(trafficRule)).toMatchObject({ currentValue: "20", __alertDecisionEligible: true });
    storageMock.getSpendTotalForRange.mockResolvedValue({ totalSpend: 0, sourceIds: [] });
    expect(await resolveAlertCurrentValueForDecision(trafficRule)).toMatchObject({ currentValue: "20", __alertDecisionEligible: false, __alertDecisionReason: "insufficient_spend" });
    expect(storageMock.getSpendTotalForRange).toHaveBeenCalledTimes(2);
  });

  it("shares one native provider read across financial rules in one check without sharing rule state", async () => {
    enableProvider();
    const cache = new Map<string, Promise<any>>();
    const metrics = ["revenue", "roas", "roi", "cpa"];
    const results = [];
    for (const metric of metrics) results.push(await resolveAlertCurrentValueForDecision(row(metric), cache));
    expect(ga4ServiceMock.getTotalsWithRevenue).toHaveBeenCalledTimes(1);
    expect(results.map((result) => result.currentValue)).toEqual(["1000", "10", "900", "10"]);
    expect(results.map((result) => result.id)).toEqual(metrics.map((metric) => `kpi-${metric}`));
    expect(results.every((result) => result.__alertDecisionEligible === true)).toBe(true);
    const differentThreshold = await resolveAlertCurrentValueForDecision({ ...row("revenue"), id: "benchmark", alertThreshold: "2000" }, cache);
    expect(isAlertDecisionBreached(results[0])).toBe(false);
    expect(isAlertDecisionBreached(differentThreshold)).toBe(true);
    expect(ga4ServiceMock.getTotalsWithRevenue).toHaveBeenCalledTimes(1);
  });

  it("shares an in-flight read but still waits for authoritative provider completion", async () => {
    enableProvider();
    const cache = new Map<string, Promise<any>>();
    ga4ServiceMock.getTotalsWithRevenue.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return { totals: { revenue: 1000, conversions: 10 } };
    });
    let completed = false;
    const pending = Promise.all(["revenue", "roas", "roi", "cpa"].map((metric) =>
      resolveAlertCurrentValueForDecision(row(metric), cache))).then(() => { completed = true; });
    await vi.advanceTimersByTimeAsync(999);
    expect(completed).toBe(false);
    expect(ga4ServiceMock.getTotalsWithRevenue).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(completed).toBe(true);
  });

  it("removes repeated provider wait time from a sequential four-rule check", async () => {
    enableProvider();
    ga4ServiceMock.getTotalsWithRevenue.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return { totals: { revenue: 1000, conversions: 10 } };
    });
    const run = async (cache?: Map<string, Promise<any>>) => {
      const started = Date.now();
      for (const metric of ["revenue", "roas", "roi", "cpa"]) await resolveAlertCurrentValueForDecision(row(metric), cache);
      return Date.now() - started;
    };
    const uncached = run();
    await vi.runAllTimersAsync();
    expect(await uncached).toBe(4000);
    const cached = run(new Map());
    await vi.runAllTimersAsync();
    expect(await cached).toBe(1000);
  });

  it.each([0, -10])("retains valid native %s and reloads changed imported sources on the next check", async (nativeRevenue) => {
    enableProvider();
    ga4ServiceMock.getTotalsWithRevenue.mockResolvedValue({ totals: { revenue: nativeRevenue, conversions: 10 } });
    const cache = new Map<string, Promise<any>>();
    const first = await resolveAlertCurrentValueForDecision(row("revenue"), cache);
    storageMock.getRevenueTotalForRange.mockResolvedValue({ totalRevenue: 50, sourceIds: ["imported"] });
    const sameCheck = await resolveAlertCurrentValueForDecision(row("revenue"), cache);
    expect(sameCheck.currentValue).toBe(String(nativeRevenue));
    const second = await resolveAlertCurrentValueForDecision(row("revenue"), new Map());
    expect(first.currentValue).toBe(String(nativeRevenue));
    expect(second.currentValue).toBe(String(nativeRevenue + 50));
    expect(ga4ServiceMock.getTotalsWithRevenue).toHaveBeenCalledTimes(2);
    expect(storageMock.getRevenueTotalForRange).toHaveBeenCalledTimes(2);
  });

  it("does not reuse native reads across checks or calls without an explicit cache", async () => {
    enableProvider();
    await resolveAlertCurrentValueForDecision(row("revenue"), new Map());
    await resolveAlertCurrentValueForDecision(row("revenue"), new Map());
    await resolveAlertCurrentValueForDecision(row("revenue"));
    await resolveAlertCurrentValueForDecision(row("revenue"));
    expect(ga4ServiceMock.getTotalsWithRevenue).toHaveBeenCalledTimes(4);
    expect(storageMock.getGA4DailyMetrics).toHaveBeenCalledTimes(4);
    expect(storageMock.getRevenueTotalForRange).toHaveBeenCalledTimes(4);
    expect(storageMock.getSpendTotalForRange).toHaveBeenCalledTimes(4);
  });

  it("shares stored inputs across KPI/Benchmark metrics and aliases without sharing decisions", async () => {
    enableProvider();
    const metrics = ["revenue", "Total Revenue", "roas", "roi", "cpa", "sessions"];
    const uncached = [];
    for (const metric of metrics) uncached.push(await resolveAlertCurrentValueForDecision(row(metric)));
    for (const mock of Object.values(storageMock)) mock.mockClear();
    const cache = new Map<string, Promise<any>>();
    const cached = [];
    for (const metric of metrics) cached.push(await resolveAlertCurrentValueForDecision(row(metric), cache));
    expect(cached).toEqual(uncached);
    expect(storageMock.getGA4DailyMetrics).toHaveBeenCalledTimes(1);
    expect(storageMock.getRevenueTotalForRange).toHaveBeenCalledTimes(1);
    expect(storageMock.getSpendTotalForRange).toHaveBeenCalledTimes(1);
    expect(storageMock.getCampaign).toHaveBeenCalledTimes(metrics.length);
    expect(storageMock.getGA4Connections).toHaveBeenCalledTimes(metrics.length);
  });

  it("shares in-flight stored reads while waiting for their completion", async () => {
    storageMock.getSpendTotalForRange.mockImplementation(() => new Promise(resolve =>
      setTimeout(() => resolve({ totalSpend: 100, sourceIds: ["spend-source"] }), 1000)));
    const cache = new Map<string, Promise<any>>();
    let completed = false;
    const pending = Promise.all(["sessions", "conversions"].map(metric =>
      resolveAlertCurrentValueForDecision(row(metric), cache))).then(result => { completed = true; return result; });
    await vi.advanceTimersByTimeAsync(999);
    expect(completed).toBe(false);
    expect(storageMock.getSpendTotalForRange).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect((await pending).every(result => result.__alertDecisionEligible)).toBe(true);
  });

  it("removes repeated stored-source wait time from a sequential financial check", async () => {
    storageMock.getSpendTotalForRange.mockImplementation(() => new Promise(resolve =>
      setTimeout(() => resolve({ totalSpend: 100, sourceIds: ["spend-source"] }), 300)));
    const run = async (cache?: Map<string, Promise<any>>) => {
      const start = Date.now();
      for (const metric of ["revenue", "roas", "roi", "cpa"]) await resolveAlertCurrentValueForDecision(row(metric), cache);
      return Date.now() - start;
    };
    const uncached = run();
    await vi.runAllTimersAsync();
    expect(await uncached).toBe(1200);
    const cached = run(new Map());
    await vi.runAllTimersAsync();
    expect(await cached).toBe(300);
  });

  it("does not use cached sources after the campaign disappears", async () => {
    const cache = new Map<string, Promise<any>>();
    await resolveAlertCurrentValueForDecision(row("roi"), cache);
    storageMock.getCampaign.mockResolvedValue(undefined);
    expect(await resolveAlertCurrentValueForDecision(row("roi"), cache)).toMatchObject({
      __alertDecisionEligible: false, __alertDecisionReason: "unavailable",
    });
  });

  it.each(["getGA4DailyMetrics", "getRevenueTotalForRange", "getSpendTotalForRange"] as const)(
    "retries rejected %s reads within the same check", async (method) => {
      const cache = new Map<string, Promise<any>>();
      storageMock[method].mockRejectedValueOnce(new Error("temporary failure"));
      const first = await resolveAlertCurrentValueForDecision(row("roi"), cache);
      expect(first.__alertDecisionEligible).toBe(false);
      const second = await resolveAlertCurrentValueForDecision(row("roi"), cache);
      expect(second.__alertDecisionEligible).toBe(true);
      expect(storageMock[method]).toHaveBeenCalledTimes(2);
    });

  it.each(["daily", "revenue", "spend"])("does not retain unusable %s reads", async (kind) => {
    const cache = new Map<string, Promise<any>>();
    const method = kind === "daily" ? storageMock.getGA4DailyMetrics
      : kind === "revenue" ? storageMock.getRevenueTotalForRange : storageMock.getSpendTotalForRange;
    method.mockResolvedValueOnce(kind === "daily" ? [] : { totalRevenue: "invalid", totalSpend: "invalid", sourceIds: [] });
    await resolveAlertCurrentValueForDecision(row("roi"), cache);
    expect((await resolveAlertCurrentValueForDecision(row("roi"), cache)).__alertDecisionEligible).toBe(true);
    expect(method).toHaveBeenCalledTimes(2);
  });

  it.each(["campaign", "property", "filter", "currency", "timezone", "end"])("isolates stored inputs for changed %s", async (changed) => {
    const cache = new Map<string, Promise<any>>();
    await resolveAlertCurrentValueForDecision(row("roi"), cache);
    const next = row("roi");
    if (changed === "campaign") {
      next.campaignId = "another-owner-campaign";
      storageMock.getCampaign.mockResolvedValue({ ...campaign, id: next.campaignId, ownerId: "another-owner" });
    }
    if (changed === "property") storageMock.getGA4Connections.mockResolvedValue([{ ...connection, propertyId: "456" }]);
    if (changed === "filter") storageMock.getCampaign.mockResolvedValue({ ...campaign, ga4CampaignFilter: "another" });
    if (changed === "currency") storageMock.getCampaign.mockResolvedValue({ ...campaign, currency: "EUR" });
    if (changed === "timezone") storageMock.getCampaign.mockResolvedValue({ ...campaign, reportingTimeZone: "Europe/Amsterdam" });
    if (changed === "end") vi.setSystemTime(new Date("2026-08-02T12:00:00Z"));
    await resolveAlertCurrentValueForDecision(next, cache);
    expect(storageMock.getGA4DailyMetrics).toHaveBeenCalledTimes(2);
    expect(storageMock.getRevenueTotalForRange).toHaveBeenCalledTimes(2);
    expect(storageMock.getSpendTotalForRange).toHaveBeenCalledTimes(2);
  });

  it.each(["campaign", "property", "token", "filter", "currency", "start", "end"])("keeps changed %s scope independent", async (changed) => {
    const oauth = enableProvider();
    const cache = new Map<string, Promise<any>>();
    await resolveAlertCurrentValueForDecision(row("revenue"), cache);
    const next = row("revenue");
    if (changed === "campaign") {
      next.campaignId = "another-owner-campaign";
      storageMock.getCampaign.mockResolvedValue({ ...campaign, id: next.campaignId, userId: "another-owner" });
    }
    if (changed === "property" || changed === "token") {
      const nextConnection = { ...oauth, [changed === "property" ? "propertyId" : "accessToken"]: "different" };
      storageMock.getGA4Connections.mockResolvedValue([nextConnection]);
      storageMock.getGA4Connection.mockResolvedValue(nextConnection);
    }
    if (changed === "filter") storageMock.getCampaign.mockResolvedValue({ ...campaign, ga4CampaignFilter: "other_campaign" });
    if (changed === "currency") storageMock.getCampaign.mockResolvedValue({ ...campaign, currency: "EUR" });
    if (changed === "start") storageMock.getCampaign.mockResolvedValue({ ...campaign, startDate: "2026-06-01" });
    if (changed === "end") vi.setSystemTime(new Date("2026-08-02T12:00:00Z"));
    await resolveAlertCurrentValueForDecision(next, cache);
    expect(ga4ServiceMock.getTotalsWithRevenue).toHaveBeenCalledTimes(2);
  });

  it.each(["error", "invalid"])("does not retain a failed %s provider result for the next rule", async (failure) => {
    enableProvider();
    const cache = new Map<string, Promise<any>>();
    if (failure === "error") ga4ServiceMock.getTotalsWithRevenue.mockRejectedValueOnce(new Error("503 unavailable"));
    else ga4ServiceMock.getTotalsWithRevenue.mockResolvedValueOnce({ totals: { revenue: "invalid" } });
    await resolveAlertCurrentValueForDecision(row("revenue"), cache);
    const next = await resolveAlertCurrentValueForDecision(row("revenue"), cache);
    expect(next.currentValue).toBe("1000");
    expect(ga4ServiceMock.getTotalsWithRevenue).toHaveBeenCalledTimes(2);
  });

  it("keeps authoritative zero alert-eligible for counts and revenue", async () => {
    const users = await resolveAlertCurrentValueForDecision(row("users"));
    const revenue = await resolveAlertCurrentValueForDecision(row("revenue"));

    expect(users).toMatchObject({ currentValue: "0", __alertDecisionEligible: true });
    expect(revenue).toMatchObject({ currentValue: "0", __alertDecisionEligible: true });
    expect(isAlertDecisionBreached(users)).toBe(true);
    expect(isAlertDecisionBreached(revenue)).toBe(true);
  });

  it("blocks insufficient rate and CPA inputs before threshold evaluation", async () => {
    const conversionRate = await resolveAlertCurrentValueForDecision(row("conversionRate"));
    const cpa = await resolveAlertCurrentValueForDecision(row("cpa"));

    expect(conversionRate).toMatchObject({
      currentValue: "0",
      __alertDecisionEligible: false,
      __alertDecisionReason: "insufficient_sessions",
    });
    expect(cpa).toMatchObject({
      currentValue: "0",
      __alertDecisionEligible: false,
      __alertDecisionReason: "insufficient_conversions",
    });
    expect(isAlertDecisionBreached(conversionRate)).toBe(false);
    expect(isAlertDecisionBreached(cpa)).toBe(false);
  });

  it("preserves but never evaluates a last-good value when required source input is unavailable", async () => {
    storageMock.getGA4DailyMetrics.mockRejectedValue(new Error("daily source unavailable"));

    const users = await resolveAlertCurrentValueForDecision(row("users"));
    const revenue = await resolveAlertCurrentValueForDecision(row("revenue"));

    expect(users).toMatchObject({
      currentValue: "99",
      __alertDecisionEligible: false,
      __alertDecisionReason: "unavailable",
    });
    expect(revenue).toMatchObject({
      currentValue: "99",
      __alertDecisionEligible: false,
      __alertDecisionReason: "unavailable",
    });
    expect(isAlertDecisionBreached(users)).toBe(false);
    expect(isAlertDecisionBreached(revenue)).toBe(false);
  });

  it("does not evaluate imported revenue with an unverified native fallback", async () => {
    storageMock.getRevenueTotalForRange.mockResolvedValue({ totalRevenue: 0, sourceIds: ["shopify-zero"] });

    const revenue = await resolveAlertCurrentValueForDecision(row("revenue"));

    expect(revenue).toMatchObject({
      currentValue: "99",
      __alertDecisionEligible: false,
      __alertDecisionReason: "unavailable",
    });
  });

  it("keeps traffic alerts on the same completed-day rows as the live KPI cards", async () => {
    const oauthConnection = {
      ...connection,
      method: "access_token",
      accessToken: "access-token",
    };
    storageMock.getGA4Connections.mockResolvedValue([oauthConnection]);
    storageMock.getGA4Connection.mockResolvedValue(oauthConnection);
    storageMock.getGA4DailyMetrics.mockResolvedValue([{
      ...sourceRow,
      users: 80,
      sessions: 100,
      conversions: 20,
    }]);
    ga4ServiceMock.getTotalsWithRevenue.mockResolvedValue({
      totals: { users: 90, sessions: 120, pageviews: 140, conversions: 30, revenue: 2 },
    });

    const sessions = await resolveAlertCurrentValueForDecision(row("sessions"));
    const conversionRate = await resolveAlertCurrentValueForDecision(row("conversionRate"));

    expect(sessions).toMatchObject({ currentValue: "100", __alertDecisionEligible: true });
    expect(conversionRate).toMatchObject({ currentValue: "20", __alertDecisionEligible: true });
    expect(ga4ServiceMock.getTotalsWithRevenue).not.toHaveBeenCalled();
  });

  it("uses campaign-to-date financial conversions for CPA alerts while traffic keeps the import boundary", async () => {
    storageMock.getCampaign.mockResolvedValue({
      ...campaign,
      startDate: "2026-06-20T00:00:00.000Z",
    });
    const oauthConnection = {
      ...connection,
      method: "access_token",
      accessToken: "access-token",
    };
    storageMock.getGA4Connections.mockResolvedValue([oauthConnection]);
    storageMock.getGA4Connection.mockResolvedValue(oauthConnection);
    storageMock.getGA4DailyMetrics.mockResolvedValue([{
      ...sourceRow,
      sessions: 100,
      conversions: 20,
    }]);
    storageMock.getSpendTotalForRange.mockResolvedValue({ totalSpend: 100, sourceIds: ["spend-source"] });
    ga4ServiceMock.getTotalsWithRevenue.mockResolvedValue({
      totals: { users: 90, sessions: 120, pageviews: 140, conversions: 25, revenue: 2 },
    });

    const cpa = await resolveAlertCurrentValueForDecision(row("cpa"));

    expect(storageMock.getGA4DailyMetrics).toHaveBeenCalledWith(
      campaign.id,
      connection.propertyId,
      "2026-06-20",
      "2026-07-31",
    );
    expect(ga4ServiceMock.getTotalsWithRevenue).toHaveBeenCalledWith(
      connection.propertyId,
      "access-token",
      "2026-06-20",
      "2026-07-31",
      "scoped_campaign",
      "USD",
    );
    expect(storageMock.getRevenueTotalForRange).toHaveBeenCalledWith(campaign.id, "1900-01-01", "2026-07-31", "ga4");
    expect(storageMock.getSpendTotalForRange).toHaveBeenCalledWith(campaign.id, "1900-01-01", "2026-07-31", "ga4");
    expect(cpa).toMatchObject({ currentValue: "4", __alertDecisionEligible: true });
  });

  it("preserves normal credential refresh but forbids it in notification validation read-only mode", async () => {
    const oauthConnection = {
      ...connection,
      method: "access_token",
      accessToken: "expired-access-token",
      refreshToken: "refresh-token",
    };
    storageMock.getGA4Connections.mockResolvedValue([oauthConnection]);
    storageMock.getGA4Connection.mockResolvedValue(oauthConnection);
    ga4ServiceMock.getTotalsWithRevenue
      .mockRejectedValueOnce(new Error("401 unauthenticated"))
      .mockResolvedValue({
        totals: { users: 7, sessions: 8, pageviews: 9, conversions: 1, revenue: 2 },
      });
    ga4ServiceMock.refreshAccessToken.mockResolvedValue({ access_token: "new-access-token", expires_in: 3600 });

    const cache = new Map<string, Promise<any>>();
    const normal = await resolveAlertCurrentValueForDecision(row("revenue"), cache);

    expect(normal).toMatchObject({ currentValue: "2", __alertDecisionEligible: true });
    expect(ga4ServiceMock.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(storageMock.updateGA4ConnectionTokens).toHaveBeenCalledTimes(1);

    ga4ServiceMock.getTotalsWithRevenue.mockReset().mockRejectedValue(new Error("401 unauthenticated"));
    ga4ServiceMock.refreshAccessToken.mockReset();
    storageMock.updateGA4ConnectionTokens.mockReset();

    const readOnly = await resolveAlertCurrentValueForDecision(
      row("revenue"),
      cache,
      { allowCredentialRefresh: false },
    );

    expect(readOnly).toMatchObject({ currentValue: "0", __alertDecisionEligible: true });
    expect(ga4ServiceMock.refreshAccessToken).not.toHaveBeenCalled();
    expect(storageMock.updateGA4ConnectionTokens).not.toHaveBeenCalled();
  });

  it("fails closed instead of using a rolling financial fallback", async () => {
    storageMock.getGA4DailyMetrics.mockResolvedValue([]);

    const revenue = await resolveAlertCurrentValueForDecision(
      row("revenue"),
      undefined,
      { allowCredentialRefresh: false },
    );

    expect(revenue).toMatchObject({ currentValue: "99", __alertDecisionEligible: false, __alertDecisionReason: "unavailable" });
    expect(ga4ServiceMock.getAcquisitionBreakdown).not.toHaveBeenCalled();
    expect(ga4ServiceMock.refreshAccessToken).not.toHaveBeenCalled();
    expect(storageMock.updateGA4ConnectionTokens).not.toHaveBeenCalled();
  });

  it("routes every GA4 alert consumer through the shared resolver and decision predicate", () => {
    const files = [
      "kpi-scheduler.ts",
      "benchmark-notifications.ts",
      join("services", "alert-monitoring.ts"),
      "routes-oauth.ts",
    ].map((name) => readFileSync(join(process.cwd(), "server", name), "utf8"));
    const kpiNotifications = readFileSync(join(process.cwd(), "server", "kpi-notifications.ts"), "utf8");

    for (const source of files) expect(source).toContain("resolveAlertCurrentValueForDecision");
    for (const source of files.slice(1)) expect(source).toContain("isAlertDecisionBreached");
    expect(files[0]).toContain("shouldTriggerAlert(kpi)");
    expect(kpiNotifications).toContain("return isAlertDecisionBreached(kpi);");
    expect(files[2].match(/resolveAlertCurrentValueForDecision\(/g)).toHaveLength(6);
    expect(files[2].match(/isAlertDecisionBreached\(/g)).toHaveLength(6);
    expect(files[3]).toContain("resolveAlertCurrentValueForDecision(row);");
    expect(files[3]).toContain("isAlertDecisionBreached(resolved);");
  });
});
