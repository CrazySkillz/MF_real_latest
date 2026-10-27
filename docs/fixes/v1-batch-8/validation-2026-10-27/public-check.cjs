// Four anonymous GETs only; no cookies, credentials, provider calls or writes.
const fs = require('node:fs');
const path = require('node:path');
const origin = 'https://marketforensics.onrender.com';
(async () => {
  const results = await Promise.all(['/api/health', '/health/scheduler', '/api/campaigns', '/api/clients'].map(async route => {
    try {
      const response = await fetch(origin + route, { redirect: 'error', signal: AbortSignal.timeout(30000) });
      const body = await response.json().catch(() => null);
      return { route, status: response.status, body: route.startsWith('/api/health') || route === '/health/scheduler' ? body : { message: body?.message || body?.error || null } };
    } catch (error) { return { route, error: error.message }; }
  }));
  const output = { at: new Date().toISOString(), origin, methods: ['GET'], authenticated: false, results };
  fs.writeFileSync(path.join(__dirname, 'public-check.json'), JSON.stringify(output, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify(output, null, 2));
})();
