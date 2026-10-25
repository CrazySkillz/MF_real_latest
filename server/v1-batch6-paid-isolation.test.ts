import { readFileSync } from "node:fs";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { filterActiveSchedulerCampaigns } from "./utils/campaign-scheduler-eligibility";

// Execute the current route/helper bodies with isolated storage and no provider I/O.
const routeSource = ts.createSourceFile("routes.ts", readFileSync("server/routes-oauth.ts", "utf8"), ts.ScriptTarget.Latest, true);
const routes = new Map<string, string>();
const declarations = new Map<string, string>();
function visit(node: ts.Node) {
  if (ts.isFunctionDeclaration(node) && node.name) declarations.set(node.name.text, node.getText(routeSource));
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && !declarations.has(node.name.text))
    declarations.set(node.name.text, `const ${node.getText(routeSource)};`);
  if (ts.isCallExpression(node) && /^app\.(get|post)$/.test(node.expression.getText(routeSource)) && ts.isStringLiteral(node.arguments[0]))
    routes.set(`${(node.expression as ts.PropertyAccessExpression).name.text} ${node.arguments[0].text}`, node.arguments.at(-1)!.getText(routeSource));
  ts.forEachChild(node, visit);
}
visit(routeSource);
function bind(code: string, name: string, env: Record<string, any>) {
  const js = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  return new Function(...Object.keys(env), `${js}\nreturn ${name};`)(...Object.values(env));
}
const quiet = { log() {}, warn() {}, error() {} };
const campaignId = "11111111-1111-4111-8111-111111111111";
const parent = { id: campaignId, ownerId: "owner-a", status: "active", currency: "EUR" };
function context(overrides: Record<string, any> = {}, nodeEnv = "production", actor: string | null = "owner-a") {
  const effects: string[] = [];
  const storage = new Proxy({ getCampaign: vi.fn(async () => parent), ...overrides }, {
    get(target, key) {
      if (key in target) return (target as any)[key];
      return async () => { effects.push(String(key)); throw new Error(`Unexpected storage effect: ${String(key)}`); };
    },
  });
  const env: Record<string, any> = { storage, console: quiet, z, filterActiveSchedulerCampaigns,
    process: { env: { NODE_ENV: nodeEnv, ALLOW_MOCK_DATA: "true" } },
    getAuth: () => ({ userId: actor }), isInternalAutoRefreshRequest: () => false,
    require: () => { effects.push("provider-load"); throw new Error("Provider loading forbidden"); },
  };
  for (const name of ["campaignIdSchema", "getActorId", "ensureCampaignAccess", "yesterdayUTC", "parseMetaSelectedCampaignIds"])
    env[name] = bind(declarations.get(name)!, name, env);
  return { env, storage, effects };
}
async function invoke(route: string, f: ReturnType<typeof context>, query: Record<string, string> = {}) {
  const handler = bind(`const handler = ${routes.get(route)};`, "handler", f.env);
  const res: any = { statusCode: 200, status(code: number) { this.statusCode = code; return this; }, json(body: any) { this.body = body; return this; } };
  await handler({ params: { campaignId }, body: { selectedCampaignIds: ["selected"] }, query, headers: {} }, res);
  return res;
}
const testRoutes = ["meta", "instagram", "tiktok", "google-ads"].map(platform => `post /api/${platform}/:campaignId/connect-test`)
  .concat(["instagram", "tiktok"].map(platform => `post /api/${platform}/:campaignId/refresh-test`));

describe("Batch 6 retained production readers reject saved test connections", () => {
  const readers = [
    ["google-ads", "GoogleAds", "daily-metrics"], ["google-ads", "GoogleAds", "campaigns"],
    ["meta", "Meta", "daily-metrics"], ["meta", "Meta", "analytics"], ["meta", "Meta", "campaigns"],
    ["instagram", "Instagram", "daily-metrics"], ["instagram", "Instagram", "overview-summary"], ["instagram", "Instagram", "campaigns"],
    ["tiktok", "TikTok", "daily-metrics"], ["tiktok", "TikTok", "campaigns"], ["linkedin", "LinkedIn", "daily-metrics"],
  ];
  function reader(kind: string, nodeEnv = "production", method = "test_mode") {
    const connection = { campaignId, method, selectedCampaignIds: '["selected"]', accessToken: method === 'oauth' ? 'real-fixture' : 'test-mode-token' };
    const metrics = vi.fn(async () => []);
    const f = context({ [`get${kind}Connection`]: async () => connection, [`get${kind}DailyMetrics`]: metrics,
      getRevenueTotalForRange: async () => ({ totalRevenue: 0, sourceIds: [] }) }, nodeEnv);
    f.env.getDateRangeBounds = () => ({ startDate: "2026-10-01", endDate: "2026-10-24" });
    return { f, metrics };
  }
  for (const [platform, kind, endpoint] of readers) {
    it(`${platform}/${endpoint} rejects old test facts before reading or loading a provider`, async () => {
      const { f, metrics } = reader(kind);
      expect((await invoke(`get /api/${platform}/:campaignId/${endpoint}`, f)).statusCode).toBe(409);
      expect(metrics).not.toHaveBeenCalled(); expect(f.effects).toEqual([]);
    });
  }
  for (const [platform, kind, endpoint] of readers.filter(row => row[2] === 'daily-metrics' || row[2] === 'overview-summary')) {
    it(`${platform}/${endpoint} preserves the real-source production read`, async () => {
      const { f, metrics } = reader(kind, 'production', 'oauth');
      expect((await invoke(`get /api/${platform}/:campaignId/${endpoint}`, f)).statusCode).toBe(200);
      expect(metrics).toHaveBeenCalledOnce(); expect(f.effects).toEqual([]);
    });
  }
  it('blocks a Meta mock query even with a real connection', async () => {
    const { f, metrics } = reader('Meta', 'production', 'oauth');
    expect((await invoke('get /api/meta/:campaignId/analytics', f, { useMock: '1' })).statusCode).toBe(409);
    expect(metrics).not.toHaveBeenCalled(); expect(f.effects).toEqual([]);
  });
  it('blocks persisted test Meta insights', async () => {
    const { f, metrics } = reader('Meta');
    expect((await invoke('get /api/meta/:campaignId/insights/daily', f, { metaCampaignId: 'selected' })).statusCode).toBe(409);
    expect(metrics).not.toHaveBeenCalled(); expect(f.effects).toEqual([]);
  });
  it('excludes explicitly simulated TikTok rows from a real production connection', async () => {
    const { f, metrics } = reader('TikTok', 'production', 'oauth');
    metrics.mockResolvedValue([{ tiktokCampaignId: 'selected', spend: '900', isSimulated: true },
      { tiktokCampaignId: 'selected', spend: '10', isSimulated: false }] as any);
    const response = await invoke('get /api/tiktok/:campaignId/daily-metrics', f);
    expect(response.body.rows.map((row: any) => row.spend)).toEqual([10]);
  });
  it('keeps explicit Google Ads development test rows readable', async () => {
    const { f, metrics } = reader('GoogleAds', 'development');
    expect((await invoke('get /api/google-ads/:campaignId/daily-metrics', f)).statusCode).toBe(200);
    expect(metrics).toHaveBeenCalledOnce();
  });
});

describe('Batch 6 retained aggregate descriptors exclude saved test facts', () => {
  for (const [kind, key] of [['GoogleAds', 'googleAds'], ['Instagram', 'instagram'], ['TikTok', 'tiktok'], ['LinkedIn', 'linkedIn']]) {
    it(`${kind} excludes test-mode rows before reading any metrics`, async () => {
      const read = vi.fn(async () => []);
      const f = context({ [`get${kind}Connection`]: async () => ({ campaignId, method: 'test_mode', adAccountId: 'account', selectedCampaignIds: '["selected"]', accessToken: 'test-mode-token' }),
        [`get${kind}DailyMetrics`]: read, getRevenueTotalForRange: async () => ({ totalRevenue: 0, sourceIds: [] }) });
      const name = `build${kind}PlatformSourceForAggregate`;
      const fn = bind(declarations.get(name)!, name, f.env);
      const result = kind === 'LinkedIn' ? await fn(campaignId, undefined, { startDate: '2026-10-01', endDate: '2026-10-24' })
        : await fn(campaignId, '2026-10-01', '2026-10-24');
      expect(result[key].connected).toBe(false); expect(result[`${key}Spend`]).toBe(0); expect(read).not.toHaveBeenCalled();
      expect(f.effects).toEqual([]);
    });
  }
  it('excludes test Meta facts from the exact inline aggregate branch', async () => {
    const start = routeSource.text.indexOf('// Meta summary inputs');
    const end = routeSource.text.indexOf('const aggregateStartDate', start);
    expect(start).toBeGreaterThan(0); expect(end).toBeGreaterThan(start);
    const read = vi.fn(async () => []);
    const f = context({ getMetaDailyMetrics: read });
    const run = bind(`const run = async () => { ${routeSource.text.slice(start, end)} return { meta, metaSpend }; };`, 'run', {
      ...f.env, campaignId, metaConn: { method: 'test_mode', selectedCampaignIds: '["selected"]' },
      currentValueWindow: { startDate: '2026-10-01', endDate: '2026-10-24' }, parseNum: Number,
    });
    expect(await run()).toMatchObject({ meta: { connected: false }, metaSpend: 0 }); expect(read).not.toHaveBeenCalled();
  });
});

describe('Batch 6 saved test facts cannot refresh goals or generate report values', () => {
  for (const kind of ['Instagram', 'TikTok']) {
    for (const name of [`get${kind}MetricsForTarget`, `build${kind}ScheduledPdfAttachment`, `validate${kind}ScheduledReportScope`]) {
      it(`${name} rejects a production test connection before reading metrics`, async () => {
        const file = name.startsWith('get') ? 'server/utils/kpi-refresh.ts' : 'server/report-scheduler.ts';
        const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
        const fn = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name)!;
        const metrics = vi.fn(async () => []);
        const connection = { campaignId, method: 'test_mode', selectedCampaignIds: '["selected"]' };
        const chain: any = { from: () => chain, where: () => chain, limit: async () => [{ id: campaignId }] };
        const env = { storage: { [`get${kind}Connection`]: async () => connection, [`get${kind}DailyMetrics`]: metrics },
          process: { env: { NODE_ENV: 'production' } }, db: { select: () => chain }, campaigns: { id: 'id' }, eq: () => true,
          yesterdayUTC: () => '2026-10-24' };
        const run = bind(fn.getText(source), name, env);
        const report = { campaignId, platformType: kind.toLowerCase() };
        const result = name.startsWith('get') ? await run(campaignId, { trackingPeriod: 30 }) : name.startsWith('build')
          ? await run({ report, windowStart: '2026-10-01', windowEnd: '2026-10-24', campaignName: 'Fixture' }) : await run(report);
        if (name.startsWith('validate')) expect(result.ok).toBe(false); else expect(result).toBeNull();
        expect(metrics).not.toHaveBeenCalled();
        connection.method = 'oauth';
        if (name.startsWith('validate')) expect((await run(report)).ok).toBe(true);
        else {
          if (name.startsWith('get')) await run(campaignId, { trackingPeriod: 30 });
          else await run({ report, windowStart: '2026-10-01', windowEnd: '2026-10-24', campaignName: 'Fixture' });
          expect(metrics).toHaveBeenCalledOnce();
        }
      });
    }
  }
  for (const name of ['getLatestLinkedInMetrics', 'getCampaignSpecificMetrics']) {
    it(`${name} excludes legacy test-token imports before reading their session`, async () => {
      const source = ts.createSourceFile('kpi.ts', readFileSync('server/utils/kpi-refresh.ts', 'utf8'), ts.ScriptTarget.Latest, true);
      const fn = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name)!;
      const read = vi.fn(async () => null);
      const run = bind(fn.getText(source), name, { console: quiet, process: { env: { NODE_ENV: 'production' } }, storage: {
        getLinkedInConnection: async () => ({ campaignId, method: 'oauth', accessToken: 'test-mode-token' }), getLatestLinkedInImportSession: read,
      } });
      expect(await run(campaignId, 'Selected')).toBeNull(); expect(read).not.toHaveBeenCalled();
    });
  }
  for (const [platform, kind] of [['meta', 'Meta'], ['linkedin', 'LinkedIn']]) {
    it(`${platform} cannot enrich saved test facts through its retained direct helper`, async () => {
      const f = context(), enrich = vi.fn(async () => ({ enriched: 1 }));
      f.env.enrichPlatformWithGA4Revenue = enrich;
      const name = `enrich${kind}WithGA4Revenue`;
      const run = loadWrapper(platform, name, f);
      await expect(run.fn(campaignId, { campaignId, method: 'test_mode', accessToken: 'test-mode-token' })).rejects.toThrow('Test-mode');
      expect(enrich).not.toHaveBeenCalled(); expect(f.effects).toEqual([]);
      expect(await run.fn(campaignId, { campaignId, method: 'oauth', accessToken: 'real-fixture' })).toEqual({ enriched: 1 });
      expect(enrich).toHaveBeenCalledOnce();
    });
  }
});

describe('Batch 6 legacy ad-platform reprocessing isolation', () => {
  const source = readFileSync('server/auto-refresh-scheduler.ts', 'utf8');
  const start = source.indexOf('// Ad Platform Spend (Google Ads / Meta)');
  const code = source.slice(start, source.indexOf('// Google Sheets (Revenue)', start));
  function fixture(method: string, rows: any[], selectedCampaignIds = '["selected"]') {
    const read = vi.fn(async () => rows), replace = vi.fn(async () => ({})), update = vi.fn(async () => ({}));
    const f = context({ getSpendSources: async () => [{ id: 'legacy', campaignId, sourceType: 'ad_platforms', platformContext: 'meta', displayName: 'Meta Ads', currency: 'EUR', mappingConfig: '{"selectedCampaignIds":["selected"]}' }],
      getMetaConnection: async () => ({ campaignId, method, selectedCampaignIds }), getMetaDailyMetrics: read,
      replaceSpendRecordsForSource: replace, getSpendTotalForRange: async () => ({ totalSpend: 10 }), updateCampaign: update,
    });
    const run = bind(`const run = async () => { let attempted=0, succeeded=0, skipped=0, anyUpdated=false; ${code} return {succeeded,skipped,anyUpdated}; };`, 'run', {
      ...f.env, campaignId, guarded: false, campaign: { startDate: '2026-10-01', currency: 'EUR' },
      safeJsonParse: JSON.parse, isSourceOutsideCampaign: (row: any, id: string) => row.campaignId !== id,
      getLatestCompleteReportingDate: () => '2026-10-24', refreshWriteInput: {},
    });
    return { run, read, replace, update };
  }
  it('does not copy saved test-mode facts into financial records', async () => {
    const f = fixture('test_mode', [{ campaignId, metaCampaignId: 'selected', date: '2026-10-01', spend: '900', currency: 'EUR' }]);
    expect((await f.run()).succeeded).toBe(0); expect(f.read).not.toHaveBeenCalled(); expect(f.replace).not.toHaveBeenCalled();
  });
  it.each([{ currency: undefined }, { currency: 'USD' }, { isSimulated: true }, { spend: '-1' }, { spend: '' }, { spend: '10x' }, { date: undefined }, { date: '2026-10-25' }, { date: '2026-10-20x' }, { campaignId: 'foreign' }])('retains old financial records when current facts are unverified: %j', extra => {
    const f = fixture('oauth', [{ campaignId, metaCampaignId: 'selected', date: '2026-10-01', spend: '10', currency: 'EUR', ...extra }]);
    return f.run().then(result => { expect(result.succeeded).toBe(0); expect(f.replace).not.toHaveBeenCalled(); });
  });
  it('preserves valid dated selected real EUR facts', async () => {
    const f = fixture('oauth', [{ campaignId, metaCampaignId: 'selected', date: '2026-10-01', spend: '10', currency: 'EUR' }]);
    expect((await f.run()).succeeded).toBe(1); expect(f.replace).toHaveBeenCalledOnce();
    expect(f.update).not.toHaveBeenCalled();
    expect(f.replace).toHaveBeenCalledWith(campaignId, 'legacy', 'ad_platforms', 'meta', expect.any(Array), '{"selectedCampaignIds":["selected"]}');
  });
  it('does not reprocess a selection removed from the connection', async () => {
    const f = fixture('oauth', [{ campaignId, metaCampaignId: 'selected', date: '2026-10-01', spend: '10', currency: 'EUR' }], '["different"]');
    expect((await f.run()).succeeded).toBe(0); expect(f.replace).not.toHaveBeenCalled();
  });
});

describe("Batch 6 production test-entry isolation", () => {
  for (const route of testRoutes) {
    it.each(["production", " Production "])(`${route} blocks %s before reads, writes, or provider loading`, async nodeEnv => {
      const f = context({}, nodeEnv);
      const response = await invoke(route, f);
      expect(response.statusCode).toBe(404);
      expect(f.storage.getCampaign).not.toHaveBeenCalled();
      expect(f.effects).toEqual([]);
    });
    it.each([[null, 401], ["other-owner", 404]] as const)(`${route} preserves development access guard for %s`, async (actor, status) => {
      const f = context({}, "development", actor);
      expect((await invoke(route, f)).statusCode).toBe(status);
      expect(f.effects).toEqual([]);
    });
  }
  it("does not seed Instagram metrics from a production GET on an old test connection", async () => {
    const f = context({ getInstagramConnection: async () => ({ campaignId, method: "test_mode", selectedCampaignIds: '["selected"]' }),
      getInstagramDailyMetrics: async () => [], upsertInstagramDailyMetrics: vi.fn(async () => ({ upserted: 1 })) });
    f.env.getDateRangeBounds = () => ({ startDate: "2026-10-01", endDate: "2026-10-23" });
    const response = await invoke("get /api/instagram/:campaignId/daily-metrics", f);
    expect(response.statusCode).toBe(409);
    expect(f.storage.upsertInstagramDailyMetrics).not.toHaveBeenCalled();
    expect(f.effects).toEqual([]);
  });
  for (const [platform, kind] of [["meta", "Meta"], ["instagram", "Instagram"], ["tiktok", "TikTok"], ["google-ads", "GoogleAds"]]) {
    it(`${platform} keeps owned development test setup available`, async () => {
      const create = vi.fn(async (row: any) => row), write = vi.fn(async (rows: any[]) => ({ upserted: rows.length }));
      const f = context({ [`delete${kind}Connection`]: async () => true, [`create${kind}Connection`]: create,
        [`replace${kind}Connection`]: create, [`upsert${kind}DailyMetrics`]: write, [`update${kind}Connection`]: async () => {} }, "development");
      f.env.clearGoogleAdsAttributedRevenueSourcesForCampaign = vi.fn(async () => {});
      const generate = vi.fn(async () => {});
      f.env.require = (name: string) => {
        if (name === "./meta-scheduler") return { generateMockMetaData: generate };
        if (name === "./google-ads-scheduler") return { refreshGoogleAdsForCampaign: generate };
        throw new Error(name);
      };
      expect((await invoke(`post /api/${platform}/:campaignId/connect-test`, f)).body.success).toBe(true);
      expect(create.mock.calls[0][0]).toMatchObject({ campaignId, method: "test_mode" });
      if (platform === "instagram") expect(write.mock.calls[0][0][0]).toMatchObject({ campaignId, instagramCampaignId: "selected", spend: "85.00" });
      if (platform === "meta" || platform === "google-ads") expect(generate).toHaveBeenCalledTimes(30);
      expect(f.effects).toEqual([]);
    });
  }
});

const wrappers = [
  ["google-ads", "refreshGoogleAdsForCampaign"], ["linkedin", "refreshLinkedInDataForCampaign"],
  ["meta", "refreshMetaDataForCampaign"], ["instagram", "refreshInstagramForCampaign"], ["tiktok", "refreshTikTokForCampaign"],
] as const;
function loadWrapper(platform: string, name: string, f: ReturnType<typeof context>) {
  const source = ts.createSourceFile("scheduler.ts", readFileSync(`server/${platform}-scheduler.ts`, "utf8"), ts.ScriptTarget.Latest, true);
  const funcs = new Map<string, string>();
  for (const node of source.statements) {
    if (ts.isFunctionDeclaration(node) && node.name) funcs.set(node.name.text, node.getText(source).replace(/^export\s+/, ""));
    if (ts.isVariableStatement(node)) for (const decl of node.declarationList.declarations)
      if (ts.isIdentifier(decl.name)) funcs.set(decl.name.text, `const ${decl.getText(source)};`);
  }
  const real = vi.fn(async () => true), mock = vi.fn(async () => true), downstream = vi.fn(async () => {});
  Object.assign(f.env, { AbortSignal, fetchRealLinkedInData: real, fetchRealGoogleAdsData: real, fetchRealMetaData: real,
    generateMockLinkedInData: mock, generateMockGoogleAdsData: mock, generateMockMetaData: mock,
    refreshKPIsForCampaign: downstream, checkPerformanceAlerts: downstream, checkBenchmarkPerformanceAlerts: downstream });
  for (const helper of ["iso", "getSelectedMetaCampaignIds", "parseSelectedInstagramCampaignIds", "parseSelectedTikTokCampaignIds", "parseTikTokCampaignMetadata", "buildTestModeTikTokRows", "markTikTokRefreshFailure"])
    if (funcs.has(helper)) f.env[helper] = bind(funcs.get(helper)!, helper, f.env);
  return { fn: bind(funcs.get(name)!, name, f.env), real, mock, downstream };
}
describe("Batch 6 refresh dispatch boundaries", () => {
  for (const [platform, name] of wrappers) {
    it(`${platform} rejects a connection belonging to a different campaign`, async () => {
      const f = context(); const w = loadWrapper(platform, name, f);
      await w.fn(campaignId, { campaignId: "another-campaign", method: "oauth", selectedCampaignIds: '["selected"]', accessToken: "live-token", advertiserId: "account" }).catch(() => {});
      expect(w.real).not.toHaveBeenCalled(); expect(w.mock).not.toHaveBeenCalled(); expect(w.downstream).not.toHaveBeenCalled(); expect(f.effects).toEqual([]);
    });
    for (const [label, campaign] of [["missing", null], ["ownerless", { ...parent, ownerId: null }],
      ["blank owner", { ...parent, ownerId: " " }], ["paused", { ...parent, status: "paused" }],
      ["draft", { ...parent, status: "draft" }], ["archived", { ...parent, status: "archived" }]] as const) {
      it(`${platform} refuses ${label} parent without data/downstream effects`, async () => {
        const f = context({ getCampaign: async () => campaign });
        const w = loadWrapper(platform, name, f);
        await w.fn(campaignId, { campaignId, method: "oauth", selectedCampaignIds: '["selected"]', accessToken: "live-token", advertiserId: "account" }).catch(() => {});
        expect(w.real).not.toHaveBeenCalled(); expect(w.mock).not.toHaveBeenCalled(); expect(w.downstream).not.toHaveBeenCalled();
        expect(f.effects).toEqual([]);
      });
    }
    it(`${platform} refuses an old test-mode connection in production`, async () => {
      const f = context();
      const w = loadWrapper(platform, name, f);
      await w.fn(campaignId, { campaignId, method: "test_mode", selectedCampaignIds: '["selected"]', advertiserId: "account" }).catch(() => {});
      expect(w.mock).not.toHaveBeenCalled(); expect(w.real).not.toHaveBeenCalled(); expect(w.downstream).not.toHaveBeenCalled();
      expect(f.effects).toEqual([]);
    });
  }
  for (const [platform, name] of wrappers.slice(0, 3)) {
    it(`${platform} retains active real-source dispatch`, async () => {
      const f = context(); const w = loadWrapper(platform, name, f);
      await w.fn(campaignId, { campaignId, method: "oauth", selectedCampaignIds: '["selected"]', accessToken: "live-token" });
      expect(w.real).toHaveBeenCalledOnce(); expect(w.mock).not.toHaveBeenCalled(); expect(f.effects).toEqual([]);
    });
  }
  it("preserves the authenticated Google Ads draft Spend preview and refuses a paused preview", async () => {
    const connection = { campaignId, method: "oauth", spendOnly: true };
    const f = context({ getCampaign: vi.fn(async () => ({ ...parent, status: "draft" })), getGA4GoogleAdsSpendConnection: async () => connection });
    f.env.materializeGA4GoogleAdsSpendForCampaign = vi.fn(async () => ({ updated: true }));
    const preview = loadWrapper("google-ads", "refreshGoogleAdsForCampaign", f);
    expect((await preview.fn(campaignId, connection, { allowDraftPreview: true, ga4SpendConnection: true })).providerRefreshed).toBe(true);
    expect(preview.real).toHaveBeenCalledOnce(); expect(f.effects).toEqual([]);
    f.storage.getCampaign.mockResolvedValue({ ...parent, status: "paused" });
    await expect(preview.fn(campaignId, connection, { allowDraftPreview: true, ga4SpendConnection: true })).rejects.toThrow("scope is unavailable");
    expect(preview.real).toHaveBeenCalledOnce();
  });
  it("retains isolated development TikTok generation but never generates it in production", async () => {
    const write = vi.fn(async (rows: any[]) => ({ upserted: rows.length }));
    const f = context({ upsertTikTokDailyMetrics: write, updateTikTokConnection: vi.fn(async () => {}) }, "development");
    const w = loadWrapper("tiktok", "refreshTikTokForCampaign", f);
    const connection = { campaignId, method: "test_mode", advertiserId: "account", selectedCampaignIds: '["selected"]' };
    expect((await w.fn(campaignId, connection)).refreshed).toBe(true);
    expect(write.mock.calls[0][0][0]).toMatchObject({ campaignId, isSimulated: true, tiktokCampaignId: "selected" });
    f.env.process.env.NODE_ENV = "production";
    expect((await w.fn(campaignId, connection)).refreshed).toBe(false);
    expect(write).toHaveBeenCalledOnce();
  });
  it("retains real Instagram writes only for the selected Instagram placement", async () => {
    const write = vi.fn(async (rows: any[]) => ({ upserted: rows.length }));
    const f = context({ upsertInstagramDailyMetrics: write, updateInstagramConnection: vi.fn(async () => {}) });
    const query = vi.fn(async (_id: string, _range: any) => [{ publisherPlatform: "instagram", dateStart: "2026-10-23", impressions: 100, clicks: 10, spend: 20, conversions: 2 },
      { publisherPlatform: "facebook", dateStart: "2026-10-23", spend: 900 }]);
    f.env.require = (name: string) => { if (name === "./services/meta-graph-api") return { MetaGraphAPIClient: class { getCampaignDailyPlacementInsights = query; } }; throw new Error(name); };
    const w = loadWrapper("instagram", "refreshInstagramForCampaign", f);
    expect((await w.fn(campaignId, { campaignId, method: "oauth", accessToken: "live-token", selectedCampaignIds: '["selected"]' })).upserted).toBe(1);
    expect(write.mock.calls[0][0]).toEqual([expect.objectContaining({ campaignId, instagramCampaignId: "selected", spend: "20.00" })]);
    expect(query.mock.calls[0][0]).toBe("selected"); expect(f.effects).toEqual([]);
  });
});

const saved = vi.hoisted(() => new Proxy<Record<string, any>>({}, { get(target, name: string) { return target[name] ??= vi.fn(async () => []); } }));
vi.mock("./storage", () => ({ storage: saved }));
vi.mock("./db", () => ({ db: {} }));
vi.mock("./analytics", () => ({ ga4Service: {} }));
import { aggregateCampaignMetrics } from "./scheduler";
describe("Batch 6 shared rollup simulation boundary", () => {
  beforeEach(() => {
    for (const mock of Object.values(saved)) mock.mockReset().mockResolvedValue([]);
    vi.stubEnv("NODE_ENV", "production");
    for (const method of ["log", "warn", "error"] as const) vi.spyOn(console, method).mockImplementation(() => {});
    saved.getCampaign.mockResolvedValue(parent);
    for (const name of ["LinkedIn", "Meta", "GoogleAds", "Instagram", "TikTok", "PrimaryGA4"])
      saved[`get${name}Connection`].mockResolvedValue(null);
    saved.getLatestCustomIntegrationMetrics.mockResolvedValue(null);
    saved.getRevenueTotalForRange.mockResolvedValue({ totalRevenue: 0, sourceIds: [], currency: "EUR" });
    saved.getSpendTotalForRange.mockResolvedValue({ totalSpend: 0, sourceIds: [], currency: "EUR" });
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
  for (const platform of ["Meta", "GoogleAds", "Instagram", "TikTok"]) {
    it(`${platform} excludes saved test-mode data from totals and trends`, async () => {
      saved[`get${platform}Connection`].mockResolvedValue({ campaignId, method: "test_mode", selectedCampaignIds: '["selected"]' });
      saved[`get${platform}DailyMetrics`].mockResolvedValue([{ date: "2026-10-23", googleCampaignId: "selected", instagramCampaignId: "selected",
        tiktokCampaignId: "selected", publisherPlatform: "instagram", spend: "100", impressions: 1000, clicks: 10, conversions: 2 }]);
      const result = await aggregateCampaignMetrics(campaignId);
      expect(result.totalSpend).toBe(0);
      expect(saved[`get${platform}DailyMetrics`]).not.toHaveBeenCalled();
    });
  }
  it("keeps real selected facts while excluding TikTok's persisted isSimulated rows", async () => {
    for (const platform of ["Instagram", "TikTok"]) {
      saved[`get${platform}Connection`].mockResolvedValue({ campaignId, method: "oauth", selectedCampaignIds: '["selected"]' });
      const row = { date: "2026-10-23", instagramCampaignId: "selected", tiktokCampaignId: "selected", publisherPlatform: "instagram", spend: "10", impressions: 100, clicks: 10, conversions: 2 };
      saved[`get${platform}DailyMetrics`].mockResolvedValue(platform === "TikTok" ? [row, { ...row, spend: "900", isSimulated: true }] : [row]);
    }
    expect((await aggregateCampaignMetrics(campaignId)).totalSpend).toBe(20);
  });
  it("does not read a LinkedIn test import session into the production aggregate", async () => {
    saved.getLinkedInConnection.mockResolvedValue({ campaignId, method: "oauth", accessToken: "test-mode-token" });
    saved.getLatestLinkedInImportSession.mockResolvedValue({ id: "test-session" });
    saved.getLinkedInImportMetrics.mockResolvedValue([{ metricKey: "spend", metricValue: "900" }]);
    expect((await aggregateCampaignMetrics(campaignId)).totalSpend).toBe(0);
    expect(saved.getLatestLinkedInImportSession).not.toHaveBeenCalled();
  });
  it("keeps Google Ads imported revenue and native facts while making name-matched revenue unavailable", async () => {
    saved.getGoogleAdsConnection.mockResolvedValue({ campaignId, method: "oauth", selectedCampaignIds: '["selected"]' });
    saved.getGoogleAdsDailyMetrics.mockResolvedValue([{ date: "2026-10-23", googleCampaignId: "selected", spend: "10", impressions: 100,
      clicks: 10, conversions: "2", conversionValue: "25", ga4Revenue: "999" }]);
    saved.getRevenueTotalForRange.mockImplementation(async (_id: string, _start: string, _end: string, context: string) =>
      context === "google_ads" ? { totalRevenue: 100, sourceIds: ["ads-source"], currency: "EUR" } : { totalRevenue: 0, sourceIds: [], currency: "EUR" });
    const result = await aggregateCampaignMetrics(campaignId);
    const summary = result.detailedMetrics.performanceSummary;
    const ads = summary.sources.find((source: any) => source.id === "google_ads")!;
    expect(ads.metrics).toMatchObject({ spend: 10, conversionValue: 25, ga4AttributedRevenue: null, attributedRevenue: 100 });
    expect(summary.totals.revenue.value).toBe(100);
    expect(result.totalSpend).toBe(10);
  });
});
