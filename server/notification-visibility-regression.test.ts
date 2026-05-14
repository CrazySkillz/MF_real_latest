import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("notification visibility regression guard", () => {
  it("hides resolved alert notifications from visible notification lists", () => {
    const routesFile = readFileSync(
      join(process.cwd(), "server", "routes-oauth.ts"),
      "utf-8"
    );

    expect(routesFile).toContain("return !!meta?.dismissedAt || !!meta?.resolved;");
  });

  it("hides orphaned or cross-campaign performance alert notifications", () => {
    const routesFile = readFileSync(
      join(process.cwd(), "server", "routes-oauth.ts"),
      "utf-8"
    );

    expect(routesFile).toContain('const isPerformanceAlert = String(n.type || "") === "performance-alert";');
    expect(routesFile).toContain('if (!kpi || String((kpi as any).campaignId || "") !== String(n.campaignId || "")) return null;');
    expect(routesFile).toContain('if (!benchmark || String((benchmark as any).campaignId || "") !== String(n.campaignId || "")) return null;');
    expect(routesFile).toContain("if (isPerformanceAlert) return null;");
    expect(routesFile).toContain('if (String((n as any)?.type || "") !== "performance-alert") return true;');
    expect(routesFile).toContain("const kpi = await storage.getKPI(String(meta.kpiId)).catch(() => undefined as any);");
    expect(routesFile).toContain("const benchmark = await storage.getBenchmark(String(meta.benchmarkId)).catch(() => undefined as any);");
  });

  it("hides performance alert notifications when the linked row no longer breaches", () => {
    const routesFile = readFileSync(
      join(process.cwd(), "server", "routes-oauth.ts"),
      "utf-8"
    );

    expect(routesFile).toContain("const isAlertRowBreached = (row: any): boolean => {");
    expect(routesFile).toContain("if (isPerformanceAlert && !isAlertRowBreached(kpi)) return null;");
    expect(routesFile).toContain("if (isPerformanceAlert && !isAlertRowBreached(benchmark)) return null;");
    expect(routesFile).toContain("&& isAlertRowBreached(kpi);");
    expect(routesFile).toContain("&& isAlertRowBreached(benchmark);");
  });
});
