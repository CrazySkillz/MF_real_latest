import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("GA4 KPI regression guard", () => {
  it("routes GA4 KPI notifications to ga4-metrics instead of LinkedIn", () => {
    const notificationsFile = readFileSync(
      join(process.cwd(), "server", "kpi-notifications.ts"),
      "utf-8"
    );

    expect(notificationsFile).toContain("function buildKPIActionUrl(kpi: KPI): string {");
    expect(notificationsFile).toContain('if (platform === "google_analytics") {');
    expect(notificationsFile).toContain('/ga4-metrics?tab=kpis&highlight=');
    expect(notificationsFile).toContain('/linkedin-analytics?tab=kpis&highlight=');
    expect(notificationsFile).toContain("const actionUrl = buildKPIActionUrl(kpi);");
  });

  it("allows breached alert-enabled GA4 KPIs to be considered by the alert checker", () => {
    const schedulerFile = readFileSync(
      join(process.cwd(), "server", "kpi-scheduler.ts"),
      "utf-8"
    );
    const activeKpisQueryMatch = schedulerFile.match(
      /const activeKPIs = await db\.select\(\)\s*\.from\(kpis\)\s*\.where\(and\(([\s\S]*?)\)\);/
    );
    const activeKpisQuery = activeKpisQueryMatch?.[0] || "";

    expect(activeKpisQuery).toContain("eq(kpis.alertsEnabled, true)");
    expect(activeKpisQuery).not.toContain("eq(kpis.status, 'active')");
    expect(schedulerFile).toContain("if (shouldTriggerAlert(kpi)) {");
    expect(schedulerFile).toContain("await createKPIAlert(kpi);");
  });

  it("opens GA4 Create KPI with a clean empty form state", () => {
    const ga4MetricsFile = readFileSync(
      join(process.cwd(), "client", "src", "pages", "ga4-metrics.tsx"),
      "utf-8"
    );

    expect(ga4MetricsFile).toContain("const getEmptyKpiFormValues = (): KPIFormData => ({");
    expect(ga4MetricsFile).toContain("kpiForm.reset(getEmptyKpiFormValues());");
    expect(ga4MetricsFile).toContain("kpiForm.reset({");
    expect(ga4MetricsFile).toContain("...getEmptyKpiFormValues(),");
    expect(ga4MetricsFile).not.toContain('kpiForm.reset({ ...kpiForm.getValues(), name: "", metric: "", description: "", unit: "%", currentValue: "", targetValue: "", priority: "medium" });');
  });
});
