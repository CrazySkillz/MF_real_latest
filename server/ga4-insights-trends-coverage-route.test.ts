import express from "express";
import { getAuth } from "@clerk/express";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const storageMock = vi.hoisted(() => ({
  getCampaign: vi.fn(),
  getGA4Connection: vi.fn(),
  getGA4DailyMetrics: vi.fn(),
  replaceGA4DailyMetricsWindow: vi.fn(),
  updateGA4ConnectionTokens: vi.fn(),
}));
const ga4ServiceMock = vi.hoisted(() => ({
  getTrendsDailyPresenceWithToken: vi.fn(),
}));
vi.mock("./storage", () => ({ storage: storageMock }));
vi.mock("./analytics", () => ({ ga4Service: ga4ServiceMock }));
vi.mock("./db", () => ({ db: null, pool: null }));
vi.mock("@clerk/express", () => ({ getAuth: vi.fn(() => ({ userId: "owner-1" })) }));
vi.mock("./middleware/rateLimiter", () => {
  const passThrough = (_req: any, _res: any, next: any) => next();
  return {
    oauthRateLimiter: passThrough,
    linkedInApiRateLimiter: passThrough,
    googleSheetsRateLimiter: passThrough,
    ga4RateLimiter: passThrough,
    importRateLimiter: passThrough,
  };
});
vi.mock("jspdf", () => ({ jsPDF: class {} }));

import { registerRoutes } from "./routes-oauth";
import { buildGA4InsightsCalendarRollup, buildGA4InsightsMonthlySeries } from "../shared/ga4-insights";

const campaign = {
  id: "ga4-trends-coverage-campaign",
  ownerId: "owner-1",
  reportingTimeZone: "Europe/Amsterdam",
  ga4CampaignFilter: '["spring","summer"]',
  currency: "USD",
};
const connection = {
  campaignId: campaign.id,
  propertyId: "542352127",
  method: "access_token",
  accessToken: "token",
  isActive: true,
  importStartDate: "2026-09-04",
};
const dailyRows = [
  { date: "2026-09-04", sessions: 30, users: 28, conversions: 3, revenue: "40.00", pageviews: 45, engagedSessions: 20, engagementRate: 20 / 30 },
  { date: "2026-09-06", sessions: 34, users: 33, conversions: 4, revenue: "55.00", pageviews: 48, engagedSessions: 21, engagementRate: 21 / 34 },
];
let server: ReturnType<ReturnType<typeof express>["listen"]>;
let baseUrl = "";

describe("Insights Trends zero-day coverage route", () => {
  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    server = await registerRoutes(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    baseUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  });
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-17T12:00:00.000Z"));
    vi.mocked(getAuth).mockReturnValue({ userId: "owner-1" } as any);
    for (const fn of Object.values(storageMock)) fn.mockReset();
    for (const fn of Object.values(ga4ServiceMock)) fn.mockReset();
    storageMock.getCampaign.mockResolvedValue(campaign);
    storageMock.getGA4Connection.mockResolvedValue(connection);
    storageMock.getGA4DailyMetrics.mockResolvedValue(dailyRows);
    ga4ServiceMock.getTrendsDailyPresenceWithToken.mockResolvedValue({ dailyRows, presentDates: dailyRows.map((row) => row.date) });
  });
  afterEach(() => vi.useRealTimers());
  afterAll(async () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));

  const request = () => fetch(`${baseUrl}/api/campaigns/${campaign.id}/ga4-insights-trends-coverage?propertyId=${connection.propertyId}`);

  it("returns confirmed zero dates from stored-row parity without writing shared data", async () => {
    const response = await request();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ verified: true, propertyId: connection.propertyId, startDate: "2026-09-04", endDate: "2026-09-16" });
    expect(body.zeroDates).toHaveLength(11);
    expect(body.zeroDates).toContain("2026-09-05");
    expect(body.dailyRows).toHaveLength(2);
    const trendRows = [...body.dailyRows, ...body.zeroDates.map((date: string) => ({ date, sessions: 0, users: 0, conversions: 0, revenue: 0, pageviews: 0, engagedSessions: 0, engagementRate: 0 }))];
    const sevenDays = buildGA4InsightsCalendarRollup(trendRows, "2026-09-10", 7);
    expect(sevenDays).toMatchObject({ complete: true, sessions: 64, engagedSessions: 41, engagementRate: 64.0625 });
    const monthly = buildGA4InsightsMonthlySeries(trendRows, "2026-09-16", "sessions");
    expect(monthly[0]).toMatchObject({ value: 64, days: 13, partial: true });
    expect(ga4ServiceMock.getTrendsDailyPresenceWithToken).toHaveBeenCalledWith(connection.propertyId, connection.accessToken, "2026-09-04", "2026-09-16", ["spring", "summer"], "USD");
    expect(storageMock.replaceGA4DailyMetricsWindow).not.toHaveBeenCalled();
    expect(storageMock.updateGA4ConnectionTokens).not.toHaveBeenCalled();
  });

  it("withholds zero dates if GA4 reports activity absent from stored rows", async () => {
    ga4ServiceMock.getTrendsDailyPresenceWithToken.mockResolvedValue({ dailyRows, presentDates: [...dailyRows.map((row) => row.date), "2026-09-05"] });
    const body = await (await request()).json();
    expect(body).toMatchObject({ verified: false, reason: "stored_daily_history_differs_from_ga4", zeroDates: [] });
  });

  it("withholds zero dates if a stored metric disagrees with GA4", async () => {
    ga4ServiceMock.getTrendsDailyPresenceWithToken.mockResolvedValue({ dailyRows: [{ ...dailyRows[0], sessions: 31 }, dailyRows[1]], presentDates: dailyRows.map((row) => row.date) });
    const body = await (await request()).json();
    expect(body).toMatchObject({ verified: false, reason: "stored_daily_history_differs_from_ga4", zeroDates: [] });
  });

  it("withholds zero dates after provider failure", async () => {
    ga4ServiceMock.getTrendsDailyPresenceWithToken.mockRejectedValue(new Error("provider unavailable"));
    const body = await (await request()).json();
    expect(body).toMatchObject({ verified: false, reason: "provider_verification_unavailable", zeroDates: [] });
  });

  it("does not disclose coverage to another owner or property", async () => {
    vi.mocked(getAuth).mockReturnValue({ userId: "other-owner" } as any);
    expect((await request()).status).toBe(404);
    expect(ga4ServiceMock.getTrendsDailyPresenceWithToken).not.toHaveBeenCalled();
    vi.mocked(getAuth).mockReturnValue({ userId: "owner-1" } as any);
    storageMock.getGA4Connection.mockResolvedValue(null);
    expect((await request()).status).toBe(404);
  });
});
