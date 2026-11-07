import { readFileSync } from "node:fs";
import ts from "typescript";
import { z } from "zod";
import { describe, expect, it, vi } from "vitest";

// Execute the actual registered handlers and ownership guard with synthetic provider transport/storage.
const source = ts.createSourceFile("routes.ts", readFileSync("server/routes-oauth.ts", "utf8"), ts.ScriptTarget.Latest, true);
const declarations = new Map<string, string>(), routes = new Map<string, string>();
function visit(node: ts.Node) {
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) declarations.set(node.name.text, `const ${node.getText(source)};`);
  if (ts.isCallExpression(node) && ["app.get", "app.post"].includes(node.expression.getText(source)) && ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text.includes("/ga4-service-account/")) {
    routes.set(node.arguments[0].text.split("/").at(-1)!, node.arguments.at(-1)!.getText(source));
  }
  ts.forEachChild(node, visit);
}
visit(source);
const bind = (code: string, env: Record<string, any>) => new Function(...Object.keys(env), ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText)(...Object.values(env));
function fixture(options: { status?: string; selfService?: boolean; googleStatus?: number; prepared?: boolean; connections?: any[] } = {}) {
  const effects: string[] = [], connections = structuredClone(options.connections || []);
  const binding = { id: "binding-a", ownerId: "owner-a", clientId: "client-a", propertyId: "542352127", googleUniqueId: "111", email: "acme-542352127@fixture-project.iam.gserviceaccount.com", verifiedAt: null as Date | null };
  const storage = {
    getCampaign: vi.fn(async (id: string) => ["a", "b"].includes(id) ? { id, ownerId: `owner-${id}`, clientId: `client-${id}`, status: options.status || "draft", reportingTimeZone: "Europe/Amsterdam" } : undefined),
    getGA4Connections: vi.fn(async () => connections),
    reserveGA4ClientServiceAccount: vi.fn(async () => { effects.push("reserve"); return binding; }),
    completeGA4ClientServiceAccount: vi.fn(async (_c, _p, _b, _g, _o, verified) => { effects.push(verified ? "verify" : "prepare"); if (verified) binding.verifiedAt = new Date(); return binding; }),
    getGA4ClientServiceAccount: vi.fn(async (_id, property) => options.prepared === false || property !== binding.propertyId ? undefined : binding),
    assertServiceAccountResourceAccess: vi.fn(async () => { effects.push("legacy-grant"); }),
    withGA4PropertyRequest: async (_id: string, signal: AbortSignal, operation: any) => operation(signal),
    createGA4Connection: vi.fn(async (data: any) => { effects.push("create"); const value = { ...data, id: "connection-a" }; connections.push(value); return value; }),
    updateGA4Connection: vi.fn(async (id, data) => { effects.push("update"); Object.assign(connections.find(c => c.id === id), data); return connections.find(c => c.id === id); }),
    setPrimaryGA4Connection: vi.fn(async () => true),
  };
  const request = vi.fn(async () => { effects.push("google-read"); return new Response("{}", { status: options.googleStatus || 200 }); });
  const env: Record<string, any> = {
    z, storage, fetch: request, AbortSignal,
    getAuth: (req: any) => ({ userId: req.actor }), isInternalAutoRefreshRequest: () => false,
    getGA4ServiceAccountPublicStatus: () => ({ enabled: true, email: null, selfService: true }),
    getGA4ServiceAccountConfig: () => ({ email: "existing@fixture.invalid", allowedPropertyIds: new Set(["542352127"]) }),
    isGA4ClientServiceAccountSetupEnabled: () => options.selfService !== false,
    normalizeGA4ServiceAccountPropertyId: (id: any) => String(id || "").trim().replace(/^properties\//i, ""),
    assertGA4ServiceAccountPropertyAllowed: (id: string) => id,
    getGA4ServiceAccountAccessToken: vi.fn(async () => { effects.push("legacy-token"); return { accessToken: "legacy-token" }; }),
    getGA4ClientServiceAccountAccessToken: vi.fn(async () => { effects.push("client-token"); return { accessToken: "client-token" }; }),
    provisionGA4ClientServiceAccount: vi.fn(async () => { effects.push("provision"); return "111"; }),
    getGA4HistoricalImportStartDate: () => "2026-10-08",
    GA4_SERVICE_ACCOUNT_METHOD: "service_account",
  };
  for (const name of ["campaignIdSchema", "getActorId", "ensureCampaignAccess"]) env[name] = bind(declarations.get(name)! + `\nreturn ${name};`, env);
  const handlers = Object.fromEntries([...routes].map(([name, code]) => [name, bind(`return (${code});`, env)]));
  const call = async (route: string, body: any = { propertyId: "542352127", lookbackDays: 30 }, actor = "owner-a", campaignId = "a") => {
    const result: any = { status: 200 };
    const res = { status(status: number) { result.status = status; return this; }, json(body: any) { result.body = body; return this; } };
    await handlers[route]({ params: { id: campaignId }, body, actor }, res); return result;
  };
  return { call, effects, connections, storage, env, request, binding };
}

describe("automatic GA4 connection request boundaries", () => {
  for (const route of ["status", "prepare", "connect"]) it.each([["", 401], ["owner-b", 404]])(`${route} rejects actor %s before provider access`, async (actor, status) => {
    const f = fixture(); expect((await f.call(route, undefined, String(actor))).status).toBe(status);
    expect(f.effects).toEqual([]); expect(f.request).not.toHaveBeenCalled();
  });
  it("prepares the exact owner's property without granting access or creating a campaign connection", async () => {
    const f = fixture(); const r = await f.call("prepare");
    expect(r.body).toEqual({ success: true, propertyId: "542352127", email: f.binding.email });
    expect(f.storage.reserveGA4ClientServiceAccount).toHaveBeenCalledWith("a", "542352127", "owner-a");
    expect(f.effects).toEqual(["reserve", "provision", "prepare"]); expect(f.connections).toEqual([]);
  });
  it.each(["active", "deleted"])("never prepares or connects an existing %s campaign", async status => {
    const f = fixture({ status }); expect((await f.call("prepare")).status).toBe(409); expect((await f.call("connect")).status).toBe(409);
    expect(f.effects).toEqual([]);
  });
  it("refuses an unprepared or different property", async () => {
    const f = fixture({ prepared: false }); expect((await f.call("connect")).status).toBe(409); expect(f.effects).toEqual([]);
    const g = fixture(); expect((await g.call("connect", { propertyId: "999", lookbackDays: 30 })).status).toBe(409); expect(g.effects).toEqual([]);
  });
  it.each([403, 429, 500])("does not save grants or connections when Google returns %s", async googleStatus => {
    const f = fixture({ googleStatus }); expect((await f.call("connect")).status).toBe(googleStatus === 403 ? 403 : 502);
    expect(f.effects).toEqual(["client-token", "google-read"]); expect(f.binding.verifiedAt).toBeNull(); expect(f.connections).toEqual([]);
  });
  it("checks Google as the dedicated account before verification and save, without changing legacy grants", async () => {
    const f = fixture(); expect((await f.call("connect")).status).toBe(200);
    expect(f.effects).toEqual(["client-token", "google-read", "verify", "create"]);
    expect(f.connections[0]).toMatchObject({ campaignId: "a", propertyId: "542352127", method: "service_account", serviceAccountBindingId: "binding-a", lookbackDays: 30 });
    expect(f.request.mock.calls[0][0]).toBe("https://analyticsdata.googleapis.com/v1beta/properties/542352127:runReport");
    expect(f.request.mock.calls[0][1].headers.Authorization).toBe("Bearer client-token");
    expect(f.storage.completeGA4ClientServiceAccount).toHaveBeenCalledWith("a", "542352127", "binding-a", "111", "owner-a", true);
    expect(f.storage.assertServiceAccountResourceAccess).not.toHaveBeenCalled();
  });
  it("leaves an existing OAuth connection untouched", async () => {
    const old = { id: "old", method: "access_token", propertyId: "542352127", accessToken: "original" };
    const f = fixture({ connections: [old] });
    expect((await f.call("prepare")).status).toBe(409); expect((await f.call("connect")).status).toBe(409);
    expect(f.effects).toEqual([]); expect(f.connections).toEqual([old]);
  });
  it("preserves the old shared-account path and does not silently migrate an existing connection", async () => {
    const f = fixture({ connections: [{ id: "old", method: "service_account", propertyId: "542352127" }] });
    expect((await f.call("status")).body).toEqual({ success: true, enabled: true, email: "existing@fixture.invalid" });
    expect((await f.call("prepare")).status).toBe(409); expect((await f.call("connect")).status).toBe(200);
    expect(f.effects).toEqual(["legacy-grant", "legacy-token", "google-read", "update"]);
    expect(f.connections[0].serviceAccountBindingId).toBeUndefined();
  });
  it("does not provision when disabled or with malformed input", async () => {
    const f = fixture({ selfService: false }); expect((await f.call("prepare")).status).toBe(503); expect(f.effects).toEqual([]);
    const g = fixture(); expect((await g.call("prepare", { propertyId: "1/2" })).status).toBe(400); expect(g.effects).toEqual([]);
  });
  it("never falls back to shared credentials for an existing dedicated account when new setup is disabled", async () => {
    const original = { id: "dedicated", method: "service_account", propertyId: "542352127", serviceAccountBindingId: "binding-a" };
    const f = fixture({ selfService: false, connections: [original] });
    expect((await f.call("status")).body).toEqual({ success: true, enabled: false, email: null });
    expect((await f.call("connect")).status).toBe(503);
    expect(f.effects).toEqual([]); expect(f.connections).toEqual([original]);
  });
  it("does not expose raw provider or database errors during preparation", async () => {
    const f = fixture(); f.storage.reserveGA4ClientServiceAccount.mockRejectedValueOnce(new Error("private database details"));
    const response = await f.call("prepare");
    expect(response.status).toBe(503); expect(JSON.stringify(response)).not.toContain("private database details");
  });
});
