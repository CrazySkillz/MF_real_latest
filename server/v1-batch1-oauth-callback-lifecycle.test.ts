import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { once } from "node:events";
import express from "express";
import ts from "typescript";
import { z } from "zod";
import { describe, expect, it } from "vitest";

// Exact application callbacks over loopback HTTP. Only provider transport,
// authenticated actor and persisted fixture connections are controlled here.
// No application startup, .env, real credentials or external provider access.
const require = createRequire(import.meta.url);
const source = ts.createSourceFile("routes.ts", readFileSync("server/routes-oauth.ts", "utf8"), ts.ScriptTarget.Latest, true);
const declarations = new Map<string, string>(), callbacks = new Map<string, string>();
function visit(node: ts.Node) {
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) declarations.set(node.name.text, `const ${node.getText(source)};`);
  if (ts.isFunctionDeclaration(node) && node.name) declarations.set(node.name.text, node.getText(source));
  if (ts.isCallExpression(node) && node.expression.getText(source) === "app.get" && ts.isStringLiteral(node.arguments[0])) {
    for (const provider of ["linkedin", "meta"]) if (node.arguments[0].text === `/api/auth/${provider}/callback`) callbacks.set(provider, node.arguments.at(-1)!.getText(source));
  }
  ts.forEachChild(node, visit);
}
visit(source);
const compile = (code: string) => ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const bind = (code: string, result: string, env: Record<string, any>) => new Function(...Object.keys(env), compile(code) + `\nreturn ${result};`)(...Object.values(env));

async function fixture(provider: "linkedin" | "meta", run: (f: any) => Promise<void>, configured = true) {
  const prefix = provider === "linkedin" ? "LinkedIn" : "Meta";
  const effects: any[] = [], errors: any[] = [], requests: string[] = [], consumed = new Set<string>();
  const records = new Map<string, any>(); records.set("campaign-b", { campaignId: "campaign-b", accessToken: "foreign-synthetic-token", adAccountName: "Untouched" });
  const processFixture = { env: { NODE_ENV: "production", APP_BASE_URL: "https://app.example.invalid", TOKEN_ENCRYPTION_KEY: configured ? "synthetic-signing-key" : "", LINKEDIN_CLIENT_ID: "synthetic-id", LINKEDIN_CLIENT_SECRET: "synthetic-secret", META_APP_ID: "synthetic-id", META_APP_SECRET: "synthetic-secret" } };
  const quiet = { log() {}, warn() {}, error() {} };
  const vault: any = {}, retry: any = {};
  new Function("exports", "require", "process", compile(readFileSync("server/utils/tokenVault.ts", "utf8")))(vault, require, processFixture);
  new Function("exports", "console", compile(readFileSync("server/utils/retry.ts", "utf8")))(retry, quiet);
  const storage = {
    getCampaign: async (id: string) => ["campaign-a", "campaign-b"].includes(id) ? { id, ownerId: id === "campaign-a" ? "owner-a" : "owner-b" } : undefined,
    getLinkedInConnection: async (id: string) => records.get(id),
    createLinkedInConnection: async (data: any) => { effects.push(["create", structuredClone(data)]); records.set(data.campaignId, structuredClone(data)); },
    updateLinkedInConnection: async (id: string, data: any) => { effects.push(["update", structuredClone(data)]); records.set(id, { ...records.get(id), ...structuredClone(data) }); },
    deleteMetaConnection: async (id: string) => { effects.push(["delete", id]); records.delete(id); },
    createMetaConnection: async (data: any) => { effects.push(["create", structuredClone(data)]); records.set(data.campaignId, structuredClone(data)); },
  };
  const env: any = {
    z, Buffer, createHmac, randomBytes, timingSafeEqual, process: processFixture, console: quiet, storage,
    resolveOAuthStateSigningSecret: vault.resolveOAuthStateSigningSecret,
    getAuth: (req: any) => ({ userId: req.headers["x-fixture-actor"] || null }), isInternalAutoRefreshRequest: () => false,
    require: (name: string) => {
      if (name === "./utils/retry") return retry;
      if (name === "./services/meta-graph-api") return { MetaGraphAPIClient: class {} };
      throw Error(`Unexpected module: ${name}`);
    },
    fetch: async (input: string, options: any = {}) => {
      const url = new URL(input); expect(["www.linkedin.com", "graph.facebook.com"]).toContain(url.hostname); requests.push(url.pathname);
      const data = options.body ? new URLSearchParams(options.body) : url.searchParams;
      if (url.pathname.endsWith("/adaccounts")) return new Response(JSON.stringify({ data: [{ id: "act_fixture", name: "Fixture", account_status: 1 }] }), { status: 200 });
      if (data.get("grant_type") === "fb_exchange_token") return new Response(JSON.stringify({ access_token: data.get("fb_exchange_token") + "-long", expires_in: 3600 }), { status: 200 });
      const code = data.get("code")!;
      if (!code?.startsWith("synthetic-code-") || consumed.has(code)) return new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 });
      consumed.add(code); return new Response(JSON.stringify({ access_token: "synthetic-token-" + code, expires_in: 3600 }), { status: 200 });
    },
  };
  for (const name of ["campaignIdSchema", "getActorId", "ensureCampaignAccess", "serializeOAuthPopupJson", "escapeOAuthPopupHtml", `${provider.toUpperCase()}_OAUTH_STATE_TTL_MS`, `sign${prefix}OAuthState`, `verify${prefix}OAuthState`]) {
    expect(declarations.has(name)).toBe(true); env[name] = bind(declarations.get(name)!, name, env);
  }
  const handler = bind(`const handler = ${callbacks.get(provider)};`, "handler", env);
  const app = express(); app.get("/callback", (req, res) => { Promise.resolve(handler(req, res)).catch(error => { errors.push(error.code || error.message); if (!res.headersSent) res.status(500).end(); }); });
  const server = app.listen(0, "127.0.0.1"); await once(server, "listening");
  const address = server.address() as { port: number };
  const call = async (state: string, actor: string | null = "owner-a", code = "synthetic-code-first") => {
    const response = await fetch(`http://127.0.0.1:${address.port}/callback?${new URLSearchParams({ code, state })}`, { headers: actor ? { "x-fixture-actor": actor } : {} });
    const body = await response.text(); await new Promise(resolve => setImmediate(resolve)); return { status: response.status, body };
  };
  try { await run({ call, sign: env[`sign${prefix}OAuthState`], verify: env[`verify${prefix}OAuthState`], effects, errors, requests, records, processFixture }); }
  finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
}

describe("Batch 1 callback session and replay propagation", () => {
  for (const provider of ["linkedin", "meta"] as const) {
    for (const [actor, status] of [[null, 401], ["owner-b", 404]] as const) it(`${provider} sends one denial for ${actor || "signed-out"} without provider access`, async () => {
      await fixture(provider, async f => {
        const response = await f.call(f.sign("campaign-a"), actor);
        expect(response.status).toBe(status); expect(JSON.parse(response.body).success).toBe(false);
        expect(f.requests).toEqual([]); expect(f.effects).toEqual([]); expect(f.errors).toEqual([]);
      });
    });
    it(`${provider} preserves a successful connection when the same authorization code is rejected on replay`, async () => {
      await fixture(provider, async f => {
        const state = f.sign("campaign-a", true);
        expect((await f.call(state)).body).toContain(`${provider}_auth_success`);
        const saved = structuredClone([...f.records]), writes = f.effects.length, reads = f.requests.length;
        const response = await f.call(state);
        expect(response.body).toContain(`${provider}_auth_error`); expect(response.body).not.toContain(`${provider}_auth_success`);
        expect(f.requests.length).toBe(reads + 1); expect(f.effects.length).toBe(writes); expect([...f.records]).toEqual(saved); expect(f.errors).toEqual([]);
      });
    });
    it(`${provider} accepts a fresh reconnect code for the same owned campaign and preserves the foreign connection`, async () => {
      await fixture(provider, async f => {
        await f.call(f.sign("campaign-a")); const first = f.records.get("campaign-a").accessToken, foreign = structuredClone(f.records.get("campaign-b"));
        expect((await f.call(f.sign("campaign-a"), "owner-a", "synthetic-code-reconnect")).body).toContain(`${provider}_auth_success`);
        expect(f.records.get("campaign-a").accessToken).not.toBe(first); expect(f.records.get("campaign-b")).toEqual(foreign); expect(f.errors).toEqual([]);
      });
    });
    it(`${provider} rejects a tampered signed state before provider or persistence work`, async () => {
      await fixture(provider, async f => {
        const state = f.sign("campaign-a"), changed = (state[0] === "a" ? "b" : "a") + state.slice(1);
        expect((await f.call(changed)).body).toContain(`${provider}_auth_error`); expect(f.requests).toEqual([]); expect(f.effects).toEqual([]); expect(f.errors).toEqual([]);
      });
    });
    it(`${provider} fails closed without a production state secret`, async () => {
      await fixture(provider, async f => {
        expect(() => f.sign("campaign-a")).toThrow("not configured"); expect(() => f.verify("a.b")).toThrow("not configured");
        expect((await f.call("a.b")).body).toContain(`${provider}_auth_error`); expect(f.requests).toEqual([]); expect(f.effects).toEqual([]);
      }, false);
    });
  }
});
