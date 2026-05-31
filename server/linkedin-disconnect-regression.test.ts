import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("LinkedIn disconnect visibility regression guard", () => {
  it("hides stale LinkedIn import data when no active Connected Platforms source exists", () => {
    const routes = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");

    const sessionsStart = routes.indexOf('app.get("/api/linkedin/import-sessions/:campaignId"');
    const metricsStart = routes.indexOf('app.get("/api/linkedin/metrics/:campaignId"');
    const importsStart = routes.indexOf('app.get("/api/linkedin/imports/:sessionId"');
    const dailyStart = routes.indexOf('app.get("/api/linkedin/:campaignId/daily-metrics"');
    const coverageStart = routes.indexOf('app.get("/api/campaigns/:id/linkedin/coverage"');

    const sessionsRoute = routes.slice(sessionsStart, metricsStart);
    const metricsRoute = routes.slice(metricsStart, importsStart);
    const dailyRoute = routes.slice(dailyStart, routes.indexOf("app.post(\"/api/linkedin/:campaignId/enrich-ga4-revenue\"", dailyStart));
    const coverageRoute = routes.slice(coverageStart, routes.indexOf("// Manual trigger: refresh LinkedIn data", coverageStart));

    expect(sessionsRoute).toContain("const linkedInConnection = await storage.getLinkedInConnection(campaignId).catch(() => null);");
    expect(sessionsRoute).toContain("if (!linkedInConnection) return res.json([]);");
    expect(metricsRoute).toContain("const linkedInConnection = await storage.getLinkedInConnection(campaignId).catch(() => null);");
    expect(metricsRoute).toContain("if (!linkedInConnection) return res.json(null);");
    expect(dailyRoute).toContain("const linkedInConnection = await storage.getLinkedInConnection(campaignId).catch(() => null);");
    expect(dailyRoute).toContain("if (!linkedInConnection) return res.json({ success: true, metrics: [] });");
    expect(coverageRoute).toContain("const linkedInConnection = await storage.getLinkedInConnection(campaignId).catch(() => null);");
    expect(coverageRoute).toContain("latestImportAt: null");
    expect(coverageRoute).toContain("lastRefreshAt: null");
  });

  it("blocks direct stale import-session access after LinkedIn disconnect", () => {
    const routes = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");
    const helperStart = routes.indexOf("const ensureLinkedInSessionAccess = async");
    const helperEnd = routes.indexOf("// KPI/Benchmark/Report ownership helpers", helperStart);
    const helper = routes.slice(helperStart, helperEnd);

    expect(helper).toContain("const linkedInConnection = await storage.getLinkedInConnection(String((sess as any).campaignId)).catch(() => null);");
    expect(helper).toContain('res.status(404).json({ success: false, message: "LinkedIn connection not found" });');
  });
});
