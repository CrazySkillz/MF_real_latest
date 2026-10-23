import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

const routes = ts.createSourceFile("routes.ts", readFileSync(new URL("./routes-oauth.ts", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true);
const families = ["ga4", "google-sheets", "linkedin", "meta"] as const;
function extractRoute(family: string) {
  let code = "";
  function visit(n: ts.Node) {
    if (ts.isCallExpression(n) && n.expression.getText(routes) === "app.post" && ts.isStringLiteral(n.arguments[0]) && n.arguments[0].text === `/api/${family}/transfer-connection`) code = n.getText(routes);
    ts.forEachChild(n, visit);
  }
  visit(routes); if (!code) throw new Error("Missing route");
  return ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
}
const codes = Object.fromEntries(families.map(f => [f, extractRoute(f)]));
function fixture(family: typeof families[number]) {
  const transfer = vi.fn(async () => ({ connectionId: "original-id" }));
  const legacyWrite = vi.fn(async () => ({ id: "replacement-id" }));
  const existing = { id: "original-id", isPrimary: true, method: "service_account", propertyId: "123", spreadsheetId: "sheet", sheetName: "Selected", campaignId: "a" };
  const storage: any = { transferCampaignConnection: transfer, getGA4Connections: async () => [existing], getGoogleSheetsConnection: async () => existing,
    getLinkedInConnection: async () => existing, getMetaConnection: async () => existing, getCampaignLinkedInImportSessions: async () => [],
    createGA4Connection: legacyWrite, setPrimaryGA4Connection: legacyWrite, deleteGA4Connection: legacyWrite,
    createGoogleSheetsConnection: legacyWrite, deleteGoogleSheetsConnection: legacyWrite, createLinkedInConnection: legacyWrite, deleteLinkedInConnection: legacyWrite,
    createMetaConnection: legacyWrite, deleteMetaConnection: legacyWrite };
  const access = vi.fn(async (_req: any, _res: any, id: string): Promise<any> => ({ id, ownerId: "owner", clientId: "client", status: "draft" }));
  let handler: any;
  const deps = { app: { post: (_path: string, fn: any) => { handler = fn; } }, storage, ensureCampaignAccess: access, z, console: { log: vi.fn(), error: vi.fn() } };
  new Function(...Object.keys(deps), codes[family])(...Object.values(deps));
  async function invoke(body: any = { fromCampaignId: "a", toCampaignId: "b" }) {
    const res: any = { statusCode: 200, status(code: number) { this.statusCode = code; return this; }, json(value: any) { this.body = value; return this; } };
    await handler({ body }, res); return res;
  }
  return { invoke, transfer, legacyWrite, access };
}

describe.each(families)("V1-069 retained %s transfer route", family => {
  it.each([{ fromCampaignId: "a", toCampaignId: "a" }, { fromCampaignId: " a ", toCampaignId: "a" }, {},
    { fromCampaignId: [], toCampaignId: "b" }, { fromCampaignId: "a", toCampaignId: " " }, { fromCampaignId: "a", toCampaignId: {} }])("rejects invalid/same-campaign input %j before writes", async body => {
    const f = fixture(family), result = await f.invoke(body);
    expect(result.statusCode).toBe(400); expect(f.transfer).not.toHaveBeenCalled(); expect(f.legacyWrite).not.toHaveBeenCalled();
  });
  it.each(["a", "b"])("fails closed when access to %s is denied", async denied => {
    const f = fixture(family); f.access.mockImplementation(async (_req, res, id) => id === denied ? (res.status(404).json({ error: "Not found" }), null) : { id, ownerId: "owner" });
    expect((await f.invoke()).statusCode).toBe(404); expect(f.transfer).not.toHaveBeenCalled(); expect(f.legacyWrite).not.toHaveBeenCalled();
  });
  it("delegates once after both access checks and retains the public success contract", async () => {
    const f = fixture(family), response = await f.invoke();
    expect(response.statusCode).toBe(200); expect(response.body.success).toBe(true);
    expect(f.transfer).toHaveBeenCalledExactlyOnceWith("a", "b", "owner", family === "google-sheets" ? "google_sheets" : family);
    expect(f.access.mock.calls.map(args => args[2])).toEqual(["a", "b"]);
    expect(f.access.mock.invocationCallOrder[1]).toBeLessThan(f.transfer.mock.invocationCallOrder[0]);
    expect(f.legacyWrite).not.toHaveBeenCalled();
    if (family === "ga4") expect(response.body.connectionId).toBe("original-id");
  });
  it("reports missing source without success or destructive fallback", async () => {
    const f = fixture(family); f.transfer.mockResolvedValue(undefined as any);
    expect((await f.invoke()).statusCode).toBe(404); expect(f.legacyWrite).not.toHaveBeenCalled();
  });
  it("reports transaction conflict as 409 and database failure as 500", async () => {
    const f = fixture(family); f.transfer.mockRejectedValueOnce(Object.assign(new Error("Destination already has a connection"), { code: "CONNECTION_TRANSFER_CONFLICT" }));
    const conflict = await f.invoke(); expect(conflict.statusCode).toBe(409); expect(conflict.body.success).toBe(false);
    f.transfer.mockRejectedValueOnce(new Error("isolated failure")); const failed = await f.invoke(); expect(failed.statusCode).toBe(500); expect(failed.body.success).toBe(false);
  });
});

it("does not invent a current UI transfer path", () => {
  const read = (dir: string): string => readdirSync(dir, { withFileTypes: true }).map(entry => entry.isDirectory() ? read(join(dir, entry.name)) : /\.tsx?$/.test(entry.name) ? readFileSync(join(dir, entry.name), "utf8") : "").join("\n");
  const client = read("client/src");
  for (const family of families) expect(client).not.toContain(`/api/${family}/transfer-connection`);
});
