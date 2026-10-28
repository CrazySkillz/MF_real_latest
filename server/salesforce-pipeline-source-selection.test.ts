import { readFileSync } from "node:fs";
import ts from "typescript";
import { z } from "zod";
import { describe, expect, it, vi } from "vitest";

const source = (id = "salesforce-source", config: any = {}, fields: any = {}) => ({
  id, campaignId: "campaign-a", sourceType: "salesforce", platformContext: "ga4", isActive: true,
  connectedAt: "2026-10-28T09:00:00Z", ...fields,
  mappingConfig: JSON.stringify({ platformContext: "ga4", selectedValues: ["Annual Subscription"], campaignField: "Name",
    revenueField: "Amount", pipelineEnabled: true, pipelineStageName: "Proposal", pipelineStageLabel: "Proposal",
    pipelineTotalToDate: 1250, pipelineCurrency: "EUR", pipelineProxyMode: "current_stage", pipelineWarning: null,
    pipelineLastUpdatedAt: "2026-10-28T09:00:00Z", pipelineValueRevenueTotals: [{ campaignValue: "Annual Subscription", revenue: 1250 }], ...config }),
});

async function response(sources = [source()], authorized = true, platformContext = "ga4") {
  const text = readFileSync("server/routes-oauth.ts", "utf8");
  const start = text.indexOf('  app.get("/api/salesforce/:campaignId/pipeline-proxy",');
  const end = text.indexOf('  // HubSpot deals properties', start);
  const validationStart = text.indexOf('  const zSalesforceRevenuePlatformContext =');
  expect(start).toBeGreaterThan(0); expect(end).toBeGreaterThan(start); expect(validationStart).toBeGreaterThan(0);
  const campaign = { id: "campaign-a", currency: "EUR", ga4CampaignFilter: '["brand-search","retargeting"]' };
  const storage = {
    getSalesforceConnection: vi.fn(async () => ({ id: "connection" })),
    getCampaign: vi.fn(async () => campaign),
    getRevenueSources: vi.fn(async (campaignId: string, context: string) => sources.filter(s => s.campaignId === campaignId && s.isActive && s.platformContext === context)),
  };
  let handler: any;
  const code = text.slice(validationStart, text.indexOf('\n', validationStart)) + '\n' + text.slice(start, end);
  new Function("app", "ensureCampaignAccess", "storage", "getGA4CampaignFilterValues", "z", "sendBadRequest",
    ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText)(
    { get: (_path: string, fn: any) => { handler = fn; } },
    async (_req: any, res: any) => authorized ? campaign : (res.status(403).json({ success: false }), null),
    storage, JSON.parse, z, (res: any) => res.status(400).json({ success: false }),
  );
  const res: any = { statusCode: 200, body: null, setHeader: vi.fn(), status(code: number) { this.statusCode = code; return this; }, json(body: any) { this.body = body; return this; } };
  await handler({ params: { campaignId: "campaign-a" }, query: { platformContext } }, res);
  return { res, storage };
}

describe("Salesforce campaign-owned Pipeline Proxy read", () => {
  it("already returns the selected opportunity's saved stage amount without a GA4 name mapping", async () => {
    const f = await response();
    expect(f.res.statusCode).toBe(200);
    expect(f.res.body).toMatchObject({ success: true, sourceId: "salesforce-source", totalToDate: 1250, currency: "EUR", pipelineStageLabel: "Proposal" });
    expect(f.storage.getRevenueSources).toHaveBeenCalledExactlyOnceWith("campaign-a", "ga4");
  });
  it("returns a configured zero when no selected opportunity remains in the open stage", async () => {
    const f = await response([source("salesforce-source", { pipelineTotalToDate: 0, pipelineCurrency: null, pipelineValueRevenueTotals: [] })]);
    expect(f.res.statusCode).toBe(200); expect(f.res.body.totalToDate).toBe(0);
  });
  it("rejects an ambiguous pair of unmapped sources", async () => {
    const f = await response([source(), source("second")]); expect(f.res.statusCode).toBe(404);
  });
  it.each([
    source("other-campaign", {}, { campaignId: "campaign-b" }), source("other-platform", {}, { platformContext: "linkedin" }),
    source("inactive", {}, { isActive: false }), source("disabled", { pipelineEnabled: false }), source("wrong-mapping", { platformContext: "linkedin" }),
  ])("does not expose $id", async candidate => { expect((await response([candidate])).res.statusCode).toBe(404); });
  it("requires campaign access and an explicit supported context", async () => {
    const denied = await response([source()], false); expect(denied.res.statusCode).toBe(403); expect(denied.storage.getRevenueSources).not.toHaveBeenCalled();
    const missingContext = await response([source()], true, ""); expect(missingContext.res.statusCode).toBe(400); expect(missingContext.storage.getRevenueSources).not.toHaveBeenCalled();
  });
});
