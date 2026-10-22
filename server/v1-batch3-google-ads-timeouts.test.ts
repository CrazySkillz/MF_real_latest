import { afterEach, describe, expect, it, vi } from 'vitest';
import { createServer, type Server } from 'node:http';
import axios from 'axios';
import { GoogleAdsClient } from './googleAdsClient';

const nativeTimeout = AbortSignal.timeout.bind(AbortSignal);
const originalAdapter = axios.defaults.adapter;
const httpAdapter = axios.getAdapter('http');
const client = () => new GoogleAdsClient({ accessToken: 'fixture', developerToken: 'fixture', customerId: '123' });
const cases = [
  { name: 'authorization exchange', run: () => GoogleAdsClient.exchangeCodeForToken('fixture', 'fixture', 'fixture', 'https://fixture.invalid/callback') },
  { name: 'token renewal', run: () => GoogleAdsClient.refreshAccessToken('fixture', 'fixture', 'fixture') },
  { name: 'customer discovery', run: () => client().getAccessibleCustomers() },
  { name: 'customer details', run: () => client().getAccessibleCustomers() },
  { name: 'customer metadata', run: () => client().getCustomerAccount() },
  { name: 'campaign discovery', run: () => client().getCampaigns() },
  { name: 'daily financial inputs', run: () => client().getDailyMetrics('2026-10-20', '2026-10-20', ['7']) },
];

describe('Google Ads request deadlines with the real Axios HTTP adapter', () => {
  let server: Server | undefined;
  afterEach(async () => {
    axios.defaults.adapter = originalAdapter; vi.restoreAllMocks();
    server?.closeAllConnections();
    if (server?.listening) await new Promise<void>(resolve => server!.close(() => resolve()));
    server = undefined;
  });
  for (const phase of ['headers', 'body'] as const) {
    it.each(cases)(`cancels $name during stalled ${phase} without returning partial success`, async test => {
      let closed!: () => void;
      const disconnected = new Promise<void>(resolve => { closed = resolve; });
      let observedSignal: AbortSignal | undefined;
      let timeoutConfigured: number | undefined;
      let signals = 0;
      const controllers: AbortController[] = [];
      vi.spyOn(AbortSignal, 'timeout').mockImplementation(ms => {
        expect(ms).toBe(120_000); signals++;
        const controller = new AbortController(); controllers.push(controller); return controller.signal;
      });
      server = createServer((_req, res) => {
        res.on('close', closed);
        if (phase === 'body') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.write('{"unfinished":'); }
        nativeTimeout(30).addEventListener('abort', () => controllers.forEach(c => c.abort(new DOMException('Timed out', 'TimeoutError'))), { once: true });
      });
      await new Promise<void>(resolve => server!.listen(0, '127.0.0.1', resolve));
      const address = server.address() as { port: number };
      axios.defaults.adapter = async config => {
        if (test.name === 'customer details' && config.url?.includes('listAccessibleCustomers')) {
          return { status: 200, statusText: 'OK', headers: {}, config, data: { resourceNames: ['customers/123'] } };
        }
        observedSignal = config.signal as AbortSignal;
        timeoutConfigured = config.timeout;
        // Fail before touching transport on the pre-fix client, rather than waiting indefinitely.
        if (!config.signal || !config.timeout) throw new Error('Missing bounded Google Ads request');
        return httpAdapter({ ...config, baseURL: undefined, url: `http://127.0.0.1:${address.port}/fixture`, proxy: false });
      };
      const result = await test.run().catch(error => error);
      expect(result).toMatchObject({ code: 'ERR_CANCELED' });
      await disconnected;
      expect(observedSignal?.aborted).toBe(true);
      expect(timeoutConfigured).toBe(120_000);
      expect(signals).toBeGreaterThan(0);
    });
  }

  it('gives consecutive requests independent live deadlines and keeps account scope and fractional values', async () => {
    const requests: any[] = [];
    axios.defaults.adapter = async config => {
      requests.push(config);
      return { status: 200, statusText: 'OK', headers: {}, config, data: [{ results: [{ campaign: { id: '7', name: 'Selected' }, segments: { date: '2026-10-20' }, metrics: { conversions: '0.75', costMicros: '1000000' } }] }] };
    };
    const ads = client();
    for (let i = 0; i < 2; i++) expect(await ads.getDailyMetrics('2026-10-20', '2026-10-20', ['7']))
      .toMatchObject([{ campaignId: '7', conversions: 0.75, costMicros: 1000000 }]);
    expect(requests[0].signal).toBeInstanceOf(AbortSignal);
    expect(requests[1].signal).not.toBe(requests[0].signal);
    expect(requests.every(r => !r.signal.aborted && JSON.parse(r.data).query.includes('AND campaign.id IN (7)'))).toBe(true);
  });
});
