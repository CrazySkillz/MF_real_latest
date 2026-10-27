// Anonymous GETs only. No browser profile, cookies, account login or job triggers.
const fs = require('node:fs');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
(async () => {
  const origin = 'https://marketforensics.onrender.com';
  const get = path => fetch(new URL(path, origin), { redirect: 'manual', headers: { 'cache-control': 'no-cache' }, signal: AbortSignal.timeout(30000) });
  const result = { at: new Date().toISOString(), method: 'Anonymous read-only GETs', protectedGets: [], deploymentIncludes: [] };
  const health = await get('/api/health');
  if (health.status !== 200) throw new Error('Public deployment unavailable');
  result.health = await health.json();
  for (const revision of ['4522f834', '839bf508', 'ff3c5115', '67279e8e', 'ee44ca77']) {
    execFileSync('git', ['merge-base', '--is-ancestor', revision, result.health.commit], { stdio: 'pipe' });
    result.deploymentIncludes.push(revision);
  }
  for (const route of ['/api/clients', '/api/campaigns', '/api/metrics', '/api/integrations', '/api/attribution/models']) {
    const response = await get(route);
    result.protectedGets.push({ route, status: response.status, denied: [401, 403].includes(response.status) });
    await response.body?.cancel();
  }
  const html = await (await get('/')).text();
  const entry = html.match(/<script[^>]*\bsrc=["']([^"']*\/assets\/index-[^"']+\.js)["']/)?.[1];
  if (!entry) throw new Error('Public client entry unavailable');
  const code = await (await get(entry)).text();
  const keys = [...new Set(code.match(/pk_(?:test|live)_[A-Za-z0-9_-]{25,}/g) || [])];
  result.publicAuthenticationConfiguration = { entry, publishableKeyModes: keys.map(key => key.startsWith('pk_live_') ? 'live' : 'test'), keyFingerprints: keys.map(key => crypto.createHash('sha256').update(key).digest('hex').slice(0, 12)), limits: 'Public compiled configuration only; no account or provider authentication performed' };
  result.protectedGetsPassed = result.protectedGets.every(row => row.denied);
  fs.writeFileSync(__dirname + '/public-deployment.json', JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify(result, null, 2));
  if (!result.protectedGetsPassed) process.exitCode = 1;
})().catch(error => { console.error(error.message); process.exitCode = 1; });
