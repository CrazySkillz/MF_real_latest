import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf-8");

function sliceBetween(sourceText: string, start: string, end: string): string {
  const startIndex = sourceText.indexOf(start);
  expect(startIndex).toBeGreaterThan(-1);
  const endIndex = sourceText.indexOf(end, startIndex + start.length);
  expect(endIndex).toBeGreaterThan(startIndex);
  return sourceText.slice(startIndex, endIndex);
}

function expectBefore(sourceText: string, first: string, second: string): void {
  const firstIndex = sourceText.indexOf(first);
  const secondIndex = sourceText.indexOf(second);
  expect(firstIndex).toBeGreaterThan(-1);
  expect(secondIndex).toBeGreaterThan(-1);
  expect(firstIndex).toBeLessThan(secondIndex);
}

describe("GA4 scheduler and scheduled report observability", () => {
  it("exposes GA4 daily scheduler runtime state through the scheduler health endpoint", () => {
    const index = source("server/index.ts");
    const daily = source("server/ga4-daily-scheduler.ts");

    expect(index).toContain('import { getGA4DailySchedulerStatus, startGA4DailyScheduler } from "./ga4-daily-scheduler";');
    expect(index).toContain("ga4DailyScheduler: getGA4DailySchedulerStatus()");
    expect(daily).toContain("export function getGA4DailySchedulerStatus()");
    expect(daily).toContain("timerScheduled: Boolean((global as any).ga4DailySchedulerTimer)");
    expect(daily).toContain("nextRunAt: toIsoOrNull(ga4DailySchedulerStatus.nextRunAt)");
    expect(daily).toContain("totalScheduledRuns: ga4DailySchedulerStatus.totalScheduledRuns");
    expect(daily).toContain("lastRunStatus: ga4DailySchedulerStatus.lastRunStatus");
    expectBefore(daily, "ga4DailySchedulerStatus.nextRunAt = nextRunAt;", "setTimeout(() => {");
  });

  it("updates report scheduler health metrics on every scheduled check", () => {
    const reportScheduler = source("server/report-scheduler.ts");

    expect(reportScheduler).toContain("schedulerStartedAt: null as Date | null");
    expect(reportScheduler).toContain("cronSchedule: null as string | null");
    expect(reportScheduler).toContain("lastCheckFinishedAt: null as Date | null");
    expect(reportScheduler).toContain("lastScheduledReportsFound: 0");
    expect(reportScheduler).toContain("lastDueReportsFound: 0");
    expect(reportScheduler).toContain("schedulerMetrics.totalChecks++");
    expect(reportScheduler).toContain("schedulerMetrics.lastCheckTime = now");
    expect(reportScheduler).toContain("schedulerMetrics.lastScheduledReportsFound = scheduledReports.length");
    expect(reportScheduler).toContain("schedulerMetrics.lastDueReportsFound++");
    expect(reportScheduler).toContain("schedulerMetrics.lastCheckFinishedAt = new Date()");
    expect(reportScheduler).toContain("schedulerMetrics.schedulerStartedAt = new Date()");
    expect(reportScheduler).toContain("schedulerMetrics.cronSchedule = cronSchedule");
  });

  it("adds a read-only guarded send-event evidence endpoint for scheduled report runtime validation", () => {
    const routes = source("server/routes-oauth.ts");
    const route = sliceBetween(
      routes,
      'app.get("/api/platforms/:platformType/reports/:reportId/send-events"',
      '  // Report snapshots (immutable history)'
    );

    expect(route).toContain("const existing = await ensurePlatformReportAccess");
    expect(route).toContain('return res.status(404).json({ success: false, error: "Report not found" });');
    expect(route).toContain('const { reportSendEvents } = await import("../shared/schema");');
    expect(route).toContain(".where(eq((reportSendEvents as any).reportId, String(reportId)))");
    expect(route).toContain('certificationStatus: "validation_output_only"');
    expect(route).toContain("scheduledSendObserved: events.length > 0");
    expect(route).toContain('sentEventObserved: events.some((event: any) => event.status === "sent" && !!event.sentAt)');
    expect(route).not.toMatch(/db\.(insert|update|delete)/);
    expect(route).not.toContain("sendTestReport");
    expect(route).not.toContain("sendReportEmail");
    expect(route).not.toContain("buildPdfAttachmentForReport");
  });
});
