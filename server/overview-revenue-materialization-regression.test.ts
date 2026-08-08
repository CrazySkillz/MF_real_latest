import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  assertGa4RevenueMaterializationComplete,
  requiresGa4RevenueMaterializationCompleteness,
} from "./utils/revenue-record-total";

describe("GA4 Overview revenue materialization integrity", () => {
  it("accepts an explicit persisted zero as valid materialization", () => {
    expect(() => assertGa4RevenueMaterializationComplete(
      [{ id: "shopify-zero", isActive: true }],
      [{ revenueSourceId: "shopify-zero", revenue: "0.00" }],
    )).not.toThrow();
  });

  it("fails closed when an active source has no valid record", () => {
    let failure: any = null;
    try {
      assertGa4RevenueMaterializationComplete(
        [{ id: "healthy", isActive: true }, { id: "missing", isActive: true }],
        [{ revenueSourceId: "healthy", revenue: "25.00" }],
      );
    } catch (error) {
      failure = error;
    }
    expect(failure).toMatchObject({
      code: "GA4_REVENUE_MATERIALIZATION_INCOMPLETE",
      sourceIds: ["missing"],
    });
  });

  it("does not let inactive sources block current totals", () => {
    expect(() => assertGa4RevenueMaterializationComplete(
      [{ id: "inactive", isActive: false }],
      [],
    )).not.toThrow();
  });

  it("limits completeness enforcement to current GA4 campaign-to-date totals", () => {
    const today = "2026-08-08";
    expect(requiresGa4RevenueMaterializationCompleteness("ga4", "1900-01-01", today, today)).toBe(true);
    expect(requiresGa4RevenueMaterializationCompleteness("ga4", "2026-07-10", today, today)).toBe(false);
    expect(requiresGa4RevenueMaterializationCompleteness("ga4", "1900-01-01", "2026-08-07", today)).toBe(false);
    expect(requiresGa4RevenueMaterializationCompleteness("linkedin", "1900-01-01", today, today)).toBe(false);
  });

  it("guards the to-date total and renders missing provenance as unavailable for every GA4 source type", () => {
    const storage = readFileSync("server/storage.ts", "utf8");
    const routes = readFileSync("server/routes-oauth.ts", "utf8");
    const page = readFileSync("client/src/pages/ga4-metrics.tsx", "utf8");

    expect(storage).toContain("requiresGa4RevenueMaterializationCompleteness(platformContext, startDate, endDate)");
    expect(storage).toContain("assertGa4RevenueMaterializationComplete(activeSources as any[], rows as any[])");
    expect(routes).toContain('const isGa4RevenueSource = platformContext === "ga4"');
    expect(routes).toContain('materializedRevenueStatus: hasMaterializedRevenue ? "available" : "unavailable"');
    expect(page).toContain('const materializedRevenueUnavailable = s.materializedRevenueStatus === "unavailable";');
  });
});
