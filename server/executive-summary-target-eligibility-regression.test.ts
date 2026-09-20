import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { parseExecutiveSummaryStoredMetricValue } from "./utils/executive-summary-target-eligibility";

describe("Executive Summary target eligibility", () => {
  it("preserves measured zero while rejecting missing or invalid stored values", () => {
    expect(parseExecutiveSummaryStoredMetricValue(0)).toBe(0);
    expect(parseExecutiveSummaryStoredMetricValue("0.00")).toBe(0);
    expect(parseExecutiveSummaryStoredMetricValue("12.5")).toBe(12.5);
    expect(parseExecutiveSummaryStoredMetricValue(null)).toBeNull();
    expect(parseExecutiveSummaryStoredMetricValue(undefined)).toBeNull();
    expect(parseExecutiveSummaryStoredMetricValue(" ")).toBeNull();
    expect(parseExecutiveSummaryStoredMetricValue("not-a-number")).toBeNull();
  });

  it("fails closed before parsing GA4 KPI and Benchmark current values", () => {
    const routes = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");
    const routeStart = routes.indexOf('app.get("/api/campaigns/:id/executive-summary"');
    const routeEnd = routes.indexOf("// ============================================================================", routeStart);
    const route = routes.slice(routeStart, routeEnd);

    expect(route).toContain("if (isGA4Kpi && parseExecutiveSummaryStoredMetricValue(kpi.currentValue) === null) continue;");
    expect(route).toContain("if (isGA4Benchmark && parseExecutiveSummaryStoredMetricValue(bm.currentValue) === null) continue;");
  });

  it("scores only freshly verified source values without refreshing credentials", () => {
    const routes = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");
    const routeStart = routes.indexOf('app.get("/api/campaigns/:id/executive-summary"');
    const routeEnd = routes.indexOf("// ============================================================================", routeStart);
    const route = routes.slice(routeStart, routeEnd);

    expect(route).toContain("const executiveTargetSourceCache = new Map<string, Promise<any>>();");
    expect((route.match(/resolveAlertCurrentValueForDecision\(/g) || [])).toHaveLength(2);
    expect((route.match(/allowCredentialRefresh: false/g) || [])).toHaveLength(2);
    expect((route.match(/requireCurrentTrafficFreshness: true/g) || [])).toHaveLength(2);
    expect(route).toContain("if (isGA4Kpi && kpi?.__alertDecisionEligible !== true) continue;");
    expect(route).toContain("if (isGA4Benchmark && bm?.__alertDecisionEligible !== true) continue;");
  });
});
