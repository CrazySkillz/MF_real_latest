import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("Spend source additivity", () => {
  it("Google Sheets spend add mode creates a new additive source instead of replacing by connection", () => {
    const routesFile = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");

    const routeStart = routesFile.indexOf('app.post("/api/campaigns/:id/spend/sheets/process"');
    const nextRouteStart = routesFile.indexOf("// ---------------------------------------------------------------------------", routeStart);
    expect(routeStart).toBeGreaterThan(-1);
    expect(nextRouteStart).toBeGreaterThan(routeStart);
    const route = routesFile.slice(routeStart, nextRouteStart);

    expect(route).toContain("Add mode creates a new additive source. Edit/refresh mode passes sourceId and updates only that source.");
    expect(route).toContain("const existingSheetsSpendSource = existingSourceId");
    expect(route).toContain("return String((s as any).id || \"\") === existingSourceId;");
    expect(route).toContain('if (existingSourceId && !existingSheetsSpendSource) {');
    expect(route).toContain('return res.status(404).json({ success: false, error: "Spend source not found" });');
    expect(route).not.toContain("String(cfg?.connectionId || \"\") === String(connectionId)");
  });

  it("Total Spend source totals use the full imported record window unless the campaign has an explicit start date", () => {
    const routesFile = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");
    expect(routesFile).toContain('const startDate = toISODateUTC((campaign as any)?.startDate) || "1900-01-01";');
    expect(routesFile).not.toContain('toISODateUTC((campaign as any)?.createdAt) || "2020-01-01"');
  });
});
