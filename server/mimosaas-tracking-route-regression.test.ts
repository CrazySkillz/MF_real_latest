import express from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const authState = vi.hoisted(() => ({ userId: "owner-1" }));
const storageMock = vi.hoisted(() => ({
  getCampaign: vi.fn(),
  getMimosaasWebsiteConnections: vi.fn(),
  getMimosaasWebsiteConnection: vi.fn(),
  getMimosaasWebsiteConnectionByTrackingPublicId: vi.fn(),
  createMimosaasWebsiteConnection: vi.fn(),
  updateMimosaasWebsiteConnection: vi.fn(),
  rotateMimosaasWebsiteConnectionSecret: vi.fn(),
  claimMimosaasGtmInstallation: vi.fn(),
  recordMimosaasGtmInstallation: vi.fn(),
  releaseMimosaasGtmInstallationClaim: vi.fn(),
  verifyMimosaasWebsiteConnectionInstallation: vi.fn(),
  getMimosaasTrackingConfiguration: vi.fn(),
  createMimosaasTrackingConfiguration: vi.fn(),
  updateMimosaasTrackingConfiguration: vi.fn(),
  getMimosaasTrackingCampaignMappings: vi.fn(),
  createMimosaasTrackingCampaignMapping: vi.fn(),
  updateMimosaasTrackingCampaignMapping: vi.fn(),
  finalizeMimosaasTrackingCampaign: vi.fn(),
  createMimosaasTrackingEvent: vi.fn(),
  resolveMimosaasTrackingUtmAttribution: vi.fn(),
  getLatestMimosaasTrackingDailySnapshot: vi.fn(),
  getRevenueSources: vi.fn(),
  getSpendSources: vi.fn(),
  getRevenueSource: vi.fn(),
  getSpendSource: vi.fn(),
  deleteRevenueSourceWithRecords: vi.fn(),
  deleteSpendSourceWithRecords: vi.fn(),
}));
const gtmMock = vi.hoisted(() => ({
  listMimosaasGtmContainers: vi.fn(),
  buildMimosaasGtmAuthorization: vi.fn(),
  resolveMimosaasGtmAuthorization: vi.fn(),
  installMimosaasGtmTag: vi.fn(),
}));

vi.mock("./storage", () => ({ storage: storageMock }));
vi.mock("./mimosaas-gtm-installer", () => gtmMock);
vi.mock("./db", () => ({ db: null, pool: null }));
vi.mock("@clerk/express", () => ({ getAuth: vi.fn(() => ({ userId: authState.userId })) }));
vi.mock("./middleware/rateLimiter", () => {
  const pass = (_req: any, _res: any, next: any) => next();
  return { oauthRateLimiter: pass, linkedInApiRateLimiter: pass, googleSheetsRateLimiter: pass, ga4RateLimiter: pass, importRateLimiter: pass, mimosaasTrackingRateLimiter: pass };
});
vi.mock("jspdf", () => ({ jsPDF: class {} }));

import { registerRoutes } from "./routes-oauth";
import { hashMimosaasTrackingSecret } from "./utils/mimosaas-tracking-auth";

const campaign = { id: "campaign-1", ownerId: "owner-1", clientId: "client-1", clientWebsite: "https://example.com" };
const trackingId = `mtk_${"a".repeat(32)}`;
const trackingSecret = `mts_${"b".repeat(43)}`;
const trackingSecretHash = hashMimosaasTrackingSecret(trackingSecret);
const validTrackingEvent = () => ({
  trackingId,
  trackingSecret,
  eventId: "event_1",
  eventTime: new Date().toISOString(),
  anonymousVisitorId: "visitor_1",
  sessionId: "session_1",
  eventName: "page_view",
  url: "https://example.com/landing?utm_campaign=autumn",
  utmCampaign: "autumn",
});
let server: any;
let baseUrl = "";

describe("Mimosaas Tracking read-only setup route", () => {
  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    server = await registerRoutes(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.MIMOSAAS_TRACKING_ENABLED;
    delete process.env.MIMOSAAS_TRACKING_INGESTION_ENABLED;
    delete process.env.MIMOSAAS_TRACKING_GTM_ENABLED;
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    authState.userId = "owner-1";
    storageMock.getCampaign.mockResolvedValue(campaign);
    storageMock.getMimosaasWebsiteConnections.mockResolvedValue([]);
    storageMock.getMimosaasWebsiteConnection.mockResolvedValue({
      id: "website-1", ownerId: "owner-1", clientId: "client-1", websiteUrl: "https://example.com",
      installationMethod: "google_tag_manager", installationStatus: "pending", trackingPublicId: trackingId,
      trackingSecretHash, trackingSecretCreatedAt: new Date("2026-10-15T10:00:00.000Z"), installationMetadata: null,
    });
    storageMock.getMimosaasWebsiteConnectionByTrackingPublicId.mockResolvedValue({
      id: "website-1", ownerId: "owner-1", clientId: "client-1", websiteUrl: "https://example.com",
      installationStatus: "verified", trackingPublicId: trackingId, trackingSecretHash,
    });
    storageMock.createMimosaasTrackingEvent.mockResolvedValue({ event: { id: "event-row-1", eventId: "event_1" }, inserted: true });
    storageMock.resolveMimosaasTrackingUtmAttribution.mockResolvedValue({ eventId: "event_1", status: "attributed", campaignId: campaign.id });
    storageMock.getLatestMimosaasTrackingDailySnapshot.mockResolvedValue(undefined);
    storageMock.getRevenueSources.mockResolvedValue([]);
    storageMock.getSpendSources.mockResolvedValue([]);
    storageMock.getRevenueSource.mockResolvedValue(undefined);
    storageMock.getSpendSource.mockResolvedValue(undefined);
    storageMock.deleteRevenueSourceWithRecords.mockResolvedValue(false);
    storageMock.deleteSpendSourceWithRecords.mockResolvedValue(false);
    storageMock.verifyMimosaasWebsiteConnectionInstallation.mockResolvedValue({
      newlyVerified: true,
      connection: { id: "website-1", installationStatus: "verified", verifiedAt: new Date("2026-10-15T10:00:00.000Z"), lastEventAt: new Date("2026-10-15T10:00:00.000Z") },
    });
    storageMock.createMimosaasWebsiteConnection.mockImplementation(async (_ownerId, clientId, input) => ({
      id: "website-1", ownerId: "owner-1", clientId, trackingPublicId: "mtk_public", trackingSecret: "mts_secret", trackingSecretHash: "sha256:private", installationMetadata: { private: true }, ...input,
    }));
    storageMock.updateMimosaasWebsiteConnection.mockImplementation(async (_ownerId, clientId, connectionId, input) => ({
      id: connectionId, ownerId: "owner-1", clientId, ...input,
    }));
    storageMock.rotateMimosaasWebsiteConnectionSecret.mockImplementation(async (_ownerId, clientId, connectionId) => ({
      id: connectionId, ownerId: "owner-1", clientId, trackingPublicId: "mtk_public", trackingSecret: "mts_rotated", trackingSecretHash: "sha256:private", installationStatus: "pending",
    }));
    storageMock.claimMimosaasGtmInstallation.mockImplementation(async (_ownerId, clientId, connectionId) => ({
      alreadyInstalled: false,
      connection: { id: connectionId, ownerId: "owner-1", clientId, websiteUrl: "https://example.com", installationStatus: "pending", trackingPublicId: trackingId },
    }));
    storageMock.recordMimosaasGtmInstallation.mockImplementation(async (_ownerId, clientId, connectionId, _hash, _attemptId, metadata) => ({
      id: connectionId, ownerId: "owner-1", clientId, websiteUrl: "https://example.com", installationMethod: "google_tag_manager",
      installationStatus: "pending", trackingPublicId: trackingId, installationMetadata: metadata,
    }));
    storageMock.releaseMimosaasGtmInstallationClaim.mockResolvedValue(true);
    storageMock.getMimosaasTrackingConfiguration.mockResolvedValue({ id: "configuration-1", campaignId: campaign.id });
    storageMock.createMimosaasTrackingConfiguration.mockImplementation(async (_ownerId, _clientId, campaignId, input) => ({
      id: "configuration-1", campaignId, ...input,
    }));
    storageMock.updateMimosaasTrackingConfiguration.mockImplementation(async (_ownerId, _clientId, campaignId, input) => ({
      id: "configuration-1", campaignId, ...input,
    }));
    storageMock.getMimosaasTrackingCampaignMappings.mockResolvedValue([{ id: "mapping-1", campaignId: campaign.id, mappingType: "utm_campaign" }]);
    storageMock.createMimosaasTrackingCampaignMapping.mockImplementation(async (_ownerId, _clientId, campaignId, input) => ({
      id: "mapping-1", campaignId, ...input,
    }));
    storageMock.updateMimosaasTrackingCampaignMapping.mockImplementation(async (_ownerId, _clientId, campaignId, mappingId, input) => ({
      id: mappingId, campaignId, mappingType: "utm_campaign", ...input,
    }));
    storageMock.finalizeMimosaasTrackingCampaign.mockResolvedValue({
      campaign: { ...campaign, platform: "mimosaas-tracking", status: "active", reportingTimeZone: "UTC" },
      configuration: { id: "configuration-1", campaignId: campaign.id, status: "active" },
    });
    gtmMock.resolveMimosaasGtmAuthorization.mockReturnValue(null);
    gtmMock.installMimosaasGtmTag.mockResolvedValue({ containerPath: "accounts/1/containers/10", containerPublicId: "GTM-WEB" });
  });

  afterAll(async () => {
    delete process.env.MIMOSAAS_TRACKING_ENABLED;
    delete process.env.MIMOSAAS_TRACKING_INGESTION_ENABLED;
    delete process.env.MIMOSAAS_TRACKING_GTM_ENABLED;
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    await new Promise<void>((resolve, reject) => server.close((error: Error) => error ? reject(error) : resolve()));
  });

  it("remains unavailable and performs no storage reads while the feature flag is off", async () => {
    const response = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/mimosaas-tracking/configuration`);
    expect(response.status).toBe(404);
    expect(storageMock.getCampaign).not.toHaveBeenCalled();
    expect(storageMock.getMimosaasTrackingConfiguration).not.toHaveBeenCalled();
  });

  it("keeps public ingestion unavailable unless its separate feature flag is enabled", async () => {
    process.env.MIMOSAAS_TRACKING_ENABLED = "true";
    const response = await fetch(`${baseUrl}/api/mimosaas-tracking/events`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(validTrackingEvent()),
    });

    expect(response.status).toBe(404);
    expect(storageMock.getMimosaasWebsiteConnectionByTrackingPublicId).not.toHaveBeenCalled();
    expect(storageMock.createMimosaasTrackingEvent).not.toHaveBeenCalled();
  });

  it("keeps finalized snapshots unavailable unless both tracker flags are enabled", async () => {
    process.env.MIMOSAAS_TRACKING_ENABLED = "true";
    const response = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/mimosaas-tracking/daily-snapshot`);

    expect(response.status).toBe(404);
    expect(storageMock.getCampaign).not.toHaveBeenCalled();
    expect(storageMock.getLatestMimosaasTrackingDailySnapshot).not.toHaveBeenCalled();
  });

  it("returns only the latest finalized snapshot's executive fields", async () => {
    process.env.MIMOSAAS_TRACKING_ENABLED = "true";
    process.env.MIMOSAAS_TRACKING_INGESTION_ENABLED = "true";
    storageMock.getLatestMimosaasTrackingDailySnapshot.mockResolvedValueOnce({
      id: "snapshot-1", campaignId: campaign.id, reportingDate: "2026-10-14", reportingTimeZone: "Europe/Amsterdam",
      users: 10, sessions: 12, engagedSessions: 8, pageviews: 20, conversions: 2,
      engagementRate: "66.6667", conversionRate: "16.6667", revenue: "100.00", spend: null,
      currency: "EUR", revenueStatus: "available", spendStatus: "unavailable",
      sourceStates: { private: true }, financialSnapshotId: "financial-1", publishedAt: new Date("2026-10-15T06:00:00.000Z"),
    });

    const response = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/mimosaas-tracking/daily-snapshot`);
    const body: any = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(storageMock.getLatestMimosaasTrackingDailySnapshot).toHaveBeenCalledWith("owner-1", "client-1", campaign.id);
    expect(body.snapshot).toMatchObject({ reportingDate: "2026-10-14", sessions: 12, revenue: "100.00", spendStatus: "unavailable" });
    expect(body.snapshot).not.toHaveProperty("id");
    expect(body.snapshot).not.toHaveProperty("campaignId");
    expect(body.snapshot).not.toHaveProperty("sourceStates");
    expect(body.snapshot).not.toHaveProperty("financialSnapshotId");
  });

  it("keeps tracker financial source reads disabled with ingestion", async () => {
    process.env.MIMOSAAS_TRACKING_ENABLED = "true";
    const response = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/mimosaas-tracking/financial-sources`);

    expect(response.status).toBe(404);
    expect(storageMock.getCampaign).not.toHaveBeenCalled();
    expect(storageMock.getRevenueSources).not.toHaveBeenCalled();
    expect(storageMock.getSpendSources).not.toHaveBeenCalled();
  });

  it("returns only active tracker Google Sheets financial sources for an owned active tracker campaign", async () => {
    process.env.MIMOSAAS_TRACKING_ENABLED = "true";
    process.env.MIMOSAAS_TRACKING_INGESTION_ENABLED = "true";
    storageMock.getCampaign.mockResolvedValueOnce({ ...campaign, platform: "mimosaas-tracking", status: "active" });
    storageMock.getRevenueSources.mockResolvedValueOnce([
      { id: "revenue-1", sourceType: "google_sheets", platformContext: "mimosaas_tracking", displayName: "Revenue sheet", currency: "EUR", mappingConfig: "{}", isActive: true },
      { id: "revenue-foreign", sourceType: "google_sheets", platformContext: "ga4", isActive: true },
    ]);
    storageMock.getSpendSources.mockResolvedValueOnce([
      { id: "spend-1", sourceType: "google_sheets", platformContext: "mimosaas_tracking", displayName: "Spend sheet", currency: "EUR", mappingConfig: "{}", isActive: true },
      { id: "spend-unsupported", sourceType: "csv", platformContext: "mimosaas_tracking", isActive: true },
    ]);

    const response = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/mimosaas-tracking/financial-sources`);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      success: true,
      revenueSources: [{ id: "revenue-1", sourceType: "google_sheets", platformContext: "mimosaas_tracking", displayName: "Revenue sheet", currency: "EUR", mappingConfig: "{}", isActive: true }],
      spendSources: [{ id: "spend-1", sourceType: "google_sheets", platformContext: "mimosaas_tracking", displayName: "Spend sheet", currency: "EUR", mappingConfig: "{}", isActive: true }],
    });
    expect(storageMock.getRevenueSources).toHaveBeenCalledWith(campaign.id, "mimosaas_tracking");
    expect(storageMock.getSpendSources).toHaveBeenCalledWith(campaign.id, "mimosaas_tracking");
  });

  it("rejects tracker financial source reads for a non-tracker campaign", async () => {
    process.env.MIMOSAAS_TRACKING_ENABLED = "true";
    process.env.MIMOSAAS_TRACKING_INGESTION_ENABLED = "true";
    const response = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/mimosaas-tracking/financial-sources`);

    expect(response.status).toBe(404);
    expect(storageMock.getRevenueSources).not.toHaveBeenCalled();
    expect(storageMock.getSpendSources).not.toHaveBeenCalled();
  });

  it("does not read tracker financial sources for another owner's campaign", async () => {
    process.env.MIMOSAAS_TRACKING_ENABLED = "true";
    process.env.MIMOSAAS_TRACKING_INGESTION_ENABLED = "true";
    storageMock.getCampaign.mockResolvedValueOnce({ ...campaign, ownerId: "owner-2", platform: "mimosaas-tracking", status: "active" });

    const response = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/mimosaas-tracking/financial-sources`);

    expect(response.status).toBe(404);
    expect(storageMock.getRevenueSources).not.toHaveBeenCalled();
    expect(storageMock.getSpendSources).not.toHaveBeenCalled();
  });

  it("returns no partial tracker financial source list when either scoped read fails", async () => {
    process.env.MIMOSAAS_TRACKING_ENABLED = "true";
    process.env.MIMOSAAS_TRACKING_INGESTION_ENABLED = "true";
    storageMock.getCampaign.mockResolvedValueOnce({ ...campaign, platform: "mimosaas-tracking", status: "active" });
    storageMock.getRevenueSources.mockResolvedValueOnce([{ id: "revenue-1" }]);
    storageMock.getSpendSources.mockRejectedValueOnce(new Error("database unavailable"));

    const response = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/mimosaas-tracking/financial-sources`);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ success: false, message: "Failed to fetch Mimosaas Tracking financial sources" });
  });

  it.each([
    ["revenue", "revenue-1", "getRevenueSource", "deleteRevenueSourceWithRecords"],
    ["spend", "spend-1", "getSpendSource", "deleteSpendSourceWithRecords"],
  ] as const)("deletes only the selected tracker Google Sheets %s source", async (sourceKind, sourceId, getMethod, deleteMethod) => {
    process.env.MIMOSAAS_TRACKING_ENABLED = "true";
    process.env.MIMOSAAS_TRACKING_INGESTION_ENABLED = "true";
    storageMock.getCampaign.mockResolvedValueOnce({ ...campaign, platform: "mimosaas-tracking", status: "active" });
    storageMock[getMethod].mockResolvedValueOnce({ id: sourceId, sourceType: "google_sheets", platformContext: "mimosaas_tracking", isActive: true });
    storageMock[deleteMethod].mockResolvedValueOnce(true);

    const response = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/mimosaas-tracking/financial-sources/${sourceKind}/${sourceId}`, { method: "DELETE" });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, sourceKind, sourceId });
    expect(storageMock[getMethod]).toHaveBeenCalledWith(campaign.id, sourceId, ...(sourceKind === "spend" ? ["mimosaas_tracking"] : []));
    expect(storageMock[deleteMethod]).toHaveBeenCalledWith(campaign.id, sourceId, "mimosaas_tracking");
    expect(storageMock[sourceKind === "revenue" ? "deleteSpendSourceWithRecords" : "deleteRevenueSourceWithRecords"]).not.toHaveBeenCalled();
  });

  it("rejects non-tracker sources without deleting records", async () => {
    process.env.MIMOSAAS_TRACKING_ENABLED = "true";
    process.env.MIMOSAAS_TRACKING_INGESTION_ENABLED = "true";
    storageMock.getCampaign.mockResolvedValueOnce({ ...campaign, platform: "mimosaas-tracking", status: "active" });
    storageMock.getRevenueSource.mockResolvedValueOnce({ id: "revenue-ga4", sourceType: "google_sheets", platformContext: "ga4", isActive: true });

    const response = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/mimosaas-tracking/financial-sources/revenue/revenue-ga4`, { method: "DELETE" });

    expect(response.status).toBe(404);
    expect(storageMock.deleteRevenueSourceWithRecords).not.toHaveBeenCalled();
    expect(storageMock.deleteSpendSourceWithRecords).not.toHaveBeenCalled();
  });

  it.each([
    ["a non-tracker campaign", { ...campaign, platform: "google_analytics", status: "active" }],
    ["another owner's campaign", { ...campaign, ownerId: "owner-2", platform: "mimosaas-tracking", status: "active" }],
  ])("does not delete tracker financial sources for %s", async (_case, inaccessibleCampaign) => {
    process.env.MIMOSAAS_TRACKING_ENABLED = "true";
    process.env.MIMOSAAS_TRACKING_INGESTION_ENABLED = "true";
    storageMock.getCampaign.mockResolvedValueOnce(inaccessibleCampaign);

    const response = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/mimosaas-tracking/financial-sources/revenue/revenue-1`, { method: "DELETE" });

    expect(response.status).toBe(404);
    expect(storageMock.getRevenueSource).not.toHaveBeenCalled();
    expect(storageMock.deleteRevenueSourceWithRecords).not.toHaveBeenCalled();
  });

  it("fails closed when a tracker source changes before deletion", async () => {
    process.env.MIMOSAAS_TRACKING_ENABLED = "true";
    process.env.MIMOSAAS_TRACKING_INGESTION_ENABLED = "true";
    storageMock.getCampaign.mockResolvedValueOnce({ ...campaign, platform: "mimosaas-tracking", status: "active" });
    storageMock.getSpendSource.mockResolvedValueOnce({ id: "spend-1", sourceType: "google_sheets", platformContext: "mimosaas_tracking", isActive: true });

    const response = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/mimosaas-tracking/financial-sources/spend/spend-1`, { method: "DELETE" });

    expect(response.status).toBe(409);
    expect(storageMock.deleteSpendSourceWithRecords).toHaveBeenCalledWith(campaign.id, "spend-1", "mimosaas_tracking");
  });

  it("returns null without falling back when no finalized snapshot exists", async () => {
    process.env.MIMOSAAS_TRACKING_ENABLED = "true";
    process.env.MIMOSAAS_TRACKING_INGESTION_ENABLED = "true";

    const response = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/mimosaas-tracking/daily-snapshot`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, snapshot: null });
  });

  it("does not read a finalized snapshot for another owner's campaign", async () => {
    process.env.MIMOSAAS_TRACKING_ENABLED = "true";
    process.env.MIMOSAAS_TRACKING_INGESTION_ENABLED = "true";
    storageMock.getCampaign.mockResolvedValueOnce({ ...campaign, ownerId: "owner-2" });

    const response = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/mimosaas-tracking/daily-snapshot`);

    expect(response.status).toBe(404);
    expect(storageMock.getLatestMimosaasTrackingDailySnapshot).not.toHaveBeenCalled();
  });

  it("exposes wizard availability only to a signed-in user while both flags are enabled", async () => {
    process.env.MIMOSAAS_TRACKING_ENABLED = "true";
    const ingestionDisabled = await fetch(`${baseUrl}/api/mimosaas-tracking/availability`);
    process.env.MIMOSAAS_TRACKING_INGESTION_ENABLED = "true";
    authState.userId = "";
    const signedOut = await fetch(`${baseUrl}/api/mimosaas-tracking/availability`);
    authState.userId = "owner-1";
    const enabled = await fetch(`${baseUrl}/api/mimosaas-tracking/availability`);

    expect(ingestionDisabled.status).toBe(404);
    expect(signedOut.status).toBe(401);
    expect(enabled.status).toBe(200);
    expect(enabled.headers.get("cache-control")).toBe("no-store");
    expect(await enabled.json()).toEqual({ enabled: true });
  });

  it("keeps GTM setup behind its separate feature flag", async () => {
    process.env.MIMOSAAS_TRACKING_ENABLED = "true";
    process.env.MIMOSAAS_TRACKING_INGESTION_ENABLED = "true";
    const response = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/mimosaas-tracking/gtm/availability`);

    expect(response.status).toBe(404);
    expect(storageMock.getCampaign).not.toHaveBeenCalled();
    expect(storageMock.getMimosaasWebsiteConnection).not.toHaveBeenCalled();
  });

  it("starts scoped GTM OAuth without returning tracking credentials", async () => {
    process.env.MIMOSAAS_TRACKING_ENABLED = "true";
    process.env.MIMOSAAS_TRACKING_INGESTION_ENABLED = "true";
    process.env.MIMOSAAS_TRACKING_GTM_ENABLED = "true";
    process.env.GOOGLE_CLIENT_ID = "google-client";
    process.env.GOOGLE_CLIENT_SECRET = "google-secret";
    const response = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/mimosaas-tracking/gtm/connect`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ connectionId: "website-1" }),
    });
    const body = await response.json();
    const authUrl = new URL(body.authUrl);

    expect(response.status).toBe(200);
    expect(authUrl.origin).toBe("https://accounts.google.com");
    expect(authUrl.searchParams.get("scope")).toContain("tagmanager.edit.containers");
    expect(authUrl.searchParams.get("scope")).toContain("tagmanager.publish");
    expect(JSON.stringify(body)).not.toContain(trackingSecret);
    expect(storageMock.getMimosaasWebsiteConnection).toHaveBeenCalledWith("owner-1", "client-1", "website-1");
  });

  it("returns only an encrypted short-lived GTM authorization from the scoped callback", async () => {
    process.env.MIMOSAAS_TRACKING_ENABLED = "true";
    process.env.MIMOSAAS_TRACKING_INGESTION_ENABLED = "true";
    process.env.MIMOSAAS_TRACKING_GTM_ENABLED = "true";
    process.env.GOOGLE_CLIENT_ID = "google-client";
    process.env.GOOGLE_CLIENT_SECRET = "google-secret";
    const nativeFetch = globalThis.fetch;
    const container = { path: "accounts/1/containers/10", publicId: "GTM-WEB", name: "Website", domainNames: ["example.com"], recommended: true };
    gtmMock.listMimosaasGtmContainers.mockResolvedValue([container]);
    gtmMock.buildMimosaasGtmAuthorization.mockReturnValue({ v: 1, iv: "iv", tag: "tag", data: "encrypted" });
    const providerFetch = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      if (String(input) === "https://oauth2.googleapis.com/token") {
        return new Response(JSON.stringify({ access_token: "google-access-token" }), { status: 200, headers: { "content-type": "application/json" } });
      }
      return nativeFetch(input, init);
    });
    try {
      const start = await nativeFetch(`${baseUrl}/api/campaigns/${campaign.id}/mimosaas-tracking/gtm/connect`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ connectionId: "website-1" }),
      });
      const authUrl = new URL((await start.json()).authUrl);
      const callback = await nativeFetch(`${baseUrl}/api/auth/mimosaas-tracking/gtm/callback?code=google-code&state=${encodeURIComponent(String(authUrl.searchParams.get("state")))}`);
      const html = await callback.text();

      expect(callback.status).toBe(200);
      expect(html).toContain("mimosaas_gtm_auth_success");
      expect(html).toContain("encrypted");
      expect(html).not.toContain("google-access-token");
      expect(gtmMock.listMimosaasGtmContainers).toHaveBeenCalledWith("google-access-token", "https://example.com");
    } finally {
      providerFetch.mockRestore();
    }
  });

  it("fails the GTM callback closed when the signed-in campaign owner changes", async () => {
    process.env.MIMOSAAS_TRACKING_ENABLED = "true";
    process.env.MIMOSAAS_TRACKING_INGESTION_ENABLED = "true";
    process.env.MIMOSAAS_TRACKING_GTM_ENABLED = "true";
    process.env.GOOGLE_CLIENT_ID = "google-client";
    process.env.GOOGLE_CLIENT_SECRET = "google-secret";
    const start = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/mimosaas-tracking/gtm/connect`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ connectionId: "website-1" }),
    });
    const authUrl = new URL((await start.json()).authUrl);
    authState.userId = "other-owner";
    const callback = await fetch(`${baseUrl}/api/auth/mimosaas-tracking/gtm/callback?code=google-code&state=${encodeURIComponent(String(authUrl.searchParams.get("state")))}`);
    const html = await callback.text();

    expect(callback.status).toBe(200);
    expect(html).toContain("mimosaas_gtm_auth_error");
    expect(html).toContain("Campaign not found");
    expect(gtmMock.listMimosaasGtmContainers).not.toHaveBeenCalled();
  });

  it("installs only an authorized container and persists no plaintext tracker secret", async () => {
    process.env.MIMOSAAS_TRACKING_ENABLED = "true";
    process.env.MIMOSAAS_TRACKING_INGESTION_ENABLED = "true";
    process.env.MIMOSAAS_TRACKING_GTM_ENABLED = "true";
    const container = { path: "accounts/1/containers/10", publicId: "GTM-WEB", name: "Website", domainNames: ["example.com"], recommended: true };
    gtmMock.resolveMimosaasGtmAuthorization.mockReturnValue({ accessToken: "access-token", container });
    const response = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/mimosaas-tracking/gtm/install`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        connectionId: "website-1",
        trackingSecret,
        containerPath: container.path,
        authorization: { v: 1, iv: "iv", tag: "tag", data: "data" },
      }),
    });

    expect(response.status).toBe(200);
    expect(gtmMock.installMimosaasGtmTag).toHaveBeenCalledWith(expect.objectContaining({
      accessToken: "access-token", container, trackingId, trackingSecret,
    }));
    expect(storageMock.claimMimosaasGtmInstallation).toHaveBeenCalledWith(
      "owner-1", "client-1", "website-1", trackingSecretHash,
      expect.any(String), container.path, "2026-10-15T10:00:00.000Z",
    );
    expect(storageMock.recordMimosaasGtmInstallation).toHaveBeenCalledWith(
      "owner-1", "client-1", "website-1", trackingSecretHash, expect.any(String),
      expect.not.objectContaining({ trackingSecret }),
    );
  });

  it("does not call GTM when another installation already holds the connection claim", async () => {
    process.env.MIMOSAAS_TRACKING_ENABLED = "true";
    process.env.MIMOSAAS_TRACKING_INGESTION_ENABLED = "true";
    process.env.MIMOSAAS_TRACKING_GTM_ENABLED = "true";
    const container = { path: "accounts/1/containers/10", publicId: "GTM-WEB", name: "Website", domainNames: ["example.com"], recommended: true };
    gtmMock.resolveMimosaasGtmAuthorization.mockReturnValue({ accessToken: "access-token", container });
    storageMock.claimMimosaasGtmInstallation.mockRejectedValueOnce(Object.assign(new Error("Google Tag Manager installation is already in progress"), { code: "MIMOSAAS_GTM_INSTALLATION_IN_PROGRESS" }));

    const response = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/mimosaas-tracking/gtm/install`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        connectionId: "website-1", trackingSecret, containerPath: container.path,
        authorization: { v: 1, iv: "iv", tag: "tag", data: "data" },
      }),
    });

    expect(response.status).toBe(409);
    expect(gtmMock.installMimosaasGtmTag).not.toHaveBeenCalled();
    expect(storageMock.recordMimosaasGtmInstallation).not.toHaveBeenCalled();
  });

  it("releases its own GTM installation claim when the provider fails", async () => {
    process.env.MIMOSAAS_TRACKING_ENABLED = "true";
    process.env.MIMOSAAS_TRACKING_INGESTION_ENABLED = "true";
    process.env.MIMOSAAS_TRACKING_GTM_ENABLED = "true";
    const container = { path: "accounts/1/containers/10", publicId: "GTM-WEB", name: "Website", domainNames: ["example.com"], recommended: true };
    gtmMock.resolveMimosaasGtmAuthorization.mockReturnValue({ accessToken: "access-token", container });
    gtmMock.installMimosaasGtmTag.mockRejectedValueOnce(new Error("provider failed"));

    const response = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/mimosaas-tracking/gtm/install`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        connectionId: "website-1", trackingSecret, containerPath: container.path,
        authorization: { v: 1, iv: "iv", tag: "tag", data: "data" },
      }),
    });

    expect(response.status).toBe(502);
    expect(storageMock.releaseMimosaasGtmInstallationClaim).toHaveBeenCalledWith(
      "owner-1", "client-1", "website-1", trackingSecretHash, expect.any(String),
    );
    expect(storageMock.recordMimosaasGtmInstallation).not.toHaveBeenCalled();
  });

  it("serves the universal tracker only while both tracker flags are enabled", async () => {
    process.env.MIMOSAAS_TRACKING_ENABLED = "true";
    const disabled = await fetch(`${baseUrl}/api/mimosaas-tracking/tracker.js`);
    process.env.MIMOSAAS_TRACKING_INGESTION_ENABLED = "true";
    const enabled = await fetch(`${baseUrl}/api/mimosaas-tracking/tracker.js`);
    const source = await enabled.text();

    expect(disabled.status).toBe(404);
    expect(enabled.status).toBe(200);
    expect(enabled.headers.get("content-type")).toContain("application/javascript");
    expect(enabled.headers.get("cache-control")).toBe("no-store");
    expect(enabled.headers.get("cross-origin-resource-policy")).toBe("cross-origin");
    expect(enabled.headers.get("x-mimosaas-tracker-version")).toBe("1.0.0");
    expect(source).toContain("/api/mimosaas-tracking/installations/verify");
    expect(source).toContain("/api/mimosaas-tracking/events");
    expect(storageMock.getMimosaasWebsiteConnectionByTrackingPublicId).not.toHaveBeenCalled();
  });

  it("accepts an authenticated same-site event as pending attribution", async () => {
    process.env.MIMOSAAS_TRACKING_ENABLED = "true";
    process.env.MIMOSAAS_TRACKING_INGESTION_ENABLED = "true";
    const response = await fetch(`${baseUrl}/api/mimosaas-tracking/events`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://example.com" },
      body: JSON.stringify(validTrackingEvent()),
    });

    expect(response.status).toBe(202);
    expect(response.headers.get("access-control-allow-origin")).toBe("https://example.com");
    expect(await response.json()).toEqual({ success: true, accepted: true, duplicate: false });
    expect(storageMock.getMimosaasWebsiteConnectionByTrackingPublicId).toHaveBeenCalledWith(trackingId);
    expect(storageMock.createMimosaasTrackingEvent).toHaveBeenCalledWith("website-1", expect.objectContaining({
      eventId: "event_1",
      eventTime: expect.any(Date),
      resolvedCampaignId: null,
      campaignResolutionStatus: "pending",
    }), trackingSecretHash);
    expect(storageMock.resolveMimosaasTrackingUtmAttribution).toHaveBeenCalledWith("website-1", "event_1");
  });

  it("keeps an accepted raw event durable when immediate UTM attribution must be deferred", async () => {
    process.env.MIMOSAAS_TRACKING_ENABLED = "true";
    process.env.MIMOSAAS_TRACKING_INGESTION_ENABLED = "true";
    storageMock.resolveMimosaasTrackingUtmAttribution.mockRejectedValueOnce(new Error("temporary attribution failure"));

    const response = await fetch(`${baseUrl}/api/mimosaas-tracking/events`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://example.com" },
      body: JSON.stringify(validTrackingEvent()),
    });

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ success: true, accepted: true, duplicate: false });
    expect(storageMock.createMimosaasTrackingEvent).toHaveBeenCalledTimes(1);
    expect(storageMock.resolveMimosaasTrackingUtmAttribution).toHaveBeenCalledWith("website-1", "event_1");
  });

  it("supports browser preflight only while ingestion is enabled", async () => {
    process.env.MIMOSAAS_TRACKING_ENABLED = "true";
    process.env.MIMOSAAS_TRACKING_INGESTION_ENABLED = "true";
    const response = await fetch(`${baseUrl}/api/mimosaas-tracking/events`, {
      method: "OPTIONS", headers: { origin: "https://example.com" },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("https://example.com");
    expect(response.headers.get("access-control-allow-methods")).toBe("POST, OPTIONS");
  });

  it("verifies an authenticated same-site installation without creating an analytics event", async () => {
    process.env.MIMOSAAS_TRACKING_ENABLED = "true";
    process.env.MIMOSAAS_TRACKING_INGESTION_ENABLED = "true";
    storageMock.getMimosaasWebsiteConnectionByTrackingPublicId.mockResolvedValueOnce({
      id: "website-1", websiteUrl: "https://example.com", installationStatus: "pending", trackingSecretHash,
    });
    const response = await fetch(`${baseUrl}/api/mimosaas-tracking/installations/verify`, {
      method: "POST", headers: { "content-type": "application/json", origin: "https://example.com" },
      body: JSON.stringify({ trackingId, trackingSecret, url: "https://example.com/landing" }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, verified: true, newlyVerified: true, installationStatus: "verified" });
    expect(storageMock.verifyMimosaasWebsiteConnectionInstallation).toHaveBeenCalledWith("website-1", trackingSecretHash, "https://example.com/landing");
    expect(storageMock.createMimosaasTrackingEvent).not.toHaveBeenCalled();
  });

  it("keeps installation verification disabled with ingestion and rejects untrusted proofs", async () => {
    process.env.MIMOSAAS_TRACKING_ENABLED = "true";
    const disabled = await fetch(`${baseUrl}/api/mimosaas-tracking/installations/verify`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ trackingId, trackingSecret, url: "https://example.com" }),
    });
    process.env.MIMOSAAS_TRACKING_INGESTION_ENABLED = "true";
    const wrongOrigin = await fetch(`${baseUrl}/api/mimosaas-tracking/installations/verify`, {
      method: "POST", headers: { "content-type": "application/json", origin: "https://attacker.example" },
      body: JSON.stringify({ trackingId, trackingSecret, url: "https://example.com" }),
    });
    const missingOrigin = await fetch(`${baseUrl}/api/mimosaas-tracking/installations/verify`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ trackingId, trackingSecret, url: "https://example.com" }),
    });
    const extraFields = await fetch(`${baseUrl}/api/mimosaas-tracking/installations/verify`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ trackingId, trackingSecret, url: "https://example.com", revenue: 100 }),
    });
    const wrongSecret = await fetch(`${baseUrl}/api/mimosaas-tracking/installations/verify`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ trackingId, trackingSecret: `mts_${"c".repeat(43)}`, url: "https://example.com" }),
    });
    const wrongUrl = await fetch(`${baseUrl}/api/mimosaas-tracking/installations/verify`, {
      method: "POST", headers: { "content-type": "application/json", origin: "https://example.com" },
      body: JSON.stringify({ trackingId, trackingSecret, url: "https://attacker.example" }),
    });

    expect(disabled.status).toBe(404);
    expect(wrongOrigin.status).toBe(403);
    expect(missingOrigin.status).toBe(403);
    expect(extraFields.status).toBe(400);
    expect(wrongSecret.status).toBe(401);
    expect(wrongUrl.status).toBe(400);
    expect(storageMock.verifyMimosaasWebsiteConnectionInstallation).not.toHaveBeenCalled();
    expect(storageMock.createMimosaasTrackingEvent).not.toHaveBeenCalled();
  });

  it("fails installation verification closed after credential rotation or deactivation", async () => {
    process.env.MIMOSAAS_TRACKING_ENABLED = "true";
    process.env.MIMOSAAS_TRACKING_INGESTION_ENABLED = "true";
    storageMock.verifyMimosaasWebsiteConnectionInstallation.mockRejectedValueOnce(Object.assign(new Error("rotated"), { code: "MIMOSAAS_TRACKING_AUTH_INVALID" }));
    const rotated = await fetch(`${baseUrl}/api/mimosaas-tracking/installations/verify`, {
      method: "POST", headers: { "content-type": "application/json", origin: "https://example.com" },
      body: JSON.stringify({ trackingId, trackingSecret, url: "https://example.com" }),
    });
    storageMock.getMimosaasWebsiteConnectionByTrackingPublicId.mockResolvedValueOnce({
      id: "website-1", websiteUrl: "https://example.com", installationStatus: "disconnected", trackingSecretHash,
    });
    const inactive = await fetch(`${baseUrl}/api/mimosaas-tracking/installations/verify`, {
      method: "POST", headers: { "content-type": "application/json", origin: "https://example.com" },
      body: JSON.stringify({ trackingId, trackingSecret, url: "https://example.com" }),
    });

    expect(rotated.status).toBe(401);
    expect(inactive.status).toBe(403);
    expect(storageMock.createMimosaasTrackingEvent).not.toHaveBeenCalled();
  });

  it("rejects unknown or incorrect credentials without writing an event", async () => {
    process.env.MIMOSAAS_TRACKING_ENABLED = "true";
    process.env.MIMOSAAS_TRACKING_INGESTION_ENABLED = "true";
    const wrongSecret = await fetch(`${baseUrl}/api/mimosaas-tracking/events`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...validTrackingEvent(), trackingSecret: `mts_${"c".repeat(43)}` }),
    });
    storageMock.getMimosaasWebsiteConnectionByTrackingPublicId.mockResolvedValueOnce(undefined);
    const unknownId = await fetch(`${baseUrl}/api/mimosaas-tracking/events`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(validTrackingEvent()),
    });

    expect(wrongSecret.status).toBe(401);
    expect(unknownId.status).toBe(401);
    expect(storageMock.createMimosaasTrackingEvent).not.toHaveBeenCalled();
  });

  it("rejects monetary, attribution, and malformed payload fields before storage", async () => {
    process.env.MIMOSAAS_TRACKING_ENABLED = "true";
    process.env.MIMOSAAS_TRACKING_INGESTION_ENABLED = "true";
    const response = await fetch(`${baseUrl}/api/mimosaas-tracking/events`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...validTrackingEvent(), revenue: 100, resolvedCampaignId: "campaign-1" }),
    });

    expect(response.status).toBe(400);
    expect(storageMock.getMimosaasWebsiteConnectionByTrackingPublicId).not.toHaveBeenCalled();
    expect(storageMock.createMimosaasTrackingEvent).not.toHaveBeenCalled();
  });

  it("rejects events outside the 48-hour past and five-minute future window", async () => {
    process.env.MIMOSAAS_TRACKING_ENABLED = "true";
    process.env.MIMOSAAS_TRACKING_INGESTION_ENABLED = "true";
    const sendAt = (eventTime: string) => fetch(`${baseUrl}/api/mimosaas-tracking/events`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...validTrackingEvent(), eventTime }),
    });

    const old = await sendAt(new Date(Date.now() - 49 * 60 * 60 * 1000).toISOString());
    const future = await sendAt(new Date(Date.now() + 6 * 60 * 1000).toISOString());
    expect(old.status).toBe(400);
    expect(future.status).toBe(400);
    expect(storageMock.createMimosaasTrackingEvent).not.toHaveBeenCalled();
  });

  it("rejects request and event origins outside the connected website", async () => {
    process.env.MIMOSAAS_TRACKING_ENABLED = "true";
    process.env.MIMOSAAS_TRACKING_INGESTION_ENABLED = "true";
    const wrongRequestOrigin = await fetch(`${baseUrl}/api/mimosaas-tracking/events`, {
      method: "POST", headers: { "content-type": "application/json", origin: "https://attacker.example" },
      body: JSON.stringify(validTrackingEvent()),
    });
    const wrongEventOrigin = await fetch(`${baseUrl}/api/mimosaas-tracking/events`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...validTrackingEvent(), url: "https://attacker.example/landing" }),
    });

    expect(wrongRequestOrigin.status).toBe(403);
    expect(wrongEventOrigin.status).toBe(400);
    expect(storageMock.createMimosaasTrackingEvent).not.toHaveBeenCalled();
  });

  it("rejects inactive connections and credentials rotated during receipt", async () => {
    process.env.MIMOSAAS_TRACKING_ENABLED = "true";
    process.env.MIMOSAAS_TRACKING_INGESTION_ENABLED = "true";
    storageMock.getMimosaasWebsiteConnectionByTrackingPublicId.mockResolvedValueOnce({
      id: "website-1", websiteUrl: "https://example.com", installationStatus: "disconnected", trackingSecretHash,
    });
    const inactive = await fetch(`${baseUrl}/api/mimosaas-tracking/events`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(validTrackingEvent()),
    });
    storageMock.createMimosaasTrackingEvent.mockRejectedValueOnce(Object.assign(new Error("rotated"), { code: "MIMOSAAS_TRACKING_AUTH_INVALID" }));
    const rotated = await fetch(`${baseUrl}/api/mimosaas-tracking/events`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(validTrackingEvent()),
    });

    expect(inactive.status).toBe(403);
    expect(rotated.status).toBe(401);
  });

  it("acknowledges exact retries and rejects conflicting event ID reuse", async () => {
    process.env.MIMOSAAS_TRACKING_ENABLED = "true";
    process.env.MIMOSAAS_TRACKING_INGESTION_ENABLED = "true";
    storageMock.createMimosaasTrackingEvent.mockResolvedValueOnce({ event: { id: "event-row-1" }, inserted: false });
    const retry = await fetch(`${baseUrl}/api/mimosaas-tracking/events`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(validTrackingEvent()),
    });
    storageMock.createMimosaasTrackingEvent.mockRejectedValueOnce(Object.assign(new Error("conflict"), { code: "MIMOSAAS_TRACKING_EVENT_ID_CONFLICT" }));
    const conflict = await fetch(`${baseUrl}/api/mimosaas-tracking/events`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(validTrackingEvent()),
    });

    expect(retry.status).toBe(202);
    expect(await retry.json()).toEqual({ success: true, accepted: true, duplicate: true });
    expect(conflict.status).toBe(409);
  });

  it("returns only the signed-in owner's campaign configuration and mappings", async () => {
    process.env.MIMOSAAS_TRACKING_ENABLED = "true";
    const response = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/mimosaas-tracking/configuration`);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      success: true,
      configuration: { id: "configuration-1", campaignId: campaign.id },
      mappings: [{ id: "mapping-1", campaignId: campaign.id, mappingType: "utm_campaign" }],
    });
    expect(storageMock.getMimosaasTrackingConfiguration).toHaveBeenCalledWith("owner-1", "client-1", campaign.id);
    expect(storageMock.getMimosaasTrackingCampaignMappings).toHaveBeenCalledWith("owner-1", "client-1", campaign.id);
  });

  it("creates a draft campaign configuration with normalized conversion events", async () => {
    process.env.MIMOSAAS_TRACKING_ENABLED = "true";
    const response = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/mimosaas-tracking/configuration`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ websiteConnectionId: "website-1", conversionEventNames: ["purchase", "purchase", "lead"], attributionWindowDays: 30 }),
    });
    expect(response.status).toBe(201);
    expect(storageMock.createMimosaasTrackingConfiguration).toHaveBeenCalledWith("owner-1", "client-1", campaign.id, {
      websiteConnectionId: "website-1", conversionEventNames: ["purchase", "lead"], attributionWindowDays: 30, status: "draft",
    });
  });

  it("rejects caller-controlled configuration status and website changes", async () => {
    process.env.MIMOSAAS_TRACKING_ENABLED = "true";
    const create = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/mimosaas-tracking/configuration`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ websiteConnectionId: "website-1", status: "active" }),
    });
    const update = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/mimosaas-tracking/configuration`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ websiteConnectionId: "foreign-website", status: "active" }),
    });
    expect(create.status).toBe(400);
    expect(update.status).toBe(400);
    expect(storageMock.createMimosaasTrackingConfiguration).not.toHaveBeenCalled();
    expect(storageMock.updateMimosaasTrackingConfiguration).not.toHaveBeenCalled();
  });

  it("returns configuration changes to draft for revalidation", async () => {
    process.env.MIMOSAAS_TRACKING_ENABLED = "true";
    const response = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/mimosaas-tracking/configuration`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ conversionEventNames: ["purchase"], attributionWindowDays: 45 }),
    });
    expect(response.status).toBe(200);
    expect(storageMock.updateMimosaasTrackingConfiguration).toHaveBeenCalledWith("owner-1", "client-1", campaign.id, {
      conversionEventNames: ["purchase"], attributionWindowDays: 45, status: "draft",
    });
  });

  it("fails closed when the selected website is outside the owned client", async () => {
    process.env.MIMOSAAS_TRACKING_ENABLED = "true";
    storageMock.createMimosaasTrackingConfiguration.mockRejectedValueOnce(Object.assign(new Error("scope"), {
      code: "MIMOSAAS_TRACKING_WEBSITE_SCOPE_NOT_FOUND",
    }));
    const response = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/mimosaas-tracking/configuration`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ websiteConnectionId: "foreign-website" }),
    });
    expect(response.status).toBe(404);
  });

  it("creates only an active exact utm_campaign mapping", async () => {
    process.env.MIMOSAAS_TRACKING_ENABLED = "true";
    const response = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/mimosaas-tracking/mappings`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ campaignValue: "summer_sale" }),
    });
    expect(response.status).toBe(201);
    expect(storageMock.createMimosaasTrackingCampaignMapping).toHaveBeenCalledWith("owner-1", "client-1", campaign.id, {
      mappingType: "utm_campaign", campaignValue: "summer_sale", isActive: true,
    });
  });

  it("rejects caller-controlled mapping type or initial active state", async () => {
    process.env.MIMOSAAS_TRACKING_ENABLED = "true";
    const response = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/mimosaas-tracking/mappings`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ campaignValue: "summer_sale", mappingType: "gclid", isActive: false }),
    });
    expect(response.status).toBe(400);
    expect(storageMock.createMimosaasTrackingCampaignMapping).not.toHaveBeenCalled();
  });

  it("updates only an owned utm_campaign mapping", async () => {
    process.env.MIMOSAAS_TRACKING_ENABLED = "true";
    const response = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/mimosaas-tracking/mappings/mapping-1`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ campaignValue: "autumn_sale", isActive: false }),
    });
    expect(response.status).toBe(200);
    expect(storageMock.updateMimosaasTrackingCampaignMapping).toHaveBeenCalledWith("owner-1", "client-1", campaign.id, "mapping-1", {
      campaignValue: "autumn_sale", isActive: false,
    });
  });

  it("does not update a non-UTM mapping through the UTM route", async () => {
    process.env.MIMOSAAS_TRACKING_ENABLED = "true";
    storageMock.getMimosaasTrackingCampaignMappings.mockResolvedValueOnce([{
      id: "mapping-1", campaignId: campaign.id, mappingType: "gclid",
    }]);
    const response = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/mimosaas-tracking/mappings/mapping-1`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ campaignValue: "autumn_sale" }),
    });
    expect(response.status).toBe(404);
    expect(storageMock.updateMimosaasTrackingCampaignMapping).not.toHaveBeenCalled();
  });

  it("finalizes only through the scoped verified Mimosaas Tracking flow", async () => {
    process.env.MIMOSAAS_TRACKING_ENABLED = "true";
    process.env.MIMOSAAS_TRACKING_INGESTION_ENABLED = "true";
    const response = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/mimosaas-tracking/finalize`, { method: "POST" });

    expect(response.status).toBe(200);
    expect(storageMock.finalizeMimosaasTrackingCampaign).toHaveBeenCalledWith("owner-1", "client-1", campaign.id);
    expect(await response.json()).toMatchObject({ id: campaign.id, platform: "mimosaas-tracking", status: "active" });
  });

  it("keeps an unverified Mimosaas Tracking campaign in draft", async () => {
    process.env.MIMOSAAS_TRACKING_ENABLED = "true";
    process.env.MIMOSAAS_TRACKING_INGESTION_ENABLED = "true";
    storageMock.finalizeMimosaasTrackingCampaign.mockRejectedValueOnce(Object.assign(new Error("Website tracking installation is not verified"), {
      code: "MIMOSAAS_TRACKING_INSTALLATION_NOT_VERIFIED",
    }));
    const response = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/mimosaas-tracking/finalize`, { method: "POST" });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ success: false, message: "Website tracking installation is not verified" });
  });

  it("rejects bypassing verified finalization through the generic campaign update", async () => {
    const response = await fetch(`${baseUrl}/api/campaigns/${campaign.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ platform: "mimosaas-tracking", status: "active" }),
    });

    expect(response.status).toBe(400);
    expect(storageMock.finalizeMimosaasTrackingCampaign).not.toHaveBeenCalled();
  });

  it("rejects duplicate website campaign mappings", async () => {
    process.env.MIMOSAAS_TRACKING_ENABLED = "true";
    storageMock.createMimosaasTrackingCampaignMapping.mockRejectedValueOnce(Object.assign(new Error("conflict"), {
      code: "MIMOSAAS_TRACKING_MAPPING_CONFLICT",
    }));
    const response = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/mimosaas-tracking/mappings`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ campaignValue: "summer_sale" }),
    });
    expect(response.status).toBe(409);
  });

  it("lists only the campaign client's connections and omits internal metadata", async () => {
    process.env.MIMOSAAS_TRACKING_ENABLED = "true";
    storageMock.getMimosaasWebsiteConnections.mockResolvedValue([{
      id: "website-1", ownerId: "owner-1", clientId: "client-1", websiteUrl: "https://example.com",
      installationMethod: "google_tag_manager", installationStatus: "pending", trackingPublicId: "mtk_public", trackingSecretHash: "sha256:private", installationMetadata: { private: true },
    }]);
    const response = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/mimosaas-tracking/websites`);
    const body: any = await response.json();
    expect(response.status).toBe(200);
    expect(storageMock.getMimosaasWebsiteConnections).toHaveBeenCalledWith("owner-1", "client-1");
    expect(body.connections[0]).not.toHaveProperty("ownerId");
    expect(body.connections[0]).not.toHaveProperty("installationMetadata");
    expect(body.connections[0]).not.toHaveProperty("trackingSecretHash");
    expect(body.connections[0].trackingPublicId).toBe("mtk_public");
  });

  it("creates a pending connection from a canonical website origin", async () => {
    process.env.MIMOSAAS_TRACKING_ENABLED = "true";
    const response = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/mimosaas-tracking/websites`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ websiteUrl: "https://Example.com/path?query=1", installationMethod: "google_tag_manager" }),
    });
    expect(response.status).toBe(201);
    expect(storageMock.createMimosaasWebsiteConnection).toHaveBeenCalledWith("owner-1", "client-1", {
      websiteUrl: "https://example.com", installationMethod: "google_tag_manager", installationStatus: "pending",
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({
      connection: { trackingPublicId: "mtk_public" },
      credentials: { trackingId: "mtk_public", secret: "mts_secret" },
    });
  });

  it("rotates a scoped website secret and returns it only in the no-store response", async () => {
    process.env.MIMOSAAS_TRACKING_ENABLED = "true";
    const response = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/mimosaas-tracking/websites/website-1/rotate-secret`, { method: "POST" });
    const body: any = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(storageMock.rotateMimosaasWebsiteConnectionSecret).toHaveBeenCalledWith("owner-1", "client-1", "website-1");
    expect(body.credentials).toEqual({ trackingId: "mtk_public", secret: "mts_rotated" });
    expect(body.connection).not.toHaveProperty("trackingSecret");
    expect(body.connection).not.toHaveProperty("trackingSecretHash");
  });

  it("does not rotate a website secret for another owner's campaign", async () => {
    process.env.MIMOSAAS_TRACKING_ENABLED = "true";
    storageMock.getCampaign.mockResolvedValue({ ...campaign, ownerId: "owner-2" });

    const response = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/mimosaas-tracking/websites/website-1/rotate-secret`, { method: "POST" });

    expect(response.status).toBe(404);
    expect(storageMock.rotateMimosaasWebsiteConnectionSecret).not.toHaveBeenCalled();
  });

  it("rejects invalid or caller-verified connection writes before storage", async () => {
    process.env.MIMOSAAS_TRACKING_ENABLED = "true";
    const response = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/mimosaas-tracking/websites`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ websiteUrl: "javascript:alert(1)", installationMethod: "unknown", installationStatus: "verified" }),
    });
    expect(response.status).toBe(400);
    expect(storageMock.createMimosaasWebsiteConnection).not.toHaveBeenCalled();
  });

  it("resets verification when the website setup changes", async () => {
    process.env.MIMOSAAS_TRACKING_ENABLED = "true";
    const response = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/mimosaas-tracking/websites/website-1`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ installationMethod: "universal" }),
    });
    expect(response.status).toBe(200);
    expect(storageMock.updateMimosaasWebsiteConnection).toHaveBeenCalledWith("owner-1", "client-1", "website-1", {
      installationMethod: "universal", installationStatus: "pending", installationMetadata: null, verifiedAt: null, lastEventAt: null,
    });
  });

  it("does not enumerate or read tracker data for another owner's campaign", async () => {
    process.env.MIMOSAAS_TRACKING_ENABLED = "true";
    storageMock.getCampaign.mockResolvedValue({ ...campaign, ownerId: "owner-2" });
    const response = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/mimosaas-tracking/configuration`);
    expect(response.status).toBe(404);
    expect(storageMock.getMimosaasTrackingConfiguration).not.toHaveBeenCalled();
    expect(storageMock.getMimosaasTrackingCampaignMappings).not.toHaveBeenCalled();
  });

  it("does not create website connections for another owner's campaign", async () => {
    process.env.MIMOSAAS_TRACKING_ENABLED = "true";
    storageMock.getCampaign.mockResolvedValue({ ...campaign, ownerId: "owner-2" });
    const response = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/mimosaas-tracking/websites`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ websiteUrl: "https://example.com", installationMethod: "google_tag_manager" }),
    });
    expect(response.status).toBe(404);
    expect(storageMock.createMimosaasWebsiteConnection).not.toHaveBeenCalled();
  });

  it("returns an empty setup without reading mappings when no configuration exists", async () => {
    process.env.MIMOSAAS_TRACKING_ENABLED = "true";
    storageMock.getMimosaasTrackingConfiguration.mockResolvedValue(undefined);
    const response = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/mimosaas-tracking/configuration`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, configuration: null, mappings: [] });
    expect(storageMock.getMimosaasTrackingCampaignMappings).not.toHaveBeenCalled();
  });
});
