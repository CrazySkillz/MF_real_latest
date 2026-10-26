import express from "express";
import { getAuth } from "@clerk/express";
import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => Object.fromEntries(["getCampaign", "getClients", "getCampaigns", "getKPI", "getCampaignKPIs", "getPlatformKPIs", "createKPI", "recordKPIProgress", "getGA4PublicationVersion"].map(name => [name, vi.fn()])));
vi.mock("./storage", () => ({ storage }));
vi.mock("./db", () => ({ db: {}, pool: null }));
vi.mock("./analytics", () => ({ ga4Service: {} }));
vi.mock("./kpi-scheduler", () => ({ checkPerformanceAlerts: vi.fn(async () => {}), checkGA4PerformanceAlertsForCampaign: vi.fn(async () => {}) }));
vi.mock("./services/alert-monitoring", () => ({ alertMonitoringService: { sendImmediateKPIAlertIfNeeded: vi.fn(async () => {}) } }));
vi.mock("@clerk/express", () => ({ getAuth: vi.fn(() => ({ userId: "owner" })) }));
vi.mock("./middleware/rateLimiter", () => {
  const pass = (_req: any, _res: any, next: any) => next();
  return { oauthRateLimiter: pass, linkedInApiRateLimiter: pass, googleSheetsRateLimiter: pass, ga4RateLimiter: pass, importRateLimiter: pass };
});
import { registerRoutes } from "./routes-oauth";
let server: any, url: string;
let kpis: any[];
const campaigns = [{ id: "a", ownerId: "owner", clientId: "client-a", status: "active", currency: "EUR" }, { id: "b", ownerId: "owner", clientId: "client-b", status: "active", currency: "EUR" }, { id: "foreign", ownerId: "other", clientId: "foreign", status: "active" }];
const request = (path: string, body?: any) => fetch(url + path, body === undefined ? undefined : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
beforeAll(async () => {
  const app = express(); app.use(express.json()); server = await registerRoutes(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve)); url = `http://127.0.0.1:${server.address().port}`;
});
beforeEach(() => {
  for (const mock of Object.values(storage)) mock.mockReset();
  vi.mocked(getAuth).mockReturnValue({ userId: "owner" } as any);
  kpis = [{ id: "k", campaignId: "a", platformType: "facebook", name: "ROI", unit: "%", currentValue: "0", targetValue: "100", status: "tracking" }];
  storage.getClients.mockResolvedValue([{ id: "client-a" }, { id: "client-b" }]);
  storage.getCampaigns.mockResolvedValue(campaigns);
  storage.getCampaign.mockImplementation(async id => campaigns.find(c => c.id === id));
  storage.getKPI.mockImplementation(async id => kpis.find(k => k.id === id));
  storage.getPlatformKPIs.mockImplementation(async (platform, campaignId) => kpis.filter(k => k.platformType === platform && k.campaignId === campaignId));
  storage.getCampaignKPIs.mockImplementation(async campaignId => kpis.filter(k => !k.platformType && k.campaignId === campaignId));
  storage.createKPI.mockImplementation(async data => { const kpi = { ...data, id: "new" }; kpis.push(kpi); return kpi; });
  storage.recordKPIProgress.mockImplementation(async data => { kpis.find(k => k.id === data.kpiId).currentValue = data.value; return { id: "progress", ...data }; });
  storage.getGA4PublicationVersion.mockResolvedValue(7);
});
afterAll(async () => { server.closeAllConnections?.(); await new Promise<void>((resolve, reject) => server.close((error: any) => error ? reject(error) : resolve())); });

describe("V1-129/130 actual retained KPI HTTP contracts", () => {
  it("campaign selector reads only the selected owned client's campaigns", async () => {
    const response = await request("/api/campaigns?clientId=client-a");
    expect(response.status).toBe(200); expect((await response.json()).map((c: any) => c.id)).toEqual(["a"]);
    expect((await request("/api/campaigns?clientId=foreign")).status).toBe(404);
  });
  it("lists only the exact campaign and platform and propagates a failed list read", async () => {
    expect(await (await request("/api/platforms/facebook/kpis?campaignId=a")).json()).toHaveLength(1);
    expect(await (await request("/api/platforms/facebook/kpis?campaignId=b")).json()).toEqual([]);
    storage.getPlatformKPIs.mockRejectedValue(new Error("read failed"));
    expect((await request("/api/platforms/facebook/kpis?campaignId=a")).status).toBe(500);
  });
  it("creates a platform KPI in its selected campaign with unchanged numeric units", async () => {
    const response = await request("/api/platforms/facebook/kpis", { campaignId: "b", name: "ROI", unit: "%", targetValue: "100", currentValue: "-10" });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ campaignId: "b", platformType: "facebook", currentValue: "-10", unit: "%" });
    expect(await (await request("/api/platforms/facebook/kpis?campaignId=a")).json()).toHaveLength(1);
  });
  it("requires a campaign on creation and rejects a different owner", async () => {
    expect((await request("/api/platforms/facebook/kpis", { name: "ROI", unit: "%", targetValue: "100" })).status).toBe(400);
    expect((await request("/api/platforms/facebook/kpis", { campaignId: "foreign", name: "ROI", unit: "%", targetValue: "100" })).status).toBe(404);
    expect(storage.createKPI).not.toHaveBeenCalled();
  });
  it.each([-100, -10.5, 0, 0.75, 300])("records signed/fractional platform progress %s without changing saved status", async value => {
    const response = await request("/api/kpis/k/progress", { expectedScope: "platform", platformType: "facebook", campaignId: "a", value });
    expect(response.status).toBe(200); expect((await response.json()).value).toBe(String(value));
    expect(kpis[0].status).toBe("tracking");
  });
  it.each([null, "", " ", "bad", "Infinity", "NaN", true, false, {}, [1]])("rejects invalid progress %j without writing", async value => {
    expect((await request("/api/kpis/k/progress", { expectedScope: "platform", platformType: "facebook", campaignId: "a", value })).status).toBe(400);
    expect(storage.recordKPIProgress).not.toHaveBeenCalled();
  });
  it.each([{ campaignId: "b" }, { platformType: "linkedin" }, { expectedScope: "campaign" }])("rejects mismatched progress scope %j", async mismatch => {
    expect((await request("/api/kpis/k/progress", { expectedScope: "platform", platformType: "facebook", campaignId: "a", value: -10, ...mismatch })).status).toBe(404);
    expect(storage.recordKPIProgress).not.toHaveBeenCalled();
  });
  it("preserves the existing platform caller contract when campaignId is omitted", async () => {
    expect((await request("/api/kpis/k/progress", { expectedScope: "platform", platformType: "facebook", value: 0 })).status).toBe(200);
  });
  it("passes campaign progress through the existing publication-version guard", async () => {
    kpis[0].platformType = null;
    const response = await request("/api/kpis/k/progress", { expectedScope: "campaign", campaignId: "a", value: -10 });
    expect(response.status).toBe(200);
    expect(storage.recordKPIProgress).toHaveBeenCalledWith(expect.objectContaining({ value: "-10", publicationVersion: { campaignId: "a", version: 7 } }));
  });
  it("rejects progress for another owner or deleted KPI before writing", async () => {
    vi.mocked(getAuth).mockReturnValue({ userId: "other" } as any);
    expect((await request("/api/kpis/k/progress", { expectedScope: "platform", platformType: "facebook", campaignId: "a", value: 0 })).status).toBe(404);
    expect((await request("/api/kpis/deleted/progress", { expectedScope: "platform", platformType: "facebook", value: 0 })).status).toBe(404);
    expect(storage.recordKPIProgress).not.toHaveBeenCalled();
  });
});
