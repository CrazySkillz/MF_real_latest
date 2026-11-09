import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { z } from 'zod';
import { describe, expect, it, vi } from 'vitest';
import { normalizeGoogleSheetsSpreadsheetId } from './utils/google-sheets-service-account';

const source = ts.createSourceFile('routes.ts', readFileSync('server/routes-oauth.ts', 'utf8'), ts.ScriptTarget.Latest, true);
const declarations = new Map<string, string>(), routes = new Map<string, string>();
function visit(node: ts.Node) {
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) declarations.set(node.name.text, `const ${node.getText(source)};`);
  if (ts.isCallExpression(node) && ['app.get', 'app.post'].includes(node.expression.getText(source)) && ts.isStringLiteral(node.arguments[0])) routes.set(node.arguments[0].text, node.arguments.at(-1)!.getText(source));
  ts.forEachChild(node, visit);
}
visit(source);
const bind = (code: string, env: Record<string, any>) => new Function(...Object.keys(env), ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText)(...Object.values(env));
function fixture(options: { existing?: any[]; enabled?: boolean; prepared?: boolean; providerStatus?: number; returnedId?: string; tabs?: string[] } = {}) {
  const effects: string[] = [];
  const binding = { id: 'binding-a', spreadsheetId: '1234567890', googleUniqueId: '111', email: 'acme-sheets-fixture@fixture.iam.gserviceaccount.com' };
  const storage = {
    getCampaign: vi.fn(async (id: string) => ({ id, ownerId: 'owner-a', clientId: 'client-a', status: 'active' })),
    getGoogleSheetsConnections: vi.fn(async () => options.existing || []),
    reserveGoogleSheetsClientServiceAccount: vi.fn(async () => { effects.push('reserve'); return binding; }),
    completeGoogleSheetsClientServiceAccount: vi.fn(async (_c, _p, _b, _g, _o, verified) => { effects.push(verified ? 'verify' : 'prepare'); return binding; }),
    getGoogleSheetsClientServiceAccount: vi.fn(async (_c, id) => options.prepared === false || id !== binding.spreadsheetId ? undefined : binding),
    assertServiceAccountResourceAccess: vi.fn(async () => { effects.push('legacy-grant'); }),
    createGoogleSheetsConnection: vi.fn(async () => { effects.push('save'); return { id: 'connection-a' }; }),
  };
  const request = vi.fn(async () => { effects.push('read'); return new Response(JSON.stringify({ spreadsheetId: options.returnedId || binding.spreadsheetId, properties: { title: 'Fixture' }, sheets: (options.tabs || ['Data']).map(title => ({ properties: { title, sheetId: 0 } })) }), { status: options.providerStatus || 200 }); });
  const env: Record<string, any> = {
    z, storage, getAuth: (req: any) => ({ userId: req.actor }), isInternalAutoRefreshRequest: () => false,
    isGoogleSheetsClientServiceAccountSetupEnabled: () => options.enabled !== false,
    getGoogleSheetsServiceAccountPublicStatus: () => ({ enabled: true, email: null, selfService: true }),
    getGoogleSheetsServiceAccountConfig: () => ({ email: 'shared@fixture.invalid' }), normalizeGoogleSheetsSpreadsheetId,
    getGoogleSheetsClientServiceAccountAccessToken: async () => { effects.push('client-token'); return { accessToken: 'client-token' }; },
    getGoogleSheetsServiceAccountAccessToken: async () => { effects.push('legacy-token'); return { accessToken: 'legacy-token' }; },
    provisionGoogleSheetsClientServiceAccount: async () => { effects.push('provision'); return '111'; },
    GOOGLE_SHEETS_SERVICE_ACCOUNT_METHOD: 'service_account', fetch: request, AbortSignal, devLog: () => {},
  };
  for (const name of ['campaignIdSchema', 'getActorId', 'ensureCampaignAccess']) env[name] = bind(declarations.get(name)! + `\nreturn ${name};`, env);
  const call = async (name: string, body: any = {}, actor = 'owner-a') => {
    const path = name.startsWith('/') ? name : `/api/campaigns/:id/google-sheets-service-account/${name}`;
    const handler = bind(`return (${routes.get(path)});`, env), result: any = { status: 200 };
    await handler({ params: { id: 'a', spreadsheetId: body.spreadsheetId || binding.spreadsheetId }, query: { campaignId: 'a', purpose: 'spend' }, actor, body: { spreadsheetId: binding.spreadsheetId, campaignId: 'a', purpose: 'spend', ...body } }, { status(value: number) { result.status = value; return this; }, json(body: any) { result.body = body; return this; } });
    return result;
  };
  return { call, effects, storage, binding, request };
}

describe('Sheets access-email HTTP boundaries', () => {
  for (const route of ['status','prepare','connect']) it.each([['',401],['owner-b',404]])(`${route} blocks actor %s before side effects`, async (actor,status) => {
    const f = fixture(); expect((await f.call(route,{},String(actor))).status).toBe(status); expect(f.effects).toEqual([]);
  });
  it('prepares an email without a connection or imported figures', async () => {
    const f = fixture(); expect((await f.call('prepare')).body.email).toBe(f.binding.email);
    expect(f.effects).toEqual(['reserve','provision','prepare']);
  });
  it('verifies the exact file before persisting its credential-free pending connection', async () => {
    const f = fixture(); expect((await f.call('connect')).status).toBe(200); expect(f.effects).toEqual(['client-token','read','verify','save']);
    expect(f.storage.createGoogleSheetsConnection).toHaveBeenCalledWith(expect.objectContaining({ campaignId:'a',spreadsheetId:'pending',serviceAccountBindingId:'binding-a',method:'service_account' }));
    expect(f.storage.assertServiceAccountResourceAccess).not.toHaveBeenCalled();
  });
  it.each([401,403,404,429,500])('never saves on Google HTTP %s', async providerStatus => {
    const f=fixture({providerStatus}); expect((await f.call('connect')).status).toBeGreaterThanOrEqual(400); expect(f.effects).toEqual(['client-token','read']);
  });
  it.each([{returnedId:'other-file'}, {tabs:[]}])('rejects wrong files or missing tabs: %j',async options=>{
    const f=fixture(options);expect((await f.call('connect')).status).toBeGreaterThanOrEqual(400);expect(f.storage.createGoogleSheetsConnection).not.toHaveBeenCalled();
  });
  it('does not reuse pending identities belonging to another file',async()=>{
    const f=fixture({existing:[{id:'other',method:'service_account',spreadsheetId:'pending',serviceAccountBindingId:'other-binding',purpose:'spend'}]});
    expect((await f.call('connect')).status).toBe(200); expect(f.storage.createGoogleSheetsConnection).toHaveBeenCalledOnce();
  });
  it('requires preparation and preserves OAuth and existing shared connections',async()=>{
    const missing=fixture({prepared:false});expect((await missing.call('connect')).status).toBe(409);expect(missing.effects).toEqual([]);
    const oauth=fixture({existing:[{method:'access_token'}]});expect((await oauth.call('prepare')).status).toBe(409);expect((await oauth.call('connect')).status).toBe(409);expect(oauth.effects).toEqual([]);
    const legacy=fixture({existing:[{method:'service_account',spreadsheetId:'1234567890'}]});expect((await legacy.call('connect')).status).toBe(200);expect(legacy.effects).toEqual(['legacy-grant','legacy-token','read','save']);
  });
  it('never uses an unrelated file token for tab discovery or tab selection',async()=>{
    const other={id:'other',method:'service_account',accessToken:'foreign-file-token',spreadsheetId:'pending',serviceAccountBindingId:'other-binding',serviceAccountSpreadsheetId:'9999999999'};
    const f=fixture({existing:[other]});expect((await f.call('/api/google-sheets/:spreadsheetId/sheets')).status).toBe(404);
    expect((await f.call('/api/google-sheets/select-spreadsheet-multiple',{sheetNames:['Data']})).status).toBe(404);
    expect(f.request).not.toHaveBeenCalled();expect(f.storage.createGoogleSheetsConnection).not.toHaveBeenCalled();
  });
});
