import { describe, expect, it } from "vitest";
import {
  GA4_KPI_METRIC_INVENTORY,
  getGA4KpiMetricDependencies,
  getGA4KpiMetricIdentity,
  resolveGA4KpiMetricIdentity,
} from "../shared/ga4-kpi-metric-identity";
import { getGA4KPIDuplicateKey } from "./utils/ga4-kpi-alert-dedupe";

describe("GA4 KPI metric identity contract", () => {
  it("pins the complete supported standard and legacy-alias inventory", () => {
    expect(GA4_KPI_METRIC_INVENTORY).toEqual([
      { identity: "revenue", aliases: ["revenue", "totalrevenue"] },
      { identity: "conversions", aliases: ["conversions", "totalconversions"] },
      { identity: "sessions", aliases: ["sessions", "totalsessions"] },
      { identity: "users", aliases: ["users", "totalusers"] },
      { identity: "pageviews", aliases: ["pageviews"] },
      { identity: "conversion_rate", aliases: ["conversionrate"] },
      { identity: "engagement_rate", aliases: ["engagementrate"] },
      { identity: "roas", aliases: ["roas"] },
      { identity: "roi", aliases: ["roi"] },
      { identity: "cpa", aliases: ["cpa"] },
    ]);
  });

  it("normalizes stored keys, display labels, case, and separators without guessing custom metrics", () => {
    expect(getGA4KpiMetricIdentity("totalRevenue")).toBe("revenue");
    expect(getGA4KpiMetricIdentity("Total Revenue")).toBe("revenue");
    expect(getGA4KpiMetricIdentity("conversion_rate")).toBe("conversion_rate");
    expect(getGA4KpiMetricIdentity("Engagement-Rate")).toBe("engagement_rate");
    expect(resolveGA4KpiMetricIdentity("__custom__", "Total Sessions")).toBe("sessions");
    expect(resolveGA4KpiMetricIdentity("__custom__", "Manual pipeline quality")).toBeNull();
  });

  it("uses the same financial dependency identity for standard and legacy aliases", () => {
    expect(getGA4KpiMetricDependencies("Total Revenue")).toMatchObject({ identity: "revenue", requiresRevenue: true, requiresSpend: false });
    expect(getGA4KpiMetricDependencies("ROAS")).toMatchObject({ identity: "roas", requiresRevenue: true, requiresSpend: true });
    expect(getGA4KpiMetricDependencies("cpa")).toMatchObject({ identity: "cpa", requiresRevenue: false, requiresSpend: true });
    expect(getGA4KpiMetricDependencies("Total Conversions")).toMatchObject({ identity: "conversions", requiresRevenue: false, requiresSpend: false });
  });

  it("deduplicates alert eligibility by canonical metric while preserving custom identity", () => {
    const base = { campaignId: "campaign-a", platformType: "google_analytics" };
    expect(getGA4KPIDuplicateKey({ ...base, metric: "revenue" })).toBe("campaign-a:revenue");
    expect(getGA4KPIDuplicateKey({ ...base, metric: "Total Revenue" })).toBe("campaign-a:revenue");
    expect(getGA4KPIDuplicateKey({ ...base, metric: "__custom__", name: "Manual KPI" })).toBe("campaign-a:custom");
  });
});
