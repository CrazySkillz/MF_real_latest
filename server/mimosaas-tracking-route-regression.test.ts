import express from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const authState = vi.hoisted(() => ({ userId: "owner-1" }));
const storageMock = vi.hoisted(() => ({
  getCampaign: vi.fn(),
  getMimosaasTrackingConfiguration: vi.fn(),
  getMimosaasTrackingCampaignMappings: vi.fn(),
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
    storageMock.getMimosaasTrackingConfiguration.mockResolvedValue({ id: "configuration-1", campaignId: campaign.id });
    storageMock.getMimosaasTrackingCampaignMappings.mockResolvedValue([{ id: "mapping-1", campaignId: campaign.id }]);
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
      mappings: [{ id: "mapping-1", campaignId: campaign.id }],
    });
    expect(storageMock.getMimosaasTrackingConfiguration).toHaveBeenCalledWith("owner-1", "client-1", campaign.id);
    expect(storageMock.getMimosaasTrackingCampaignMappings).toHaveBeenCalledWith("owner-1", "client-1", campaign.id);
  });

  it("does not enumerate or read tracker data for another owner's campaign", async () => {
    process.env.MIMOSAAS_TRACKING_ENABLED = "true";
    storageMock.getCampaign.mockResolvedValue({ ...campaign, ownerId: "owner-2" });
    const response = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/mimosaas-tracking/configuration`);
    expect(response.status).toBe(404);
    expect(storageMock.getMimosaasTrackingConfiguration).not.toHaveBeenCalled();
    expect(storageMock.getMimosaasTrackingCampaignMappings).not.toHaveBeenCalled();
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
