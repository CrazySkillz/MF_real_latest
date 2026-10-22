import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
const fixture = vi.hoisted(() => ({ pool: null as Pool | null }));
vi.mock('./db', () => ({ db: null, get pool() { return fixture.pool; } }));
import { DatabaseStorage } from './storage';
const testUrl = process.env.GA4_TEST_DATABASE_URL;
if (testUrl && (new URL(testUrl).hostname !== '127.0.0.1' || new URL(testUrl).pathname !== '/ga4_alignment_test' || process.env.DATABASE_URL)) throw new Error('Local fixtures only');
describe.skipIf(!testUrl)('GA4 database property request slots', () => {
  const property = String(Date.now());
  beforeAll(() => { fixture.pool = new Pool({ connectionString: testUrl, max: 10, connectionTimeoutMillis: 1000, application_name: 'v1_batch3_property_fixture' }); });
  afterAll(async () => { await fixture.pool?.end(); });
  it('bounds independent storage callers sharing one property and releases all locks', async () => {
    let active = 0, peak = 0;
    await Promise.all(Array.from({ length: 25 }, () => new DatabaseStorage().withGA4PropertyRequest(property, AbortSignal.timeout(5000), async () => {
      active++; peak = Math.max(peak, active);
      await new Promise(resolve => setTimeout(resolve, 15)); active--; return true;
    })));
    expect(peak).toBe(5); expect(active).toBe(0);
    const locks = await fixture.pool!.query("SELECT count(*) FROM pg_locks l JOIN pg_stat_activity a USING(pid) WHERE a.application_name='v1_batch3_property_fixture' AND l.locktype='advisory'");
    expect(Number(locks.rows[0].count)).toBe(0);
  });
  it('does not block a separate property and never dispatches an aborted waiter', async () => {
    let release!: () => void, entered = 0;
    const held = new Promise<void>(resolve => { release = resolve; });
    const active = Array.from({ length: 5 }, () => new DatabaseStorage().withGA4PropertyRequest(property, AbortSignal.timeout(5000), async () => { entered++; await held; }));
    try {
      await vi.waitFor(() => expect(entered).toBe(5));
      const pinned = await fixture.pool!.query("SELECT count(*) FROM pg_stat_activity WHERE application_name='v1_batch3_property_fixture' AND state='idle in transaction'");
      expect(Number(pinned.rows[0].count)).toBe(5);
      await expect(new DatabaseStorage().withGA4PropertyRequest(`${property}1`, AbortSignal.timeout(1000), async () => 7)).resolves.toBe(7);
      const provider = vi.fn();
      await expect(new DatabaseStorage().withGA4PropertyRequest(property, AbortSignal.timeout(60), provider)).rejects.toMatchObject({ name: 'TimeoutError' });
      expect(provider).not.toHaveBeenCalled();
    } finally { release(); await Promise.all(active); }
    const pinned = await fixture.pool!.query("SELECT count(*) FROM pg_stat_activity WHERE application_name='v1_batch3_property_fixture' AND state='idle in transaction'");
    expect(Number(pinned.rows[0].count)).toBe(0);
  });
  it('releases the slot after a provider failure and a later request succeeds', async () => {
    await expect(new DatabaseStorage().withGA4PropertyRequest(property, AbortSignal.timeout(1000), async () => { throw new Error('provider failed'); })).rejects.toThrow('provider failed');
    await expect(new DatabaseStorage().withGA4PropertyRequest(property, AbortSignal.timeout(1000), async () => 9)).resolves.toBe(9);
  });
  it('cancels the owning provider when its database session is lost', async () => {
    const request = new DatabaseStorage().withGA4PropertyRequest(property, AbortSignal.timeout(5000), signal => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      void fixture.pool!.query("SELECT pg_terminate_backend(a.pid) FROM pg_stat_activity a WHERE a.application_name='v1_batch3_property_fixture' AND a.pid <> pg_backend_pid() AND EXISTS (SELECT 1 FROM pg_locks l WHERE l.pid=a.pid AND l.locktype='advisory')");
    }));
    await expect(request).rejects.toThrow();
    await expect(new DatabaseStorage().withGA4PropertyRequest(property, AbortSignal.timeout(1000), async () => 11)).resolves.toBe(11);
  });
});
