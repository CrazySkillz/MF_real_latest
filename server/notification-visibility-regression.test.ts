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

  it("deduplicates visible performance alerts by linked KPI or Benchmark", () => {
    const routesFile = readFileSync(
      join(process.cwd(), "server", "routes-oauth.ts"),
      "utf-8"
    );

    expect(routesFile).toContain("const visiblePerformanceAlertKey = (n: any): string | null => {");
    expect(routesFile).toContain('if (meta?.kpiId) return `kpi:${String(meta.kpiId)}`;');
    expect(routesFile).toContain('if (meta?.benchmarkId) return `benchmark:${String(meta.benchmarkId)}`;');
    expect(routesFile).toContain("const dedupeVisiblePerformanceAlerts = (rows: any[]) => {");
    expect(routesFile).toContain("const scoped = dedupeVisiblePerformanceAlerts(scopedRows.filter(Boolean));");
    expect(routesFile).toContain("return res.json(dedupeVisiblePerformanceAlerts(list));");
  });

  it("prevents stale KPI and Benchmark alert creation from missing campaigns or non-breaches", () => {
    const kpiNotificationsFile = readFileSync(
      join(process.cwd(), "server", "kpi-notifications.ts"),
      "utf-8"
    );
    const benchmarkNotificationsFile = readFileSync(
      join(process.cwd(), "server", "benchmark-notifications.ts"),
      "utf-8"
    );

    expect(kpiNotificationsFile).toContain("if (!shouldTriggerAlert(kpi)) {");
    expect(kpiNotificationsFile).toContain("await resolveKPIAlerts(String(kpi.id), 'cleared');");
    expect(kpiNotificationsFile).toContain('const campaignId = String(kpi.campaignId || "").trim();');
    expect(kpiNotificationsFile).toContain("const campaign = await storage.getCampaign(campaignId).catch(() => undefined);");
    expect(kpiNotificationsFile).toContain("if (!campaign) return;");
    expect(kpiNotificationsFile).toContain('const usesSingleActiveAlert = platformType === "google_analytics" || !platformType || platformType === "campaign";');
    expect(benchmarkNotificationsFile).toContain('const campaignId = String(b.campaignId || "").trim();');
    expect(benchmarkNotificationsFile).toContain("const campaign = await storage.getCampaign(campaignId).catch(() => undefined);");
    expect(benchmarkNotificationsFile).toContain("if (!campaign) continue;");
    expect(benchmarkNotificationsFile).toContain('const usesSingleActiveAlert = platformType === "google_analytics" || !platformType || platformType === "campaign";');
  });
});
