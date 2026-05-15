import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("Benchmark route isolation regression guard", () => {
  it("blocks campaign-level Benchmark platform values from platform Benchmark routes", () => {
    const routesFile = readFileSync(
      join(process.cwd(), "server", "routes-oauth.ts"),
      "utf-8"
    );

    expect(routesFile).toContain("const isCampaignBenchmarkPlatformType = (value: unknown): boolean => {");
    expect(routesFile).toContain('return !platformType || platformType === "campaign";');
    expect(routesFile).toContain('app.get("/api/platforms/:platformType/benchmarks"');
    expect(routesFile).toContain('app.post("/api/platforms/:platformType/benchmarks"');
    expect(routesFile).toContain('app.put("/api/platforms/:platformType/benchmarks/:benchmarkId"');
    expect(routesFile).toContain('app.delete("/api/platforms/:platformType/benchmarks/:benchmarkId"');
    expect((routesFile.match(/isCampaignBenchmarkPlatformType\(platformType\)/g) || []).length).toBeGreaterThanOrEqual(4);
  });

  it("keeps Benchmark campaign/platform scope immutable on update routes", () => {
    const routesFile = readFileSync(
      join(process.cwd(), "server", "routes-oauth.ts"),
      "utf-8"
    );

    expect(routesFile).toContain('if (String((existing as any)?.campaignId || "") !== String(campaignId)) {');
    expect((routesFile.match(/campaignId: \(existing as any\)\.campaignId/g) || []).length).toBeGreaterThanOrEqual(3);
    expect((routesFile.match(/platformType: \(existing as any\)\.platformType/g) || []).length).toBeGreaterThanOrEqual(3);
    expect((routesFile.match(/delete validatedBenchmark\.campaignId/g) || []).length).toBeGreaterThanOrEqual(1);
    expect((routesFile.match(/delete validatedData\.campaignId/g) || []).length).toBeGreaterThanOrEqual(1);
    expect((routesFile.match(/delete validated\.campaignId/g) || []).length).toBeGreaterThanOrEqual(1);
  });

  it("deletes only the selected Benchmark history before deleting that Benchmark", () => {
    const storageFile = readFileSync(
      join(process.cwd(), "server", "storage.ts"),
      "utf-8"
    );

    expect(storageFile).toContain("async deleteBenchmark(id: string): Promise<boolean> {");
    expect(storageFile).toContain("const [existing] = await tx.select({ id: benchmarks.id }).from(benchmarks).where(eq(benchmarks.id, id)).limit(1);");
    expect(storageFile).toContain("await tx.delete(benchmarkHistory).where(eq(benchmarkHistory.benchmarkId, id));");
    expect(storageFile).toContain("const result = await tx.delete(benchmarks).where(eq(benchmarks.id, id));");
  });

  it("refuses to record Benchmark history for missing Benchmark rows", () => {
    const storageFile = readFileSync(
      join(process.cwd(), "server", "storage.ts"),
      "utf-8"
    );

    expect(storageFile).toContain("async recordBenchmarkHistory(historyData: InsertBenchmarkHistory): Promise<BenchmarkHistory> {");
    expect(storageFile).toContain("const benchmarkId = String((historyData as any)?.benchmarkId || \"\").trim();");
    expect(storageFile).toContain("const [existing] = await db.select({ id: benchmarks.id }).from(benchmarks).where(eq(benchmarks.id, benchmarkId)).limit(1);");
    expect(storageFile).toContain("throw new Error(\"Benchmark not found\");");
  });

  it("protects Benchmark history and analytics read routes with Benchmark access checks", () => {
    const routesFile = readFileSync(
      join(process.cwd(), "server", "routes-oauth.ts"),
      "utf-8"
    );

    expect(routesFile).toContain('app.get("/api/benchmarks/:id/history", async (req, res) => {');
    expect(routesFile).toContain('app.get("/api/benchmarks/:id/analytics", async (req, res) => {');
    expect(routesFile).toContain("const existing = await ensureBenchmarkAccess(req as any, res as any, id);");
    expect(routesFile).toContain("const history = await storage.getBenchmarkHistory(id);");
    expect(routesFile).toContain("const analytics = await storage.getBenchmarkAnalytics(id);");
  });
});
