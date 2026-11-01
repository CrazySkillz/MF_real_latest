import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createSign, generateKeyPairSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { once } from 'node:events';
import { request } from 'node:http';
import express from 'express';
import ts from 'typescript';
import { clerkMiddleware, createClerkClient, getAuth } from '@clerk/express';

// Actual startup fragment and installed Clerk SDK, with ephemeral local signatures.
// No app startup, personal browser, environment file, provider or Clerk network call.
const source = readFileSync('server/index.ts', 'utf8');
const start = source.indexOf('// @clerk/express looks for CLERK_PUBLISHABLE_KEY;');
const end = source.indexOf('// Conditionally apply body parsing', start);
const fragment = ts.transpileModule(source.slice(start, end), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const pair = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwtKey = pair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
const key = (mode = 'live') => `pk_${mode}_${Buffer.from('clerk.fixture.example$').toString('base64')}`;
const productionEnv = { CLERK_PUBLISHABLE_KEY: key(), APP_BASE_URL: 'https://app.mimosaas.app/' };
function configure(env: Record<string, string>, app: any, middleware: any) {
  new Function('app', 'clerkMiddleware', 'process', fragment)(app, middleware, { env: { ...env } });
}
function optionsFor(env: Record<string, string>) {
  let options: any;
  configure(env, { use: () => {} }, (value: any) => { options = value; });
  return options;
}
function token(origin = 'https://app.mimosaas.app', overrides: Record<string, any> = {}) {
  const now = Math.floor(Date.now() / 1000);
  const encode = (value: any) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const data = `${encode({ alg: 'RS256', typ: 'JWT', kid: 'local-fixture' })}.${encode({
    sub: 'user_local_fixture', sid: 'sess_local_fixture', iss: 'https://clerk.fixture.example',
    iat: now - 5, nbf: now - 10, exp: now + 300, v: 2, sts: 'active', azp: origin, ...overrides,
  })}`;
  return `${data}.${createSign('RSA-SHA256').update(data).sign(pair.privateKey).toString('base64url')}`;
}
async function withServer(env: Record<string, string>, run: (port: number) => Promise<void>) {
  const app = express();
  app.set('trust proxy', 1);
  const publishableKey = env.CLERK_PUBLISHABLE_KEY || env.VITE_CLERK_PUBLISHABLE_KEY;
  const secretKey = 'sk_live_local_fixture_only';
  const client = createClerkClient({ secretKey, publishableKey });
  configure(env, app, (options: any) => clerkMiddleware({ ...options,
    publishableKey, secretKey, jwtKey, clerkClient: client }));
  app.get(['/sign-in', '/api/public-fixture'], (_req, res) => res.json({ public: true }));
  app.use((req, res) => {
    const user = getAuth(req).userId;
    res.status(user ? 200 : 401).json({ user });
  });
  app.use((_error: any, _req: any, res: any, _next: any) => res.status(500).json({ error: 'fixture middleware failure' }));
  const listener = app.listen(0, '127.0.0.1');
  await once(listener, 'listening');
  try { await run((listener.address() as any).port); }
  finally { await new Promise<void>((resolve, reject) => listener.close(error => error ? reject(error) : resolve())); }
}
function get(port: number, path: string, headers: Record<string, string> = {}) {
  return new Promise<{ status: number; body: string }>((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port, path, headers: {
      host: 'app.mimosaas.app', 'x-forwarded-proto': 'https', 'sec-fetch-dest': 'empty', ...headers,
    } }, res => {
      let body = ''; res.setEncoding('utf8'); res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode!, body }));
    });
    req.on('error', reject); req.end();
  });
}
describe('production Clerk authorized origin', () => {
  const externalFetch = vi.fn(async () => { throw Error('External network forbidden'); });
  beforeAll(() => vi.stubGlobal('fetch', externalFetch));
  afterAll(() => { vi.unstubAllGlobals(); expect(externalFetch).not.toHaveBeenCalled(); });
  it('sets the exact configured HTTPS origin for either backend key or frontend fallback', () => {
    expect(optionsFor(productionEnv)).toEqual({ authorizedParties: ['https://app.mimosaas.app'] });
    expect(optionsFor({ VITE_CLERK_PUBLISHABLE_KEY: key(), APP_BASE_URL: 'https://app.mimosaas.app' }))
      .toEqual({ authorizedParties: ['https://app.mimosaas.app'] });
  });
  it('preserves the current development-key and missing-key middleware options', () => {
    for (const env of [{}, { CLERK_PUBLISHABLE_KEY: key('test') },
      { VITE_CLERK_PUBLISHABLE_KEY: key('test'), APP_BASE_URL: 'https://marketforensics.onrender.com/' }])
      expect(optionsFor(env)).toBeUndefined();
  });
  for (const base of ['', 'not-a-url', 'http://app.mimosaas.app', 'https://user:password@app.mimosaas.app',
    'https://app.mimosaas.app/path', 'https://app.mimosaas.app/?query=1', 'https://app.mimosaas.app/#fragment']) {
    it(`fails startup on an invalid production application origin ${JSON.stringify(base)}`, () => {
      expect(() => optionsFor({ ...productionEnv, APP_BASE_URL: base })).toThrow();
    });
  }
  it('accepts correctly signed app tokens and rejects signed foreign-origin, expired and modified tokens', async () => {
    await withServer(productionEnv, async port => {
      const allowed = await get(port, '/api/clients', { authorization: `Bearer ${token()}` });
      expect(allowed.status).toBe(200); expect(JSON.parse(allowed.body).user).toBe('user_local_fixture');
      for (const origin of ['https://www.mimosaas.app', 'https://unrelated.example', 'https://app.mimosaas.app.unrelated.example',
        'http://app.mimosaas.app', 'https://marketforensics.onrender.com']) {
        expect((await get(port, '/api/clients', { authorization: `Bearer ${token(origin)}` })).status).toBe(401);
      }
      const expired = token(undefined, { exp: Math.floor(Date.now() / 1000) - 120 });
      expect((await get(port, '/api/clients', { authorization: `Bearer ${expired}` })).status).toBe(401);
      const valid = token(), pieces = valid.split('.');
      pieces[2] = (pieces[2][0] === 'a' ? 'b' : 'a') + pieces[2].slice(1);
      expect((await get(port, '/api/clients', { authorization: `Bearer ${pieces.join('.')}` })).status).toBe(401);
    });
  });
  it('retains signed session cookies on all four callback paths and denies signed-out API requests', async () => {
    await withServer(productionEnv, async port => {
      const cookie = `__session=${token()}; __client_uat=${Math.floor(Date.now() / 1000) - 60}`;
      for (const provider of ['google-sheets', 'hubspot', 'salesforce', 'shopify']) {
        const response = await get(port, `/api/auth/${provider}/callback?code=fixture`, { cookie, 'sec-fetch-dest': 'document' });
        expect(response.status).toBe(200); expect(JSON.parse(response.body).user).toBe('user_local_fixture');
      }
      expect((await get(port, '/api/clients')).status).toBe(401);
      expect((await get(port, '/sign-in')).status).toBe(200);
      expect((await get(port, '/api/public-fixture')).status).toBe(200);
    });
  });
  it('does not change the existing development-key origin behavior', async () => {
    await withServer({ CLERK_PUBLISHABLE_KEY: key('test') }, async port => {
      expect((await get(port, '/api/clients', { authorization: `Bearer ${token('https://marketforensics.onrender.com')}` })).status).toBe(200);
    });
  });
});
