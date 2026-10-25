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
  for (const name of ["campaignIdSchema", "getActorId", "ensureCampaignAccess", "yesterdayUTC"])
    env[name] = bind(declarations.get(name)!, name, env);
  return { env, storage, effects };
}
async function invoke(route: string, f: ReturnType<typeof context>) {
  const handler = bind(`const handler = ${routes.get(route)};`, "handler", f.env);
  const res: any = { statusCode: 200, status(code: number) { this.statusCode = code; return this; }, json(body: any) { this.body = body; return this; } };
  await handler({ params: { campaignId }, body: { selectedCampaignIds: ["selected"] }, query: {}, headers: {} }, res);
  return res;
}
const testRoutes = ["meta", "instagram", "tiktok", "google-ads"].map(platform => `post /api/${platform}/:campaignId/connect-test`)
  .concat(["instagram", "tiktok"].map(platform => `post /api/${platform}/:campaignId/refresh-test`));

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
