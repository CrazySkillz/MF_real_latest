import express from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => ({
  getCampaign: vi.fn(), getKPI: vi.fn(), getBenchmark: vi.fn(),
  updateKPI: vi.fn(), updateBenchmark: vi.fn(), getGA4PublicationVersion: vi.fn(),
}));
vi.mock("./storage", () => ({ storage }));
vi.mock("./db", () => ({ db: null, pool: null }));
vi.mock("@clerk/express", () => ({ getAuth: () => ({ userId: "owner" }) }));
vi.mock("./utils/campaign-current-values", async importOriginal => ({
  ...await importOriginal<any>(), refreshCampaignCurrentValuesForCampaign: vi.fn(async () => ({})),
}));
vi.mock("./ga4-kpi-benchmark-jobs", () => ({ runGA4DailyKPIAndBenchmarkJobs: vi.fn(async () => ({})) }));
vi.mock("./kpi-scheduler", () => ({ checkPerformanceAlerts: vi.fn(), checkGA4PerformanceAlertsForCampaign: vi.fn() }));
vi.mock("./benchmark-notifications", () => ({ checkBenchmarkPerformanceAlerts: vi.fn(), checkGA4BenchmarkPerformanceAlertsForCampaign: vi.fn() }));
vi.mock("./middleware/rateLimiter", () => {
  const pass = (_req: any, _res: any, next: any) => next();
  return { oauthRateLimiter: pass, linkedInApiRateLimiter: pass, googleSheetsRateLimiter: pass, ga4RateLimiter: pass, importRateLimiter: pass };
});
import { registerRoutes } from "./routes-oauth";

describe("campaign definition edits during durable GA4 refresh", () => {
  let server: any, baseUrl: string;
  beforeAll(async () => {
    const app = express(); app.use(express.json()); server = await registerRoutes(app);
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });
  afterAll(async () => new Promise<void>(resolve => server.close(resolve)));
  beforeEach(() => {
    vi.clearAllMocks();
    storage.getCampaign.mockResolvedValue({ id: "campaign", ownerId: "owner", name: "Campaign" });
    storage.getKPI.mockResolvedValue({ id: "kpi", campaignId: "campaign", platformType: "campaign", alertsEnabled: false });
    storage.getBenchmark.mockResolvedValue({ id: "benchmark", campaignId: "campaign", platformType: "campaign", alertsEnabled: false });
    storage.updateKPI.mockImplementation(async (_id, data) => ({ id: "kpi", campaignId: "campaign", ...data }));
    storage.updateBenchmark.mockImplementation(async (_id, data) => ({ id: "benchmark", campaignId: "campaign", ...data }));
    storage.getGA4PublicationVersion.mockRejectedValue(new Error("GA4_REFRESH_PUBLICATION_BUSY"));
  });
  const patch = (kind: string, body: any) => fetch(`${baseUrl}/api/campaigns/campaign/${kind}s/${kind}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  it.each(["kpi", "benchmark"])("allows %s definition edits while the storage edit invalidates the old worker", async kind => {
    const response = await patch(kind, kind === "kpi" ? { targetValue: "100" } : { benchmarkValue: "100" });
    expect(response.status).toBe(200);
    expect(storage.getGA4PublicationVersion).not.toHaveBeenCalled();
    expect(kind === "kpi" ? storage.updateKPI : storage.updateBenchmark).toHaveBeenCalledTimes(1);
  });
  it.each(["kpi", "benchmark"])("rejects an ordinary %s current-value write while recovery owns publication", async kind => {
    const response = await patch(kind, { currentValue: "999" });
    expect(response.status).toBe(500);
    expect(storage.getGA4PublicationVersion).toHaveBeenCalledWith("campaign");
    expect(kind === "kpi" ? storage.updateKPI : storage.updateBenchmark).not.toHaveBeenCalled();
  });
  it("does not accept a browser-supplied worker token or generation", async () => {
    const response = await patch("kpi", { targetValue: "100", refreshScope: { work: { leaseToken: "forged" } }, publicationVersion: { version: "forged" } });
    expect(response.status).toBe(200);
    expect(storage.updateKPI.mock.calls[0][1]).not.toHaveProperty("refreshScope");
    expect(storage.updateKPI.mock.calls[0][1]).not.toHaveProperty("publicationVersion");
  });
  it("rejects another owner's campaign before any generation read or write", async () => {
    storage.getCampaign.mockResolvedValue({ id: "campaign", ownerId: "other-owner" });
    const response = await patch("kpi", { targetValue: "100" });
    expect([403, 404]).toContain(response.status);
    expect(storage.getGA4PublicationVersion).not.toHaveBeenCalled(); expect(storage.updateKPI).not.toHaveBeenCalled();
  });
});
