import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { getAlertEmailSchedulerConfig } from "./alert-email-scheduler";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf-8");

describe("alert email scheduler regression guard", () => {
  it("uses a configurable scheduler interval with a safe 15 minute default", () => {
    expect(getAlertEmailSchedulerConfig({} as any)).toEqual({
      enabled: true,
      intervalMs: 15 * 60 * 1000,
    });
    expect(getAlertEmailSchedulerConfig({ ALERT_EMAIL_REMINDER_INTERVAL_MS: "60000" } as any).intervalMs).toBe(60000);
    expect(getAlertEmailSchedulerConfig({ ALERT_EMAIL_REMINDER_INTERVAL_MS: "1000" } as any).intervalMs).toBe(60000);
    expect(getAlertEmailSchedulerConfig({ ALERT_EMAIL_REMINDER_SCHEDULER_ENABLED: "false" } as any).enabled).toBe(false);
  });

  it("starts from the existing server startup scheduler block", () => {
    const index = source("server/index.ts");

    expect(index).toContain('import { startAlertEmailScheduler } from "./alert-email-scheduler";');
    expect(index).toContain("// Start alert email reminder scheduler");
    expect(index).toContain("startAlertEmailScheduler();");
    expect(index).toContain("Failed to start alert email scheduler");
  });

  it("runs alert email checks on its own cadence with an overlap guard", () => {
    const scheduler = source("server/alert-email-scheduler.ts");

    expect(scheduler).toContain("DEFAULT_ALERT_EMAIL_INTERVAL_MS = 15 * 60 * 1000");
    expect(scheduler).toContain("__alertEmailReminderSchedulerInProgress");
    expect(scheduler).toContain("Previous run still in progress; skipping overlap");
    expect(scheduler).toContain('const { alertMonitoringService } = await import("./services/alert-monitoring.js");');
    expect(scheduler).toContain("const results = await alertMonitoringService.runAlertChecks();");
    expect(scheduler).toContain("setInterval(() => {");
    expect(scheduler).toContain("}, config.intervalMs);");
  });

  it("keeps immediate alert email reminders off the daily KPI scheduler cadence", () => {
    const kpiScheduler = source("server/kpi-scheduler.ts");
    const alertScheduler = source("server/alert-email-scheduler.ts");

    expect(kpiScheduler).not.toContain("alertMonitoringService.runAlertChecks()");
    expect(alertScheduler).toContain("setInterval(() => {");
    expect(alertScheduler).toContain("config.intervalMs");
  });

  it("does not make source refresh paths synchronously responsible for alert email delivery", () => {
    const autoRefresh = source("server/auto-refresh-scheduler.ts");
    const ga4Daily = source("server/ga4-daily-scheduler.ts");

    expect(autoRefresh).not.toContain("alertMonitoringService.runAlertChecks()");
    expect(autoRefresh).not.toContain("startAlertEmailScheduler");
    expect(ga4Daily).not.toContain("alertMonitoringService.runAlertChecks()");
    expect(ga4Daily).not.toContain("startAlertEmailScheduler");
  });

  it("keeps the production manual alert check route disabled", () => {
    const routes = source("server/routes-oauth.ts");
    const routeStart = routes.indexOf('app.post("/api/alerts/check"');
    const routeEnd = routes.indexOf('app.get("/api/alerts/settings"', routeStart);
    const route = routes.slice(routeStart, routeEnd);

    expect(routeStart).toBeGreaterThan(-1);
    expect(route).toContain('if (String(process.env.NODE_ENV || "").toLowerCase() === "production")');
    expect(route).toContain('return res.status(404).json({ success: false, message: "Not found" });');
  });
});
