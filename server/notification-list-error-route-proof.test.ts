import express from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  linkedType: "kpi" as "kpi" | "benchmark",
  lookup: "error" as "error" | "missing" | "other-campaign" | "matching",
  platformLookup: "error" as "error" | "success",
  dbAvailable: true,
  fallbackFailure: "none" as "none" | "campaigns" | "notifications" | "kpi" | "benchmark",
  fallbackOwnerId: "owner-1",
  fallbackMissing: false,
}));

vi.mock("./db", () => {
  const mockDb = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        innerJoin: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(async () => [{ n: {
              id: "alert-1",
              campaignId: "campaign-1",
              type: "performance-alert",
              title: "Performance alert",
              createdAt: new Date("2026-09-22T00:00:00.000Z"),
              metadata: JSON.stringify(state.linkedType === "kpi" ? { kpiId: "kpi-1" } : { benchmarkId: "benchmark-1" }),
            } }]),
          })),
        })),
        where: vi.fn(() => ({
          limit: vi.fn(async () => {
            if (state.lookup === "error") throw new Error("linked alert lookup failed");
            return state.lookup === "missing" ? [] : state.lookup === "matching"
              ? [{ id: "kpi-1", campaignId: "campaign-1", platformType: "google_analytics", metric: "sessions", name: "Sessions", alertsEnabled: true, alertThreshold: 10, currentValue: 5, alertCondition: "below" }]
              : [{ id: "other-1", campaignId: "campaign-2" }];
          }),
        })),
      })),
    })),
  };
  return { get db() { return state.dbAvailable ? mockDb : null; }, pool: null };
});
vi.mock("./storage", () => ({ storage: {
  getCampaigns: vi.fn(async () => {
    if (state.fallbackFailure === "campaigns") throw new Error("campaign lookup failed");
    return [{ id: "campaign-1", ownerId: state.fallbackOwnerId }];
  }),
  getNotifications: vi.fn(async () => {
    if (state.fallbackFailure === "notifications") throw new Error("notification lookup failed");
    return [{ id: "alert-1", campaignId: "campaign-1", type: "performance-alert", title: "Performance alert", createdAt: new Date("2026-09-22T00:00:00.000Z"), metadata: JSON.stringify(state.linkedType === "kpi" ? { kpiId: "kpi-1" } : { benchmarkId: "benchmark-1" }) }];
  }),
  getKPI: vi.fn(async () => {
    if (state.fallbackFailure === "kpi") throw new Error("KPI lookup failed");
    if (state.fallbackMissing) return undefined;
    return { id: "kpi-1", campaignId: "campaign-1", platformType: "google_analytics", metric: "sessions", name: "Sessions", alertsEnabled: true, alertThreshold: 10, currentValue: 5, alertCondition: "below" };
  }),
  getBenchmark: vi.fn(async () => {
    if (state.fallbackFailure === "benchmark") throw new Error("Benchmark lookup failed");
    if (state.fallbackMissing) return undefined;
    return { id: "benchmark-1", campaignId: "campaign-1", alertsEnabled: true, alertThreshold: 10, currentValue: 5, alertCondition: "below" };
  }),
  getPlatformKPIs: vi.fn(async () => {
    if (state.platformLookup === "error") throw new Error("GA4 KPI duplicate lookup failed");
    return [{ id: "kpi-1", campaignId: "campaign-1", platformType: "google_analytics", metric: "sessions" }];
  }),
} }));
vi.mock("./utils/ga4-alert-current-value", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./utils/ga4-alert-current-value")>()),
  resolveAlertCurrentValueForDecision: vi.fn(async (row: any) => row),
}));
vi.mock("@clerk/express", () => ({ getAuth: vi.fn(() => ({ userId: "owner-1" })) }));
vi.mock("./ga4-daily-scheduler", () => ({
  getGA4DailySchedulerConfig: vi.fn(() => ({ reportingTimeZone: "UTC", hour: 22, minute: 0 })),
  getGA4DailySchedulerStatus: vi.fn(() => ({ lastRunStatus: "success", inProgress: false })),
  runGA4DailyRefreshPipeline: vi.fn(),
}));
vi.mock("./kpi-scheduler", () => ({
  checkGA4PerformanceAlertsForCampaign: vi.fn(),
  checkPerformanceAlerts: vi.fn(),
}));
vi.mock("./benchmark-notifications", () => ({
  checkGA4BenchmarkPerformanceAlertsForCampaign: vi.fn(),
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

describe("Notifications list failure response", () => {
  let server: any;
  let baseUrl = "";

  beforeAll(async () => {
    const app = express();
    server = await registerRoutes(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  beforeEach(() => {
    state.linkedType = "kpi";
    state.lookup = "error";
    state.platformLookup = "error";
    state.dbAvailable = true;
    state.fallbackFailure = "none";
    state.fallbackOwnerId = "owner-1";
    state.fallbackMissing = false;
  });

  afterAll(async () => new Promise<void>((resolve, reject) => server.close((error: any) => error ? reject(error) : resolve())));

  it.each(["kpi", "benchmark"] as const)("returns 500 when an active %s lookup fails", async (linkedType) => {
    state.linkedType = linkedType;
    const response = await fetch(`${baseUrl}/api/notifications`);

    expect(response.status).toBe(500);
    expect((await response.json()).message).toBe("Failed to fetch notifications");
  });

  it("still hides a confirmed missing linked alert", async () => {
    state.lookup = "missing";
    const response = await fetch(`${baseUrl}/api/notifications`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });

  it("still hides a linked alert from another campaign", async () => {
    state.lookup = "other-campaign";
    const response = await fetch(`${baseUrl}/api/notifications`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });

  it("returns 500 when GA4 KPI duplicate validation fails", async () => {
    state.lookup = "matching";
    const response = await fetch(`${baseUrl}/api/notifications`);

    expect(response.status).toBe(500);
    expect((await response.json()).message).toBe("Failed to fetch notifications");
  });

  it("keeps a validated GA4 KPI alert visible", async () => {
    state.lookup = "matching";
    state.platformLookup = "success";
    const response = await fetch(`${baseUrl}/api/notifications`);

    expect(response.status).toBe(200);
    const alerts = await response.json();
    expect(alerts).toHaveLength(1);
    expect(JSON.parse(alerts[0].metadata).actionUrl).toBe("/campaigns/campaign-1/ga4-metrics?tab=kpis&highlight=kpi-1");
  });

  it.each(["campaigns", "notifications", "kpi", "benchmark"] as const)("returns 500 when fallback %s storage fails", async (failure) => {
    state.dbAvailable = false;
    state.fallbackFailure = failure;
    state.linkedType = failure === "benchmark" ? "benchmark" : "kpi";
    const response = await fetch(`${baseUrl}/api/notifications`);

    expect(response.status).toBe(500);
    expect((await response.json()).message).toBe("Failed to fetch notifications");
  });

  it("keeps an owned fallback GA4 KPI alert visible after successful reads", async () => {
    state.dbAvailable = false;
    state.platformLookup = "success";
    const response = await fetch(`${baseUrl}/api/notifications`);

    expect(response.status).toBe(200);
    expect(await response.json()).toHaveLength(1);
  });

  it.each(["other-owner", "missing"] as const)("still hides fallback %s linked alerts", async (reason) => {
    state.dbAvailable = false;
    if (reason === "other-owner") state.fallbackOwnerId = "owner-2";
    else state.fallbackMissing = true;
    const response = await fetch(`${baseUrl}/api/notifications`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });
});
