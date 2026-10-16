import express from "express";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const authState = vi.hoisted(() => ({ userId: "owner-1" }));
const storageMock = vi.hoisted(() => ({
  getCampaign: vi.fn(),
  getGA4Connection: vi.fn(),
  getGA4OverviewSnapshot: vi.fn(),
  getLatestGA4DailyMetric: vi.fn(),
}));
const ga4ServiceMock = vi.hoisted(() => ({
  getLandingPagesReport: vi.fn(),
  getConversionEventsReport: vi.fn(),
}));

vi.mock("./storage", () => ({ storage: storageMock }));
vi.mock("./analytics", () => ({ ga4Service: ga4ServiceMock }));
vi.mock("./db", () => ({ db: null, pool: null }));
vi.mock("@clerk/express", () => ({ getAuth: vi.fn(() => ({ userId: authState.userId })) }));
vi.mock("./utils/campaign-current-values", () => ({
  getCampaignMetricTotals: vi.fn(),
  getCampaignMetricTotalsAtDate: vi.fn(),
  refreshCampaignCurrentValuesForCampaign: vi.fn(),
  resolveCampaignCurrentValueForAlert: vi.fn(async (row: any) => row),
}));
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
vi.mock("jspdf", () => ({
  jsPDF: class {
    setFillColor() {}
    rect() {}
    roundedRect() {}
    setFontSize() {}
    setFont() {}
    setTextColor() {}
    setDrawColor() {}
    setLineWidth() {}
    line() {}
    addPage() {}
    splitTextToSize(value: any) { return [String(value)]; }
    text() {}
    output(kind: string) { return kind === "nodebuffer" ? Buffer.from("x".repeat(256)) : new ArrayBuffer(256); }
  },
}));

import { registerRoutes } from "./routes-oauth";

const campaign = {
  id: "8aa735ee-c02f-41e2-bb1f-7c3f43bb9458",
  ownerId: "owner-1",
  reportingTimeZone: "Europe/Amsterdam",
  ga4CampaignFilter: "saved_campaign",
};
const connection = {
  id: "connection-1",
  campaignId: campaign.id,
  propertyId: "542352127",
  importStartDate: "2026-08-01",
  accessToken: "token",
  isActive: true,
};

let server: ReturnType<ReturnType<typeof express>["listen"]>;
let baseUrl = "";

describe("GA4 Overview Conversion Events API route", () => {
  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    server = await registerRoutes(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    baseUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  });

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-09-15T12:00:00.000Z"));
    authState.userId = "owner-1";
    storageMock.getCampaign.mockReset().mockResolvedValue(campaign);
    storageMock.getGA4Connection.mockReset().mockImplementation(async (_campaignId: string, propertyId?: string) =>
      propertyId === connection.propertyId ? connection : undefined);
    storageMock.getLatestGA4DailyMetric.mockReset().mockResolvedValue({ date: "2026-09-14" });
    storageMock.getGA4OverviewSnapshot.mockReset().mockResolvedValue({
      campaignId: campaign.id,
      propertyId: connection.propertyId,
      windowStart: "2026-08-01",
      windowEnd: "2026-09-14",
      landingPages: {
        propertyId: connection.propertyId,
        rows: [{ landingPage: "/saved", source: "google", medium: "cpc", sessions: 4, users: 3, conversions: 2 }],
        totals: { sessions: 4, users: 3, conversions: 2 },
      },
      conversionEvents: {
        propertyId: connection.propertyId,
        revenueMetric: "totalRevenue",
        rows: [{ eventName: "purchase", conversions: 2.5, eventCount: 4, users: 3, revenue: 20 }],
        totals: { conversions: 2.5, eventCount: 4, users: 3, revenue: 20 },
      },
      updatedAt: new Date("2026-09-15T03:00:00.000Z"),
    });
    ga4ServiceMock.getLandingPagesReport.mockReset();
    ga4ServiceMock.getConversionEventsReport.mockReset().mockResolvedValue({
      propertyId: connection.propertyId,
      revenueMetric: "totalRevenue",
      rows: [{ eventName: "purchase", conversions: 2.5, eventCount: 4, users: 3, revenue: 20 }],
      totals: { conversions: 2.5, eventCount: 4, users: 3, revenue: 20 },
    });
  });

  afterEach(() => vi.useRealTimers());
  afterAll(async () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));

  it("passes the exact owner/property/window/saved scope through read-only mode", async () => {
    const response = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/ga4-conversion-events?window=import-to-date&propertyId=${connection.propertyId}&limit=50&snapshotEndDate=2026-09-14&readOnly=1`);
    const body: any = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-ga4-validation-read-only")).toBe("1");
    expect(response.headers.get("x-ga4-credential-refresh-allowed")).toBe("0");
    expect(body).toMatchObject({
      success: true,
      propertyId: connection.propertyId,
      window: "import-to-date",
      startDate: "2026-08-01",
      endDate: "2026-09-14",
      validationReadOnly: true,
    });
    expect(storageMock.getGA4OverviewSnapshot).toHaveBeenCalledWith(campaign.id, connection.propertyId);
    expect(ga4ServiceMock.getConversionEventsReport).not.toHaveBeenCalled();
  });

  it("serves Landing Pages from the same scheduler generation without provider work", async () => {
    const response = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/ga4-landing-pages?window=import-to-date&propertyId=${connection.propertyId}&limit=50&snapshotEndDate=2026-09-14&readOnly=1`);
    const body: any = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      startDate: "2026-08-01",
      endDate: "2026-09-14",
      rows: [{ landingPage: "/saved", sessions: 4, conversions: 2 }],
    });
    expect(ga4ServiceMock.getLandingPagesReport).not.toHaveBeenCalled();
  });

  it("fails before provider access when property or saved campaign scope is absent", async () => {
    const missingProperty = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/ga4-conversion-events?window=import-to-date&readOnly=1`);
    expect(missingProperty.status).toBe(400);
    expect(await missingProperty.json()).toMatchObject({ error: "GA4_PROPERTY_SCOPE_REQUIRED" });

    storageMock.getCampaign.mockResolvedValueOnce({ ...campaign, ga4CampaignFilter: null });
    const missingCampaign = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/ga4-conversion-events?window=import-to-date&propertyId=${connection.propertyId}&readOnly=1`);
    expect(missingCampaign.status).toBe(409);
    expect(await missingCampaign.json()).toMatchObject({ error: "GA4_CAMPAIGN_SCOPE_REQUIRED" });
    expect(ga4ServiceMock.getConversionEventsReport).not.toHaveBeenCalled();
  });

  it("returns non-enumerating denials for foreign ownership and a missing property connection", async () => {
    authState.userId = "foreign-owner";
    const foreign = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/ga4-conversion-events?window=import-to-date&propertyId=${connection.propertyId}&readOnly=1`);
    expect(foreign.status).toBe(404);

    authState.userId = "owner-1";
    const wrongProperty = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/ga4-conversion-events?window=import-to-date&propertyId=999999999&readOnly=1`);
    expect(wrongProperty.status).toBe(404);
    expect(ga4ServiceMock.getConversionEventsReport).not.toHaveBeenCalled();
  });

  it("fails closed when the daily scheduler has not published a synchronized snapshot", async () => {
    storageMock.getGA4OverviewSnapshot.mockResolvedValue(undefined);
    const response = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/ga4-conversion-events?window=import-to-date&propertyId=${connection.propertyId}&readOnly=1`);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: "GA4_OVERVIEW_SNAPSHOT_UNAVAILABLE" });
    expect(ga4ServiceMock.getConversionEventsReport).not.toHaveBeenCalled();
  });

  it("rejects a table generation newer than the Summary generation requested by the browser", async () => {
    const response = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/ga4-conversion-events?window=import-to-date&propertyId=${connection.propertyId}&snapshotEndDate=2026-09-13&readOnly=1`);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: "GA4_OVERVIEW_SNAPSHOT_UNAVAILABLE" });
  });
});
