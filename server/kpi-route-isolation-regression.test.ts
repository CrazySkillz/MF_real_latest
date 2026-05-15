import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("KPI route isolation regression guard", () => {
  it("blocks campaign-level KPI platform values from platform KPI routes", () => {
    const routesFile = readFileSync(
      join(process.cwd(), "server", "routes-oauth.ts"),
      "utf-8"
    );

    expect(routesFile).toContain("const isCampaignKPIPlatformType = (value: unknown): boolean => {");
    expect(routesFile).toContain('return !platformType || platformType === "campaign";');
    expect(routesFile).toContain('app.get("/api/platforms/:platformType/kpis"');
    expect(routesFile).toContain('app.post("/api/platforms/:platformType/kpis"');
    expect(routesFile).toContain('app.patch("/api/platforms/:platformType/kpis/:kpiId"');
    expect(routesFile).toContain('app.delete("/api/platforms/:platformType/kpis/:kpiId"');
    expect((routesFile.match(/isCampaignKPIPlatformType\(platformType\)/g) || []).length).toBeGreaterThanOrEqual(4);
  });

  it("keeps campaign KPI routes responsible for campaign KPI rows", () => {
    const routesFile = readFileSync(
      join(process.cwd(), "server", "routes-oauth.ts"),
      "utf-8"
    );

    expect(routesFile).toContain("platformType: null,");
    expect(routesFile).toContain('if (platformType && platformType !== "campaign") {');
    expect(routesFile).toContain("delete updateData.platformType;");
  });

  it("requires explicit layer scope before recording KPI progress", () => {
    const routesFile = readFileSync(
      join(process.cwd(), "server", "routes-oauth.ts"),
      "utf-8"
    );
    const campaignKpisPage = readFileSync(
      join(process.cwd(), "client", "src", "pages", "kpis.tsx"),
      "utf-8"
    );
    const platformKpisPage = readFileSync(
      join(process.cwd(), "client", "src", "pages", "platform-kpis.tsx"),
      "utf-8"
    );

    expect(routesFile).toContain('const expectedScope = String(req.body?.expectedScope || "").trim().toLowerCase();');
    expect(routesFile).toContain('if (expectedScope === "campaign") {');
    expect(routesFile).toContain('return res.status(400).json({ message: "campaignId is required" });');
    expect(routesFile).toContain('} else if (expectedScope === "platform") {');
    expect(routesFile).toContain('return res.status(400).json({ message: "KPI progress scope is required" });');
    expect(campaignKpisPage).toContain('expectedScope: "campaign"');
    expect(platformKpisPage).toContain('expectedScope: "platform"');
  });

  it("guards generic KPI read routes before reading analytics or period storage", () => {
    const routesFile = readFileSync(
      join(process.cwd(), "server", "routes-oauth.ts"),
      "utf-8"
    );

    const latestPeriodRoute = routesFile.slice(
      routesFile.indexOf('app.get("/api/kpis/:kpiId/latest-period"'),
      routesFile.indexOf('// Platform-level KPI routes')
    );
    const analyticsRoute = routesFile.slice(
      routesFile.indexOf('app.get("/api/kpis/:id/analytics"'),
      routesFile.indexOf('// Record KPI progress')
    );

    expect(latestPeriodRoute).toContain("ensureKpiAccess(req as any, res as any, kpiId)");
    expect(latestPeriodRoute.indexOf("ensureKpiAccess")).toBeLessThan(latestPeriodRoute.indexOf("storage.getLatestKPIPeriod"));
    expect(analyticsRoute).toContain("ensureKpiAccess(req as any, res as any, id)");
    expect(analyticsRoute.indexOf("ensureKpiAccess")).toBeLessThan(analyticsRoute.indexOf("storage.getKPIAnalytics"));
  });

  it("fails closed before recording KPI progress for a missing KPI row", () => {
    const storageFile = readFileSync(
      join(process.cwd(), "server", "storage.ts"),
      "utf-8"
    );

    const recordProgressMethod = storageFile.slice(
      storageFile.indexOf("async recordKPIProgress"),
      storageFile.indexOf("async getKPIAnalytics")
    );

    expect(recordProgressMethod).toContain(".select({ id: kpis.id })");
    expect(recordProgressMethod).toContain(".where(eq(kpis.id, progressData.kpiId))");
    expect(recordProgressMethod).toContain('throw new Error("KPI not found");');
    expect(recordProgressMethod.indexOf("existingKPI")).toBeLessThan(recordProgressMethod.indexOf(".insert(kpiProgress)"));
  });
});
