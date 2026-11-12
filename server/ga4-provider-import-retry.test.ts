import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { completeFinancialImportRequest, getFinancialImportRequestId } from "../client/src/lib/utils";

// Execute the actual final-submit callbacks with controlled HTTP responses.
// Provider fetching and browser rendering have separate fixture coverage.
function fixture(provider: "salesforce" | "shopify", override: any = {}) {
  const name = provider === "salesforce" ? "SalesforceRevenueWizard" : "ShopifyRevenueWizard";
  const source = readFileSync(new URL(`../client/src/components/${name}.tsx`, import.meta.url), "utf8");
  const ast = ts.createSourceFile(`${name}.tsx`, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const target = provider === "salesforce" ? "save" : "handleNext";
  let callback = "";
  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === target) callback = node.initializer!.getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast); if (!callback) throw new Error("Submit callback missing");
  const fetch = vi.fn(), onSuccess = vi.fn(), toast = vi.fn(), setStep = vi.fn();
  const deps: any = { getFinancialImportRequestId, completeFinancialImportRequest, fetch, onSuccess, toast, setStep,
    setIsSaving: vi.fn(), setSaveError: vi.fn(), setLastSaveResult: vi.fn(), step: "review", isRepair: false,
    campaignId: "campaign-a", platformContext: "ga4", mode: "connect", sourceId: undefined, editSourceId: undefined,
    isGA4: true, isLinkedIn: false, isGoogleAds: false, isMeta: false, isInstagram: false, isTikTok: false,
    campaignField: "Campaign", selectedValues: ["sale"], revenueField: "Amount", revenueMetric: "current_total_price",
    days: 90, requestDays: 90, dateField: "CloseDate", campaignDisplayName: "Sale", selectedCampaignMappings: [],
    pipelineEnabled: false, revenueClassification: "offsite_not_in_ga4", effectiveSalesforceCurrency: "EUR",
    props: { expectedSourceMappingConfig: '{"selectedValues":["sale"]}' },
    previewLoading: false, previewError: null, preview: { totalRevenue: 250 },
    formatReviewCurrency: (n: number) => `EUR ${n.toFixed(2)}`, ...override };
  const invoke = new Function(...Object.keys(deps), ts.transpileModule(`return (${callback});`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText)(...Object.values(deps));
  return { invoke, fetch, onSuccess, toast, setStep };
}
describe("provider final-save retry identity", () => {
  beforeEach(() => {
    const data = new Map<string, string>();
    vi.stubGlobal("sessionStorage", { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value), removeItem: (key: string) => data.delete(key) });
    vi.stubGlobal("crypto", { randomUUID });
  });
  afterEach(() => vi.unstubAllGlobals());
  it.each(["salesforce", "shopify"] as const)("retains %s identity across network, truncated JSON, missing confirmation and unavailable responses", async provider => {
    const f = fixture(provider), key = `financial-import-request:campaign-a:revenue:${provider}`;
    f.fetch.mockRejectedValueOnce(new Error("Response lost")); await f.invoke();
    const id = sessionStorage.getItem(key); expect(id).toMatch(/^[a-f0-9-]{36}$/);
    for (const response of [new Response('{"success":'), Response.json({}), Response.json({ error: "Unavailable" }, { status: 503 })]) {
      f.fetch.mockResolvedValueOnce(response); await f.invoke();
      expect(sessionStorage.getItem(key)).toBe(id); expect(f.onSuccess).not.toHaveBeenCalled();
      expect(f.setStep).not.toHaveBeenCalledWith("complete");
    }
    f.fetch.mockResolvedValueOnce(Response.json({ success: true, alreadySaved: true, sourceId: id })); await f.invoke();
    expect(f.fetch.mock.calls.map(([, init]) => init.headers["X-Import-Request-Id"])).toEqual(Array(5).fill(id));
    expect(f.onSuccess).toHaveBeenCalledTimes(1); expect(f.toast).toHaveBeenLastCalledWith(expect.objectContaining({ title: "Import already saved", description: expect.not.stringContaining("0.00") }));
    expect(sessionStorage.getItem(key)).toBeNull();
    f.fetch.mockResolvedValueOnce(Response.json({ success: true, totalRevenue: 125 })); await f.invoke();
    expect(f.fetch.mock.calls.at(-1)![1].headers["X-Import-Request-Id"]).not.toBe(id);
  });
  it.each(["salesforce", "shopify"] as const)("keeps %s edits separate and retires a definitely deleted request", async provider => {
    const f = fixture(provider), key = `financial-import-request:campaign-a:revenue:${provider}`;
    f.fetch.mockResolvedValueOnce(Response.json({ code: "FINANCIAL_IMPORT_RETIRED" }, { status: 409 })); await f.invoke();
    expect(sessionStorage.getItem(key)).toBeNull(); expect(f.onSuccess).not.toHaveBeenCalled();
    const edit = fixture(provider, { mode: "edit", sourceId: "saved-source", editSourceId: "saved-source" });
    edit.fetch.mockResolvedValueOnce(Response.json({ success: true, totalRevenue: 250 })); await edit.invoke();
    expect(edit.fetch.mock.calls[0][1].headers).not.toHaveProperty("X-Import-Request-Id");
    expect(JSON.parse(edit.fetch.mock.calls[0][1].body).sourceId).toBe("saved-source");
    if (provider === "salesforce") expect(JSON.parse(edit.fetch.mock.calls[0][1].body).expectedSourceMappingConfig).toBe('{"selectedValues":["sale"]}');
  });
  it("separates campaign/source requests and cannot clear a newer pending identity", () => {
    const a = getFinancialImportRequestId("a", "revenue:csv"), b = getFinancialImportRequestId("b", "revenue:csv"), spend = getFinancialImportRequestId("a", "spend:csv");
    expect(new Set([a, b, spend]).size).toBe(3); expect(getFinancialImportRequestId("a", "revenue:csv")).toBe(a);
    completeFinancialImportRequest("a", "revenue:csv", b); expect(getFinancialImportRequestId("a", "revenue:csv")).toBe(a);
    completeFinancialImportRequest("a", "revenue:csv", a); expect(getFinancialImportRequestId("a", "revenue:csv")).not.toBe(a);
  });
});
