import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import * as schema from "../shared/schema";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { resolveOAuthStateSigningSecret } from "./utils/tokenVault";
import { normalizeStrictUtcDateKey } from "./utils/data-transformation";

// Execute exact current handlers, including their access helpers, without loading
// the server, a database, provider credentials, or delivery transports.
const source = ts.createSourceFile("routes.ts", readFileSync("server/routes-oauth.ts", "utf8"), ts.ScriptTarget.Latest, true);
const routes = new Map<string, string>();
const names = new Map<string, string>();
function visit(node: ts.Node) {
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && !names.has(node.name.text))
    names.set(node.name.text, `const ${node.getText(source)};`);
  if (ts.isCallExpression(node) && /^app\.(get|post|patch|delete)$/.test(node.expression.getText(source))
    && ts.isStringLiteral(node.arguments[0])) {
    const method = (node.expression as ts.PropertyAccessExpression).name.text.toUpperCase();
    routes.set(`${method} ${node.arguments[0].text}`, node.arguments[node.arguments.length - 1].getText(source));
  }
  ts.forEachChild(node, visit);
}
visit(source);
function bind(code: string, name: string, env: Record<string, any>) {
  const compiled = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  return new Function(...Object.keys(env), `${compiled}\nreturn ${name};`)(...Object.values(env));
}
function fixture(actor: string | null, overrides: Record<string, any> = {}, nodeEnv = "production") {
  const effects: string[] = [];
  const storage = new Proxy({
    getCampaign: vi.fn(async (id: string) => ({ id, ownerId: "owner-a", status: "active", currency: "EUR", name: "Fixture", trendKeywords: [] })),
    ...overrides,
  }, { get(target, key) {
    if (key in target) return (target as any)[key];
    return async () => { effects.push(String(key)); throw new Error("Unexpected fixture effect: " + String(key)); };
  } });
  const env: Record<string, any> = {
    ...schema, z, storage, getAuth: () => ({ userId: actor }), isInternalAutoRefreshRequest: () => false,
    console: { log() {}, warn() {}, error() {} }, process: { env: { NODE_ENV: nodeEnv, ALLOW_MOCK_DATA: "true" } },
    require: () => { throw new Error("Provider/module loading forbidden in access fixture"); },
    createHmac, randomBytes, timingSafeEqual, Buffer, resolveOAuthStateSigningSecret,
    normalizeStrictUtcDateKey, recalcCampaignSpend: vi.fn(async () => 100), recomputeGA4SpendBeforeResponse: vi.fn(async () => {}),
    getPlatformFields: () => [{ id: "fixture-field" }],
  };
  for (const name of ["campaignIdSchema", "getActorId", "ensureCampaignAccess"])
    env[name] = bind(names.get(name)!, name, env);
  env.parseNum = (value: any) => Number(value) || 0;
  env.processConnectorDerivedSpend = bind(names.get("processConnectorDerivedSpend")!, "processConnectorDerivedSpend", env);
  for (const name of ["serializeOAuthPopupJson", "escapeOAuthPopupHtml"])
    env[name] = bind(names.get(name)!, name, env);
  return { env, effects, storage };
}
async function invoke(key: string, actor: string | null, options: { overrides?: Record<string, any>; params?: any; body?: any; query?: any; nodeEnv?: string } = {}) {
  const f = fixture(actor, options.overrides, options.nodeEnv);
  const handler = bind(`const handler=${routes.get(key)};`, "handler", f.env);
  const res: any = { statusCode: 200, setHeader() {}, status(n: number) { this.statusCode = n; return this; }, json(payload: any) { this.payload = payload; return this; }, send(payload: any) { this.payload = payload; return this; } };
  await handler({
    params: { id: "campaign-a", campaignId: "campaign-a", platform: "linkedin", ...options.params },
    body: { amount: 100, value: 10, currency: "EUR", fromCampaignId: "campaign-a", toCampaignId: "campaign-a", ...options.body },
    query: { campaignId: "campaign-a", ...options.query }, headers: {}, get: () => undefined, socket: { remoteAddress: "198.51.100.1" },
  }, res);
  return { ...f, res };
}
const privateRoutes = [
  "GET /api/campaigns/:id/linkedin-campaigns",
  "GET /api/campaigns/:id/linkedin-campaign-revenue",
  "GET /api/campaigns/:id/google-trends",
  "GET /api/campaigns/:campaignId/attribution",
  "GET /api/platforms/:platform/fields",
  "POST /api/campaigns/:id/spend/process/connectors",
  "POST /api/campaigns/:id/spend/process/ad-platforms",
  "POST /api/webhook/conversion/:campaignId",
  "POST /api/custom-integration/:campaignId/connect",
  "POST /api/custom-integration/transfer",
];
describe("Batch 1 campaign entry boundaries", () => {
  for (const route of privateRoutes) for (const [actor, status] of [[null, 401], ["owner-b", 404]] as const) {
    it(`${route} rejects ${actor || "anonymous"} before data/provider effects`, async () => {
      const { res, effects } = await invoke(route, actor);
      expect(res.statusCode).toBe(status);
      expect(effects).toEqual([]);
    });
  }
  it("allows owned LinkedIn campaign-list reads without changing the response contract", async () => {
    const { res } = await invoke(privateRoutes[0], "owner-a", { overrides: {
      getLatestLinkedInImportSession: async () => ({ id: "session-a" }),
      getLinkedInImportMetrics: async () => [{ campaignUrn: "urn-a", campaignName: "A", campaignStatus: "active" }],
    } });
    expect(res.statusCode).toBe(200);
    expect(res.payload).toEqual({ campaigns: [{ urn: "urn-a", name: "A", status: "active" }] });
  });
  it("keeps the non-campaign static field catalog available", async () => {
    const { res, effects } = await invoke("GET /api/platforms/:platform/fields", null, { query: { campaignId: undefined } });
    expect(res.statusCode).toBe(200); expect(effects).toEqual([]);
  });
  for (const key of ["POST /api/campaigns/:id/linkedin-daily/mock", "POST /api/campaigns/:id/linkedin/mock-seed", "POST /api/alerts/test-email"]) {
    it(`${key} cannot be enabled in production by a test flag`, async () => {
      const { res, effects } = await invoke(key, null);
      expect([403, 404]).toContain(res.statusCode); expect(effects).toEqual([]);
    });
  }
  for (const key of ["POST /api/campaigns/:id/linkedin-daily/mock", "POST /api/campaigns/:id/linkedin/mock-seed", "POST /api/alerts/test-email"]) {
    it(`${key} requires authentication outside production`, async () => {
      const { res, effects } = await invoke(key, null, { nodeEnv: "development" });
      expect(res.statusCode).toBe(401); expect(effects).toEqual([]);
    });
  }
  for (const key of ["POST /api/custom-integration/:campaignId/connect", "POST /api/custom-integration/transfer"]) {
    it(`${key} does not exempt the shared temporary ID`, async () => {
      const { res, effects } = await invoke(key, null, { params: { campaignId: "temp-campaign-setup" }, body: { fromCampaignId: "temp-campaign-setup" } });
      expect(res.statusCode).toBe(401); expect(effects).toEqual([]);
    });
  }
});

describe("Batch 1 immutable parent identities", () => {
  for (const [route, overrides, writer] of [
    ["PATCH /api/linkedin/update/:campaignId", {}, "updateLinkedInConnection"],
    ["PATCH /api/platforms/meta/kpis/:kpiId", { getKPI: async () => undefined, getMetaKPIById: async () => ({ campaignId: "campaign-a" }) }, "updateMetaKPI"],
    ["PATCH /api/benchmarks/:benchmarkId", { getMetaBenchmarkById: async () => ({ campaignId: "campaign-a" }) }, "updateMetaBenchmark"],
  ] as const) {
    it(`${route} preserves parent and identifier while accepting valid edits`, async () => {
      const write = vi.fn(async (_id, data) => ({ ...data, id: "record-a" }));
      const { res } = await invoke(route, "owner-a", { params: { kpiId: "record-a", benchmarkId: "record-a" },
        body: { id: "record-b", campaignId: "campaign-b", name: "Updated", adAccountName: "Updated" },
        overrides: { ...overrides, [writer]: write } });
      expect(res.statusCode).toBe(200);
      expect(write).toHaveBeenCalledOnce();
      expect(write.mock.calls[0][1]).not.toHaveProperty("campaignId");
      expect(write.mock.calls[0][1]).not.toHaveProperty("id");
      expect(Object.values(write.mock.calls[0][1])).toContain("Updated");
    });
  }
});

describe("Batch 1 popup contexts", () => {
  const sentinel = "</script><script>globalThis.untrusted=true</script><img src=x onerror='bad()'>";
  for (const route of ["GET /api/auth/google/simulation-auth", "GET /api/auth/salesforce/callback", "GET /api/auth/linkedin/callback", "GET /api/auth/meta/callback"]) {
    it(`${route} encodes untrusted HTML and script content`, async () => {
      const { res } = await invoke(route, null, { query: { state: sentinel, error: sentinel, error_description: sentinel } });
      expect(res.statusCode).toBe(200);
      expect(res.payload).not.toContain("<img");
      expect(res.payload).not.toContain("</script><script>globalThis.untrusted");
      expect(res.payload).toContain("\\u003c/script>");
    });
  }
});

describe("Batch 1 global and attribution APIs", () => {
  const globals = ["GET /api/metrics", "POST /api/metrics", "GET /api/performance", "POST /api/performance", "GET /api/integrations", "POST /api/integrations"];
  const attribution = [...routes.keys()].filter(key => key.includes(" /api/attribution/"));
  for (const route of [...globals, ...attribution]) {
    it(`${route} rejects anonymous callers before storage`, async () => {
      const { res, effects } = await invoke(route, null);
      expect(res.statusCode).toBe(401); expect(effects).toEqual([]);
    });
  }
  for (const [route, method] of [
    ["GET /api/metrics", "getMetrics"], ["GET /api/performance", "getPerformanceData"],
    ["GET /api/integrations", "getIntegrations"], ["GET /api/attribution/models", "getAttributionModels"],
  ]) {
    it(`${route} supplies the authenticated owner to the query`, async () => {
      const query = vi.fn(async () => []);
      const { res } = await invoke(route, "owner-a", { overrides: { [method]: query } });
      expect(res.payload).toEqual([]); expect(query).toHaveBeenCalledWith("owner-a");
    });
  }
  for (const route of ["PATCH /api/attribution/models/:id", "DELETE /api/attribution/models/:id", "POST /api/attribution/models/:id/set-default",
    "PATCH /api/attribution/journeys/:id", "GET /api/attribution/journeys/:id", "GET /api/attribution/touchpoints", "POST /api/attribution/calculate"]) {
    it(`${route} rejects another owner's parent`, async () => {
      const { res, effects } = await invoke(route, "owner-a", { overrides: {
        getAttributionModel: async () => ({ ownerId: "owner-b" }), getCustomerJourney: async () => ({ ownerId: "owner-b" }),
      }, body: { journeyId: "foreign", modelId: "foreign" }, query: { journeyId: "foreign" } });
      expect(res.statusCode).toBe(404); expect(effects).toEqual([]);
    });
  }
});

describe("Batch 1 financial ingress", () => {
  for (const body of [{ value: "" }, { value: "10garbage" }, { value: null }, { value: Infinity }, { currency: "USD" }, { occurredAt: "invalid" }]) {
    it(`rejects invalid conversion ${JSON.stringify(body)}`, async () => {
      const { res, effects } = await invoke("POST /api/webhook/conversion/:campaignId", "owner-a", { body });
      expect(res.statusCode).toBe(400); expect(effects).toEqual([]);
    });
  }
  it("accepts zero and preserves the owner response contract", async () => {
    const write = vi.fn(async (event: any) => ({ ...event, id: "event-a" }));
    const { res } = await invoke("POST /api/webhook/conversion/:campaignId", "owner-a", { body: { value: 0 }, overrides: { createConversionEvent: write } });
    expect(res.statusCode).toBe(200);
    expect(res.payload.event.value).toBe("0.00");
    expect(write.mock.calls[0][0].currency).toBe("EUR");
  });
  for (const route of privateRoutes.filter(key => key.includes("/spend/process/"))) {
    it(`${route} requires source records and never changes campaign currency`, async () => {
      const { res, effects } = await invoke(route, "owner-a");
      expect(res.statusCode).toBe(400); expect(effects).toEqual([]);
    });
    it(`${route} materializes reconciled records and invokes both recompute paths`, async () => {
      const write = vi.fn(async () => ({ id: "source-a" }));
      const { res, env } = await invoke(route, "owner-a", { body: { platformContext: "ga4", records: [{ date: "2026-10-19", spend: "100" }] },
        overrides: { replaceSpendSourceWithRecords: write } });
      expect(res.statusCode).toBe(200);
      expect(res.payload).toEqual({ success: true, sourceId: "source-a", spendToDate: 100, currency: "EUR" });
      expect(env.recalcCampaignSpend).toHaveBeenCalledWith("campaign-a");
      expect(env.recomputeGA4SpendBeforeResponse).toHaveBeenCalledWith("campaign-a");
    });
  }
});
