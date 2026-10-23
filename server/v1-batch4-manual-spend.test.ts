import { readFileSync } from "node:fs";
import ts from "typescript";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { getTableColumns, getTableName, SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import * as schema from "../shared/schema";
import { z } from "zod";
import { isSupportedGa4CsvRevenueAmount } from "./utils/csv";
import { buildGA4GoogleAdsSpendMaterialization } from "./ga4-google-ads-spend";
import { isSupportedGoogleAdsSpendConnectionMethod } from "./utils/google-ads-service-account";

const database = vi.hoisted(() => ({ current: null as any }));
vi.mock("./db", () => ({ get db() { return database.current; }, pool: null }));
import { DatabaseStorage } from "./storage";

const ast = ts.createSourceFile("routes.ts", readFileSync(new URL("./routes-oauth.ts", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true);
function extract(predicate: (n: ts.Node) => boolean) {
  let found = "";
  function visit(n: ts.Node) { if (!found && predicate(n)) found = n.getText(ast); ts.forEachChild(n, visit); }
  visit(ast); if (!found) throw new Error("Missing implementation"); return found;
}
const helpers = ["spendSourceTypeForPlatformContext", "spendSourceMatchesPlatformContext"].map(name =>
  `const ${extract(n => ts.isVariableDeclaration(n) && n.name.getText(ast) === name)};`).join("\n");
const parseNum = `const ${extract(n => ts.isVariableDeclaration(n) && n.name.getText(ast) === "parseNum" && n.getText(ast).includes("String(val).replace"))};`;
const route = extract(n => ts.isCallExpression(n) && n.expression.getText(ast) === "app.post" && ts.isStringLiteral(n.arguments[0]) && n.arguments[0].text === "/api/campaigns/:id/spend/process/manual");
const code = ts.transpileModule(`${helpers}\n${parseNum}\n${route}`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;

// Actual registered route and helpers, with auth/persistence boundaries replaced by isolated fixtures.
function manualFixture(persistence?: any) {
  const campaign = { id: "a", ownerId: "owner", currency: "EUR", startDate: "2026-10-01", reportingTimeZone: "Europe/Amsterdam" };
  const saved: any = { id: "source-a", campaignId: "a", sourceType: "manual", platformContext: "linkedin", displayName: "Manual entry", isActive: true, mappingConfig: '{"amount":20,"currency":"EUR"}' };
  const replace = vi.fn(async (...args: any[]) => persistence ? persistence(...args) : { ...saved, ...args[4] });
  const storage: any = { replaceSpendSourceWithRecords: replace, getSpendSource: vi.fn(async () => saved), getSpendSources: vi.fn(async () => []),
    createSpendSource: vi.fn(async () => saved), updateSpendSource: vi.fn(async () => saved), createSpendRecords: vi.fn(), deleteSpendRecordsBySource: vi.fn(),
    getGA4GoogleAdsSpendConnection: vi.fn(async () => ({ spendOnly: true, method: "oauth", customerName: "Fixture", lastRefreshAt: new Date("2026-10-22") })),
    getGoogleAdsConnection: vi.fn(), getGA4GoogleAdsSpendDailyMetrics: vi.fn(async () => [
      { googleCampaignId: "ad-a", googleCampaignName: "Selected", date: "2026-10-21", spend: "12.34", currency: "EUR" },
      { googleCampaignId: "ad-other", googleCampaignName: "Other", date: "2026-10-21", spend: "900.00", currency: "EUR" },
    ]) };
  const recalc = vi.fn(), recompute = vi.fn(); let handler: any;
  const access = vi.fn(async (_req: any, _res: any, _id: string): Promise<any> => campaign);
  const deps: any = { app: { post: (_path: string, fn: any) => { handler = fn; } }, storage, z, isSupportedGa4CsvRevenueAmount,
    ensureCampaignAccess: access, recalcCampaignSpend: recalc, recomputeGA4SpendBeforeResponse: recompute,
    buildGA4GoogleAdsSpendMaterialization, isSupportedGoogleAdsSpendConnectionMethod, getReportingDateWindow: () => ({ endDate: "2026-10-21" }),
    console: { warn: vi.fn(), error: vi.fn() } };
  new Function(...Object.keys(deps), code)(...Object.values(deps));
  async function invoke(body: any = {}) {
    const res: any = { statusCode: 200, status(n: number) { this.statusCode = n; return this; }, json(value: any) { this.body = value; return this; } };
    await handler({ params: { id: "a" }, body: { platformContext: "linkedin", amount: "100", ...body } }, res); return res;
  }
  return { invoke, storage, replace, saved, campaign, access, recalc, recompute };
}

describe("V1-068 Manual Spend validation and truthful outcomes", () => {
  it.each(["csv", "google_sheets", "custom", "connector_derived", "arbitrary"])("rejects disguised source %s without writes", async sourceType => {
    for (const platformContext of ["ga4", "linkedin", "instagram"]) {
      const f = manualFixture(); expect((await f.invoke({ sourceType, platformContext })).statusCode).toBe(400);
      expect(f.replace).not.toHaveBeenCalled(); expect(f.storage.createSpendSource).not.toHaveBeenCalled();
    }
  });
  it.each(["ga4", " GA4 ", undefined, null, ""])("keeps the GA4 manual block for %j", async platformContext => {
    const f = manualFixture(); expect((await f.invoke({ platformContext })).statusCode).toBe(400); expect(f.replace).not.toHaveBeenCalled();
  });
  it.each(["100oops", "1,23", "1e3", "0x10", "1.234", "-1", "0", "", null, true, [100], {}, "Infinity", "NaN", "100000000", "$100"])("rejects invalid EUR amount %j before writes", async amount => {
    const f = manualFixture(); expect((await f.invoke({ amount })).statusCode).toBe(400);
    expect(f.replace).not.toHaveBeenCalled(); expect(f.storage.createSpendSource).not.toHaveBeenCalled();
  });
  it.each(["100", "1,234.56", 0.01, "99999999.99"])("saves exact amount %j using one atomic replacement", async amount => {
    const f = manualFixture(), r = await f.invoke({ amount }); expect(r.statusCode).toBe(200); expect(r.body.success).toBe(true);
    expect(f.replace).toHaveBeenCalledTimes(1); const args = f.replace.mock.calls[0];
    expect(args[5][0].spend).toBe(Number(String(amount).replace(/,/g, "")).toFixed(2));
    expect(args[4].sourceType).toBe("manual"); expect(args[4].platformContext).toBe("linkedin"); expect(args[4].currency).toBe("EUR");
    expect(f.storage.createSpendSource).not.toHaveBeenCalled(); expect(f.storage.deleteSpendRecordsBySource).not.toHaveBeenCalled();
    expect(f.recalc).toHaveBeenCalledWith("a"); expect(f.recompute).toHaveBeenCalledWith("a");
  });
  it("accepts USD-formatted amounts only for USD campaigns", async () => {
    const f = manualFixture(); f.campaign.currency = "USD";
    expect((await f.invoke({ amount: "$1,234.56", currency: "USD" })).body.spendToDate).toBe(1234.56);
  });
  it.each([{ currency: "USD" }, { currency: ["EUR"] }, { platformContext: "unknown" }, { sourceId: [] }, { sourceId: "" }, { mappingConfig: [] }])("rejects malformed scope/config %j", async body => {
    const f = manualFixture(); expect((await f.invoke(body)).statusCode).toBe(400); expect(f.replace).not.toHaveBeenCalled();
  });
  it("does not save after access denial", async () => {
    const f = manualFixture(); f.access.mockImplementation(async (_req, res) => { res.status(403).json({ error: "Forbidden" }); return null; });
    expect((await f.invoke()).statusCode).toBe(403); expect(f.replace).not.toHaveBeenCalled();
  });
  it.each([null, { sourceType: "csv" }, { platformContext: "ga4" }, { isActive: false }])("rejects absent, wrong-type, wrong-context or inactive edit %j", async change => {
    const f = manualFixture(); f.storage.getSpendSource.mockResolvedValue(change ? { ...f.saved, ...change } : null);
    expect((await f.invoke({ sourceId: "source-a" })).statusCode).toBe(404); expect(f.replace).not.toHaveBeenCalled();
  });
  it("preserves exact source identity and supplies a stale-edit guard", async () => {
    const f = manualFixture(); expect((await f.invoke({ sourceId: "source-a" })).statusCode).toBe(200);
    expect(f.replace.mock.calls[0].slice(0, 4)).toEqual(["a", "source-a", "manual", "linkedin"]);
    expect(f.replace.mock.calls[0][6]).toBe(f.saved.mappingConfig);
  });
  it("reports persistence failure without recomputing or claiming success", async () => {
    const f = manualFixture(); f.replace.mockRejectedValue(new Error("isolated insert failure"));
    f.storage.createSpendRecords.mockRejectedValue(new Error("isolated insert failure"));
    const r = await f.invoke(); expect(r.statusCode).toBe(500); expect(r.body.success).toBe(false); expect(f.recalc).not.toHaveBeenCalled();
  });
  it.each(["recalc", "recompute"] as const)("distinguishes saved source from %s failure", async stage => {
    const f = manualFixture(); f[stage].mockRejectedValue(new Error("isolated refresh failure"));
    const r = await f.invoke(); expect(r.statusCode).toBe(503); expect(r.body.success).toBe(false); expect(r.body.spendSaved).toBe(true);
    expect(r.body.sourceId).toBe("source-a"); expect(r.body.error).toContain("Reload before retrying");
  });
  it("preserves Instagram's existing manual source classification", async () => {
    const f = manualFixture(); expect((await f.invoke({ platformContext: "instagram" })).statusCode).toBe(200);
    expect(f.replace.mock.calls[0][2]).toBe("instagram_api");
  });
  it("ignores caller totals for GA4 Google Ads and materializes only selected server rows", async () => {
    const f = manualFixture(); const r = await f.invoke({ platformContext: " GA4 ", sourceType: "ad_platforms", amount: "invented", displayName: "Disguised", mappingConfig: { platform: "google_ads", selectedCampaignIds: ["ad-a"] } });
    expect(r.statusCode, JSON.stringify(r.body)).toBe(200); expect(r.body.spendToDate).toBe(12.34);
    expect(f.replace.mock.calls[0][4].displayName).toBe("Google Ads"); expect(f.replace.mock.calls[0][5]).toHaveLength(1);
  });
  it("rejects GA4 non-Google-Ads labels before source publication", async () => {
    for (const sourceType of ["manual", "linkedin_api", "instagram_api", "ad_platforms"]) {
      const f = manualFixture(); expect((await f.invoke({ platformContext: "ga4", sourceType, mappingConfig: { platform: "meta" } })).statusCode).toBe(400);
      expect(f.replace).not.toHaveBeenCalled();
    }
  });
  it("rejects an ad-platform edit aimed at another provider's source", async () => {
    const f = manualFixture(); Object.assign(f.saved, { sourceType: "ad_platforms", displayName: "Meta Ads" });
    expect((await f.invoke({ sourceId: "source-a", sourceType: "ad_platforms", displayName: "Google Ads", mappingConfig: { platform: "google_ads" } })).statusCode).toBe(404);
    expect(f.replace).not.toHaveBeenCalled();
  });
  it.each(["meta", "google_ads"])("retains the non-GA4 %s caller contract and exact source identity", async platform => {
    const f = manualFixture(), displayName = platform === "meta" ? "Meta Ads" : "Google Ads";
    Object.assign(f.saved, { sourceType: "ad_platforms", displayName });
    const r = await f.invoke({ sourceId: "source-a", sourceType: "ad_platforms", displayName, mappingConfig: { platform, selectedCampaignIds: ["ad-a"] } });
    expect(r.statusCode).toBe(200); expect(f.replace.mock.calls[0].slice(0, 4)).toEqual(["a", "source-a", "ad_platforms", "linkedin"]);
  });
  it("retains the explicit non-GA4 LinkedIn demo caller but blocks relabelled live imports", async () => {
    const f = manualFixture();
    expect((await f.invoke({ sourceType: "linkedin_api", displayName: "LinkedIn Ads", mappingConfig: { platform: "linkedin", testMode: true } })).statusCode).toBe(200);
    expect((await f.invoke({ sourceType: "linkedin_api", mappingConfig: { platform: "linkedin", testMode: false } })).statusCode).toBe(400);
    expect(f.replace).toHaveBeenCalledTimes(1);
  });
  it("rejects a missing Google Ads connection, missing selection, stale edit and duplicate add", async () => {
    const body = { platformContext: "ga4", sourceType: "ad_platforms", displayName: "Google Ads", mappingConfig: { platform: "google_ads", selectedCampaignIds: ["ad-a"] } };
    const missing = manualFixture(); missing.storage.getGA4GoogleAdsSpendConnection.mockResolvedValue(null);
    expect((await missing.invoke(body)).statusCode).toBe(400); expect(missing.replace).not.toHaveBeenCalled();
    const selection = manualFixture(); expect((await selection.invoke({ ...body, mappingConfig: { platform: "google_ads", selectedCampaignIds: [] } })).statusCode).toBe(400);
    expect(selection.replace).not.toHaveBeenCalled();
    const edit = manualFixture(); edit.storage.getSpendSource.mockResolvedValue(null);
    expect((await edit.invoke({ ...body, sourceId: "stale" })).statusCode).toBe(404); expect(edit.replace).not.toHaveBeenCalled();
    const duplicate = manualFixture(); duplicate.storage.getSpendSources.mockResolvedValue([{ sourceType: "ad_platforms", displayName: "Google Ads" }]);
    expect((await duplicate.invoke(body)).statusCode).toBe(409); expect(duplicate.replace).not.toHaveBeenCalled();
  });
  it("preserves Google Ads zero spend and its partial-derived-refresh response", async () => {
    const f = manualFixture(); f.storage.getGA4GoogleAdsSpendDailyMetrics.mockResolvedValue([{ googleCampaignId: "ad-a", date: "2026-10-21", spend: "0.00" }]);
    f.recompute.mockRejectedValue(new Error("isolated derived failure"));
    const r = await f.invoke({ platformContext: "ga4", sourceType: "ad_platforms", mappingConfig: { platform: "google_ads", selectedCampaignIds: ["ad-a"] } });
    expect(r.statusCode).toBe(200); expect(r.body).toMatchObject({ success: true, spendToDate: 0, derivedValuesUpdated: false });
    expect(f.replace.mock.calls[0][5][0].spend).toBe("0.00");
  });
  it("does not report a failed Google Ads source save as a partial success", async () => {
    const f = manualFixture(); f.replace.mockRejectedValue(new Error("isolated write failure"));
    const r = await f.invoke({ platformContext: "ga4", sourceType: "ad_platforms", mappingConfig: { platform: "google_ads", selectedCampaignIds: ["ad-a"] } });
    expect(r.statusCode).toBe(500); expect(r.body.success).toBe(false); expect(f.recalc).not.toHaveBeenCalled(); expect(f.recompute).not.toHaveBeenCalled();
  });
});

describe("V1-068 retained Manual Spend form", () => {
  const ui = ts.createSourceFile("modal.tsx", readFileSync(new URL("../client/src/components/AddSpendWizardModal.tsx", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let saveCode = "", changeCode = "", hasBlur = false;
  function visit(n: ts.Node) {
    if (ts.isVariableDeclaration(n) && n.name.getText(ui) === "processManual") saveCode = `const ${n.getText(ui)}; return processManual;`;
    if (ts.isJsxSelfClosingElement(n) && n.tagName.getText(ui) === "Input" && n.attributes.properties.some(p => ts.isJsxAttribute(p) && p.name.getText(ui) === "id" && p.initializer?.getText(ui) === '"manual-spend"')) {
      for (const p of n.attributes.properties) if (ts.isJsxAttribute(p)) {
        if (p.name.getText(ui) === "onBlur") hasBlur = true;
        if (p.name.getText(ui) === "onChange" && p.initializer && ts.isJsxExpression(p.initializer)) changeCode = `return ${p.initializer.expression!.getText(ui)};`;
      }
    }
    ts.forEachChild(n, visit);
  }
  visit(ui);
  it.each(["-100", "100oops", "1.234", "1,23", "$100"])("sends %s intact for server rejection and leaves the form open", async value => {
    expect(saveCode).not.toBe(""); expect(changeCode).not.toBe(""); expect(hasBlur).toBe(false);
    let manualAmount = "";
    new Function("setManualAmount", ts.transpileModule(changeCode, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText)((v: string) => { manualAmount = v; })({ target: { value } });
    expect(manualAmount).toBe(value);
    const f = manualFixture(), toast = vi.fn(), onProcessed = vi.fn(), onOpenChange = vi.fn();
    const deps: any = { manualAmount, isEditing: false, setIsProcessing: vi.fn(), toast,
      props: { campaignId: "a", currency: "EUR", platformContext: "linkedin", onProcessed, onOpenChange },
      fetch: vi.fn(async (_url: string, options: any) => {
        const body = JSON.parse(options.body); expect(body.amount).toBe(value);
        const response = await f.invoke(body); return { ok: response.statusCode === 200, json: async () => response.body };
      }) };
    await new Function(...Object.keys(deps), ts.transpileModule(saveCode, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText)(...Object.values(deps))();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Save failed", variant: "destructive" }));
    expect(onProcessed).not.toHaveBeenCalled(); expect(onOpenChange).not.toHaveBeenCalled(); expect(f.replace).not.toHaveBeenCalled();
  });
});

const testUrl = String(process.env.GA4_TEST_DATABASE_URL || "").trim();
if (testUrl) {
  const url = new URL(testUrl);
  if (!["postgres:", "postgresql:"].includes(url.protocol) || url.hostname !== "127.0.0.1"
    || url.pathname !== "/ga4_alignment_test" || url.search || process.env.DATABASE_URL) {
    throw new Error("Manual Spend PostgreSQL tests require 127.0.0.1/ga4_alignment_test and no DATABASE_URL");
  }
}
const schemaName = `manual_spend_it_${randomUUID().replace(/-/g, "")}`;
const tables = [schema.campaigns, schema.spendSources, schema.spendRecords];
const realStorage = new DatabaseStorage();
let admin: Pool, pool: Pool, created = false;
describe.skipIf(!testUrl)("V1-068 real PostgreSQL publication and rollback", () => {
  beforeAll(async () => {
    admin = new Pool({ connectionString: testUrl, max: 2 });
    await admin.query(`CREATE SCHEMA "${schemaName}"`); created = true;
    pool = new Pool({ connectionString: testUrl, options: `-c search_path=${schemaName}`, application_name: schemaName, max: 4 });
    database.current = drizzle(pool, { schema });
    const dialect = new PgDialect();
    for (const table of tables) {
      const columns = Object.values(getTableColumns(table)).map((column: any) => {
        const value = column.default;
        const defaultSql = value instanceof SQL ? dialect.sqlToQuery(value).sql
          : typeof value === "string" ? `'${value.replace(/'/g, "''")}'` : String(value);
        return `"${column.name}" ${column.getSQLType()}${column.notNull ? " NOT NULL" : ""}${value !== undefined ? ` DEFAULT ${defaultSql}` : ""}${column.primary ? " PRIMARY KEY" : ""}`;
      });
      await pool.query(`CREATE TABLE "${getTableName(table)}" (${columns.join(", ")})`);
    }
  });
  afterAll(async () => { await pool?.end(); if (created) await admin.query(`DROP SCHEMA "${schemaName}" CASCADE`); await admin?.end(); });
  beforeEach(async () => {
    for (const table of [...tables].reverse()) await pool.query(`DELETE FROM "${getTableName(table)}"`);
    for (const id of ["a", "other"]) {
      await database.current.insert(schema.campaigns).values({ id, ownerId: id, name: id, status: "active", currency: "EUR" });
      await database.current.insert(schema.spendSources).values({ id: `source-${id}`, campaignId: id, sourceType: "manual", platformContext: "linkedin", currency: "EUR", mappingConfig: '{"amount":20,"currency":"EUR"}' });
      await database.current.insert(schema.spendRecords).values({ id: `record-${id}`, campaignId: id, spendSourceId: `source-${id}`, date: "2026-10-01", spend: "20.00", currency: "EUR", sourceType: "manual" });
    }
  });
  const snapshot = async () => ({ sources: (await pool.query("SELECT * FROM spend_sources ORDER BY id")).rows, records: (await pool.query("SELECT * FROM spend_records ORDER BY id")).rows });
  function persistedFixture() {
    const f = manualFixture(realStorage.replaceSpendSourceWithRecords.bind(realStorage));
    f.storage.getSpendSource.mockImplementation(realStorage.getSpendSource.bind(realStorage));
    f.storage.getSpendSources.mockImplementation(realStorage.getSpendSources.bind(realStorage));
    for (const name of ["getCampaign", "getSpendBreakdownBySource", "updateCampaign"] as const) f.storage[name] = realStorage[name].bind(realStorage);
    const recalcCode = `${parseNum}\nconst ${extract(n => ts.isVariableDeclaration(n) && n.name.getText(ast) === "recalcCampaignSpend")};\nreturn recalcCampaignSpend;`;
    f.recalc.mockImplementation(new Function("storage", ts.transpileModule(recalcCode, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText)(f.storage));
    return f;
  }
  it("publishes exact cents, reconciles campaign spend, and preserves another campaign", async () => {
    const before = await snapshot(), f = persistedFixture();
    const r = await f.invoke({ sourceId: "source-a", amount: "1,234.56", subCampaignUrn: "ad-a" });
    expect(r.statusCode, JSON.stringify(r.body)).toBe(200);
    const after = await snapshot();
    expect(after.sources.find(s => s.id === "source-other")).toEqual(before.sources.find(s => s.id === "source-other"));
    expect(after.records.find(s => s.id === "record-other")).toEqual(before.records.find(s => s.id === "record-other"));
    expect(after.records.filter(s => s.campaign_id === "a").map(s => [s.spend, s.sub_campaign_urn])).toEqual([["1234.56", "ad-a"]]);
    expect((await realStorage.getCampaign("a"))?.spend).toBe("1234.56");
    expect((await realStorage.getSpendSources("a", "linkedin"))[0].id).toBe("source-a");
    expect((await realStorage.getSpendTotalForRange("a", "1900-01-01", "2099-01-01", "linkedin")).totalSpend).toBe(1234.56);
  });
  it.each(["add", "edit"])("rolls back %s source publication when record insertion fails", async mode => {
    const before = await snapshot(), f = persistedFixture();
    await pool.query("ALTER TABLE spend_records ADD CONSTRAINT fixture_insert_failure CHECK (spend < 50)");
    try {
      const r = await f.invoke(mode === "edit" ? { sourceId: "source-a" } : {});
      expect(r.statusCode).toBe(500); expect(r.body.success).toBe(false); expect(f.recalc).not.toHaveBeenCalled(); expect(await snapshot()).toEqual(before);
    } finally { await pool.query("ALTER TABLE spend_records DROP CONSTRAINT fixture_insert_failure"); }
  });
  it("rolls back an edited source when deleting its old rows fails", async () => {
    const before = await snapshot(), f = persistedFixture();
    await pool.query("CREATE FUNCTION fixture_delete_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'isolated delete failure'; END $$");
    await pool.query("CREATE TRIGGER fixture_delete_failure BEFORE DELETE ON spend_records FOR EACH ROW EXECUTE FUNCTION fixture_delete_failure()");
    try {
      expect((await f.invoke({ sourceId: "source-a" })).statusCode).toBe(500); expect(await snapshot()).toEqual(before);
    } finally { await pool.query("DROP TRIGGER fixture_delete_failure ON spend_records"); await pool.query("DROP FUNCTION fixture_delete_failure()"); }
  });
  it.each([{ sourceId: "source-other" }, { sourceId: "missing" }, { sourceId: "source-a", platformContext: "google_sheets" }])("rejects real source boundary mismatch %j", async body => {
    const before = await snapshot(); expect((await persistedFixture().invoke(body)).statusCode).toBe(404); expect(await snapshot()).toEqual(before);
  });
  it("rejects a concurrently changed mapping without losing the new values", async () => {
    const f = persistedFixture();
    f.replace.mockImplementation(async (...args: any[]) => {
      await pool.query("UPDATE spend_sources SET mapping_config=$1 WHERE id='source-a'", ['{"amount":20,"currency":"EUR","changed":true}']);
      return (realStorage.replaceSpendSourceWithRecords as any)(...args);
    });
    const records = (await snapshot()).records;
    expect((await f.invoke({ sourceId: "source-a" })).statusCode).toBe(409);
    expect((await snapshot()).records).toEqual(records); expect((await realStorage.getSpendSource("a", "source-a"))?.mappingConfig).toContain('"changed":true');
  });
  it("serializes simultaneous replacements from one saved mapping; only one succeeds", async () => {
    const mapping = (await realStorage.getSpendSource("a", "source-a"))!.mappingConfig;
    const write = (amount: number) => realStorage.replaceSpendSourceWithRecords("a", "source-a", "manual", "linkedin", {
      campaignId: "a", sourceType: "manual", platformContext: "linkedin", currency: "EUR", mappingConfig: JSON.stringify({ amount }),
    }, [{ campaignId: "a", date: "2026-10-22", spend: amount.toFixed(2), currency: "EUR" }], mapping);
    const outcomes = await Promise.allSettled([write(100), write(200)]);
    expect(outcomes.filter(r => r.status === "fulfilled")).toHaveLength(1);
    const source = (await realStorage.getSpendSource("a", "source-a"))!;
    const rows = (await snapshot()).records.filter(r => r.campaign_id === "a"); expect(rows).toHaveLength(1);
    expect(Number(rows[0].spend)).toBe(JSON.parse(source.mappingConfig!).amount);
  });
});
