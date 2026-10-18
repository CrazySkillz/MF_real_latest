import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { storage } from "./storage";
import { runDailyAutoRefreshOnce } from "./auto-refresh-scheduler";
import { getInternalGA4RefreshWriteInput } from "./internal-request-auth";

const scope = { campaignId: "campaign-a", ownerId: "owner-a", reportingDate: "2026-10-17", work: { id: "work-a", leaseToken: "test-lease" } };
const campaign = { id: "campaign-a", ownerId: "owner-a", status: "active", reportingTimeZone: "Europe/Amsterdam", currency: "EUR" };
let live: boolean;
const revenue = (sourceType: string) => ({ id: `${sourceType}-source`, campaignId: campaign.id, platformContext: "ga4", sourceType, isActive: true,
  mappingConfig: JSON.stringify({ platformContext: "ga4", selectedValues: ["sale"], campaignField: "Campaign", campaignProperty: "Campaign", revenueField: "Amount", revenueProperty: "amount" }) });
const sheet = (type: "revenue" | "spend") => ({ id: `sheets-${type}`, campaignId: campaign.id, platformContext: "ga4", sourceType: "google_sheets", isActive: true,
  mappingConfig: JSON.stringify({ platformContext: "ga4", connectionId: "sheet-a", [`${type}Column`]: "Amount", dateColumn: "Date", campaignColumn: "Campaign", campaignValues: ["sale"], currency: "EUR" }) });

describe("owned financial scheduler integration", () => {
  beforeEach(() => {
    live = true;
    vi.spyOn(storage, "writeWithGA4RefreshOwnership").mockImplementation(async (input, write) => {
      if (!live || JSON.stringify(input) !== JSON.stringify(scope)) throw new Error("GA4_REFRESH_WORK_OWNERSHIP_LOST");
      return write({});
    });
    vi.spyOn(storage, "getCampaign").mockResolvedValue(campaign as any);
    vi.spyOn(storage, "getCampaigns").mockImplementation(async () => { throw new Error("must not scan other campaigns"); });
    vi.spyOn(storage, "getRevenueSources").mockResolvedValue([]);
    vi.spyOn(storage, "getSpendSources").mockResolvedValue([]);
    vi.spyOn(storage, "getGA4Connections").mockResolvedValue([{ propertyId: "123", isActive: true }] as any);
  });
  afterEach(() => {
    vi.restoreAllMocks(); vi.unstubAllGlobals();
    delete (global as any).__autoRefreshInProgress;
    delete (global as any).__googleSheetsSpendRefreshInProgress;
    delete (global as any).__salesforcePipelineRefreshInProgress;
  });
  const run = (extra: any = {}) => runDailyAutoRefreshOnce("manual", { campaignId: campaign.id, financialSourcesOnly: true, deferDownstream: true, refreshScope: scope, ...extra });

  it("transports ownership and exact source state for all internal financial routes", async () => {
    const sources = [revenue("hubspot"), revenue("salesforce"), revenue("shopify")];
    vi.mocked(storage.getRevenueSources).mockResolvedValue(sources as any);
    vi.mocked(storage.getSpendSources).mockResolvedValue([sheet("spend")] as any);
    const requests: any[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url, options) => {
      const req = { socket: { remoteAddress: "127.0.0.1" }, headers: options.headers };
      const metadata = getInternalGA4RefreshWriteInput(req);
      expect(metadata).toEqual({ refreshScope: scope });
      const body = JSON.parse(options.body); expect(JSON.stringify(body)).not.toContain(scope.work.leaseToken);
      requests.push({ url, body });
      return { ok: true, status: 200, text: async () => JSON.stringify({ success: true, materializedRecordCount: 1, totalRevenue: 20, materializedDates: [scope.reportingDate] }) };
    }));
    const result = await run(); expect(result).toMatchObject({ campaignsScanned: 1, providerJobsAttempted: 4, providerJobsSucceeded: 4, campaignErrors: 0 });
    expect(requests).toHaveLength(4);
    for (const source of [...sources, sheet("spend")]) {
      expect(requests.some(request => (request.body.sourceId || request.body.mapping?.sourceId) === source.id && request.body.expectedSourceMappingConfig === source.mappingConfig)).toBe(true);
    }
    expect(storage.getCampaigns).not.toHaveBeenCalled();
    expect(vi.mocked(storage.getRevenueSources).mock.calls.every(args => args[0] === campaign.id && args[1] === "ga4")).toBe(true);
    expect(vi.mocked(storage.getSpendSources).mock.calls.every(args => args[0] === campaign.id && args[1] === "ga4")).toBe(true);
  });
  it.each(["expired", "request failed"])("stops after an %s route reply and releases the local busy flag", async mode => {
    vi.mocked(storage.getRevenueSources).mockResolvedValue([revenue("hubspot"), revenue("salesforce")] as any);
    const fetch = vi.fn(async () => {
      if (mode === "expired") live = false;
      return { ok: mode !== "request failed", status: 500, text: async () => "{}" };
    }); vi.stubGlobal("fetch", fetch);
    await expect(run()).rejects.toThrow(mode === "expired" ? "GA4_REFRESH_WORK_OWNERSHIP_LOST" : "financial refresh request failed");
    expect(fetch).toHaveBeenCalledTimes(1); expect((global as any).__autoRefreshInProgress).toBe(false);
  });
  it.each([{ campaignId: "other" }, { refreshScope: undefined }, { deferDownstream: false }, { financialSourcesOnly: false }, { onCampaignRefreshed: async () => {} }])("rejects unsafe options before touching providers (%j)", async extra => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    await expect(run(extra)).rejects.toThrow(); expect(fetch).not.toHaveBeenCalled(); expect(storage.getRevenueSources).not.toHaveBeenCalled();
  });
  it("rejects unsupported Spend providers before any financial writes", async () => {
    vi.mocked(storage.getSpendSources).mockResolvedValue([{ id: "meta", sourceType: "ad_platforms", isActive: true, mappingConfig: '{"platform":"meta"}' }] as any);
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    await expect(run()).rejects.toThrow("GA4_REFRESH_UNSUPPORTED_FINANCIAL_SOURCE"); expect(fetch).not.toHaveBeenCalled();
  });
  it("does not fall back to a different Google Ads connection after a discovery error", async () => {
    vi.mocked(storage.getSpendSources).mockResolvedValue([{ id: "ads", sourceType: "ad_platforms", isActive: true, mappingConfig: '{"platform":"google_ads"}' }] as any);
    vi.spyOn(storage, "getGA4GoogleAdsSpendConnection").mockRejectedValue(new Error("database unavailable"));
    const legacy = vi.spyOn(storage, "getGoogleAdsConnection"); const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    expect(await run()).toMatchObject({ providerJobsAttempted: 1, providerJobsSucceeded: 0 });
    expect(legacy).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
  });
  it.each([false, true])("carries ownership through direct Sheets Revenue materialization (expires=%s)", async expired => {
    vi.mocked(storage.getRevenueSources).mockResolvedValue([sheet("revenue")] as any);
    vi.spyOn(storage, "getGoogleSheetsConnections").mockResolvedValue([{ id: "sheet-a", campaignId: campaign.id, spreadsheetId: "sheet", accessToken: "fake", sheetName: "Revenue" }] as any);
    const save = vi.spyOn(storage, "replaceRevenueSourceWithRecords").mockImplementation(async (...args) => {
      expect(args[6]).toBe(sheet("revenue").mappingConfig); expect(args[7]).toEqual({ refreshScope: scope });
      await storage.writeWithGA4RefreshOwnership(args[7]?.refreshScope, async () => {});
      expect(args[5]).toEqual([{ campaignId: campaign.id, date: scope.reportingDate, revenue: "20.00", currency: "EUR" }]);
      return { id: "sheets-revenue" } as any;
    });
    vi.stubGlobal("fetch", vi.fn(async url => {
      if (String(url).includes("?fields=")) return { ok: true, json: async () => ({ sheets: [{ properties: { title: "Revenue", index: 0, gridProperties: { rowCount: 2 } } }] }) };
      if (expired) live = false;
      return { ok: true, json: async () => ({ values: [["Date", "Amount", "Campaign"], [scope.reportingDate, "20", "sale"]] }) };
    }));
    if (expired) await expect(run()).rejects.toThrow("GA4_REFRESH_WORK_OWNERSHIP_LOST");
    else expect(await run()).toMatchObject({ providerJobsAttempted: 1, providerJobsSucceeded: 1 });
    expect(save).toHaveBeenCalledTimes(1);
  });
});
