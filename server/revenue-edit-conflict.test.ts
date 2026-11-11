import { readFileSync } from "node:fs";
import ts from "typescript";
import { z } from "zod";
import { describe, expect, it, vi } from "vitest";

const routes = readFileSync("server/routes-oauth.ts", "utf8");
const original = '{"selectedValues":["A"],"lastTotalRevenue":100}';
const newer = '{"selectedValues":["B"],"lastTotalRevenue":200}';
const compile = (code: string, deps: Record<string, any>) => new Function(...Object.keys(deps),
  ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText)(...Object.values(deps));

// Execute each actual route's access, validation and conflict checks, stopping before provider access.
function fixture(provider: "hubspot" | "salesforce", saved: any = { mappingConfig: newer }) {
  const start = routes.indexOf(`app.post("/api/campaigns/:id/${provider}/save-mappings"`);
  const end = routes.indexOf("      const { accessToken", start);
  expect(start).toBeGreaterThan(0); expect(end).toBeGreaterThan(start);
  let handler: any;
  const storage = { getCampaign: vi.fn(async () => ({ currency: "EUR" })),
    getRevenueSource: vi.fn(async (campaignId: string, sourceId: string) => campaignId === "a" && sourceId === "source-a" && saved
      ? { sourceType: provider, platformContext: "ga4", ...saved } : undefined),
    writeWithGA4RefreshOwnership: vi.fn(async (_scope, fn) => fn()) };
  let allowed = true;
  compile(routes.slice(start, end) + 'return res.json({ reachedProvider: true }); } catch(error: any) { return res.status(500).json({ error: error.message }); } });', {
    app: { post: (_path: string, ...handlers: any[]) => { handler = handlers.at(-1); } }, z,
    importRateLimiter: () => {}, requireCampaignAccessParamId: () => {},
    getInternalGA4RefreshWriteInput: (req: any) => req.refresh || {},
    ensureCampaignAccess: async (_req: any, res: any) => { if (!allowed) res.status(403).json({ error: "Forbidden" }); return allowed; },
    zSelectedValues: z.array(z.string()), zValueSource: z.enum(["revenue", "conversion_value"]),
    zNumberLike: z.coerce.number(), zSalesforceRevenuePlatformContext: z.string(), zHubSpotRevenuePlatformContext: z.string(),
    sendBadRequest: (res: any, error: string) => res.status(400).json({ error }), isSafeSalesforceFieldPath: () => true, storage,
  });
  return { storage, deny: () => { allowed = false; }, async invoke(body: any = {}, refresh?: any) {
    const res: any = { statusCode: 200, status(code: number) { this.statusCode = code; return this; }, json(value: any) { this.body = value; return this; } };
    await handler({ params: { id: "a" }, headers: {}, refresh, body: { campaignProperty: "dealname", campaignField: "Name",
      selectedValues: ["A"], sourceId: "source-a", platformContext: "ga4", expectedSourceMappingConfig: original, ...body } }, res);
    return res;
  } };
}

describe.each(["hubspot", "salesforce"] as const)("%s stale edit protection", provider => {
  it("rejects the older tab before provider access and leaves the newer mapping intact", async () => {
    const saved = { mappingConfig: newer }, f = fixture(provider, saved), result = await f.invoke();
    expect(result.statusCode).toBe(409); expect(result.body.code).toBe(`${provider.toUpperCase()}_REVENUE_SOURCE_CHANGED`);
    expect(result.body.error).toContain("Reload the page and reopen"); expect(saved.mappingConfig).toBe(newer);
    expect(result.body.reachedProvider).toBeUndefined();
  });
  it("allows the freshly reopened editor and retains scheduler compatibility", async () => {
    const f = fixture(provider);
    expect((await f.invoke({ expectedSourceMappingConfig: newer })).body.reachedProvider).toBe(true);
    expect((await f.invoke({ expectedSourceMappingConfig: newer }, { refreshScope: { campaignId: "a" } })).body.reachedProvider).toBe(true);
    expect((await f.invoke({}, { refreshScope: { campaignId: "a" } })).statusCode).toBe(409);
  });
  it.each([null, { sourceType: "csv" }, { platformContext: "linkedin" }])("rejects missing or incorrectly scoped sources (%j)", async saved => {
    expect((await fixture(provider, saved).invoke()).statusCode).toBe(404);
  });
  it("keeps campaign authorization first and rejects foreign source IDs", async () => {
    const f = fixture(provider);
    expect((await f.invoke({ sourceId: "other-source" })).statusCode).toBe(404);
    f.storage.getRevenueSource.mockClear(); f.deny();
    expect((await f.invoke()).statusCode).toBe(403); expect(f.storage.getRevenueSource).not.toHaveBeenCalled();
  });
  it("does not impose an edit snapshot on creates or legacy callers", async () => {
    expect((await fixture(provider).invoke({ sourceId: undefined, expectedSourceMappingConfig: undefined })).body.reachedProvider).toBe(true);
    expect((await fixture(provider).invoke({ expectedSourceMappingConfig: undefined })).body.reachedProvider).toBe(true);
    expect((await fixture(provider).invoke({ expectedSourceMappingConfig: "" })).statusCode).toBe(400);
  });
  it("sends the original unmodified snapshot from the actual save function", async () => {
    const name = provider === "hubspot" ? "HubSpot" : "Salesforce";
    const code = readFileSync(`client/src/components/${name}RevenueWizard.tsx`, "utf8");
    const sf = ts.createSourceFile("wizard.tsx", code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let saveCode = "";
    function visit(node: ts.Node) { if (ts.isVariableDeclaration(node) && node.name.getText(sf) === "save") saveCode = node.getText(sf); ts.forEachChild(node, visit); }
    visit(sf); expect(saveCode).toBeTruthy();
    const fetch = vi.fn(async () => new Response(JSON.stringify({ error: "Settings changed. Close and reopen the editor." }), { status: 409 }));
    const toast = vi.fn(), onSuccess = vi.fn();
    const deps = { props: { expectedSourceMappingConfig: original }, reviewPreviewStatus: "success", isConnected: true, isSaving: false,
      mode: "edit", hasEditChanges: true, isGA4: true, platformContext: "ga4", campaignId: "a", sourceId: "source-a",
      campaignProperty: "dealname", campaignField: "Name", selectedValues: ["C"], revenueProperty: "amount", revenueField: "Amount",
      revenueClassification: "offsite_not_in_ga4", days: 3650, dateField: provider === "hubspot" ? "closedate" : "CloseDate",
      campaignDisplayName: "", pipelineEnabled: false, pipelineStageId: null, pipelineStageLabel: null, pipelineStageName: null,
      selectedCampaignMappings: [], salesforceCurrencyOverride: "", fetch, toast, onSuccess,
      setIsSaving: vi.fn(), setSaveError: vi.fn(), completeFinancialImportRequest: vi.fn() };
    await compile(`const ${saveCode}; return save;`, deps)();
    expect(fetch).toHaveBeenCalledOnce();
    const payload = JSON.parse((fetch.mock.calls[0] as any)[1].body);
    expect(payload).toMatchObject({ sourceId: "source-a", selectedValues: ["C"], expectedSourceMappingConfig: original });
    expect(onSuccess).not.toHaveBeenCalled(); expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
  });
});
