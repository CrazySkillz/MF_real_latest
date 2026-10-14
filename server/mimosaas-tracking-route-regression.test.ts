import express from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const authState = vi.hoisted(() => ({ userId: "owner-1" }));
const storageMock = vi.hoisted(() => ({
  getCampaign: vi.fn(),
  getMimosaasWebsiteConnections: vi.fn(),
  getMimosaasWebsiteConnectionByTrackingPublicId: vi.fn(),
  createMimosaasWebsiteConnection: vi.fn(),
  updateMimosaasWebsiteConnection: vi.fn(),
  rotateMimosaasWebsiteConnectionSecret: vi.fn(),
  getMimosaasTrackingConfiguration: vi.fn(),
  createMimosaasTrackingConfiguration: vi.fn(),
  updateMimosaasTrackingConfiguration: vi.fn(),
  getMimosaasTrackingCampaignMappings: vi.fn(),
  createMimosaasTrackingCampaignMapping: vi.fn(),
  updateMimosaasTrackingCampaignMapping: vi.fn(),
  createMimosaasTrackingEvent: vi.fn(),
}));

vi.mock("./storage", () => ({ storage: storageMock }));
vi.mock("./db", () => ({ db: null, pool: null }));
vi.mock("@clerk/express", () => ({ getAuth: vi.fn(() => ({ userId: authState.userId })) }));
vi.mock("./middleware/rateLimiter", () => {
  const pass = (_req: any, _res: any, next: any) => next();
  return { oauthRateLimiter: pass, linkedInApiRateLimiter: pass, googleSheetsRateLimiter: pass, ga4RateLimiter: pass, importRateLimiter: pass, mimosaasTrackingRateLimiter: pass };
});
vi.mock("jspdf", () => ({ jsPDF: class {} }));

import { registerRoutes } from "./routes-oauth";
import { hashMimosaasTrackingSecret } from "./utils/mimosaas-tracking-auth";

const campaign = { id: "campaign-1", ownerId: "owner-1", clientId: "client-1" };
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
    authState.userId = "owner-1";
    storageMock.getCampaign.mockResolvedValue(campaign);
    storageMock.getMimosaasWebsiteConnections.mockResolvedValue([]);
    storageMock.getMimosaasWebsiteConnectionByTrackingPublicId.mockResolvedValue({
      id: "website-1", ownerId: "owner-1", clientId: "client-1", websiteUrl: "https://example.com",
      installationStatus: "verified", trackingPublicId: trackingId, trackingSecretHash,
    });
    storageMock.createMimosaasTrackingEvent.mockResolvedValue({ event: { id: "event-row-1" }, inserted: true });
    storageMock.createMimosaasWebsiteConnection.mockImplementation(async (_ownerId, clientId, input) => ({
      id: "website-1", ownerId: "owner-1", clientId, trackingPublicId: "mtk_public", trackingSecret: "mts_secret", trackingSecretHash: "sha256:private", installationMetadata: { private: true }, ...input,
    }));
    storageMock.updateMimosaasWebsiteConnection.mockImplementation(async (_ownerId, clientId, connectionId, input) => ({
      id: connectionId, ownerId: "owner-1", clientId, ...input,
    }));
    storageMock.rotateMimosaasWebsiteConnectionSecret.mockImplementation(async (_ownerId, clientId, connectionId) => ({
      id: connectionId, ownerId: "owner-1", clientId, trackingPublicId: "mtk_public", trackingSecret: "mts_rotated", trackingSecretHash: "sha256:private", installationStatus: "pending",
    }));
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
  });

  afterAll(async () => {
    delete process.env.MIMOSAAS_TRACKING_ENABLED;
    delete process.env.MIMOSAAS_TRACKING_INGESTION_ENABLED;
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
