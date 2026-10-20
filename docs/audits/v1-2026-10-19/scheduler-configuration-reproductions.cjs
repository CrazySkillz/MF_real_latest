const fs = require('node:fs'), ts = require('typescript'), assert = require('node:assert/strict');
const dir = 'docs/audits/v1-2026-10-19/';
function extract(file, name) {
  const sf = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), 99, true);
  const declaration = sf.statements.find(n => (ts.isFunctionDeclaration(n) || ts.isClassDeclaration(n)) && n.name?.text === name);
  assert.ok(declaration);
  return ts.transpileModule(declaration.getText(sf).replace(/^export\s+/, ''), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
}
function execute(family, configured, starts = 1) {
  const intervals = [], pending = [], refreshes = [];
  const spec = family === 'ads' ? ['server/google-ads-scheduler.ts', 'startGoogleAdsScheduler', 'GOOGLE_ADS_REFRESH_INTERVAL_HOURS'] :
    family === 'sheets' ? ['server/google-sheets-token-scheduler.ts', 'startGoogleSheetsTokenScheduler', 'GOOGLE_SHEETS_TOKEN_REFRESH_INTERVAL_HOURS'] :
    ['server/scheduler.ts', 'SnapshotScheduler', 'SNAPSHOT_FREQUENCY'];
  const env = {
    process: { env: configured === undefined ? {} : { [spec[2]]: configured } }, global: {},
    console: { log() {}, error() {} },
    setInterval(fn, delay) { intervals.push({ delay, fn }); return { fixtureTimer: intervals.length }; },
    setTimeout(fn, delay) { pending.push({ delay, fn }); return { fixtureTimer: pending.length }; },
    clearInterval() {},
    refreshAllGoogleAdsMetrics: async () => { refreshes.push('ads'); },
    refreshAllGoogleSheetsTokens: () => { refreshes.push('sheets'); },
    createSnapshotsForAllCampaigns: () => { refreshes.push('snapshots'); },
  };
  const target = new Function(...Object.keys(env), extract(spec[0], spec[1]) + `\nreturn ${spec[1]};`)(...Object.values(env));
  const run = family === 'snapshots' ? (() => { const scheduler = new target(); return () => scheduler.start(); })() : target;
  for (let i = 0; i < starts; i++) run();
  // Invoke only the intercepted first-run callbacks; all refresh functions above are fixtures.
  if (family === 'sheets') pending.forEach(timer => timer.fn());
  const delays = intervals.map(t => Number.isFinite(t.delay) ? t.delay : String(t.delay));
  const effectiveDelays = intervals.map(t => Number.isFinite(t.delay) && t.delay >= 1 && t.delay <= 2147483647 ? Math.trunc(t.delay) : 1);
  return { family, configured: configured ?? '(unset)', starts, intervalCount: intervals.length, delays, effectiveNodeDelayMs: effectiveDelays, initialFixtureRefreshes: refreshes.length, source: spec[0] };
}
const results = [];
for (const family of ['ads', 'sheets']) {
  for (const configured of [undefined, '0', '-1', 'invalid', '1000']) {
    const r = execute(family, configured);
    assert.equal(r.intervalCount, 1);
    assert.equal(r.effectiveNodeDelayMs[0], configured === undefined ? (family === 'ads' ? 4 : 24) * 3600000 : 1);
    results.push(r);
  }
}
for (const configured of [undefined, 'hourly', 'daily', 'weekly', 'invalid']) {
  const r = execute('snapshots', configured);
  assert.equal(r.effectiveNodeDelayMs[0], ({ hourly: 3600000, daily: 86400000, weekly: 604800000, invalid: 1 })[configured ?? 'daily']);
  results.push(r);
}
for (const family of ['ads', 'sheets', 'snapshots']) {
  const r = execute(family, undefined, 2);
  assert.equal(r.intervalCount, family === 'snapshots' ? 1 : 2);
  results.push(r);
}
// Confirm Node's normalization synchronously, then clear immediately. No callback can run.
const normalization = [];
for (const delay of [NaN, undefined, 0, -1, 3600000000]) {
  const timer = setTimeout(() => { throw new Error('Cleared timer unexpectedly ran'); }, delay);
  normalization.push({ input: String(delay), actualNodeTimeoutMs: timer._idleTimeout });
  clearTimeout(timer);
  assert.equal(timer._idleTimeout, -1);
}
assert.ok(normalization.every(r => r.actualNodeTimeoutMs === 1));
fs.writeFileSync(dir + 'scheduler-configuration-reproductions.json', JSON.stringify({
  head: '777aae6f6353e998d60b635d3e66b413093117c2', at: new Date().toISOString(),
  boundary: 'Exact current startup functions/class with synthetic environment and intercepted timers/refreshes. Node timer normalization checked using immediately cleared no-effect timers. No real jobs, DB, provider, messages or application process started.',
  normalization, results,
}, null, 2) + '\n');
console.log(JSON.stringify({ cases: results.length, normalizationControls: normalization.length }));
