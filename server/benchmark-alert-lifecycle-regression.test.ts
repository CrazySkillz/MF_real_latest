import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("benchmark alert lifecycle regression guard", () => {
  it("resolves active GA4/campaign KPI alerts when alerts are disabled or campaign context is missing", () => {
    const schedulerSource = readFileSync(join(process.cwd(), "server", "kpi-scheduler.ts"), "utf-8");
    const kpiSource = readFileSync(join(process.cwd(), "server", "kpi-notifications.ts"), "utf-8");

    expect(schedulerSource).toContain("const activeKPIsRaw = await db.select()");
    expect(schedulerSource).toContain("if (!kpi.alertsEnabled || kpi.alertThreshold === null || typeof kpi.alertThreshold === \"undefined\") {");
    expect(schedulerSource).toContain("if (usesSingleActiveAlert) await resolveKPIAlerts(String(kpi.id), 'cleared');");
    expect(kpiSource).toContain("if (!campaignId) {");
    expect(kpiSource).toContain("if (!campaign) {");
    expect(kpiSource).toContain("if (usesSingleActiveAlert) await resolveKPIAlerts(String(kpi.id), 'cleared');");
  });

  it("resolves active GA4/campaign Benchmark alerts when the row no longer has a valid breach", () => {
    const source = readFileSync(join(process.cwd(), "server", "benchmark-notifications.ts"), "utf-8");

    expect(source).toContain('export async function resolveBenchmarkAlerts(benchmarkId: string, reason: "cleared" | "superseded" = "cleared"): Promise<void> {');
    expect(source).toContain('.where(eq(benchmarks.status, "active"))');
    expect(source).not.toContain('.where(and(eq(benchmarks.status, "active"), eq(benchmarks.alertsEnabled, true)))');
    expect(source).toContain('if (!b.alertsEnabled || thresholdRaw === null || typeof thresholdRaw === "undefined") {');
    expect(source).toContain('if (!Number.isFinite(thresholdValue)) {');
    expect(source).toContain('if (!Number.isFinite(currentValue)) {');
    expect(source).toContain('if (!evaluation.triggered) {');
    expect(source).toContain('await resolveBenchmarkAlerts(String(b.id), "cleared");');
  });

  it("fails closed when a breached Benchmark no longer has valid campaign context", () => {
    const source = readFileSync(join(process.cwd(), "server", "benchmark-notifications.ts"), "utf-8");

    expect(source).toContain('const campaignId = String(b.campaignId || "").trim();');
    expect(source).toContain('const campaign = await storage.getCampaign(campaignId).catch(() => undefined);');
    expect(source).toContain('if (!campaignId) {');
    expect(source).toContain('if (!campaign) {');
    expect(source).toContain('if (usesSingleActiveAlert) await resolveBenchmarkAlerts(String(b.id), "cleared");');
  });

  it("allows dismissed still-breached Benchmark alerts to recreate one active alert", () => {
    const source = readFileSync(join(process.cwd(), "server", "benchmark-notifications.ts"), "utf-8");

    expect(source).toContain("if (meta?.dismissedAt) return false;");
    expect(source).toContain("!meta?.resolved && !meta?.dismissedAt");
    expect(source).toContain("if (hasRecent) {");
    expect(source).toContain("await storage.updateNotification(String(preservedAlert.id), {");
    expect(source).toContain("continue;");
  });

  it("collapses duplicate active GA4/campaign KPI and Benchmark alerts", () => {
    const benchmarkSource = readFileSync(join(process.cwd(), "server", "benchmark-notifications.ts"), "utf-8");
    const kpiSource = readFileSync(join(process.cwd(), "server", "kpi-notifications.ts"), "utf-8");

    expect(benchmarkSource).toContain('const usesSingleActiveAlert = platformType === "google_analytics" || !platformType || platformType === "campaign";');
    expect(benchmarkSource).toContain("const sameBenchmarkAlerts = (existingAlerts || []).filter");
    expect(benchmarkSource).toContain('resolvedReason: "superseded"');
    expect(kpiSource).toContain("const sameKpiAlerts = existingAlerts.filter");
    expect(kpiSource).toContain("resolvedReason: 'superseded'");
  });
});
