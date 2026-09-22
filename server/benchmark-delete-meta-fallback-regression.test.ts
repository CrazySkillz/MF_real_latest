import express from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const campaignId = "eee3e654-b736-4e8e-86ec-1050e4d905c0";
const benchmarkId = "1b4533c9-2fd2-494d-bed3-449cbce3c8c6";
const storageMock = vi.hoisted(() => ({
  getMetaBenchmarkById: vi.fn(),
  getBenchmark: vi.fn(),
  getCampaign: vi.fn(),
  getNotifications: vi.fn(),
  deleteBenchmark: vi.fn(),
  deleteMetaBenchmark: vi.fn(),
}));

vi.mock("./storage", () => ({ storage: storageMock }));
vi.mock("./db", () => ({ db: null, pool: null }));
vi.mock("@clerk/express", () => ({ getAuth: vi.fn(() => ({ userId: "owner-1" })) }));
vi.mock("./middleware/rateLimiter", () => {
  const pass = (_req: any, _res: any, next: any) => next();
  return { oauthRateLimiter: pass, linkedInApiRateLimiter: pass,
    googleSheetsRateLimiter: pass, ga4RateLimiter: pass, importRateLimiter: pass };
});

import { registerRoutes } from "./routes-oauth";

describe("legacy Meta Benchmark DELETE fallback when Meta is unconfigured", () => {
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
    storageMock.getMetaBenchmarkById.mockRejectedValue(Object.assign(
      new Error('relation "meta_benchmarks" does not exist'), { code: "42P01" },
    ));
    storageMock.getBenchmark.mockResolvedValue({ id: benchmarkId, campaignId, platformType: "google_analytics" });
    storageMock.getCampaign.mockResolvedValue({ id: campaignId, ownerId: "owner-1" });
    storageMock.getNotifications.mockResolvedValue([
      { id: "alert-1", campaignId, metadata: JSON.stringify({ benchmarkId }) },
      { id: "other-alert", campaignId: "another-campaign", metadata: JSON.stringify({ benchmarkId }) },
    ]);
    storageMock.deleteBenchmark.mockResolvedValue(true);
    storageMock.deleteMetaBenchmark.mockResolvedValue(true);
  });
  afterAll(async () => new Promise<void>((resolve, reject) => server.close((error: any) => error ? reject(error) : resolve())));

  it("passes a GA4 Benchmark to the guarded shared delete and hides only its scoped alert", async () => {
    const response = await fetch(`${baseUrl}/api/benchmarks/${benchmarkId}`, { method: "DELETE" });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true });
    expect(storageMock.deleteBenchmark).toHaveBeenCalledWith(benchmarkId, [expect.objectContaining({ id: "alert-1", campaignId })]);
    expect(storageMock.deleteMetaBenchmark).not.toHaveBeenCalled();
  });

  it("does not reveal or delete a foreign owner's Benchmark", async () => {
    storageMock.getCampaign.mockResolvedValue({ id: campaignId, ownerId: "owner-2" });
    const response = await fetch(`${baseUrl}/api/benchmarks/${benchmarkId}`, { method: "DELETE" });
    expect(response.status).toBe(404);
    expect(storageMock.deleteBenchmark).not.toHaveBeenCalled();
    expect(storageMock.deleteMetaBenchmark).not.toHaveBeenCalled();
  });

  it("returns 404 for a missing generic Benchmark, not a Meta-table 500", async () => {
    storageMock.getBenchmark.mockResolvedValue(undefined);
    const response = await fetch(`${baseUrl}/api/benchmarks/${benchmarkId}`, { method: "DELETE" });
    expect(response.status).toBe(404);
    expect(storageMock.deleteBenchmark).not.toHaveBeenCalled();
  });

  it("preserves the existing Meta delete when the Meta row exists", async () => {
    storageMock.getMetaBenchmarkById.mockResolvedValue({ id: benchmarkId, campaignId });
    storageMock.getNotifications.mockResolvedValue([]);
    const response = await fetch(`${baseUrl}/api/benchmarks/${benchmarkId}`, { method: "DELETE" });
    expect(response.status).toBe(200);
    expect(storageMock.deleteMetaBenchmark).toHaveBeenCalledWith(benchmarkId);
    expect(storageMock.deleteBenchmark).not.toHaveBeenCalled();
  });
});
