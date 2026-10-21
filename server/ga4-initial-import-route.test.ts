import express from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const campaignId = "83c85794-e849-43c0-92ad-5923b5cb033e";
const storageMock = vi.hoisted(() => ({
  getCampaign: vi.fn(),
  getGA4Connections: vi.fn(),
  updateCampaign: vi.fn(),
  updateCampaignWithGA4DailyInvalidation: vi.fn(),
  deleteCampaignCascade: vi.fn(),
  requestGA4InitialImport: vi.fn(), getGA4InitialImportWork: vi.fn(), getGA4InitialImportStatus: vi.fn(),
  getClients: vi.fn(), getCampaigns: vi.fn(),
}));
const schedulerMock = vi.hoisted(() => ({
  refreshAllGA4DailyMetrics: vi.fn(),
  getGA4DailyRefreshFailure: vi.fn(),
  recoverInterruptedGA4Refreshes: vi.fn(),
}));

vi.mock("./storage", () => ({ storage: storageMock }));
vi.mock("./db", () => ({ db: null, pool: null }));
vi.mock("@clerk/express", () => ({ getAuth: vi.fn(() => ({ userId: "owner-1" })) }));
vi.mock("./ga4-daily-scheduler", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./ga4-daily-scheduler")>()),
  refreshAllGA4DailyMetrics: schedulerMock.refreshAllGA4DailyMetrics,
  getGA4DailyRefreshFailure: schedulerMock.getGA4DailyRefreshFailure,
  recoverInterruptedGA4Refreshes: schedulerMock.recoverInterruptedGA4Refreshes,
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
    storageMock.getGA4InitialImportWork.mockResolvedValue(undefined);
    storageMock.getGA4InitialImportStatus.mockResolvedValue(null);
    storageMock.requestGA4InitialImport.mockResolvedValue({ id: "work-1" });
    schedulerMock.recoverInterruptedGA4Refreshes.mockResolvedValue(undefined);
    storageMock.getClients.mockResolvedValue([{ id: "client-1" }]);
    storageMock.getCampaign.mockResolvedValue({
      id: campaignId,
      ownerId: "owner-1",
      clientId: "client-1",
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

  it.each([
    { body: { currency: "EUR" }, invalidates: true },
    { body: { currency: "USD" }, invalidates: false },
    { body: { name: "Renamed campaign" }, invalidates: false },
  ])("V1-087 currency edit $body preserves the exact invalidation boundary", async ({ body, invalidates }) => {
    storageMock.getCampaign.mockResolvedValue({ id: campaignId, ownerId: "owner-1", status: "active", currency: "USD", reportingTimeZone: "UTC" });
    const response = await fetch(`${baseUrl}/api/campaigns/${campaignId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    expect(response.status).toBe(200);
    expect(storageMock.updateCampaignWithGA4DailyInvalidation).toHaveBeenCalledTimes(invalidates ? 1 : 0);
    expect(storageMock.updateCampaign).toHaveBeenCalledTimes(invalidates ? 0 : 1);
    expect(schedulerMock.refreshAllGA4DailyMetrics).not.toHaveBeenCalled();
    if (invalidates) expect(storageMock.updateCampaignWithGA4DailyInvalidation).toHaveBeenCalledWith(campaignId, body);
  });

  it("V1-087 refuses another customer's currency edit before invalidating anything", async () => {
    storageMock.getCampaign.mockResolvedValue({ id: campaignId, ownerId: "owner-2", status: "active", currency: "USD" });
    const response = await fetch(`${baseUrl}/api/campaigns/${campaignId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currency: "EUR" }),
    });
    expect(response.status).toBe(404);
    expect(storageMock.updateCampaignWithGA4DailyInvalidation).not.toHaveBeenCalled();
    expect(storageMock.updateCampaign).not.toHaveBeenCalled();
  });

  const activate = (platform = "google-analytics, google-ads", ga4CampaignFilter: string | null = "selected_campaign") =>
    fetch(`${baseUrl}/api/campaigns/${campaignId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "active", platform, ga4CampaignFilter }),
    });

  const queue = (extra = {}) => fetch(`${baseUrl}/api/campaigns/${campaignId}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "active", platform: "google-analytics", ga4CampaignFilter: "selected_campaign", asyncInitialImport: true, ...extra }),
  });
  it("acknowledges persisted initial work without waiting for the provider", async () => {
    schedulerMock.recoverInterruptedGA4Refreshes.mockReturnValueOnce(new Promise(() => {}));
    const initialImport = { state: "queued", canRetry: false, dataThroughDate: "2026-10-17", error: null };
    storageMock.getGA4InitialImportStatus.mockResolvedValue(initialImport);
    const response = await queue();
    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({ status: "draft", initialImport });
    expect(storageMock.requestGA4InitialImport).toHaveBeenCalledWith(campaignId, "owner-1", { platform: "google-analytics", ga4CampaignFilter: "selected_campaign" }, false);
    expect(storageMock.updateCampaign).not.toHaveBeenCalled();
    expect(schedulerMock.refreshAllGA4DailyMetrics).not.toHaveBeenCalled();
  });
  it("does not dispatch work when persistence fails", async () => {
    storageMock.requestGA4InitialImport.mockRejectedValueOnce(new Error("database unavailable"));
    expect((await queue()).status).toBe(500);
    expect(schedulerMock.recoverInterruptedGA4Refreshes).not.toHaveBeenCalled();
  });
  it("forwards an explicit retry while ignoring caller-supplied worker ownership", async () => {
    expect((await queue({ retryInitialImport: true, refreshScope: { work: { id: "forged" } } })).status).toBe(202);
    expect(storageMock.requestGA4InitialImport).toHaveBeenCalledWith(campaignId, "owner-1", { platform: "google-analytics", ga4CampaignFilter: "selected_campaign" }, true);
    expect(schedulerMock.recoverInterruptedGA4Refreshes).toHaveBeenCalledWith();
  });
  it("preserves existing campaign GET format unless initial-import status is requested", async () => {
    storageMock.getGA4InitialImportStatus.mockResolvedValue({ state: "running" });
    expect(await (await fetch(`${baseUrl}/api/campaigns/${campaignId}`)).json()).not.toHaveProperty("initialImport");
    expect(await (await fetch(`${baseUrl}/api/campaigns/${campaignId}?initialImport=1`)).json()).toHaveProperty("initialImport.state", "running");
  });
  it("exposes only accepted imports owned by the selected client in the opted-in list", async () => {
    const draft = await storageMock.getCampaign();
    storageMock.getCampaigns.mockResolvedValue([draft, { ...draft, id: "other", ownerId: "owner-2" }, { ...draft, id: "unaccepted" }, { ...draft, id: "wrong-client", clientId: "client-2" }]);
    storageMock.getGA4InitialImportStatus.mockImplementation(async id => id === campaignId ? { state: "running" } : null);
    expect(await (await fetch(`${baseUrl}/api/campaigns?clientId=client-1`)).json()).toEqual([]);
    const visible = await (await fetch(`${baseUrl}/api/campaigns?clientId=client-1&includeInitialImports=1`)).json();
    expect(visible.map((c: any) => c.id)).toEqual([campaignId]);
    expect(storageMock.getGA4InitialImportStatus.mock.calls.every(([id]) => [campaignId, "unaccepted"].includes(id))).toBe(true);
  });
  it("rejects cross-owner status and Create requests before looking up work", async () => {
    storageMock.getCampaign.mockResolvedValue({ id: campaignId, ownerId: "other-owner", status: "draft" });
    expect((await queue()).status).toBe(404);
    expect((await fetch(`${baseUrl}/api/campaigns/${campaignId}?initialImport=1`)).status).toBe(404);
    expect(storageMock.requestGA4InitialImport).not.toHaveBeenCalled();
    expect(storageMock.getGA4InitialImportStatus).not.toHaveBeenCalled();
  });
  it("acknowledges completed Create retries without changing active campaign data", async () => {
    storageMock.getCampaign.mockResolvedValue({ id: campaignId, ownerId: "owner-1", status: "active" });
    storageMock.getGA4InitialImportStatus.mockResolvedValue({ state: "completed" });
    expect((await queue()).status).toBe(200);
    expect(storageMock.requestGA4InitialImport).not.toHaveBeenCalled();
    expect(storageMock.updateCampaign).not.toHaveBeenCalled();
  });
  it("does not let an old browser start a synchronous import over accepted work", async () => {
    storageMock.getGA4InitialImportWork.mockResolvedValue({ id: "work-1" });
    expect((await activate()).status).toBe(409);
    expect(storageMock.updateCampaignWithGA4DailyInvalidation).not.toHaveBeenCalled();
    expect(schedulerMock.refreshAllGA4DailyMetrics).not.toHaveBeenCalled();
  });
  it("rejects imports while recovery is disabled", async () => {
    vi.stubEnv("GA4_DURABLE_RECOVERY_ENABLED", "false");
    try { expect((await queue()).status).toBe(503); }
    finally { vi.unstubAllEnvs(); }
    expect(storageMock.requestGA4InitialImport).not.toHaveBeenCalled();
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
    expect(storageMock.deleteCampaignCascade).toHaveBeenCalledWith(campaignId, { expectedDraftOwnerId: "owner-1" });
  });

  it("returns conflict if the draft is finalized after the initial route check", async () => {
    storageMock.deleteCampaignCascade.mockRejectedValueOnce(new Error("CAMPAIGN_NO_LONGER_DRAFT"));
    const response = await fetch(`${baseUrl}/api/campaigns/${campaignId}?draftCleanup=1`, { method: "DELETE" });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ success: false, message: "Campaign is no longer a draft" });
    expect(storageMock.deleteCampaignCascade).toHaveBeenCalledWith(campaignId, { expectedDraftOwnerId: "owner-1" });
  });

  it("reports not found when a draft disappears before the locked delete", async () => {
    storageMock.deleteCampaignCascade.mockResolvedValueOnce(false);
    const response = await fetch(`${baseUrl}/api/campaigns/${campaignId}?draftCleanup=1`, { method: "DELETE" });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ message: "Campaign not found" });
  });

  it("does not delete a campaign belonging to another owner", async () => {
    storageMock.getCampaign.mockResolvedValue({ id: campaignId, ownerId: "another-owner", status: "draft" });
    const response = await fetch(`${baseUrl}/api/campaigns/${campaignId}?draftCleanup=1`, { method: "DELETE" });
    expect(response.status).toBe(404);
    expect(storageMock.deleteCampaignCascade).not.toHaveBeenCalled();
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
