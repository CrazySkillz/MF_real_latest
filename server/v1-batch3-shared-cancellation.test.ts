import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const fixture = vi.hoisted(() => ({
  storage: {
    getCampaign: vi.fn(), getLinkedInConnection: vi.fn(), getLatestLinkedInImportSession: vi.fn(),
    getLinkedInImportMetrics: vi.fn(), getLinkedInDailyMetrics: vi.fn(),
    upsertLinkedInDailyMetrics: vi.fn(), updateCampaign: vi.fn(), updateLinkedInConnection: vi.fn(),
    createLinkedInImportSession: vi.fn(), createLinkedInImportMetric: vi.fn(), createLinkedInAdPerformance: vi.fn(),
  }, provider: { getCampaigns: vi.fn(), getCampaignAnalytics: vi.fn(), getCampaignAnalyticsDaily: vi.fn(),
    getCreatives: vi.fn(), getCreativeAnalytics: vi.fn() }, signals: [] as (AbortSignal | undefined)[],
  kpis: vi.fn(), alerts: vi.fn(), benchmarks: vi.fn(),
}));
vi.mock('./storage', () => ({ storage: fixture.storage }));
vi.mock('./db', () => ({ db: null }));
vi.mock('./utils/kpi-refresh', () => ({ refreshKPIsForCampaign: fixture.kpis }));
vi.mock('./kpi-scheduler', () => ({ checkPerformanceAlerts: fixture.alerts }));
vi.mock('./benchmark-notifications', () => ({ checkBenchmarkPerformanceAlerts: fixture.benchmarks }));
vi.mock('./utils/ga4RevenueEnrichment', () => ({ enrichPlatformWithGA4Revenue: vi.fn() }));
vi.mock('./linkedinClient', () => ({ LinkedInClient: class {
  constructor(_token: string, signal?: AbortSignal) { fixture.signals.push(signal); Object.assign(this, fixture.provider); }
} }));
import { refreshLinkedInDataForCampaign } from './linkedin-scheduler';

describe('Batch 3 retained shared job cancellation', () => {
  beforeEach(() => {
    vi.resetAllMocks(); fixture.signals.length = 0;
    for (const method of ['log', 'warn', 'error'] as const) vi.spyOn(console, method).mockImplementation(() => {});
    fixture.storage.getCampaign.mockResolvedValue({ id: 'fixture', ownerId: 'owner-fixture', status: 'active' });
    fixture.storage.getLatestLinkedInImportSession.mockResolvedValue({ id: 'previous', selectedMetricKeys: ['clicks'] });
    fixture.storage.getLinkedInImportMetrics.mockResolvedValue([{ campaignUrn: '123', campaignName: 'Selected' }]);
    fixture.storage.getLinkedInDailyMetrics.mockResolvedValue([]);
    fixture.storage.createLinkedInImportSession.mockResolvedValue({ id: 'new' });
    fixture.provider.getCampaigns.mockResolvedValue([{ id: '123', name: 'Selected' }]);
    for (const key of ['getCampaignAnalytics', 'getCampaignAnalyticsDaily', 'getCreatives', 'getCreativeAnalytics'] as const) fixture.provider[key].mockResolvedValue([]);
  });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
  const run = (signal: AbortSignal, method = 'oauth') => refreshLinkedInDataForCampaign('fixture',
    { accessToken: 'fixture-token', adAccountId: 'account', method }, { signal } as any);
  const writes = () => ['upsertLinkedInDailyMetrics', 'updateCampaign', 'updateLinkedInConnection',
    'createLinkedInImportSession', 'createLinkedInImportMetric', 'createLinkedInAdPerformance'] as const;

  it('rejects an already cancelled attempt before reads or writes', async () => {
    await expect(run(AbortSignal.abort(new Error('stopped')))).rejects.toThrow('stopped');
    expect(fixture.storage.getCampaign).not.toHaveBeenCalled();
  });
  it.each(['getCampaigns', 'getCampaignAnalyticsDaily', 'getCreatives', 'getCreativeAnalytics'] as const)(
    'propagates cancellation during %s and starts no subsequent writes or downstream work', async stage => {
      const owner = new AbortController(); let before: number[] = [];
      fixture.provider[stage].mockImplementation(async () => {
        before = writes().map(key => fixture.storage[key].mock.calls.length);
        owner.abort(new Error('stopped')); return [];
      });
      await expect(run(owner.signal)).rejects.toThrow('stopped');
      expect(writes().map(key => fixture.storage[key].mock.calls.length)).toEqual(before);
      expect(fixture.signals).toEqual([owner.signal]);
      expect(fixture.kpis).not.toHaveBeenCalled(); expect(fixture.alerts).not.toHaveBeenCalled();
    });
  it('does not detach an already-started write or start later writes after cancellation', async () => {
    const owner = new AbortController(); let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    fixture.storage.createLinkedInImportSession.mockImplementation(async () => {
      owner.abort(new Error('stopped')); await pending; return { id: 'new' };
    });
    let settled = false; const result = run(owner.signal).catch(error => error).finally(() => { settled = true; });
    await vi.waitFor(() => expect(fixture.storage.createLinkedInImportSession).toHaveBeenCalled());
    expect(settled).toBe(false); release();
    expect(await result).toMatchObject({ message: 'stopped' });
    expect(fixture.storage.createLinkedInImportMetric).not.toHaveBeenCalled(); expect(fixture.kpis).not.toHaveBeenCalled();
  });
  it('prevents test-mode writes after a cancelled read', async () => {
    const owner = new AbortController();
    fixture.storage.getLatestLinkedInImportSession.mockImplementation(async () => {
      owner.abort(new Error('stopped')); return { id: 'previous' };
    });
    await expect(run(owner.signal, 'test')).rejects.toThrow('stopped');
    for (const key of writes()) expect(fixture.storage[key]).not.toHaveBeenCalled();
  });
  it('retains successful behavior on a fresh attempt after cancellation', async () => {
    await expect(run(new AbortController().signal)).resolves.toEqual({ refreshed: true });
    expect(fixture.storage.createLinkedInImportMetric).toHaveBeenCalledTimes(1);
    expect(fixture.kpis).toHaveBeenCalledWith('fixture'); expect(fixture.alerts).toHaveBeenCalledTimes(1);
  });
  it('keeps the shared stage occupied until cancelled work has settled', async () => {
    vi.useFakeTimers();
    const source = readFileSync('server/auto-refresh-scheduler.ts', 'utf8');
    const start = source.indexOf('async function withTimeout');
    const end = source.indexOf('\nasync function reprocessHubSpot', start);
    const helper = new Function(ts.transpileModule(`${source.slice(start, end)}\nreturn withTimeout;`, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
    }).outputText)();
    let release!: () => void; let signal!: AbortSignal; let settled = false;
    const pending = new Promise<void>(resolve => { release = resolve; });
    const result = helper('fixture', async (value: AbortSignal) => { signal = value; await pending; }, 50)
      .catch((error: Error) => error).finally(() => { settled = true; });
    await vi.advanceTimersByTimeAsync(50);
    expect(signal.aborted).toBe(true); expect(settled).toBe(false);
    release(); expect(await result).toMatchObject({ message: 'fixture timed out after 50ms' });
  });
});
