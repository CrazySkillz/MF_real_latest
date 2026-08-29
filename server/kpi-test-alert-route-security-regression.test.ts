import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("KPI test-alert route production safety", () => {
  it("returns 404 in production before authentication or global alert reconciliation", () => {
    const routes = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf8");
    const routeStart = routes.indexOf('app.post("/api/kpis/test-alerts"');
    const routeEnd = routes.indexOf('app.post("/api/meta/:campaignId/connect-test"', routeStart);
    const route = routes.slice(routeStart, routeEnd);
    const productionGuard = route.indexOf('if (String(process.env.NODE_ENV || "").toLowerCase() === "production")');
    const authentication = route.indexOf("const actorId = getActorId(req);");
    const globalAlertImport = route.indexOf('await import("./kpi-scheduler")');

    expect(routeStart).toBeGreaterThan(-1);
    expect(routeEnd).toBeGreaterThan(routeStart);
    expect(productionGuard).toBeGreaterThan(-1);
    expect(route).toContain('return res.status(404).json({ success: false, message: "Not found" });');
    expect(productionGuard).toBeLessThan(authentication);
    expect(productionGuard).toBeLessThan(globalAlertImport);
    expect(authentication).toBeLessThan(globalAlertImport);
  });
});
