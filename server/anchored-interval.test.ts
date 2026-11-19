import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { getNextIntervalRunAt, startAnchoredInterval, type AnchoredInterval } from './utils/anchored-interval';

const anchor = '2026-11-19T02:27:53.863Z';
const handles: AnchoredInterval[] = [];
const start: typeof startAnchoredInterval = (...args) => { const job = startAnchoredInterval(...args); handles.push(job); return job; };
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-19T03:00:00Z'));
  vi.stubEnv('SCHEDULER_INTERVAL_ANCHOR_AT', anchor);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { for (const job of handles.splice(0)) job.stop(); vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe('deployment-independent interval timing', () => {
  it.each([60_000, 300_000, 900_000, 3600_000, 14400_000, 86400_000, 604800_000])('retains the next slot after repeated restarts (%i ms)', async ms => {
    const run = vi.fn(); const due = getNextIntervalRunAt(ms).getTime();
    const a = start('restart', run, ms);
    vi.setSystemTime(new Date((Date.now() + due) / 2)); a.stop();
    const b = start('restart', run, ms);
    expect(b.nextRunAt().getTime()).toBe(due);
    expect(run).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(due - Date.now());
    expect(run).toHaveBeenCalledTimes(1);
    expect(b.nextRunAt().getTime()).toBe(due + ms);
    b.stop();
    const c = start('restart', run, ms);
    expect(c.nextRunAt().getTime()).toBe(due + ms);
  });
  it('uses a fixed epoch default and validates configuration before registering work', () => {
    vi.stubEnv('SCHEDULER_INTERVAL_ANCHOR_AT', undefined);
    expect(getNextIntervalRunAt(14400_000).toISOString()).toBe('2026-11-19T04:00:00.000Z');
    const run = vi.fn();
    for (const value of [0, -1, NaN, Infinity, 1.5, 2147483648]) expect(() => start('invalid', run, value)).toThrow();
    for (const value of ['', 'invalid', '2026-11-19', '2026-02-30T02:00:00Z', '2026-11-19T02:00:00+01:00']) {
      vi.stubEnv('SCHEDULER_INTERVAL_ANCHOR_AT', value); expect(() => start('invalid', run, 60000)).toThrow();
    }
    expect(vi.getTimerCount()).toBe(0); expect(run).not.toHaveBeenCalled();
  });
  it('does not replay downtime, drift after a delayed tick, or depend on Amsterdam DST', async () => {
    const run = vi.fn(); const a = start('late', run, 86400_000);
    vi.setSystemTime(new Date('2027-03-28T03:00:00Z'));
    await vi.advanceTimersToNextTimerAsync();
    expect(run).toHaveBeenCalledOnce();
    expect((a.nextRunAt().getTime() - Date.parse(anchor)) % 86400_000).toBe(0);
    expect(a.nextRunAt().getTime()).toBeGreaterThan(Date.now());
  });
  it('waits after a backward clock adjustment without an early run', async () => {
    const run = vi.fn(); const a = start('clock', run, 60_000); const due = a.nextRunAt().getTime();
    vi.setSystemTime(Date.now() - 3600_000); await vi.advanceTimersToNextTimerAsync();
    expect(run).not.toHaveBeenCalled(); expect(a.nextRunAt().getTime()).toBe(due);
    await vi.advanceTimersByTimeAsync(due - Date.now()); expect(run).toHaveBeenCalledOnce();
  });
  it('registers once, skips in-process overlap, recovers after rejection, and stops cleanly', async () => {
    let release!: () => void;
    const run = vi.fn().mockImplementationOnce(() => new Promise<void>(r => { release = r; }))
      .mockRejectedValueOnce(new Error('provider failure')).mockResolvedValue(undefined);
    const a = start('safe', run, 60_000); expect(start('safe', run, 60_000)).toBe(a);
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersToNextTimerAsync(); await vi.advanceTimersByTimeAsync(120_000);
    expect(run).toHaveBeenCalledOnce(); release(); await Promise.resolve();
    await vi.advanceTimersByTimeAsync(60_000); expect(run).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(60_000); expect(run).toHaveBeenCalledTimes(3);
    a.stop(); await vi.advanceTimersByTimeAsync(120_000); expect(run).toHaveBeenCalledTimes(3);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('does not let an old stopped handle unregister a restarted job', () => {
    const a = start('handle', vi.fn(), 60000); a.stop();
    const b = start('handle', vi.fn(), 60000); a.stop();
    expect(start('handle', vi.fn(), 60000)).toBe(b); expect(vi.getTimerCount()).toBe(1);
  });
});

// Execute real scheduler entry points; all provider/storage work is intercepted.
function entry(file: string, names: string[], bindings: Record<string, unknown>, result: string) {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const declarations = names.map(name => {
    const declaration = source.statements.find(n => (ts.isFunctionDeclaration(n) || ts.isClassDeclaration(n)) && n.name?.text === name);
    if (!declaration) throw new Error(name);
    return declaration.getText(source).replace(/^export\s+/, '');
  }).join('\n');
  const globals = { process, global: {}, console, Date, setTimeout, clearTimeout,
    getNextIntervalRunAt, startAnchoredInterval: start, ...bindings };
  return new Function(...Object.keys(globals), ts.transpileModule(declarations, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText + '\nreturn ' + result)(...Object.values(globals));
}

describe('existing scheduler wiring', () => {
  it.each([
    ['linkedin', 'startLinkedInScheduler', 'refreshAllLinkedInData', 'LINKEDIN'],
    ['meta', 'startMetaScheduler', 'refreshAllMetaData', 'META'],
    ['google-ads', 'startGoogleAdsScheduler', 'refreshAllGoogleAdsMetrics', 'GOOGLE_ADS'],
    ['instagram', 'startInstagramScheduler', 'refreshAllInstagramMetrics', 'INSTAGRAM'],
    ['tiktok', 'startTikTokScheduler', 'refreshAllTikTokMetrics', 'TIKTOK'],
  ])('%s keeps its provider callback and frequency, without startup calls', async (file, name, callback, env) => {
    vi.stubEnv(env + '_REFRESH_INTERVAL_HOURS', '4');
    const work = vi.fn().mockResolvedValue(undefined);
    const begin = entry('server/' + file + '-scheduler.ts', [name], { [callback]: work }, name);
    begin(); begin(); expect(vi.getTimerCount()).toBe(1); expect(work).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(Date.parse('2026-11-19T06:27:53.863Z') - Date.now());
    expect(work).toHaveBeenCalledOnce();
  });
  it.each(['SnapshotScheduler', 'ExecutiveSummarySnapshotScheduler'])('%s preserves startup capture and stable daily runs, and cancels both on stop', async name => {
    vi.stubEnv('SNAPSHOT_FREQUENCY', 'daily');
    const work = vi.fn().mockResolvedValue(undefined);
    const file = name === 'SnapshotScheduler' ? 'server/scheduler.ts' : 'server/executive-summary-snapshot-scheduler.ts';
    const target = entry(file, [name], { DAY_MS: 86400_000, createSnapshotsForAllCampaigns: work, captureExecutiveSummarySnapshots: work }, 'new ' + name + '()');
    target.start(5000); expect(vi.getTimerCount()).toBe(2);
    target.stop(); expect(vi.getTimerCount()).toBe(0);
    target.start(5000); await vi.advanceTimersByTimeAsync(60_000); expect(work).toHaveBeenCalledOnce();
    if (name === 'SnapshotScheduler') expect(target.getStatus().nextRun).toBe('2026-11-20T02:27:53.863Z');
    await vi.advanceTimersByTimeAsync(Date.parse('2026-11-20T02:27:53.863Z') - Date.now());
    expect(work).toHaveBeenCalledTimes(2); target.stop(); expect(vi.getTimerCount()).toBe(0);
  });
  it('keeps disabled reminders disabled and enabled checks on their own cadence', async () => {
    const work = vi.fn().mockResolvedValue(undefined);
    const target = entry('server/alert-email-scheduler.ts', ['startAlertEmailScheduler', 'stopAlertEmailScheduler'],
      { runAlertEmailReminderSchedulerOnce: work }, '{start:startAlertEmailScheduler,stop:stopAlertEmailScheduler}');
    target.start({ enabled: false, intervalMs: 900_000 }); expect(vi.getTimerCount()).toBe(0);
    target.start({ enabled: true, intervalMs: 900_000 }); target.start({ enabled: true, intervalMs: 900_000 });
    expect(vi.getTimerCount()).toBe(1); await vi.advanceTimersToNextTimerAsync(); expect(work).toHaveBeenCalledOnce();
    target.stop(); expect(vi.getTimerCount()).toBe(0);
  });
  it.each([true, false])('preserves financial ownership gating (GA4 owner: %s)', async owned => {
    vi.stubEnv('GA4_DAILY_PIPELINE_OWNS_REFRESH', String(owned));
    const spend = vi.fn().mockResolvedValue(undefined), revenue = vi.fn().mockResolvedValue(undefined);
    const crm = vi.fn().mockResolvedValue(undefined), daily = vi.fn();
    const config = { enabled: true, hour: 23, minute: 0, reportingTimeZone: 'UTC', runOnStartup: false,
      googleSheetsSpendIntervalMinutes: 1, salesforcePipelineIntervalMinutes: 5 };
    const target = entry('server/auto-refresh-scheduler.ts', ['startDailyAutoRefreshScheduler'], {
      getAutoRefreshSchedulerConfig: () => config, autoRefreshSchedulerStatus: {}, runGoogleSheetsSpendAutoRefreshOnce: spend,
      runGoogleSheetsRevenueAutoRefreshOnce: revenue, runSalesforcePipelineAutoRefreshOnce: crm, runHubSpotPipelineAutoRefreshOnce: crm,
      runDailyAutoRefreshOnce: daily, getNextAutoRefreshRunAt: () => new Date('2026-11-19T23:00:00Z'),
      formatSchedulerLocalTime: () => '', getLatestCompleteReportingDate: () => '2026-11-18',
    }, 'startDailyAutoRefreshScheduler');
    target(); target(); expect(vi.getTimerCount()).toBe(owned ? 1 : 3);
    expect(spend).not.toHaveBeenCalled(); expect(crm).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(300_000);
    expect(spend).toHaveBeenCalledTimes(5); expect(revenue).toHaveBeenCalledTimes(5);
    expect(crm).toHaveBeenCalledTimes(owned ? 0 : 2); expect(daily).not.toHaveBeenCalled();
  });
});
