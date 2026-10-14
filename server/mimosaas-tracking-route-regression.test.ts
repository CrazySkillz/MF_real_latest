import express from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const authState = vi.hoisted(() => ({ userId: "owner-1" }));
const storageMock = vi.hoisted(() => ({
  getCampaign: vi.fn(),
  getMimosaasWebsiteConnections: vi.fn(),
  createMimosaasWebsiteConnection: vi.fn(),
  updateMimosaasWebsiteConnection: vi.fn(),
  getMimosaasTrackingConfiguration: vi.fn(),
  createMimosaasTrackingConfiguration: vi.fn(),
  updateMimosaasTrackingConfiguration: vi.fn(),
  getMimosaasTrackingCampaignMappings: vi.fn(),
  createMimosaasTrackingCampaignMapping: vi.fn(),
  updateMimosaasTrackingCampaignMapping: vi.fn(),
}));

vi.mock("./storage", () => ({ storage: storageMock }));
vi.mock("./db", () => ({ db: null, pool: null }));
vi.mock("@clerk/express", () => ({ getAuth: vi.fn(() => ({ userId: authState.userId })) }));
vi.mock("./middleware/rateLimiter", () => {
  const pass = (_req: any, _res: any, next: any) => next();
  return { oauthRateLimiter: pass, linkedInApiRateLimiter: pass, googleSheetsRateLimiter: pass, ga4RateLimiter: pass, importRateLimiter: pass };
});
vi.mock("jspdf", () => ({ jsPDF: class {} }));

import { registerRoutes } from "./routes-oauth";

const campaign = { id: "campaign-1", ownerId: "owner-1", clientId: "client-1" };
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
    authState.userId = "owner-1";
    storageMock.getCampaign.mockResolvedValue(campaign);
    storageMock.getMimosaasWebsiteConnections.mockResolvedValue([]);
    storageMock.createMimosaasWebsiteConnection.mockImplementation(async (_ownerId, clientId, input) => ({
      id: "website-1", ownerId: "owner-1", clientId, installationMetadata: { private: true }, ...input,
    }));
    storageMock.updateMimosaasWebsiteConnection.mockImplementation(async (_ownerId, clientId, connectionId, input) => ({
      id: connectionId, ownerId: "owner-1", clientId, ...input,
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
    await new Promise<void>((resolve, reject) => server.close((error: Error) => error ? reject(error) : resolve()));
  });

  it("remains unavailable and performs no storage reads while the feature flag is off", async () => {
    const response = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/mimosaas-tracking/configuration`);
    expect(response.status).toBe(404);
    expect(storageMock.getCampaign).not.toHaveBeenCalled();
    expect(storageMock.getMimosaasTrackingConfiguration).not.toHaveBeenCalled();
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
      installationMethod: "gtm", installationStatus: "pending", installationMetadata: { private: true },
    }]);
    const response = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/mimosaas-tracking/websites`);
    const body: any = await response.json();
    expect(response.status).toBe(200);
    expect(storageMock.getMimosaasWebsiteConnections).toHaveBeenCalledWith("owner-1", "client-1");
    expect(body.connections[0]).not.toHaveProperty("ownerId");
    expect(body.connections[0]).not.toHaveProperty("installationMetadata");
  });

  it("creates a pending connection from a canonical website origin", async () => {
    process.env.MIMOSAAS_TRACKING_ENABLED = "true";
    const response = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/mimosaas-tracking/websites`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ websiteUrl: "https://Example.com/path?query=1", installationMethod: "gtm" }),
    });
    expect(response.status).toBe(201);
    expect(storageMock.createMimosaasWebsiteConnection).toHaveBeenCalledWith("owner-1", "client-1", {
      websiteUrl: "https://example.com", installationMethod: "gtm", installationStatus: "pending",
    });
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
      body: JSON.stringify({ websiteUrl: "https://example.com", installationMethod: "gtm" }),
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
