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
});
