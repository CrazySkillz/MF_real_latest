import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("Executive Summary freshness warning propagation", () => {
  it("dates saved GA4 source truth to its latest row within the selected completed window", () => {
    const routes = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");
    const routeStart = routes.indexOf('app.get("/api/campaigns/:id/executive-summary"');
    const sourceTruthStart = routes.indexOf("// Fetch GA4 metrics", routeStart);
    const sourceTruthEnd = routes.indexOf("// Fetch Custom Integration metrics", sourceTruthStart);
    const sourceTruth = routes.slice(sourceTruthStart, sourceTruthEnd);

    expect(sourceTruthStart).toBeGreaterThan(routeStart);
    expect(sourceTruthEnd).toBeGreaterThan(sourceTruthStart);
    expect(sourceTruth).toContain("storage.getGA4DailyMetrics(id, primaryPropertyId, ga4Start, ga4End)");
    expect(sourceTruth).toContain("ga4LastUpdate = scopedRows.map((row: any) => String(row.date)).sort().at(-1) || null;");
    expect(sourceTruth).not.toContain("getMetricsWithAutoRefresh");
  });

  it("marks fallback age warnings stale and restores only that explicit warning through v3", () => {
    const routes = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "executive-summary.tsx"), "utf-8");
    const routeStart = routes.indexOf('app.get("/api/campaigns/:id/executive-summary"');
    const routeEnd = routes.indexOf("// ============================================================================", routeStart);
    const route = routes.slice(routeStart, routeEnd);

    expect(route).toContain('checkFreshness(ga4LastUpdate, \'Google Analytics\', \'stale\');');
    expect(route).toContain("...(verificationStatus ? { verificationStatus } : {}),");
    expect(page).toContain("const executiveFreshnessWarnings = Array.isArray");
    expect(page).toContain('.filter((warning: any) => !(hasAuthoritativeGA4Window && warning?.source === "Google Analytics"));');
    expect(page).toContain('warning?.source === "Google Analytics" && warning?.verificationStatus === "stale"');
  });
});
