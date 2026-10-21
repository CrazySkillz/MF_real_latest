import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';

// Execute the actual start/stop declarations with timers and provider work intercepted.
function fixture(family: 'ads' | 'sheets' | 'snapshot', configured?: string) {
  const spec = family === 'ads'
    ? ['server/google-ads-scheduler.ts', ['startGoogleAdsScheduler', 'stopGoogleAdsScheduler'], 'GOOGLE_ADS_REFRESH_INTERVAL_HOURS'] as const
    : family === 'sheets'
      ? ['server/google-sheets-token-scheduler.ts', ['startGoogleSheetsTokenScheduler', 'stopGoogleSheetsTokenScheduler'], 'GOOGLE_SHEETS_TOKEN_REFRESH_INTERVAL_HOURS'] as const
      : ['server/scheduler.ts', ['SnapshotScheduler'], 'SNAPSHOT_FREQUENCY'] as const;
  const sf = ts.createSourceFile(spec[0], readFileSync(spec[0], 'utf8'), ts.ScriptTarget.Latest, true);
  const declarations = spec[1].map(name => {
    const n = sf.statements.find(n => (ts.isFunctionDeclaration(n) || ts.isClassDeclaration(n)) && n.name?.text === name);
    if (!n) throw new Error(`Missing declaration: ${name}`);
    return n.getText(sf).replace(/^export\s+/, '');
  }).join('\n');
  const timers = new Map<object, { kind: string; callback: () => void; ms: number }>();
  const job = vi.fn(async () => {});
  const bindings = {
    process: { env: configured === undefined ? {} : { [spec[2]]: configured } }, global: {},
    console: { log() {}, error() {} },
    setTimeout(callback: () => void, ms: number) { const handle = {}; timers.set(handle, { kind: 'timeout', callback, ms }); return handle; },
    setInterval(callback: () => void, ms: number) { const handle = {}; timers.set(handle, { kind: 'interval', callback, ms }); return handle; },
    clearTimeout: (handle: object) => timers.delete(handle), clearInterval: (handle: object) => timers.delete(handle),
    refreshAllGoogleAdsMetrics: job, refreshAllGoogleSheetsTokens: job, createSnapshotsForAllCampaigns: job,
  };
  const compiled = ts.transpileModule(declarations, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const instance = family === 'snapshot' ? 'new SnapshotScheduler()' : `{start:${spec[1][0]}, stop:${spec[1][1]}}`;
  const target = new Function(...Object.keys(bindings), `${compiled}\nreturn ${instance};`)(...Object.values(bindings));
  return { target, timers, job };
}

describe('V1-124 bounded scheduler configuration and lifecycle', () => {
  for (const family of ['ads', 'sheets'] as const) {
    for (const value of ['0', '-1', 'invalid', '1000', '597', '4hours', '1.5', '']) {
      it(`${family} rejects ${JSON.stringify(value)} before timers or provider work`, () => {
        const f = fixture(family, value);
        expect(() => f.target.start()).toThrow(/must be a whole number/);
        expect(f.timers.size).toBe(0);
        expect(f.job).not.toHaveBeenCalled();
      });
    }
    it(`${family} starts once, stops all timers and restarts once`, () => {
      const f = fixture(family);
      f.target.start(); f.target.start();
      expect(f.timers.size).toBe(1);
      expect(f.job).toHaveBeenCalledTimes(family === 'sheets' ? 1 : 0);
      f.target.stop(); expect(f.timers.size).toBe(0);
      f.target.start(); expect(f.timers.size).toBe(1);
      if (family === 'sheets') {
        const [handle, first] = [...f.timers][0];
        f.timers.delete(handle); first.callback();
      }
      const timer = [...f.timers.values()][0];
      expect(timer.kind).toBe('interval');
      expect(timer.ms).toBe((family === 'ads' ? 4 : 24) * 3600000);
      f.target.start(); expect(f.timers.size).toBe(1);
      timer.callback();
      expect(f.job).toHaveBeenCalledTimes(family === 'sheets' ? 4 : 1);
      f.target.stop(); expect(f.timers.size).toBe(0);
    });
  }
  it.each(['invalid', '__proto__', 'toString'])('rejects snapshot frequency %s before work', value => {
    const f = fixture('snapshot', value);
    expect(() => f.target.start()).toThrow(/SNAPSHOT_FREQUENCY/);
    expect(f.timers.size).toBe(0);
    expect(f.job).not.toHaveBeenCalled();
  });
  it.each([['hourly', 3600000], ['daily', 86400000], ['weekly', 604800000]])('preserves %s, cancels delayed initial work on stop', (frequency, ms) => {
    const f = fixture('snapshot', String(frequency));
    f.target.start(); f.target.start();
    expect(f.timers.size).toBe(2);
    expect([...f.timers.values()].find(t => t.kind === 'interval')?.ms).toBe(ms);
    f.target.stop(); expect(f.timers.size).toBe(0);
    expect(f.job).not.toHaveBeenCalled();
    f.target.start(); expect(f.timers.size).toBe(2);
    expect(() => f.target.setFrequency('invalid')).toThrow();
    expect(f.timers.size).toBe(2);
  });
});

it('V1-007 startup contains no automatic demo seeding or fabricated campaign update', () => {
  const source = readFileSync('server/index.ts', 'utf8');
  expect(source).not.toMatch(/seedDashboardData|UPDATE campaigns SET|284,521|85240/);
});

it('V1-017 signup offers the existing sign-in route', () => {
  const source = readFileSync('client/src/App.tsx', 'utf8');
  expect(source).toMatch(/<SignUp\s+signInUrl="\/sign-in"/);
  expect(source).toMatch(/<SignIn\s+signUpUrl="\/sign-up"/);
});
