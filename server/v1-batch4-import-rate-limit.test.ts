import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
vi.mock('@clerk/express', () => ({ getAuth: (req: any) => ({ userId: req.fixtureVerifiedActor || null }) }));
import { importRateLimiter } from './middleware/rateLimiter';

describe('V1-126 authenticated import workflow budgets', () => {
  let server: Server, base: string, saved = 0;
  beforeAll(async () => {
    const app = express(); app.use(express.json());
    // Only this isolated fixture assigns verified identities; runtime uses Clerk middleware.
    app.use((req: any, _res, next) => { req.fixtureVerifiedActor = req.headers['x-fixture-actor']; next(); });
    app.post('/import/preview', importRateLimiter, (_req, res) => res.json({ preview: true }));
    app.post('/import/process', importRateLimiter, (_req, res) => { saved++; res.json({ saved: true }); });
    server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
    base = `http://127.0.0.1:${(server.address() as any).port}`;
  });
  afterAll(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); });
  const post = (path: string, actor?: string, headers: Record<string, string> = {}) => fetch(base + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(actor ? { 'x-fixture-actor': actor } : {}), ...headers }, body: '{}',
  });
  it('lets five users on the same IP preview and save without consuming each others budgets', async () => {
    const previews = await Promise.all(Array.from({ length: 5 }, (_, i) => post('/import/preview', `office-${i}`)));
    expect(previews.map(r => r.status)).toEqual([200, 200, 200, 200, 200]);
    const writes = await Promise.all(Array.from({ length: 5 }, (_, i) => post('/import/process', `office-${i}`)));
    expect(writes.map(r => r.status)).toEqual([200, 200, 200, 200, 200]); expect(saved).toBe(5);
  });
  it('keeps five previews and five writes separate while still denying the sixth of each', async () => {
    for (let i = 0; i < 5; i++) expect((await post('/import/preview', 'limited')).status).toBe(200);
    expect((await post('/import/preview', 'limited')).status).toBe(429);
    for (let i = 0; i < 5; i++) expect((await post('/import/process', 'limited')).status).toBe(200);
    const denied = await post('/import/process', 'limited'); expect(denied.status).toBe(429);
    expect(Number(denied.headers.get('retry-after'))).toBeGreaterThan(0);
  });
  it('retains a shared anonymous IP budget and does not trust submitted user IDs', async () => {
    for (let i = 0; i < 5; i++) expect((await post('/import/preview', undefined, { 'x-user-id': `untrusted-${i}` })).status).toBe(200);
    expect((await post('/import/process', undefined, { 'x-user-id': 'untrusted-new' })).status).toBe(429);
  });
});
