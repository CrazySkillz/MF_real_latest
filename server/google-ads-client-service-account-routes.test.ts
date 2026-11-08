import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { z } from 'zod';
import { describe, expect, it, vi } from 'vitest';
import { mapGoogleAdsDailyInsights } from './googleAdsClient';

// Execute the actual registered handlers/ownership guard; only provider and storage are synthetic.
const source = ts.createSourceFile('routes.ts', readFileSync('server/routes-oauth.ts', 'utf8'), ts.ScriptTarget.Latest, true);
const declarations = new Map<string, string>(), routes = new Map<string, string>();
function visit(node: ts.Node) {
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) declarations.set(node.name.text, `const ${node.getText(source)};`);
  if (ts.isCallExpression(node) && ['app.get', 'app.post'].includes(node.expression.getText(source)) && ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text.includes('/google-ads-service-account/')) routes.set(node.arguments[0].text.split('/').at(-1)!, node.arguments.at(-1)!.getText(source));
  ts.forEachChild(node, visit);
}
visit(source);
const bind = (code: string, env: Record<string, any>) => new Function(...Object.keys(env), ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText)(...Object.values(env));
function fixture(options: { existing?: any; enabled?: boolean; prepared?: boolean; account?: any; providerError?: number; dailyError?: boolean; sources?: any[] } = {}) {
  const effects: string[] = [];
  const binding = { id: 'binding-a', googleUniqueId: '111', customerId: '4951281615', email: 'acme-ads-4951281615@fixture.iam.gserviceaccount.com' };
  const account = { id: binding.customerId, descriptiveName: 'Ads fixture', manager: false, currencyCode: 'EUR', timeZone: 'Europe/Amsterdam', ...options.account };
  const storage = {
    getCampaign: vi.fn(async (id: string) => ({ id, ownerId: `owner-${id}`, clientId: `client-${id}`, status: 'active', currency: 'EUR', reportingTimeZone: 'Europe/Amsterdam', startDate: '2026-09-25' })),
    getGA4GoogleAdsSpendConnection: vi.fn(async () => options.existing),
    reserveGoogleAdsClientServiceAccount: vi.fn(async () => { effects.push('reserve'); return binding; }),
    completeGoogleAdsClientServiceAccount: vi.fn(async (_c, _p, _b, _g, _o, verified) => { effects.push(verified ? 'verify' : 'prepare'); return binding; }),
    getGoogleAdsClientServiceAccount: vi.fn(async (_c, customerId) => options.prepared === false || customerId !== binding.customerId ? undefined : binding),
    getSpendSources: vi.fn(async () => options.sources || []),
    assertServiceAccountResourceAccess: vi.fn(async () => { effects.push('legacy-grant'); }),
    replaceGA4GoogleAdsSpendConnection: vi.fn(async () => { effects.push('save'); }),
  };
  const providerConfig = vi.fn();
  const daily = vi.fn(async () => { effects.push('daily-read'); if (options.dailyError) throw Error('private provider detail'); return []; });
  const env: Record<string, any> = {
    z, storage, getAuth: (req: any) => ({ userId: req.actor }), isInternalAutoRefreshRequest: () => false,
    isGoogleAdsClientServiceAccountSetupEnabled: () => options.enabled !== false,
    getGoogleAdsServiceAccountPublicStatus: () => ({ enabled: true, email: null, selfService: true }),
    getGoogleAdsServiceAccountConfig: () => ({ email: 'legacy@fixture.invalid', allowedCustomerIds: new Set([binding.customerId]) }),
    normalizeGoogleAdsCustomerId: (id: any) => String(id || '').replace(/-/g, '').trim(),
    assertGoogleAdsServiceAccountCustomerAllowed: (id: string) => id,
    getGoogleAdsServiceAccountLoginCustomerId: () => '1234567890',
    getGoogleAdsClientServiceAccountAccessToken: async () => { effects.push('client-token'); return { accessToken: 'client-token' }; },
    getGoogleAdsServiceAccountAccessToken: async () => { effects.push('legacy-token'); return { accessToken: 'legacy-token' }; },
    provisionGoogleAdsClientServiceAccount: async () => { effects.push('provision'); return '111'; },
    normalizeReportingTimeZone: (value: string) => value,
    getReportingDateWindow: () => ({ endDate: '2026-11-07' }), GOOGLE_ADS_SERVICE_ACCOUNT_METHOD: 'service_account', process: { env: { GOOGLE_ADS_DEVELOPER_TOKEN: 'synthetic' } },
    require: () => ({ mapGoogleAdsDailyInsights, GoogleAdsClient: class {
      constructor(config: any) { providerConfig(config); }
      async getCustomerAccount() { effects.push('account-read'); if (options.providerError) throw { response: { status: options.providerError } }; return account; }
      getDailyMetrics = daily;
    } }),
  };
  for (const name of ['campaignIdSchema', 'getActorId', 'ensureCampaignAccess']) env[name] = bind(declarations.get(name)! + `\nreturn ${name};`, env);
  const handlers = Object.fromEntries([...routes].map(([name, code]) => [name, bind(`return (${code});`, env)]));
  const call = async (name: string, customerId = binding.customerId, actor = 'owner-a') => {
    const result: any = { status: 200 };
    await handlers[name]({ params: { id: 'a' }, actor, body: { customerId } }, { status(value: number) { result.status = value; return this; }, json(body: any) { result.body = body; return this; } });
    return result;
  };
  return { call, storage, effects, binding, providerConfig, daily };
}

describe('Google Ads access-email request boundaries', () => {
  for (const route of ['status', 'prepare', 'connect']) it.each([['', 401], ['owner-b', 404]])(`${route} rejects actor %s before provider/storage mutation`, async (actor, status) => {
    const f = fixture(); expect((await f.call(route, undefined, String(actor))).status).toBe(status); expect(f.effects).toEqual([]);
  });
  it('prepares an exact client/account email without connecting or importing', async () => {
    const f = fixture(); expect((await f.call('prepare', '495-128-1615')).body).toEqual({ success: true, customerId: f.binding.customerId, email: f.binding.email });
    expect(f.effects).toEqual(['reserve', 'provision', 'prepare']); expect(f.storage.reserveGoogleAdsClientServiceAccount).toHaveBeenCalledWith('a', '4951281615', 'owner-a');
  });
  it('validates provider account and complete data read before marking verified and saving', async () => {
    const f = fixture(); expect((await f.call('connect')).status).toBe(200);
    expect(f.effects).toEqual(['client-token', 'account-read', 'daily-read', 'verify', 'save']);
    expect(f.providerConfig).toHaveBeenCalledWith({ accessToken: 'client-token', developerToken: 'synthetic', customerId: '4951281615', managerAccountId: undefined });
    expect(f.daily).toHaveBeenCalledWith('2026-09-25', '2026-11-07');
    expect(f.storage.replaceGA4GoogleAdsSpendConnection).toHaveBeenCalledWith(expect.objectContaining({ campaignId: 'a', serviceAccountBindingId: 'binding-a', accessToken: null, refreshToken: null, managerAccountId: null }), [], 'owner-a');
  });
  it.each([401, 403, 429, 500])('provider failure %s never saves a connection', async providerError => {
    const f = fixture({ providerError }); expect((await f.call('connect')).status).toBe(providerError < 404 ? 403 : 502); expect(f.effects).toEqual(['client-token', 'account-read']);
  });
  it.each([{ manager: true }, { id: '9999999999' }, { currencyCode: 'USD' }, { timeZone: 'UTC' }, { currencyCode: null }, { timeZone: null }])('rejects wrong/unknown account scope %j', async account => {
    const f = fixture({ account }); expect((await f.call('connect')).status).toBeGreaterThanOrEqual(400); expect(f.effects).toEqual(['client-token', 'account-read']);
  });
  it('rejects partial reads and does not disclose provider errors', async () => {
    const f = fixture({ dailyError: true }); const r = await f.call('connect'); expect(r.status).toBe(502); expect(JSON.stringify(r)).not.toContain('private'); expect(f.storage.completeGoogleAdsClientServiceAccount).not.toHaveBeenCalled(); expect(f.storage.replaceGA4GoogleAdsSpendConnection).not.toHaveBeenCalled();
  });
  it('requires the matching prepared identity', async () => {
    for (const customer of ['4951281615', '9999999999']) { const f = fixture({ prepared: false }); expect((await f.call('connect', customer)).status).toBe(409); expect(f.effects).toEqual([]); }
    const f = fixture(); expect((await f.call('prepare', '123')).status).toBe(400); expect(f.effects).toEqual([]);
  });
  it('preserves existing OAuth connections', async () => {
    const f = fixture({ existing: { method: 'oauth', customerId: '4951281615' } });
    expect((await f.call('status')).body.enabled).toBe(false); expect((await f.call('prepare')).status).toBe(409); expect((await f.call('connect')).status).toBe(409); expect(f.effects).toEqual([]);
  });
  it('keeps shared credentials and grants for existing shared connections', async () => {
    const f = fixture({ existing: { method: 'service_account', customerId: '4951281615' } });
    expect((await f.call('status')).body).toEqual({ success: true, enabled: true, email: 'legacy@fixture.invalid' }); expect((await f.call('prepare')).status).toBe(409);
    expect((await f.call('connect')).status).toBe(200); expect(f.effects).toEqual(['legacy-grant', 'legacy-token', 'account-read', 'daily-read', 'save']);
    expect(f.storage.replaceGA4GoogleAdsSpendConnection.mock.calls[0][0].serviceAccountBindingId).toBeUndefined();
  });
  it('never falls back when dedicated setup is disabled', async () => {
    const f = fixture({ enabled: false, existing: { method: 'service_account', serviceAccountBindingId: 'binding-a' } }); expect((await f.call('prepare')).status).toBe(503); expect((await f.call('connect')).status).toBe(503); expect(f.effects).toEqual([]);
  });
  it('protects an orphaned Google Ads spend source from account replacement', async () => {
    const f = fixture({ sources: [{ sourceType: 'ad_platforms', mappingConfig: '{"platform":"google_ads"}', isActive: true }] }); expect((await f.call('connect')).status).toBe(409); expect(f.effects).toEqual([]);
  });
});
