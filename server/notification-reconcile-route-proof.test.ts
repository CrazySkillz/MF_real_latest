import express from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const storageMock = vi.hoisted(() => ({
  getCampaign: vi.fn(),
  getPlatformKPIs: vi.fn(),
  getPlatformBenchmarks: vi.fn(),
}));
const refreshMock = vi.hoisted(() => vi.fn());
const kpiAlertMock = vi.hoisted(() => vi.fn());
const benchmarkAlertMock = vi.hoisted(() => vi.fn());

vi.mock("./storage", () => ({ storage: storageMock }));
vi.mock("./db", () => ({ db: null, pool: null }));
vi.mock("@clerk/express", () => ({ getAuth: vi.fn(() => ({ userId: "owner-1" })) }));
vi.mock("./ga4-daily-scheduler", () => ({
  getGA4DailySchedulerConfig: vi.fn(() => ({ reportingTimeZone: "UTC", hour: 22, minute: 0 })),
  getGA4DailySchedulerStatus: vi.fn(() => ({ lastRunStatus: "success", inProgress: false })),
  runGA4DailyRefreshPipeline: refreshMock,
}));
vi.mock("./kpi-scheduler", () => ({
  checkGA4PerformanceAlertsForCampaign: kpiAlertMock,
  checkPerformanceAlerts: vi.fn(),
}));
vi.mock("./benchmark-notifications", () => ({
  checkGA4BenchmarkPerformanceAlertsForCampaign: benchmarkAlertMock,
}));
vi.mock("./middleware/rateLimiter", () => {
  const pass = (_req: any, _res: any, next: any) => next();
  return {
    oauthRateLimiter: pass,
    linkedInApiRateLimiter: pass,
    googleSheetsRateLimiter: pass,
    ga4RateLimiter: pass,
    importRateLimiter: pass,
  };
});

import { registerRoutes } from "./routes-oauth";

describe("Notifications GA4 reconciliation route proof", () => {
  let server: any;
  let baseUrl = "";

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    server = await registerRoutes(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    storageMock.getCampaign.mockResolvedValue({ id: "campaign-1", ownerId: "owner-1", reportingTimeZone: "UTC" });
    storageMock.getPlatformKPIs.mockResolvedValue([]);
    storageMock.getPlatformBenchmarks.mockResolvedValue([]);
  });

  afterAll(async () => new Promise<void>((resolve, reject) => server.close((error: any) => error ? reject(error) : resolve())));

  it("skips the provider pipeline when the campaign has no enabled alert rules", async () => {
    const response = await fetch(`${baseUrl}/api/campaigns/campaign-1/ga4-notifications/reconcile`, { method: "POST" });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, campaignId: "campaign-1" });
    expect(refreshMock).not.toHaveBeenCalled();
    expect(kpiAlertMock).not.toHaveBeenCalled();
    expect(benchmarkAlertMock).not.toHaveBeenCalled();
  });

  it("still refreshes and reconciles an enabled KPI alert", async () => {
    storageMock.getPlatformKPIs.mockResolvedValue([{ alertsEnabled: true, alertThreshold: "70" }]);

    const response = await fetch(`${baseUrl}/api/campaigns/campaign-1/ga4-notifications/reconcile`, { method: "POST" });

    expect(response.status).toBe(200);
    expect(refreshMock).toHaveBeenCalledWith({ campaignId: "campaign-1", suppressAlerts: true });
    expect(kpiAlertMock).toHaveBeenCalledWith("campaign-1", expect.any(String));
    expect(benchmarkAlertMock).toHaveBeenCalledWith("campaign-1", expect.any(String));
  });

  it("still refreshes and reconciles an enabled active Benchmark alert", async () => {
    storageMock.getPlatformBenchmarks.mockResolvedValue([{
      status: "active",
      alertsEnabled: true,
      alertThreshold: "250",
    }]);

    const response = await fetch(`${baseUrl}/api/campaigns/campaign-1/ga4-notifications/reconcile`, { method: "POST" });

    expect(response.status).toBe(200);
    expect(refreshMock).toHaveBeenCalledWith({ campaignId: "campaign-1", suppressAlerts: true });
    expect(kpiAlertMock).toHaveBeenCalledWith("campaign-1", expect.any(String));
    expect(benchmarkAlertMock).toHaveBeenCalledWith("campaign-1", expect.any(String));
  });

  it("checks ownership before reading alert rules", async () => {
    storageMock.getCampaign.mockResolvedValue({ id: "campaign-1", ownerId: "owner-2" });

    const response = await fetch(`${baseUrl}/api/campaigns/campaign-1/ga4-notifications/reconcile`, { method: "POST" });

    expect(response.status).toBe(404);
    expect(storageMock.getPlatformKPIs).not.toHaveBeenCalled();
    expect(storageMock.getPlatformBenchmarks).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
  });
});
