import express from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const campaignId = "83c85794-e849-43c0-92ad-5923b5cb033e";
const storageMock = vi.hoisted(() => ({
  getCampaign: vi.fn(),
  getGA4Connections: vi.fn(),
  updateCampaign: vi.fn(),
  updateCampaignWithGA4DailyInvalidation: vi.fn(),
  deleteCampaignCascade: vi.fn(),
}));
const schedulerMock = vi.hoisted(() => ({
  refreshAllGA4DailyMetrics: vi.fn(),
  getGA4DailyRefreshFailure: vi.fn(),
}));

vi.mock("./storage", () => ({ storage: storageMock }));
vi.mock("./db", () => ({ db: null, pool: null }));
vi.mock("@clerk/express", () => ({ getAuth: vi.fn(() => ({ userId: "owner-1" })) }));
vi.mock("./ga4-daily-scheduler", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./ga4-daily-scheduler")>()),
  refreshAllGA4DailyMetrics: schedulerMock.refreshAllGA4DailyMetrics,
  getGA4DailyRefreshFailure: schedulerMock.getGA4DailyRefreshFailure,
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
vi.mock("jspdf", () => ({ jsPDF: class {} }));

import { registerRoutes } from "./routes-oauth";

describe("new campaign initial GA4 import", () => {
  let server: any;
  let baseUrl = "";

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    server = await registerRoutes(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    storageMock.getCampaign.mockResolvedValue({
      id: campaignId,
      ownerId: "owner-1",
      name: "New campaign",
      status: "draft",
      platform: "manual",
      ga4CampaignFilter: null,
      reportingTimeZone: "UTC",
    });
    storageMock.getGA4Connections.mockResolvedValue([{
      campaignId,
      propertyId: "123456789",
      isActive: true,
    }]);
    storageMock.updateCampaignWithGA4DailyInvalidation.mockImplementation(async (_id, data) => ({
      id: campaignId,
      ownerId: "owner-1",
      name: "New campaign",
      ...data,
    }));
    storageMock.updateCampaign.mockImplementation(async (_id, data) => ({
      id: campaignId,
      ownerId: "owner-1",
      name: "New campaign",
      platform: "google-analytics, google-ads",
      ga4CampaignFilter: "selected_campaign",
      ...data,
    }));
    storageMock.deleteCampaignCascade.mockResolvedValue(true);
    schedulerMock.refreshAllGA4DailyMetrics.mockResolvedValue({
      campaignIdsProcessed: [campaignId],
      campaignIdsSkipped: [],
      campaignIdsFailed: [],
      propertyIdsProcessed: ["123456789"],
      propertyIdsFailed: [],
      rowsUpserted: 30,
      reportingDatesByCampaign: { [campaignId]: "2026-09-29" },
    });
    schedulerMock.getGA4DailyRefreshFailure.mockReturnValue(null);
  });

  afterAll(async () => new Promise<void>((resolve, reject) => server.close((error: any) => error ? reject(error) : resolve())));

  const activate = (platform = "google-analytics, google-ads", ga4CampaignFilter: string | null = "selected_campaign") =>
    fetch(`${baseUrl}/api/campaigns/${campaignId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "active", platform, ga4CampaignFilter }),
    });

  it("imports the persisted GA4 scope before promoting the draft to active", async () => {
    const response = await activate();

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: campaignId, status: "active" });
    expect(storageMock.updateCampaignWithGA4DailyInvalidation).toHaveBeenCalledWith(
      campaignId,
      expect.objectContaining({ status: "draft", ga4CampaignFilter: "selected_campaign" }),
    );
    expect(schedulerMock.refreshAllGA4DailyMetrics).toHaveBeenCalledWith({ campaignId, includeTargetDraft: true });
    expect(storageMock.updateCampaign).toHaveBeenCalledWith(campaignId, { status: "active" });
    expect(storageMock.updateCampaignWithGA4DailyInvalidation.mock.invocationCallOrder[0]).toBeLessThan(
      schedulerMock.refreshAllGA4DailyMetrics.mock.invocationCallOrder[0],
    );
    expect(schedulerMock.refreshAllGA4DailyMetrics.mock.invocationCallOrder[0]).toBeLessThan(
      storageMock.updateCampaign.mock.invocationCallOrder[0],
    );
  });

  it("keeps the campaign as a draft when the initial GA4 import fails", async () => {
    schedulerMock.getGA4DailyRefreshFailure.mockReturnValue("provider import failed");

    const response = await activate();

    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ success: false, error: "GA4_INITIAL_IMPORT_FAILED" });
    expect(storageMock.updateCampaign).not.toHaveBeenCalled();
  });

  it("does not run GA4 import when activating a non-GA4 campaign", async () => {
    const response = await activate("google-ads", null);

    expect(response.status).toBe(200);
    expect(schedulerMock.refreshAllGA4DailyMetrics).not.toHaveBeenCalled();
    expect(storageMock.updateCampaign).toHaveBeenCalledWith(
      campaignId,
      expect.objectContaining({ status: "active", platform: "google-ads" }),
    );
  });

  it("allows wizard cleanup to delete only a draft campaign", async () => {
    const response = await fetch(`${baseUrl}/api/campaigns/${campaignId}?draftCleanup=1`, { method: "DELETE" });

    expect(response.status).toBe(200);
    expect(storageMock.deleteCampaignCascade).toHaveBeenCalledWith(campaignId);
  });

  it("rejects stale wizard cleanup after the campaign is active", async () => {
    storageMock.getCampaign.mockResolvedValue({ id: campaignId, ownerId: "owner-1", status: "active" });

    const response = await fetch(`${baseUrl}/api/campaigns/${campaignId}?draftCleanup=1`, { method: "DELETE" });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ success: false, message: "Campaign is no longer a draft" });
    expect(storageMock.deleteCampaignCascade).not.toHaveBeenCalled();
  });

  it("keeps confirmed manual deletion available for an active campaign", async () => {
    storageMock.getCampaign.mockResolvedValue({ id: campaignId, ownerId: "owner-1", status: "active" });

    const response = await fetch(`${baseUrl}/api/campaigns/${campaignId}`, { method: "DELETE" });

    expect(response.status).toBe(200);
    expect(storageMock.deleteCampaignCascade).toHaveBeenCalledWith(campaignId);
  });
});
