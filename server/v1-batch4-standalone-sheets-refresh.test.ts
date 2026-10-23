import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
import { readCompleteGoogleSheetsData, hasCompleteGoogleSheetsCache } from "./utils/google-sheets-revenue-ranges";
import { buildGoogleSheetsPlatformSourceForAggregate } from "./utils/google-sheets-aggregate-source";

const conn = () => ({ id: "sheet-a", campaignId: "a", spreadsheetId: "book", sheetName: "O'Brien", accessToken: "fixture-token", purpose: "general", isActive: true });
function provider(size = 6001, width = 30, options: any = {}) {
  let metadataReads = 0;
  const all = [Array.from({ length: width }, (_, i) => i === 0 ? "Campaign Name" : `Metric ${i}`), ...Array.from({ length: size - 1 }, (_, i) => ["A", ...Array.from({ length: width - 1 }, () => i + 1)])];
  const fetch = vi.fn(async (url: any) => {
    const decoded = decodeURIComponent(String(url));
    if (decoded.includes("/values/")) {
      const [_, start, end] = decoded.match(/!(\d+):(\d+)$/) || [];
      if (!start) throw new Error("Expected full-width bounded rows");
      if (options.failSecond && Number(start) > 1) return new Response("unavailable", { status: 503 });
      return new Response(JSON.stringify({ values: options.empty ? [] : all.slice(Number(start) - 1, Number(end)) }));
    }
    metadataReads++;
    if (options.unauthorized && metadataReads === 1) return new Response("unauthorized", { status: 401 });
    return new Response(JSON.stringify({ sheets: [{ properties: { title: "O'Brien", gridProperties: { rowCount: size + (options.grow && metadataReads > 1 ? 1 : 0), columnCount: width } } }] }));
  });
  return { fetch, all };
}
function scheduler(fetch: any, connections: any[] = [conn()]) {
  const ast = ts.createSourceFile("scheduler.ts", readFileSync(new URL("./auto-refresh-scheduler.ts", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true);
  const fn = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === "refreshGoogleSheetsDataForCampaign")!;
  const code = ts.transpileModule(fn.getText(ast).replace(/^export /, "") + "\nreturn refreshGoogleSheetsDataForCampaign;", { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const storage = { getCampaign: vi.fn(async () => ({ id: "a", platform: "Google Sheets" })), getGoogleSheetsConnections: vi.fn(async () => connections),
    updateGoogleSheetsConnection: vi.fn(async (id: string, values: any) => ({ ...connections.find(c => c.id === id), ...values })) };
  return { run: new Function("storage", "fetch", "readCompleteGoogleSheetsData", code)(storage, fetch, readCompleteGoogleSheetsData), storage };
}

describe("V1-051 complete main Sheets reads and cache publication", () => {
  it("reads every row beyond 1000 and every column beyond Z using bounded escaped ranges", async () => {
    const p = provider(); const values = await readCompleteGoogleSheetsData(conn(), p.fetch);
    expect(values).toEqual(p.all); expect(values.at(-1)?.[29]).toBe(6000);
    expect(p.fetch.mock.calls.map(c => decodeURIComponent(c[0])).filter(u => u.includes("/values/"))).toEqual([
      "https://sheets.googleapis.com/v4/spreadsheets/book/values/'O''Brien'!1:5000",
      "https://sheets.googleapis.com/v4/spreadsheets/book/values/'O''Brien'!5001:6001",
    ]);
  });
  it.each([50001, 2_000_001])("rejects unsupported grid size %s before reading values", async size => {
    const p = provider(1, 1);
    p.fetch.mockResolvedValue(new Response(JSON.stringify({ sheets: [{ properties: { title: "O'Brien", gridProperties: { rowCount: size, columnCount: 1 } } }] })));
    await expect(readCompleteGoogleSheetsData(conn(), p.fetch)).rejects.toThrow(); expect(p.fetch).toHaveBeenCalledTimes(1);
  });
  it("preserves blank chunk boundaries without treating a later row as the header", async () => {
    const p = provider(5001, 1);
    p.fetch.mockImplementation(async (url: any) => new Response(JSON.stringify(String(url).includes("/values/")
      ? { values: decodeURIComponent(url).includes("!1:") ? [] : [[7]] }
      : { sheets: [{ properties: { title: "O'Brien", gridProperties: { rowCount: 5001, columnCount: 1 } } }] })));
    const values = await readCompleteGoogleSheetsData(conn(), p.fetch);
    expect(values[0]).toEqual([]); expect(values[5000]).toEqual([7]); expect(values.length).toBe(5001);
  });
  it.each([{ failSecond: true }, { grow: true }])("does not mark partial/unstable reads fresh: %j", async options => {
    const p = provider(6001, 2, options), f = scheduler(p.fetch);
    expect(await f.run("a")).toBe(false); expect(f.storage.updateGoogleSheetsConnection).not.toHaveBeenCalled();
  });
  it("publishes complete raw cache with identity and exact timestamp only after all reads", async () => {
    const p = provider(1001, 30), f = scheduler(p.fetch);
    expect(await f.run("a")).toBe(true);
    const [, update, options] = f.storage.updateGoogleSheetsConnection.mock.calls[0];
    expect(update.cachedData).toMatchObject({ complete: true, spreadsheetId: "book", sheetName: "O'Brien", totalRows: 1000, headers: p.all[0], rows: p.all.slice(1) });
    expect(options.expectedConnection.id).toBe("sheet-a");
    expect(hasCompleteGoogleSheetsCache({ ...conn(), ...update })).toBe(true);
  });
  it("publishes an empty complete sheet so deleted rows cannot survive indefinitely", async () => {
    const p = provider(10, 2, { empty: true }), f = scheduler(p.fetch);
    expect(await f.run("a")).toBe(true);
    expect(f.storage.updateGoogleSheetsConnection.mock.calls[0][1].cachedData).toMatchObject({ headers: [], rows: [], totalRows: 0, complete: true });
  });
  it("handles one OAuth renewal then completes the entire read with the renewed token", async () => {
    const p = provider(10, 2, { unauthorized: true });
    const fetch = vi.fn(async (url: any, options: any) => String(url).includes("oauth2") ? new Response(JSON.stringify({ access_token: "new-fixture-token", expires_in: 3600 })) : p.fetch(url, options));
    const f = scheduler(fetch, [{ ...conn(), refreshToken: "fixture-refresh", clientId: "fixture-client", clientSecret: "fixture-secret" }]);
    expect(await f.run("a")).toBe(true); expect(f.storage.updateGoogleSheetsConnection).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls.filter(c => c[0].includes("/values/"))[0][1].headers.Authorization).toBe("Bearer new-fixture-token");
  });
  it.each([{ sheetName: "Replacement" }, { spreadsheetId: "other-book" }, { purpose: "spend" }, { isActive: false }])("rejects a source changed during OAuth renewal: %j", async change => {
    const p = provider(10, 2, { unauthorized: true });
    const fetch = vi.fn(async (url: any, options: any) => String(url).includes("oauth2") ? new Response(JSON.stringify({ access_token: "new-fixture-token" })) : p.fetch(url, options));
    const original = { ...conn(), refreshToken: "fixture-refresh", clientId: "fixture-client", clientSecret: "fixture-secret" };
    const f = scheduler(fetch, [original]);
    f.storage.updateGoogleSheetsConnection.mockImplementation(async (_id, values) => ({ ...original, ...values, ...change }));
    expect(await f.run("a")).toBe(false);
    expect(f.storage.updateGoogleSheetsConnection).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls.filter(c => c[0].includes("/values/"))).toHaveLength(0);
  });
  it.each([{ isActive: false }, { purpose: "spend" }, { purpose: "revenue" }, { campaignId: "other" }, { spreadsheetId: "pending" }])("does not refresh out-of-scope connection %j", async change => {
    const p = provider(10, 2), f = scheduler(p.fetch, [{ ...conn(), ...change }]);
    expect(await f.run("a")).toBe(false); expect(p.fetch).not.toHaveBeenCalled();
  });
  it("does not report all connections refreshed when any connection fails", async () => {
    const p = provider(10, 2), f = scheduler(p.fetch, [conn(), { ...conn(), id: "other", sheetName: "Missing" }]);
    expect(await f.run("a")).toBe(false); expect(f.storage.updateGoogleSheetsConnection).toHaveBeenCalledTimes(1);
  });
  it("honors the overall read deadline on every metadata and value request", async () => {
    const p = provider(10, 2); const signals: AbortSignal[] = [];
    await readCompleteGoogleSheetsData(conn(), async (url, signal) => { signals.push(signal); return p.fetch(url); });
    expect(signals.length).toBe(3); expect(new Set(signals).size).toBe(1); expect(signals[0]).toBeInstanceOf(AbortSignal);
  });
});

describe("V1-051 selected complete aggregate inputs", () => {
  const scoped = () => ({ ...conn(), columnMappings: JSON.stringify([{ targetFieldId: "campaign_name", sourceColumnName: "Campaign Name", sourceColumnIndex: 0, selectedValues: ["A"] }, { targetFieldId: "clicks", sourceColumnName: "Clicks", sourceColumnIndex: 1 }]),
    lastDataRefreshAt: new Date(), cachedData: { complete: true, spreadsheetId: "book", sheetName: "O'Brien", totalRows: 2, headers: ["Campaign Name", "Clicks"], rows: [["A", 0], ["B", 900]] } });
  it("retains measured zero, excludes unrelated selected rows, preserves exact-window opt-out", () => {
    expect(buildGoogleSheetsPlatformSourceForAggregate({ id: "a", platform: "Google Sheets" }, [scoped()])?.metrics.clicks).toBe(0);
    expect(buildGoogleSheetsPlatformSourceForAggregate({ id: "a", platform: "Google Sheets" }, [scoped()], {}, false)?.metrics.clicks).toBeNull();
  });
  it.each(["old", "stale", "invalid", "no-match", "wrong-owner"])("does not supply guessed totals from %s inputs", reason => {
    const c: any = scoped();
    if (reason === "old") delete c.cachedData.complete;
    if (reason === "stale") c.lastDataRefreshAt = new Date(0);
    if (reason === "invalid") c.cachedData.rows[0][1] = "12oops";
    if (reason === "no-match") c.columnMappings = c.columnMappings.replace('"A"', '"Missing"');
    if (reason === "wrong-owner") c.campaignId = "other";
    expect(buildGoogleSheetsPlatformSourceForAggregate({ id: "a", platform: "Google Sheets" }, [c])?.metrics.clicks ?? null).toBeNull();
  });
});
