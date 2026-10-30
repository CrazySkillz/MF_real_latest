import express from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Local HTTP boundary tests: actual registered routes, synthetic identities and
// storage only. No application database, provider, email or production session.
const storage = vi.hoisted(() => ({
  getCampaign: vi.fn(), getClients: vi.fn(), updateCampaign: vi.fn(),
  updateCampaignWithGA4DailyInvalidation: vi.fn(), getGA4Connections: vi.fn(),
  getGA4InitialImportWork: vi.fn(), requestGA4InitialImport: vi.fn(),
  getKPI: vi.fn(), getMetaKPIById: vi.fn(), getMetaBenchmarkById: vi.fn(), getBenchmark: vi.fn(),
  updateLinkedInConnection: vi.fn(), updateMetaKPI: vi.fn(), updateKPI: vi.fn(),
  updateMetaBenchmark: vi.fn(), updateBenchmark: vi.fn(),
}));
vi.mock("./storage", () => ({ storage }));
vi.mock("./db", () => ({ db: null, pool: null }));
vi.mock("@clerk/express", () => ({ getAuth: (req: any) => ({ userId: req.headers["x-fixture-actor"] || null }) }));
vi.mock("./middleware/rateLimiter", () => {
  const pass = (_req: any, _res: any, next: any) => next();
  return { oauthRateLimiter: pass, linkedInApiRateLimiter: pass, googleSheetsRateLimiter: pass,
    ga4RateLimiter: pass, importRateLimiter: pass, earlyAccessRateLimiter: pass };
});
vi.mock("jspdf", () => ({ jsPDF: class {} }));
import { registerRoutes } from "./routes-oauth";

const campaignId = "00000000-0000-4000-8000-000000000054";
const campaign = { id: campaignId, ownerId: "owner-a", clientId: "client-a", name: "Fixture campaign",
  status: "active", currency: "EUR", reportingTimeZone: "Europe/Amsterdam", ga4CampaignFilter: '["fixture"]' };
const writes = () => [storage.updateCampaign, storage.updateCampaignWithGA4DailyInvalidation,
  storage.requestGA4InitialImport, storage.updateLinkedInConnection, storage.updateMetaKPI,
  storage.updateKPI, storage.updateMetaBenchmark, storage.updateBenchmark];
const targets = [
  { name: "campaign", path: `/api/campaigns/${campaignId}`, writer: "updateCampaign" },
  { name: "LinkedIn connection", path: `/api/linkedin/update/${campaignId}`, writer: "updateLinkedInConnection" },
  { name: "legacy Meta KPI", path: "/api/platforms/meta/kpis/legacy-kpi", writer: "updateMetaKPI" },
  { name: "shared Meta KPI", path: "/api/platforms/meta/kpis/shared-kpi", writer: "updateKPI" },
  { name: "legacy Meta Benchmark", path: "/api/benchmarks/legacy-benchmark", writer: "updateMetaBenchmark" },
  { name: "shared Benchmark", path: "/api/benchmarks/shared-benchmark", writer: "updateBenchmark" },
] as const;

describe("Batch 1 campaign edit authorization over local HTTP", () => {
  let server: any, origin: string;
  beforeAll(async () => {
    const app = express(); app.use(express.json());
    server = await registerRoutes(app);
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    origin = `http://127.0.0.1:${server.address().port}`;
  });
  afterAll(async () => {
    server?.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error: any) => error ? reject(error) : resolve()));
  });
  beforeEach(() => {
    vi.resetAllMocks();
    storage.getCampaign.mockImplementation(async id => id === campaignId ? { ...campaign } : undefined);
    storage.getClients.mockResolvedValue([{ id: "client-a", ownerId: "owner-a" }, { id: "client-a2", ownerId: "owner-a" }]);
    storage.getKPI.mockImplementation(async id => id === "shared-kpi" ? { id, campaignId, platformType: "meta" } : undefined);
    storage.getMetaKPIById.mockImplementation(async id => id === "legacy-kpi" ? { id, campaignId } : undefined);
    storage.getMetaBenchmarkById.mockImplementation(async id => id === "legacy-benchmark" ? { id, campaignId } : undefined);
    storage.getBenchmark.mockImplementation(async id => id === "shared-benchmark" ? { id, campaignId, platformType: "meta" } : undefined);
    storage.updateCampaign.mockImplementation(async (id, data) => ({ ...campaign, ...data, id }));
    for (const target of targets.slice(1)) storage[target.writer].mockImplementation(async (id: string, data: any) => ({ id, campaignId, ...data }));
  });
  async function patch(path: string, actor: string | null, body: any, headers: Record<string, string> = {}) {
    const response = await fetch(origin + path, { method: "PATCH", headers: {
      "Content-Type": "application/json", ...(actor ? { "x-fixture-actor": actor } : {}), ...headers,
    }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  }
  function noWrites() { for (const write of writes()) expect(write).not.toHaveBeenCalled(); }

  for (const target of targets) {
    for (const [actor, status] of [[null, 401], ["owner-b", 404]] as const) {
      it(`${target.name} rejects ${actor || "anonymous"} with forged parent/account fields before writes`, async () => {
        const response = await patch(target.path, actor, { name: "Changed", adAccountName: "Changed",
          campaignId: "foreign-campaign", ownerId: actor, clientId: "foreign-client", id: "replacement" });
        expect(response.status).toBe(status);
        expect(response.body.message).toBe(actor ? "Campaign not found" : "Your session expired. Please refresh and try again.");
        noWrites();
      });
    }
    it(`${target.name} accepts an owned edit without replacing record/campaign identities`, async () => {
      const response = await patch(target.path, "owner-a", { name: "Changed", adAccountName: "Changed",
        id: "replacement", campaignId: "foreign-campaign", ...(target.name === "campaign" ? { ownerId: "owner-b" } : {}) });
      expect(response.status).toBe(200);
      const writer = storage[target.writer]; expect(writer).toHaveBeenCalledOnce();
      expect(writer.mock.calls[0][1]).not.toHaveProperty("id");
      expect(writer.mock.calls[0][1]).not.toHaveProperty("campaignId");
      expect(writer.mock.calls[0][1]).not.toHaveProperty("ownerId");
      for (const other of writes().filter(w => w !== writer)) expect(other).not.toHaveBeenCalled();
    });
  }
  it("rejects moving an owned campaign under another account's client", async () => {
    const response = await patch(targets[0].path, "owner-a", { name: "Changed", clientId: "client-b" });
    expect(response.status).toBe(404); expect(response.body.message).toBe("Client not found");
    expect(storage.getClients).toHaveBeenCalledWith("owner-a"); noWrites();
  });
  it("preserves the existing move between two clients belonging to the same owner", async () => {
    const response = await patch(targets[0].path, "owner-a", { clientId: "client-a2" });
    expect(response.status).toBe(200);
    expect(storage.updateCampaign).toHaveBeenCalledWith(campaignId, { clientId: "client-a2" });
  });
  for (const record of [undefined, { ...campaign, ownerId: null }]) {
    it(`rejects a ${record ? "unowned" : "missing"} campaign without writes`, async () => {
      storage.getCampaign.mockResolvedValue(record);
      const response = await patch(targets[0].path, "owner-a", { name: "Changed" });
      expect(response.status).toBe(404); noWrites();
    });
  }
  for (const [actor, status] of [["owner-a", 400], ["owner-b", 404], [null, 401]] as const) {
    it(`safe manual probe returns ${status} for ${actor || "anonymous"} without reaching any writer`, async () => {
      const response = await patch(targets[0].path, actor, { name: { batch1AccessCheck: true } });
      expect(response.status).toBe(status); noWrites();
      expect(storage.getGA4Connections).not.toHaveBeenCalled();
      expect(storage.getGA4InitialImportWork).not.toHaveBeenCalled();
    });
  }
  it("a forged internal-refresh header cannot bypass ordinary authentication", async () => {
    const response = await patch(targets[0].path, null, { name: "Changed" }, { "x-internal-auto-refresh-token": "0".repeat(64) });
    expect(response.status).toBe(401); noWrites();
  });
});
