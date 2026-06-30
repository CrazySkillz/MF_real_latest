import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROUTES_FILE = join(__dirname, "routes-oauth.ts");

function readRoutes(): string {
  return readFileSync(ROUTES_FILE, "utf-8");
}

function sliceBetween(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  expect(startIndex).toBeGreaterThan(-1);
  const endIndex = source.indexOf(end, startIndex + start.length);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
}

function expectBefore(source: string, first: string, second: string): void {
  const firstIndex = source.indexOf(first);
  const secondIndex = source.indexOf(second);
  expect(firstIndex).toBeGreaterThan(-1);
  expect(secondIndex).toBeGreaterThan(-1);
  expect(firstIndex).toBeLessThan(secondIndex);
}

describe("Benchmark alert email delivery validation route", () => {
  it("exposes read-only Benchmark-scoped audit evidence without claiming inbox receipt", () => {
    const routes = readRoutes();
    const route = sliceBetween(
      routes,
      'app.get("/api/benchmarks/:id/alert-email-delivery-validation"',
      '  // Record benchmark history'
    );

    expect(route).toContain('res.setHeader("Cache-Control", "no-store");');
    expectBefore(route, "const existing = await ensureBenchmarkAccess", "const rows = await db");
    expect(route).toContain('eq((emailAlertEvents as any).kind, "alert")');
    expect(route).toContain('eq((emailAlertEvents as any).entityType, "benchmark")');
    expect(route).toContain('eq((emailAlertEvents as any).entityId, id)');
    expect(route).toContain("providerResponseId: (emailAlertEvents as any).providerResponseId");
    expect(route).toContain("deliveryStatus: (emailAlertEvents as any).deliveryStatus");
    expect(route).toContain("deliveredAt: (emailAlertEvents as any).deliveredAt");
    expect(route).toContain('providerDeliveryProven: row.deliveryStatus === "delivered" && !!row.deliveredAt');
    expect(route).toContain('certificationStatus: "validation_output_only"');
    expect(route).toContain("Provider acceptance is not delivery");
    expect(route).toContain("Actual inbox receipt is external to the app");
    expect(route).toContain("inboxReceiptProvenByApp: false");

    expect(route).not.toContain("sendAlertEmail");
    expect(route).not.toContain("sendImmediateBenchmarkAlertIfNeeded");
    expect(route).not.toContain("runImmediateBenchmarkEmailAlertCheck");
    expect(route).not.toMatch(/db\.(insert|update|delete)/);
    expect(route).not.toContain("storage.updateBenchmark");
  });
});
