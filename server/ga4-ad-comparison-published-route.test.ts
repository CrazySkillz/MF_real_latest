import { readFileSync } from "node:fs";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getReportingDateWindow, resolveGA4ImportToDateWindow } from "./utils/reporting-timezone";

const source = ts.createSourceFile("routes-oauth.ts", readFileSync("server/routes-oauth.ts", "utf8"), ts.ScriptTarget.Latest, true);
const definitions: Record<string, string> = {};
function visit(node: ts.Node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(source) === "getSynchronizedGA4OverviewSnapshot") definitions.snapshot = node.initializer!.getText(source);
  if (ts.isCallExpression(node) && node.expression.getText(source) === "app.get" && node.arguments[0]?.getText(source) === '"/api/campaigns/:id/ga4-breakdown"') definitions.route = node.arguments.at(-1)!.getText(source);
  ts.forEachChild(node, visit);
}
visit(source);
function compile(name: string, bindings: Record<string, any>) {
  if (!definitions[name]) throw new Error(`Missing production definition: ${name}`);
  return new Function(...Object.keys(bindings), ts.transpileModule(`return (${definitions[name]});`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText)(...Object.values(bindings));
}

describe("Ad Comparison reads the synchronized native campaign breakdown", () => {
  let storage: any, provider: any, bindings: any, snapshot: any, handler: any;
  beforeEach(() => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-27T12:00:00Z"));
    snapshot = { campaignId: "a", propertyId: "123", windowStart: "2026-09-23", windowEnd: "2026-10-26", updatedAt: "2026-10-27T07:10:48Z",
      campaignBreakdown: { rows: [
        { campaign: "sale", sessions: 346, users: 344, conversions: 19.25, revenue: 3400.434193, sessionKeyEventRate: 0.046242774566473986 },
        { campaign: "sale2", sessions: 258, users: 258, conversions: 20.75, revenue: 4253.52214, sessionKeyEventRate: 0.08139534883720931 },
      ], totals: { sessions: 604, users: 602, conversions: 40, revenue: 7653.96 }, meta: { currencyCode: "EUR", revenueMetric: "totalRevenue" } } };
    storage = {
      getGA4Connection: vi.fn(async (campaignId, propertyId) => campaignId === "a" && propertyId === "123"
        ? { campaignId, propertyId, importStartDate: "2026-09-23", isActive: true, accessToken: "expired" } : undefined),
      getGA4OverviewSnapshot: vi.fn(async (campaignId, propertyId) => campaignId === "a" && propertyId === "123" ? snapshot : undefined),
      getLatestGA4DailyMetric: vi.fn().mockResolvedValue({ date: "2026-10-26" }),
      updateGA4ConnectionTokens: vi.fn(),
    };
    provider = { getAcquisitionBreakdown: vi.fn().mockRejectedValue(new Error("TOKEN_EXPIRED")) };
    bindings = { storage, ga4Service: provider, getReportingDateWindow, resolveGA4ImportToDateWindow,
      ensureCampaignAccess: vi.fn().mockResolvedValue({ id: "a", currency: "EUR", reportingTimeZone: "Europe/Amsterdam", ga4CampaignFilter: ["sale", "sale2"] }),
      parseGA4CampaignFilter: (value: any) => value, isYesopMockProperty: () => false, dateRangeToDays: () => 30,
      getSynchronizedGA4OverviewSnapshot: compile("snapshot", { storage }), console: { error: vi.fn() },
    };
    handler = compile("route", bindings);
  });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
  async function request(query: Record<string, any> = {}, campaignId = "a") {
    const res: any = { code: 200, body: null, status(code: number) { this.code = code; return this; }, json(body: any) { this.body = body; return this; } };
    await handler({ params: { id: campaignId }, query: { propertyId: "123", window: "import-to-date", adComparisonCampaignBreakdown: "1", ...query } }, res);
    return res;
  }
  it.each(["TOKEN_EXPIRED", "Google temporarily unavailable"])("returns published figures without contacting the provider: %s", async error => {
    provider.getAcquisitionBreakdown.mockRejectedValue(new Error(error));
    const res = await request();
    expect(res.code).toBe(200);
    expect(res.body).toMatchObject({ success: true, propertyId: "123", startDate: "2026-09-23", endDate: "2026-10-26", totals: snapshot.campaignBreakdown.totals, rows: snapshot.campaignBreakdown.rows, lastUpdated: snapshot.updatedAt });
    expect(res.body.rows.reduce((sum: number, row: any) => sum + row.revenue, 0)).toBeCloseTo(7653.956333, 6);
    expect(provider.getAcquisitionBreakdown).not.toHaveBeenCalled();
    expect(storage.updateGA4ConnectionTokens).not.toHaveBeenCalled();
    expect(storage.getGA4OverviewSnapshot).toHaveBeenCalledWith("a", "123");
  });
  it("returns the identical native figures used by Overview, without adding unmapped CRM revenue", async () => {
    const ads = await request();
    const overview = await request({ adComparisonCampaignBreakdown: "0", overviewCampaignBreakdown: "1" });
    expect(ads.code).toBe(200); expect(overview.code).toBe(200);
    expect(ads.body.rows).toEqual(overview.body.rows); expect(ads.body.totals).toEqual(overview.body.totals);
    expect(ads.body.totals.revenue).toBe(7653.96);
  });
  it("preserves explicit limit, debug metadata, read-only flag and unrounded fractional credits", async () => {
    const res = await request({ limit: "1", debug: "1", readOnly: "1" });
    expect(res.code).toBe(200); expect(res.body.rows).toEqual([snapshot.campaignBreakdown.rows[0]]);
    expect(res.body.rows[0].conversions).toBe(19.25);
    expect(res.body.totals.revenue).toBe(7653.96);
    expect(res.body.meta).toEqual(snapshot.campaignBreakdown.meta); expect(res.body.validationReadOnly).toBe(true);
  });
  it("preserves a verified empty window as zero", async () => {
    snapshot.campaignBreakdown.rows = []; snapshot.campaignBreakdown.totals = { sessions: 0, users: 0, conversions: 0, revenue: 0 };
    const res = await request(); expect(res.code).toBe(200); expect(res.body.rows).toEqual([]); expect(res.body.totals.revenue).toBe(0);
  });
  it.each(["missing snapshot", "missing daily", "different start", "different daily end", "requested cutoff"])("fails closed with %s and never falls back to live data", async kind => {
    if (kind === "missing snapshot") storage.getGA4OverviewSnapshot.mockResolvedValue(undefined);
    if (kind === "missing daily") storage.getLatestGA4DailyMetric.mockResolvedValue(undefined);
    if (kind === "different start") snapshot.windowStart = "2026-09-24";
    if (kind === "different daily end") storage.getLatestGA4DailyMetric.mockResolvedValue({ date: "2026-10-25" });
    const res = await request(kind === "requested cutoff" ? { snapshotEndDate: "2026-10-25" } : {});
    expect(res.code).toBe(409); expect(res.body.error).toBe("GA4_OVERVIEW_SNAPSHOT_UNAVAILABLE");
    expect(provider.getAcquisitionBreakdown).not.toHaveBeenCalled();
  });
  it.each(["missing property", "foreign property", "no campaign selection", "invalid start", "no access"])("keeps the existing access/window boundary: %s", async kind => {
    if (kind === "no campaign selection") bindings.ensureCampaignAccess.mockResolvedValue({ ga4CampaignFilter: [] });
    if (kind === "invalid start") storage.getGA4Connection.mockResolvedValue({ propertyId: "123", importStartDate: "2026-10-28" });
    if (kind === "no access") bindings.ensureCampaignAccess.mockImplementation(async (_req: any, res: any) => { res.status(403).json({ error: "Forbidden" }); return null; });
    const res = await request(kind === "missing property" ? { propertyId: "" } : kind === "foreign property" ? { propertyId: "999" } : {});
    expect(res.code).toBe(kind === "missing property" ? 400 : kind === "foreign property" ? 404 : kind === "no access" ? 403 : 409);
    expect(storage.getGA4OverviewSnapshot).not.toHaveBeenCalled(); expect(provider.getAcquisitionBreakdown).not.toHaveBeenCalled();
  });
  it("still reports a failed saved-data read rather than fabricating values", async () => {
    storage.getGA4OverviewSnapshot.mockRejectedValue(new Error("database unavailable"));
    const res = await request(); expect(res.code).toBe(500); expect(res.body.error).toBe("database unavailable");
    expect(provider.getAcquisitionBreakdown).not.toHaveBeenCalled();
  });
  it("leaves Insights and other rolling-date reads on their existing provider path", async () => {
    provider.getAcquisitionBreakdown.mockResolvedValue({ totals: { revenue: 10 }, rows: [] });
    const res = await request({ window: "", insightsChannelAttribution: "1", readOnly: "1" });
    expect(res.code).toBe(200); expect(storage.getGA4OverviewSnapshot).not.toHaveBeenCalled();
    expect(provider.getAcquisitionBreakdown).toHaveBeenCalledWith("a", storage, "2026-09-27", "123", 2000, ["sale", "sale2"], "2026-10-26", true, true);
  });
});
