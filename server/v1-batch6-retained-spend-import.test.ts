import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getReportingDateWindow } from './utils/reporting-timezone';

const file = ts.createSourceFile('routes.ts', readFileSync('server/routes-oauth.ts', 'utf8'), ts.ScriptTarget.Latest, true);
let handlerText = '';
function walk(node: ts.Node) {
  if (ts.isCallExpression(node) && node.expression.getText(file) === 'app.post'
    && ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text === '/api/campaigns/:id/spend/ad-platform/import') handlerText = node.arguments.at(-1)!.getText(file);
  ts.forEachChild(node, walk);
}
walk(file);
const script = ts.transpileModule(`const handler = ${handlerText};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const parent = { id: 'a', ownerId: 'owner-a', currency: 'EUR', status: 'active', startDate: '2026-01-01', reportingTimeZone: 'Europe/Amsterdam' };
const methodNames = { google_ads: ['getGoogleAdsConnection', 'getGoogleAdsDailyMetrics', 'googleCampaignId'], meta: ['getMetaConnection', 'getMetaDailyMetrics', 'metaCampaignId'], linkedin: ['getLinkedInConnection', 'getLinkedInDailyMetrics', 'linkedinCampaignId'], tiktok: ['getTikTokConnection', 'getTikTokDailyMetrics', 'tiktokCampaignId'] };
function fixture(platform = 'tiktok', overrides: Record<string, any> = {}, campaign: any = parent) {
  const [connectionMethod, metricsMethod, idField] = methodNames[platform as keyof typeof methodNames];
  const connection = { id: 'connection-a', campaignId: 'a', method: 'oauth', isActive: true, selectedCampaignIds: '["selected"]' };
  const row = { campaignId: 'a', date: '2026-10-01', spend: '10', currency: 'EUR', [idField]: 'selected', isSimulated: false };
  const storage: Record<string, any> = {
    [connectionMethod]: vi.fn(async () => connection), [metricsMethod]: vi.fn(async () => [row, { ...row, [idField]: 'unselected', spend: '90' }]),
    getSpendSources: vi.fn(async () => []), replaceSpendSourceWithRecords: vi.fn(async () => ({ id: 'saved-source' })),
    createSpendSource: vi.fn(async () => ({ id: 'legacy-source' })), deleteSpendRecordsBySource: vi.fn(), createSpendRecords: vi.fn(),
    getSpendTotalForRange: vi.fn(async () => ({ totalSpend: 777 })), updateCampaign: vi.fn(), ...overrides,
  };
  const env = { storage, getReportingDateWindow, process: { env: { NODE_ENV: 'production' } }, console: { error() {} },
    ensureCampaignAccess: vi.fn(async (_req, res) => { if (!campaign) res.status(404).json({ error: 'Not found' }); return campaign; }) };
  return { platform, storage, row, connection, env, metricsMethod, connectionMethod };
}
async function invoke(f: ReturnType<typeof fixture>, body: any = {}) {
  const handler = new Function(...Object.keys(f.env), script + '\nreturn handler;')(...Object.values(f.env));
  const res: any = { statusCode: 200, status(code: number) { this.statusCode = code; return this; }, json(body: any) { this.body = body; return this; } };
  await handler({ params: { id: 'a' }, body: { platform: f.platform, startDate: '2026-10-01', endDate: '2026-10-24', ...body } }, res);
  return res;
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-25T12:00:00Z')); });
afterEach(() => vi.useRealTimers());
describe('retained ad-platform spend import boundary', () => {
  it('imports only selected dated EUR facts atomically and never overwrites the GA4 campaign spend cache', async () => {
    const f = fixture(); const res = await invoke(f);
    expect(res.body).toEqual({ success: true, totalSpend: 10, daysImported: 1, sourceId: 'saved-source', displayName: 'TikTok Ads' });
    expect(f.storage.getSpendSources).toHaveBeenCalledWith('a', 'tiktok');
    expect(f.storage.replaceSpendSourceWithRecords).toHaveBeenCalledWith('a', null, 'tiktok_api', 'tiktok',
      expect.objectContaining({ currency: 'EUR', platformContext: 'tiktok', mappingConfig: JSON.stringify({ platform: 'tiktok', selectedCampaignIds: ['selected'] }) }),
      [{ campaignId: 'a', date: '2026-10-01', spend: '10.00', currency: 'EUR', sourceType: 'tiktok_api' }], undefined);
    expect(f.storage.deleteSpendRecordsBySource).not.toHaveBeenCalled(); expect(f.storage.updateCampaign).not.toHaveBeenCalled();
  });
  it.each(['google_ads', 'meta', 'linkedin'])('refuses %s facts whose currency is not persisted, rather than relabeling them', async platform => {
    const f = fixture(platform); f.storage[f.metricsMethod].mockResolvedValue([{ ...f.row, currency: undefined }]);
    const res = await invoke(f); expect(res.statusCode).toBe(409); expect(res.body.error).toContain('currency');
    expect(f.storage.replaceSpendSourceWithRecords).not.toHaveBeenCalled(); expect(f.storage.createSpendSource).not.toHaveBeenCalled();
  });
  it.each(Object.keys(methodNames))('requires an active, correctly scoped, non-test %s connection and selection', async platform => {
    for (const connection of [null, { campaignId: 'b' }, { isActive: false }, { spendOnly: true }, { method: 'test_mode' }, { accessToken: 'test-token' }, { selectedCampaignIds: '[]' }, { selectedCampaignIds: '{bad' }]) {
      const f = fixture(platform); f.storage[f.connectionMethod].mockResolvedValue(connection === null ? null : { ...f.connection, ...connection });
      expect((await invoke(f)).body.success).toBe(false);
      expect(f.storage.replaceSpendSourceWithRecords).not.toHaveBeenCalled(); expect(f.storage.createSpendSource).not.toHaveBeenCalled();
    }
  });
  it.each([{ spend: '12x' }, { spend: '' }, { spend: null }, { spend: 'Infinity' }, { spend: '-1' }, { currency: 'USD' }, { currency: '' }, { date: '2026-09-30' }, { date: '2026-10-25' }, { campaignId: 'b' }, { isSimulated: true }])('does not replace prior records from invalid selected facts: %j', extra => {
    const f = fixture(); f.storage[f.metricsMethod].mockResolvedValue([{ ...f.row, ...extra }]);
    return invoke(f).then(res => { expect(res.body.success).toBe(false); expect(f.storage.replaceSpendSourceWithRecords).not.toHaveBeenCalled(); expect(f.storage.deleteSpendRecordsBySource).not.toHaveBeenCalled(); });
  });
  it.each([{ startDate: '2026-02-30' }, { endDate: '2026-10-25' }, { startDate: '2026-10-24', endDate: '2026-10-01' }, { startDate: '2025-12-31' }])('rejects invalid or incomplete date windows: %j', body => {
    const f = fixture(); return invoke(f, body).then(res => { expect(res.statusCode).toBe(400); expect(f.storage.replaceSpendSourceWithRecords).not.toHaveBeenCalled(); });
  });
  it('keeps measured zero and rejects duplicate provider/date rows', async () => {
    const f = fixture(); f.storage[f.metricsMethod].mockResolvedValue([{ ...f.row, spend: '0' }]);
    expect((await invoke(f)).body.totalSpend).toBe(0);
    f.storage.replaceSpendSourceWithRecords.mockClear(); f.storage[f.metricsMethod].mockResolvedValue([f.row, f.row]);
    expect((await invoke(f)).body.success).toBe(false); expect(f.storage.replaceSpendSourceWithRecords).not.toHaveBeenCalled();
  });
  it('fails an inaccessible campaign before reading sources or metrics', async () => {
    const f = fixture('tiktok', {}, null); expect((await invoke(f)).statusCode).toBe(404); expect(f.storage[f.metricsMethod]).not.toHaveBeenCalled();
  });
  it('fails a source ID in the wrong context/type before a replacement', async () => {
    const f = fixture('tiktok', { getSpendSources: vi.fn(async () => [{ id: 'wrong', campaignId: 'a', sourceType: 'tiktok_api', platformContext: 'ga4', displayName: 'TikTok Ads', isActive: true }]) });
    expect((await invoke(f, { sourceId: 'wrong' })).statusCode).toBe(404); expect(f.storage.replaceSpendSourceWithRecords).not.toHaveBeenCalled();
  });
  it('passes the exact existing mapping for compare-and-set, and reports a transaction failure', async () => {
    const source = { id: 'existing', campaignId: 'a', sourceType: 'tiktok_api', platformContext: 'tiktok', displayName: 'TikTok Ads', isActive: true, mappingConfig: '{"platform":"tiktok","selectedCampaignIds":["old"]}' };
    const f = fixture('tiktok', { getSpendSources: vi.fn(async () => [source]), replaceSpendSourceWithRecords: vi.fn(async () => { throw new Error('Save failed'); }) });
    expect((await invoke(f, { sourceId: 'existing' })).statusCode).toBe(500);
    expect(f.storage.replaceSpendSourceWithRecords.mock.calls[0]?.[6]).toBe(source.mappingConfig);
    expect(f.storage.deleteSpendRecordsBySource).not.toHaveBeenCalled(); expect(f.storage.updateCampaign).not.toHaveBeenCalled();
  });
  it('requires an exact source ID when multiple existing sources match', async () => {
    const source = { campaignId: 'a', sourceType: 'tiktok_api', platformContext: 'tiktok', displayName: 'TikTok Ads', isActive: true, mappingConfig: null };
    const f = fixture('tiktok', { getSpendSources: vi.fn(async () => [{ ...source, id: 'one' }, { ...source, id: 'two' }]) });
    expect((await invoke(f)).statusCode).toBe(409); expect(f.storage.replaceSpendSourceWithRecords).not.toHaveBeenCalled();
    expect((await invoke(f, { sourceId: 'two' })).body.success).toBe(true);
    expect(f.storage.replaceSpendSourceWithRecords.mock.calls[0]?.[1]).toBe('two');
  });
});
