import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveGA4RefreshStatus } from "./utils/reporting-timezone";

const storageMock = vi.hoisted(() => ({
  getCampaign: vi.fn(), getCampaigns: vi.fn(), getGA4Connections: vi.fn(), replaceGA4DailyMetricsWindow: vi.fn(),
}));
const providerMock = vi.hoisted(() => ({ getTimeSeriesData: vi.fn() }));
vi.mock("./storage", () => ({ storage: storageMock }));
vi.mock("./analytics", () => ({ ga4Service: providerMock, GA4_CONVERSION_EVENTS_SNAPSHOT_VERSION: 1 }));
vi.mock("./db", () => ({ db: null, pool: null }));
import { getGA4DailyRefreshAttempt, refreshAllGA4DailyMetrics } from "./ga4-daily-scheduler";

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

describe("GA4 property refresh observations", () => {
  let campaign: any;
  let connection: any;
  let fixtureId = 0;
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-14T14:00:00Z"));
    vi.stubEnv("GA4_DAILY_LOOKBACK_DAYS", "7");
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    campaign = { id: `attempt-${++fixtureId}`, ownerId: "owner-a", clientId: "client-a", status: "active", reportingTimeZone: "UTC", currency: "EUR" };
    connection = { id: `connection-${fixtureId}`, campaignId: campaign.id, propertyId: "properties/123", connectedAt: "2026-10-01T00:00:00Z", isActive: true, importStartDate: "2026-10-01" };
    storageMock.getCampaign.mockReset().mockResolvedValue(campaign);
    storageMock.getCampaigns.mockReset().mockResolvedValue([campaign]);
    storageMock.getGA4Connections.mockReset().mockResolvedValue([connection]);
    storageMock.replaceGA4DailyMetricsWindow.mockReset().mockResolvedValue({ replaced: 7 });
    providerMock.getTimeSeriesData.mockReset().mockResolvedValue([]);
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.useRealTimers(); });

  it("observes running until storage commits, then records success without changing metric writes", async () => {
    const provider = deferred<any[]>();
    const write = deferred<{ replaced: number }>();
    providerMock.getTimeSeriesData.mockReturnValue(provider.promise);
    storageMock.replaceGA4DailyMetricsWindow.mockReturnValue(write.promise);
    expect(getGA4DailyRefreshAttempt(campaign, connection)).toBeNull();
    const run = refreshAllGA4DailyMetrics({ campaignId: campaign.id });
    await vi.waitFor(() => expect(providerMock.getTimeSeriesData).toHaveBeenCalled());
    expect(getGA4DailyRefreshAttempt(campaign, connection)).toEqual({
      reportingDate: "2026-10-13", startedAt: expect.any(String), finishedAt: null, status: "running",
    });
    expect(Date.parse(getGA4DailyRefreshAttempt(campaign, connection)!.startedAt)).toBeLessThanOrEqual(Date.now());
    provider.resolve([]);
    await vi.waitFor(() => expect(storageMock.replaceGA4DailyMetricsWindow).toHaveBeenCalled());
    expect(getGA4DailyRefreshAttempt(campaign, connection)?.status).toBe("running");
    const returnedCopy = getGA4DailyRefreshAttempt(campaign, connection)!;
    returnedCopy.status = "failed";
    expect(getGA4DailyRefreshAttempt(campaign, connection)?.status).toBe("running");
    vi.setSystemTime(new Date("2026-10-14T14:05:00Z"));
    write.resolve({ replaced: 7 });
    expect(await run).toMatchObject({ campaignIdsProcessed: [campaign.id], campaignIdsFailed: [], rowsUpserted: 7 });
    expect(getGA4DailyRefreshAttempt(campaign, connection)).toMatchObject({ status: "success", finishedAt: "2026-10-14T14:05:00.000Z" });
    const args = storageMock.replaceGA4DailyMetricsWindow.mock.calls[0];
    expect(args.slice(0, 4)).toEqual([campaign.id, connection.propertyId, "2026-10-07", "2026-10-13"]);
    expect(args[4]).toHaveLength(7);
    expect(args[4].every((row: any) => row.sessions === 0 && row.conversions === 0 && row.campaignId === campaign.id && row.propertyId === connection.propertyId)).toBe(true);
  });

  it.each(["provider", "storage"])("records a %s failure and clears it on a successful retry", async (stage) => {
    const error = new Error("private provider detail token=not-for-the-response");
    if (stage === "provider") providerMock.getTimeSeriesData.mockRejectedValueOnce(error);
    else storageMock.replaceGA4DailyMetricsWindow.mockRejectedValueOnce(error);
    expect(await refreshAllGA4DailyMetrics({ campaignId: campaign.id })).toMatchObject({ campaignIdsFailed: [campaign.id] });
    const observed = getGA4DailyRefreshAttempt(campaign, connection);
    expect(observed?.status).toBe("failed");
    expect(Object.keys(observed!).sort()).toEqual(["finishedAt", "reportingDate", "startedAt", "status"]);
    expect(JSON.stringify(observed)).not.toContain("private provider");
    if (stage === "provider") expect(storageMock.replaceGA4DailyMetricsWindow).not.toHaveBeenCalled();
    vi.setSystemTime(new Date("2026-10-14T14:10:00Z"));
    await refreshAllGA4DailyMetrics({ campaignId: campaign.id });
    expect(getGA4DailyRefreshAttempt(campaign, connection)).toMatchObject({ status: "success", startedAt: "2026-10-14T14:10:00.000Z" });
  });

  it("isolates failure from another campaign and another property of the same campaign", async () => {
    const otherCampaign = { ...campaign, id: `${campaign.id}-other`, ownerId: "owner-b" };
    const second = { ...connection, id: `${connection.id}-second`, propertyId: "properties/456" };
    const otherConnection = { ...connection, id: `${connection.id}-other`, campaignId: otherCampaign.id };
    storageMock.getCampaigns.mockResolvedValue([campaign, otherCampaign]);
    storageMock.getGA4Connections.mockImplementation(async (id) => id === campaign.id ? [connection, second] : [otherConnection]);
    providerMock.getTimeSeriesData.mockRejectedValueOnce(new Error("provider failed"));
    await refreshAllGA4DailyMetrics();
    expect(getGA4DailyRefreshAttempt(campaign, connection)?.status).toBe("failed");
    expect(getGA4DailyRefreshAttempt(campaign, second)?.status).toBe("success");
    expect(getGA4DailyRefreshAttempt(otherCampaign, otherConnection)?.status).toBe("success");
    expect(getGA4DailyRefreshAttempt(otherCampaign, connection)).toBeNull();
  });

  it("ignores evidence after reconnection, deactivation, or a change of saved analytics scope", async () => {
    await refreshAllGA4DailyMetrics({ campaignId: campaign.id });
    for (const change of [
      { id: "new-connection" }, { isActive: false }, { campaignId: "foreign" },
      { propertyId: "properties/456" }, { importStartDate: "2026-10-05" }, { connectedAt: "2026-10-14T14:01:00Z" },
    ]) expect(getGA4DailyRefreshAttempt(campaign, { ...connection, ...change })).toBeNull();
    for (const change of [
      { ownerId: "owner-b" }, { clientId: "client-b" }, { currency: "USD" },
      { ga4CampaignFilter: "other-campaign" }, { reportingTimeZone: "Europe/Amsterdam" },
    ]) expect(getGA4DailyRefreshAttempt({ ...campaign, ...change }, connection)).toBeNull();
  });

  it("does not let an older overlapping failure overwrite the newer attempt", async () => {
    const firstProvider = deferred<any[]>();
    providerMock.getTimeSeriesData.mockReturnValueOnce(firstProvider.promise);
    const firstRun = refreshAllGA4DailyMetrics({ campaignId: campaign.id });
    await vi.waitFor(() => expect(providerMock.getTimeSeriesData).toHaveBeenCalledTimes(1));
    vi.setSystemTime(new Date("2026-10-14T14:01:00Z"));
    await refreshAllGA4DailyMetrics({ campaignId: campaign.id });
    firstProvider.reject(new Error("older attempt failed"));
    await firstRun;
    expect(getGA4DailyRefreshAttempt(campaign, connection)).toMatchObject({ status: "success", startedAt: "2026-10-14T14:01:00.000Z" });
  });

  it("has no remembered running or failed state after the scheduler module restarts", async () => {
    providerMock.getTimeSeriesData.mockRejectedValueOnce(new Error("provider failed"));
    await refreshAllGA4DailyMetrics({ campaignId: campaign.id });
    expect(getGA4DailyRefreshAttempt(campaign, connection)?.status).toBe("failed");
    vi.resetModules();
    const restarted = await import("./ga4-daily-scheduler");
    expect(restarted.getGA4DailyRefreshAttempt(campaign, connection)).toBeNull();
  });
});

describe("GA4 refresh status classification", () => {
  const input = {
    dataThroughDate: "2026-10-13", expectedRefreshAt: new Date("2026-10-14T14:00:00Z"),
    lastCompletedRefreshAt: "2026-10-14T08:05:00Z", refreshIsStale: true, now: new Date("2026-10-14T14:10:00Z"),
  };
  const attempt = { reportingDate: "2026-10-13", startedAt: "2026-10-14T14:00:00Z", finishedAt: null, status: "running" };
  it("distinguishes observed running and failed attempts from an overdue update with unknown cause", () => {
    expect(resolveGA4RefreshStatus(input)).toBe("delayed");
    expect(resolveGA4RefreshStatus({ ...input, attempt })).toBe("running");
    expect(resolveGA4RefreshStatus({ ...input, attempt: { ...attempt, status: "failed", finishedAt: "2026-10-14T14:05:00Z" } })).toBe("failed");
    expect(resolveGA4RefreshStatus({ ...input, attempt: { ...attempt, status: "success", finishedAt: "2026-10-14T14:05:00Z" } })).toBe("delayed");
    expect(resolveGA4RefreshStatus({ ...input, refreshIsStale: false, lastCompletedRefreshAt: "2026-10-14T14:05:00Z" })).toBe("current");
    expect(resolveGA4RefreshStatus({ ...input, refreshIsStale: false, now: new Date("2026-10-14T13:59:00Z") })).toBe("pending");
  });
  it("ignores an older failure after a newer saved success", () => {
    expect(resolveGA4RefreshStatus({
      ...input, refreshIsStale: false, lastCompletedRefreshAt: "2026-10-14T14:06:00Z",
      attempt: { ...attempt, status: "failed", finishedAt: "2026-10-14T14:05:00Z" },
    })).toBe("current");
  });
  it.each([
    { ...attempt, reportingDate: "2026-10-12" },
    { ...attempt, startedAt: "2026-10-14T15:00:00Z" },
    { ...attempt, startedAt: "invalid" },
    { ...attempt, status: "failed", finishedAt: "invalid" },
    { ...attempt, status: "failed", finishedAt: "2026-10-14T13:00:00Z" },
    { ...attempt, status: "failed", finishedAt: "2026-10-14T15:00:00Z" },
  ])("does not claim a running or failed refresh from irrelevant or invalid evidence %#", (invalid) => {
    expect(resolveGA4RefreshStatus({ ...input, attempt: invalid })).toBe("delayed");
  });
});
