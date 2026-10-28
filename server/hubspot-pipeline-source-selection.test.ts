import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

const source = (id = "hubspot-source", config: any = {}, fields: any = {}) => ({
  id, campaignId: "promo", sourceType: "hubspot", platformContext: "ga4", isActive: true,
  connectedAt: "2026-10-28T09:59:08Z", ...fields,
  mappingConfig: JSON.stringify({ platformContext: "ga4", selectedValues: ["yesop_prospecting"], campaignProperty: "dealname",
    revenueProperty: "amount", pipelineEnabled: true, pipelineStageId: "contractsent", pipelineStageLabel: "Contract Sent",
    pipelineTotalToDate: 3200, pipelineCurrency: "EUR", pipelineProxyMode: "current_stage", pipelineWarning: null,
    pipelineLastUpdatedAt: "2026-10-28T09:59:08Z", pipelineValueRevenueTotals: [{ campaignValue: "yesop_prospecting", revenue: 3200 }], ...config }),
});

async function response(sources = [source()], authorized = true) {
  const text = readFileSync("server/routes-oauth.ts", "utf8");
  const start = text.indexOf('  app.get("/api/hubspot/:campaignId/pipeline-proxy",');
  const end = text.indexOf('  app.delete("/api/hubspot/:campaignId/pipeline-proxy",', start);
  expect(start).toBeGreaterThan(0); expect(end).toBeGreaterThan(start);
  const campaign = { id: "promo", currency: "EUR", ga4CampaignFilter: '["yesop_brand_search","yesop_retargeting"]' };
  const storage = {
    getHubspotConnection: vi.fn(async () => ({ id: "connection" })),
    getCampaign: vi.fn(async () => campaign),
    getRevenueSources: vi.fn(async (campaignId: string, context: string) => sources.filter(s => s.campaignId === campaignId && s.isActive && s.platformContext === context)),
  };
  const provider = vi.fn(async () => { throw new Error("No provider access in read-only fixture"); });
  let handler: any;
  new Function("app", "ensureCampaignAccess", "storage", "getGA4CampaignFilterValues", "getHubspotAccessTokenForCampaign", "HUBSPOT_PAGINATION_ERROR_CODE",
    ts.transpileModule(text.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText)(
    { get: (_path: string, fn: any) => { handler = fn; } },
    async (_req: any, res: any) => authorized ? campaign : (res.status(403).json({ success: false }), null),
    storage, JSON.parse, provider, "HUBSPOT_PAGINATION_INCOMPLETE",
  );
  const res: any = { statusCode: 200, body: null, setHeader: vi.fn(), status(code: number) { this.statusCode = code; return this; }, json(body: any) { this.body = body; return this; } };
  await handler({ params: { campaignId: "promo" }, query: { platformContext: "ga4" } }, res);
  return { res, storage, provider };
}

describe("HubSpot campaign-owned Pipeline Proxy selection", () => {
  it("returns Promo's saved EUR3200 open-stage value without requiring a GA4 campaign-name mapping", async () => {
    const f = await response();
    expect(f.res.statusCode).toBe(200);
    expect(f.res.body).toMatchObject({ success: true, sourceId: "hubspot-source", totalToDate: 3200, currency: "EUR", pipelineStageLabel: "Contract Sent" });
    expect(f.storage.getRevenueSources).toHaveBeenCalledExactlyOnceWith("promo", "ga4");
    expect(f.provider).not.toHaveBeenCalled();
  });
  it("preserves a valid zero after the selected deal leaves the open stage", async () => {
    const f = await response([source("hubspot-source", { pipelineTotalToDate: 0, pipelineValueRevenueTotals: [], pipelineCurrency: null })]);
    expect(f.res.statusCode).toBe(200); expect(f.res.body.totalToDate).toBe(0); expect(f.provider).not.toHaveBeenCalled();
  });
  it("retains an explicit matching source when legacy sources are present", async () => {
    const f = await response([source(), source("mapped", { campaignMappings: [{ linkedinCampaignName: "yesop_retargeting" }] })]);
    expect(f.res.statusCode).toBe(200); expect(f.res.body.sourceId).toBe("mapped");
  });
  it("does not guess between multiple unmapped sources", async () => {
    const f = await response([source(), source("second")]);
    expect(f.res.statusCode).toBe(404); expect(f.provider).not.toHaveBeenCalled();
  });
  it.each([
    source("foreign", {}, { campaignId: "other" }), source("linkedin", {}, { platformContext: "linkedin" }),
    source("inactive", {}, { isActive: false }), source("disabled", { pipelineEnabled: false }),
    source("wrong-config", { platformContext: "linkedin" }),
  ])("does not select ineligible source $id", async candidate => {
    const f = await response([candidate]); expect(f.res.statusCode).toBe(404); expect(f.provider).not.toHaveBeenCalled();
  });
  it("retains currency validation and returns unavailable if a mismatched cache cannot be refreshed", async () => {
    const f = await response([source("mapped", { pipelineCurrency: "USD", campaignMappings: [{ linkedinCampaignName: "yesop_retargeting" }] })]);
    expect(f.res.statusCode).toBe(503); expect(f.res.body.success).toBe(false);
  });
  it("performs no source reads when campaign access is denied", async () => {
    const f = await response([source()], false);
    expect(f.res.statusCode).toBe(403); expect(f.storage.getRevenueSources).not.toHaveBeenCalled(); expect(f.provider).not.toHaveBeenCalled();
  });
});
