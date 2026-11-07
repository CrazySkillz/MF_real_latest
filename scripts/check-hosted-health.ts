// Read-only operational monitoring. Never imports application startup or storage.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { getExpectedScheduledRefreshAt, getLatestCompleteReportingDate, normalizeReportingTimeZone } from "../server/utils/reporting-timezone";

export const configSchema = z.object({
  baseUrl: z.string().url().refine(value => {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash;
  }),
  expectedCommit: z.string().regex(/^[a-f0-9]{40}$/),
  graceMinutes: z.number().int().min(5).max(60),
  maxResponseMilliseconds: z.number().int().min(100).max(15000).default(5000),
  enrollmentResolved: z.literal(true).optional(),
  campaigns: z.array(z.object({
    campaignIdHash: z.string().regex(/^[a-f0-9]{12}$/),
    reportingTimeZone: z.string().min(1).refine(value => normalizeReportingTimeZone(value) === value),
    monitorFrom: z.string().datetime({ offset: true }).optional(),
  })).max(100).refine(rows => new Set(rows.map(row => row.campaignIdHash)).size === rows.length),
}).refine(config => config.campaigns.length > 0 || config.enrollmentResolved === true);
const stamp = z.string().datetime({ offset: true });
const schedulerSchema = z.object({
  status: z.enum(["healthy", "unhealthy"]), timestamp: stamp,
  ga4DailyScheduler: z.object({
    started: z.boolean(), timerScheduled: z.boolean(), inProgress: z.boolean(),
    nextRunAt: stamp.nullable(), lastRunStartedAt: stamp.nullable(),
    lastRunStatus: z.enum(["idle", "running", "success", "failed", "skipped"]), lastError: z.unknown(),
    config: z.object({ hours: z.array(z.number()), minute: z.number() }),
    alignedRefreshCampaigns: z.array(z.object({ campaignIdHash: z.string(), reportingDate: z.string(), completedAt: stamp })),
  }),
});
export type MonitorConfig = z.infer<typeof configSchema>;

export function assessHostedHealth(health: unknown, scheduler: unknown, input: unknown, now = new Date()) {
  const config = configSchema.parse(input);
  const failures: string[] = [], pending: string[] = [];
  const app = z.object({ ok: z.boolean(), commit: z.string(), nodeEnv: z.string(), ts: stamp }).safeParse(health);
  const parsed = schedulerSchema.safeParse(scheduler);
  if (!app.success || !app.data.ok || app.data.nodeEnv !== "production") failures.push("APP_HEALTH_INVALID");
  if (app.success && app.data.commit !== config.expectedCommit) failures.push("UNEXPECTED_APP_REVISION");
  if (app.success && Math.abs(now.getTime() - Date.parse(app.data.ts)) > 120_000) failures.push("APP_HEALTH_STALE");
  if (!parsed.success) failures.push("SCHEDULER_HEALTH_INVALID");
  else {
    const body = parsed.data, ga4 = body.ga4DailyScheduler;
    const graceMs = config.graceMinutes * 60_000;
    const startedAt = Date.parse(ga4.lastRunStartedAt || "");
    const runningWithinGrace = ga4.inProgress && startedAt <= now.getTime() && now.getTime() - startedAt < graceMs;
    if (Math.abs(now.getTime() - Date.parse(body.timestamp)) > 120_000) failures.push("SCHEDULER_HEALTH_STALE");
    if (body.status !== "healthy" || ga4.lastRunStatus === "failed" || ga4.lastError) failures.push("RECORDED_JOB_FAILURE");
    if (!ga4.started || (!ga4.inProgress && !ga4.timerScheduled)) failures.push("GA4_SCHEDULER_STOPPED");
    if (JSON.stringify([...ga4.config.hours].sort((a, b) => a - b)) !== "[8,14,20]" || ga4.config.minute !== 0) failures.push("GA4_SCHEDULE_CHANGED");
    if (ga4.inProgress && !runningWithinGrace) failures.push("GA4_RUN_OVERDUE");
    if (!ga4.inProgress && (!ga4.nextRunAt || Date.parse(ga4.nextRunAt) < now.getTime() - 120_000)) failures.push("GA4_TIMER_OVERDUE");
    for (const campaign of config.campaigns) {
      // Evaluate the latest slot whose completion grace has elapsed, including yesterday before 08:00.
      const cutoff = new Date(now.getTime() - graceMs), zone = campaign.reportingTimeZone;
      const schedule = { reportingTimeZone: zone, hour: 8, hours: [8, 14, 20], minute: 0 };
      let reportingDate = getLatestCompleteReportingDate(zone, cutoff);
      let due = getExpectedScheduledRefreshAt(reportingDate, schedule, cutoff)!;
      if (due > cutoff) {
        reportingDate = new Date(Date.parse(reportingDate + "T00:00:00Z") - 86_400_000).toISOString().slice(0, 10);
        due = getExpectedScheduledRefreshAt(reportingDate, schedule, cutoff)!;
      }
      if (campaign.monitorFrom && Date.parse(campaign.monitorFrom) > due.getTime()) {
        pending.push(`FIRST_SCHEDULED_REFRESH_PENDING:${campaign.campaignIdHash}`);
        continue;
      }
      const markers = ga4.alignedRefreshCampaigns.filter(row => row.campaignIdHash === campaign.campaignIdHash);
      const marker = markers[0];
      const dateValid = marker && /^\d{4}-\d{2}-\d{2}$/.test(marker.reportingDate)
        && Number.isFinite(Date.parse(marker.reportingDate + "T00:00:00Z"))
        && new Date(marker.reportingDate + "T00:00:00Z").toISOString().slice(0, 10) === marker.reportingDate
        && marker.reportingDate >= reportingDate && marker.reportingDate <= getLatestCompleteReportingDate(zone, now);
      if (markers.length > 1 || (marker && Date.parse(marker.completedAt) > now.getTime())) failures.push(`INVALID_COMPLETION:${campaign.campaignIdHash}`);
      else if (!marker || !dateValid || Date.parse(marker.completedAt) < due.getTime()) {
        if (runningWithinGrace) pending.push(`REFRESH_IN_PROGRESS:${campaign.campaignIdHash}`);
        else failures.push(`REFRESH_UNCONFIRMED:${campaign.campaignIdHash}`);
      }
    }
  }
  return { checkedAt: now.toISOString(), origin: new URL(config.baseUrl).origin,
    status: failures.length ? "failed" : pending.length ? "pending" : "passed", failures, pending,
    monitoredCampaigns: config.campaigns.length,
    scope: "Availability and refresh evidence for enrolled campaigns; not metric accuracy certification." };
}

export async function checkHostedHealth(input: unknown, request: typeof fetch = fetch) {
  const config = configSchema.parse(input);
  const get = async (path: string) => {
    const started = performance.now();
    const response = await request(new URL(path, config.baseUrl), {
      method: "GET", redirect: "error", headers: { "Cache-Control": "no-cache" }, signal: AbortSignal.timeout(15_000),
    });
    if (response.status !== 200) throw new Error("HEALTH_HTTP_FAILURE");
    const body = await response.json();
    if (performance.now() - started > config.maxResponseMilliseconds) throw new Error("HEALTH_RESPONSE_SLOW");
    return body;
  };
  try {
    const [health, scheduler] = await Promise.all([get("/api/health"), get("/health/scheduler")]);
    return assessHostedHealth(health, scheduler, config);
  } catch (error) {
    // Never echo server bodies, redirect locations, credentials, or raw network errors into monitor logs.
    return { checkedAt: new Date().toISOString(), origin: new URL(config.baseUrl).origin,
      status: "failed", failures: [error instanceof Error && error.message === "HEALTH_RESPONSE_SLOW" ? "HEALTH_RESPONSE_SLOW" : "HEALTH_REQUEST_FAILED"], pending: [], monitoredCampaigns: config.campaigns.length };
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.length < 3) { console.error("MONITOR_CONFIGURATION_INVALID"); process.exitCode = 1; }
  for (const configPath of process.argv.slice(2)) try {
    const result = await checkHostedHealth(JSON.parse(readFileSync(configPath, "utf8")));
    console.log(JSON.stringify(result));
    if (result.status === "failed") process.exitCode = 1;
  } catch {
    console.error("MONITOR_CONFIGURATION_INVALID");
    process.exitCode = 1;
  }
}
