// Read-only deployment checks. No .env, auth cookies, campaign data or provider calls.
const fs = require('node:fs');
const expected = '841d560e7b452724129002e9fbec589369297948';
const output = __dirname + '/public-verification.json';
if (fs.existsSync(output)) throw new Error('Keep historical evidence; use a new packet for another run');
const result = { startedAt: new Date().toISOString(), expectedRevision: expected,
  runtimeFixCommit: '9d928eccc18d74343990f6be35d6ecc9378ab565', observations: [] };
async function get(path) {
  return fetch('https://marketforensics.onrender.com' + path, {
    headers: { 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(15000), redirect: 'error',
  });
}
(async () => {
  for (let i = 0; i < 3; i++) {
    const response = await get('/api/health');
    const health = await response.json();
    const observation = { at: new Date().toISOString(), status: response.status, ok: health.ok,
      commit: health.commit, nodeEnv: health.nodeEnv };
    result.observations.push(observation);
    console.log(JSON.stringify(observation));
    if (response.status !== 200 || health.ok !== true || health.commit !== expected || health.nodeEnv !== 'production') throw new Error('Deployment revision/readiness mismatch');
    if (i < 2) await new Promise(resolve => setTimeout(resolve, 5000));
  }
  result.publicChecks = Object.fromEntries(await Promise.all(['/', '/health', '/api/campaigns'].map(async path => {
    const response = await get(path); const status = response.status;
    await response.body?.cancel(); return [path, status];
  })));
  if (result.publicChecks['/'] !== 200 || result.publicChecks['/health'] !== 200 || ![401, 403].includes(result.publicChecks['/api/campaigns'])) throw new Error('Public readiness/access check failed');
  const response = await get('/health/scheduler');
  const body = await response.json(); const ga4 = body.ga4DailyScheduler;
  result.scheduler = { httpStatus: response.status, status: body.status, startedAt: ga4?.startedAt,
    config: ga4?.config, nextRunAt: ga4?.nextRunAt, nextDataThroughDate: ga4?.nextDataThroughDate,
    lastRunStatus: ga4?.lastRunStatus, lastRunStartedAt: ga4?.lastRunStartedAt, lastRunFinishedAt: ga4?.lastRunFinishedAt };
  if (response.status !== 200 || body.status !== 'healthy' || !ga4?.startedAt || !ga4?.nextRunAt) throw new Error('Scheduler registration check failed');
  result.result = 'PASS: expected live revision, readiness, public access denial and scheduler registration';
})().catch(error => { result.result = 'FAIL'; result.error = error.message; process.exitCode = 1; }).finally(() => {
  result.completedAt = new Date().toISOString();
  result.boundary = 'Public checks only. Authenticated Ptomo UI, source/provider values, natural refresh completion, external recovery, hosted quota/load and full V1 acceptance were not tested. No mutation, manual refresh or provider failure was triggered.';
  fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ result: result.result, publicChecks: result.publicChecks, scheduler: result.scheduler, error: result.error }));
});
