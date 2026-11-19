/** Recurring elapsed-time jobs share a fixed UTC anchor, never process startup. */
export type AnchoredInterval = { stop(): void; nextRunAt(): Date };

const jobs = new Map<string, AnchoredInterval>();

export function getNextIntervalRunAt(intervalMs: number, now = Date.now()): Date {
  const configured = process.env.SCHEDULER_INTERVAL_ANCHOR_AT;
  const anchor = configured === undefined ? 0 : Date.parse(configured);
  if (!Number.isSafeInteger(intervalMs) || intervalMs < 1 || intervalMs > 2147483647) {
    throw new Error("Scheduler interval must be a whole number of milliseconds from 1 to 2147483647");
  }
  if (!Number.isFinite(anchor) || (configured !== undefined && (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(configured)
    || new Date(anchor).toISOString() !== configured.replace(/(?<=:\d{2})Z$/, '.000Z')))) {
    throw new Error("SCHEDULER_INTERVAL_ANCHOR_AT must be an ISO UTC timestamp");
  }
  return new Date(anchor + (Math.floor((now - anchor) / intervalMs) + 1) * intervalMs);
}

export function startAnchoredInterval(name: string, run: () => unknown, intervalMs: number): AnchoredInterval {
  const existing = jobs.get(name);
  if (existing) return existing;
  let next = getNextIntervalRunAt(intervalMs);
  let stopped = false;
  let running = false;
  let timer: ReturnType<typeof setTimeout>;
  const job: AnchoredInterval = {
    stop() {
      stopped = true;
      clearTimeout(timer);
      if (jobs.get(name) === job) jobs.delete(name);
    },
    nextRunAt: () => new Date(next),
  };
  const schedule = () => {
    timer = setTimeout(() => {
      if (stopped) return;
      // Recalculate after delayed ticks; never replay a backlog or shift the cadence.
      if (Date.now() >= next.getTime()) {
        if (!running) {
          running = true;
          void Promise.resolve().then(() => stopped ? undefined : run()).catch(error => {
            console.error(`[${name}] Scheduled run failed:`, error?.message || error);
          }).finally(() => { running = false; });
        }
        next = getNextIntervalRunAt(intervalMs);
      }
      schedule();
    }, Math.min(2147483647, Math.max(1, next.getTime() - Date.now())));
  };
  jobs.set(name, job);
  schedule();
  console.log(`[${name}] Next interval run: ${next.toISOString()} (fixed UTC anchor)`);
  return job;
}
