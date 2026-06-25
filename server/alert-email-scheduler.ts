type AlertEmailSchedulerConfig = {
  enabled: boolean;
  intervalMs: number;
};

type AlertEmailSchedulerRunResult = {
  skipped: boolean;
  reason?: "overlap";
  kpiAlerts?: number;
  benchmarkAlerts?: number;
};

const DEFAULT_ALERT_EMAIL_INTERVAL_MS = 15 * 60 * 1000;
const MIN_ALERT_EMAIL_INTERVAL_MS = 60 * 1000;
const MAX_ALERT_EMAIL_INTERVAL_MS = 24 * 60 * 60 * 1000;

const parseBoundedInt = (value: unknown, fallback: number, min: number, max: number) => {
  const parsed = parseInt(String(value ?? ""), 10);
  const n = Number.isFinite(parsed) ? parsed : fallback;
  return Math.min(Math.max(n, min), max);
};

export function getAlertEmailSchedulerConfig(env: NodeJS.ProcessEnv = process.env): AlertEmailSchedulerConfig {
  const enabled = String(env.ALERT_EMAIL_REMINDER_SCHEDULER_ENABLED ?? "true").toLowerCase() !== "false";
  const intervalMs = parseBoundedInt(
    env.ALERT_EMAIL_REMINDER_INTERVAL_MS,
    DEFAULT_ALERT_EMAIL_INTERVAL_MS,
    MIN_ALERT_EMAIL_INTERVAL_MS,
    MAX_ALERT_EMAIL_INTERVAL_MS,
  );
  return { enabled, intervalMs };
}

export async function runAlertEmailReminderSchedulerOnce(): Promise<AlertEmailSchedulerRunResult> {
  if ((global as any).__alertEmailReminderSchedulerInProgress) {
    console.log("[Alert Email Scheduler] Previous run still in progress; skipping overlap");
    return { skipped: true, reason: "overlap" };
  }

  (global as any).__alertEmailReminderSchedulerInProgress = true;
  try {
    const { alertMonitoringService } = await import("./services/alert-monitoring.js");
    const results = await alertMonitoringService.runAlertChecks();
    return {
      skipped: false,
      kpiAlerts: results.kpiAlerts,
      benchmarkAlerts: results.benchmarkAlerts,
    };
  } finally {
    (global as any).__alertEmailReminderSchedulerInProgress = false;
  }
}

export function startAlertEmailScheduler(config: AlertEmailSchedulerConfig = getAlertEmailSchedulerConfig()): void {
  if (!config.enabled) {
    console.log("[Alert Email Scheduler] Disabled by configuration");
    return;
  }

  if ((global as any).__alertEmailReminderSchedulerInterval) {
    console.log("[Alert Email Scheduler] Scheduler already running");
    return;
  }

  (global as any).__alertEmailReminderSchedulerInterval = setInterval(() => {
    runAlertEmailReminderSchedulerOnce().catch((error: any) => {
      console.warn("[Alert Email Scheduler] Reminder check failed:", error?.message || error);
    });
  }, config.intervalMs);

  console.log(`[Alert Email Scheduler] Started with interval ${config.intervalMs}ms`);
}

export function stopAlertEmailScheduler(): void {
  if ((global as any).__alertEmailReminderSchedulerInterval) {
    clearInterval((global as any).__alertEmailReminderSchedulerInterval);
    (global as any).__alertEmailReminderSchedulerInterval = null;
  }
  (global as any).__alertEmailReminderSchedulerInProgress = false;
  console.log("[Alert Email Scheduler] Stopped");
}
