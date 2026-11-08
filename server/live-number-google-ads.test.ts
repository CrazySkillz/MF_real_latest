import { afterEach, describe, expect, it, vi } from "vitest";
import { checkFinancialProviderNumbers, readFinancialSourceValues } from "./live-number-provider-checks";
import { readOnlyMonitorFetch } from "../scripts/check-live-numbers";
import { type LiveNumberSnapshot } from "./live-number-checks";

const hydrate = vi.hoisted(() => vi.fn());
vi.mock("./utils/google-ads-service-account", () => ({ hydrateGoogleAdsServiceAccountConnection: hydrate }));
const now = new Date("2026-11-08T20:00:00Z");
const url = "https://googleads.googleapis.com/v25/customers/4951281615/googleAds:searchStream";
const fixture = (): LiveNumberSnapshot => ({
  campaign: { id: "campaign", ownerId: "owner", clientId: "client", status: "active", currency: "EUR", reportingTimeZone: "Europe/Amsterdam", ga4CampaignFilter: '["selected"]' },
  rows: {
    ga4Connections: [{ campaignId: "campaign", propertyId: "123", isActive: true, isPrimary: true, importStartDate: "2026-11-01" }],
    ga4OverviewSnapshots: [{ campaignId: "campaign", propertyId: "123", windowStart: "2026-11-01", windowEnd: "2026-11-07", campaignBreakdown: { meta: { propertyId: "123", currencyCode: "EUR" } } }],
    ga4GoogleAdsSpendConnections: [{ campaignId: "campaign", customerId: "4951281615", managerAccountId: "1234567890", method: "oauth", spendOnly: true, accessToken: "private-access", developerToken: "private-developer" }],
    spendSources: [{ id: "source", campaignId: "campaign", currency: "EUR", sourceType: "ad_platforms", platformContext: "ga4", isActive: true, mappingConfig: { platform: "google_ads", selectedCampaignIds: ["10", "20"] } }],
    spendRecords: [{ campaignId: "campaign", spendSourceId: "source", currency: "EUR", date: "2026-09-23", spend: "4.890002", subCampaignUrn: null }],
  },
});
const metadata = () => [{ results: [{ customer: { id: "4951281615", manager: false, currencyCode: "EUR", timeZone: "Europe/Amsterdam" } }] }];
const facts = () => [
  { results: [{ campaign: { id: "10" }, segments: { date: "2026-09-23" }, metrics: { costMicros: "2000001" } }] },
  { results: [{ campaign: { id: "20" }, segments: { date: "2026-09-23" }, metrics: { costMicros: "2890001" } }] },
];
const provider = (account: any = metadata(), daily: any = facts()) => vi.fn(async (_url: any, options: any) =>
  new Response(JSON.stringify(JSON.parse(options.body).query.includes(" FROM customer ") ? account : daily)));
const read = (snapshot: LiveNumberSnapshot, request: typeof fetch) => readFinancialSourceValues(snapshot, snapshot.rows.spendSources[0], "spend", request);

afterEach(() => { vi.unstubAllEnvs(); hydrate.mockReset(); });

describe("Google Ads read-only spend monitoring", () => {
  it("compares exact selected daily provider micros with stored spend, across stream batches and outside the GA4 traffic window", async () => {
    const snapshot = fixture(), before = JSON.stringify(snapshot), raw = provider();
    expect(await checkFinancialProviderNumbers(snapshot, now, readOnlyMonitorFetch(raw))).toEqual([
      expect.objectContaining({ code: "SOURCE_costMicros", status: "passed" }),
    ]);
    expect(raw).toHaveBeenCalledTimes(2);
    expect(raw.mock.calls[1][0].toString()).toBe(url);
    expect(JSON.parse(raw.mock.calls[1][1].body).query).toBe("SELECT campaign.id, segments.date, metrics.cost_micros FROM campaign WHERE segments.date BETWEEN '2000-01-01' AND '2026-11-07' AND campaign.status != 'REMOVED' AND campaign.id IN (10, 20) ORDER BY segments.date");
    expect(raw.mock.calls[1][1]).toMatchObject({ redirect: "error", headers: { "login-customer-id": "1234567890", "developer-token": "private-developer", Authorization: "Bearer private-access" } });
    expect(JSON.stringify(snapshot)).toBe(before);
    snapshot.rows.spendRecords[0].spend = "4.890001";
    expect(await checkFinancialProviderNumbers(snapshot, now, readOnlyMonitorFetch(provider()))).toContainEqual(expect.objectContaining({ code: "SOURCE_costMicros", status: "difference" }));
  });
  it("uses the campaign start and excludes current-day data", async () => {
    const snapshot = fixture(), raw = provider(metadata(), []);
    snapshot.campaign.startDate = "2026-10-01T00:00:00Z"; snapshot.rows.spendRecords = [];
    expect(await read(snapshot, readOnlyMonitorFetch(raw))).toEqual({ startDate: "2026-10-01", values: [] });
    expect(JSON.parse(raw.mock.calls[1][1].body).query).toContain("BETWEEN '2026-10-01' AND '2026-11-07'");
  });
  it.each(["foreign source", "foreign connection", "duplicate connection", "test mode", "main platform", "empty selection", "duplicate selection", "invalid selection", "bad customer", "bad manager", "bad start", "older spend"])("rejects %s before provider access", async problem => {
    const snapshot = fixture(), source = snapshot.rows.spendSources[0], connection = snapshot.rows.ga4GoogleAdsSpendConnections[0], raw = provider();
    if (problem === "foreign source") source.campaignId = "foreign";
    if (problem === "foreign connection") connection.campaignId = "foreign";
    if (problem === "duplicate connection") snapshot.rows.ga4GoogleAdsSpendConnections.push({ ...connection });
    if (problem === "test mode") connection.method = "test";
    if (problem === "main platform") connection.spendOnly = false;
    if (problem === "empty selection") source.mappingConfig.selectedCampaignIds = [];
    if (problem === "duplicate selection") source.mappingConfig.selectedCampaignIds = ["10", "10"];
    if (problem === "invalid selection") source.mappingConfig.selectedCampaignIds = ["10) OR TRUE"];
    if (problem === "bad customer") connection.customerId = "other";
    if (problem === "bad manager") connection.managerAccountId = "other";
    if (problem === "bad start") snapshot.campaign.startDate = "bad";
    if (problem === "older spend") snapshot.campaign.startDate = "2026-11-01";
    await expect(read(snapshot, readOnlyMonitorFetch(raw))).rejects.toThrow(); expect(raw).not.toHaveBeenCalled();
  });
  it.each(["id", "currencyCode", "timeZone", "manager"])("rejects mismatched account %s", async field => {
    const account = metadata(); (account[0].results[0].customer as any)[field] = field === "manager" ? true : "other";
    const raw = provider(account);
    await expect(read(fixture(), readOnlyMonitorFetch(raw))).rejects.toThrow("GOOGLE_ADS_ACCOUNT_UNVERIFIED"); expect(raw).toHaveBeenCalledTimes(1);
  });
  it.each(["foreign campaign", "future date", "invalid date", "duplicate row", "negative cost", "missing cost", "unsafe cost", "malformed stream", "partial stream"])("fails closed on %s", async problem => {
    const daily: any = facts(), row = daily[0].results[0];
    if (problem === "foreign campaign") row.campaign.id = "30";
    if (problem === "future date") row.segments.date = "2026-11-08";
    if (problem === "invalid date") row.segments.date = "2026-02-30";
    if (problem === "duplicate row") daily[1].results.push(structuredClone(row));
    if (problem === "negative cost") row.metrics.costMicros = "-1";
    if (problem === "missing cost") delete row.metrics.costMicros;
    if (problem === "unsafe cost") row.metrics.costMicros = "9007199254740992";
    if (problem === "malformed stream") daily[1].results = {};
    if (problem === "partial stream") daily[1].nextPageToken = "unexpected";
    const checks = await checkFinancialProviderNumbers(fixture(), now, readOnlyMonitorFetch(provider(metadata(), daily)));
    expect(checks).toHaveLength(1); expect(checks[0].status).toBe("unverified");
  });
  it("distinguishes a successful empty response from denied access or missing saved rows", async () => {
    const snapshot = fixture(); snapshot.rows.spendRecords = [];
    expect(await checkFinancialProviderNumbers(snapshot, now, readOnlyMonitorFetch(provider(metadata(), [])))).toContainEqual(expect.objectContaining({ code: "SOURCE_EMPTY_RESULT_MATCH", status: "passed" }));
    expect(await checkFinancialProviderNumbers(fixture(), now, readOnlyMonitorFetch(provider(metadata(), [])))).toContainEqual(expect.objectContaining({ code: "SOURCE_ROW_DIFFERENCE", status: "difference" }));
    const denied = vi.fn(async () => new Response('private provider failure', { status: 403 }));
    expect(await checkFinancialProviderNumbers(snapshot, now, readOnlyMonitorFetch(denied))).toContainEqual(expect.objectContaining({ code: "GOOGLE_ADS_PROVIDER_UNVERIFIED", status: "unverified" }));
  });
  it("renews OAuth access only in memory using Ads credentials", async () => {
    const snapshot = fixture(), connection = snapshot.rows.ga4GoogleAdsSpendConnections[0];
    connection.expiresAt = "2020-01-01"; connection.refreshToken = "private-refresh";
    vi.stubEnv("GOOGLE_ADS_CLIENT_ID", "ads-client"); vi.stubEnv("GOOGLE_ADS_CLIENT_SECRET", "ads-secret");
    const original = JSON.stringify(snapshot), api = provider();
    const raw = vi.fn(async (input: any, options: any) => input.toString().includes("/token")
      ? new Response(JSON.stringify({ access_token: "renewed", expires_in: 3600 })) : api(input, options));
    await read(snapshot, readOnlyMonitorFetch(raw));
    expect(new URLSearchParams(raw.mock.calls[0][1].body).get("client_id")).toBe("ads-client");
    expect(api.mock.calls[0][1].headers.Authorization).toBe("Bearer renewed"); expect(JSON.stringify(snapshot)).toBe(original);
  });
  it("uses existing service-account authorization and never bypasses a failed grant", async () => {
    const snapshot = fixture(), connection = snapshot.rows.ga4GoogleAdsSpendConnections[0]; connection.method = "service_account";
    hydrate.mockResolvedValue({ ...connection, accessToken: "service-token" });
    const raw = provider(); await read(snapshot, readOnlyMonitorFetch(raw));
    expect(hydrate).toHaveBeenCalledWith(connection); expect(raw.mock.calls[0][1].headers.Authorization).toBe("Bearer service-token");
    hydrate.mockRejectedValue(new Error("SERVICE_ACCOUNT_ACCESS_DENIED")); raw.mockClear();
    await expect(read(snapshot, readOnlyMonitorFetch(raw))).rejects.toThrow("SERVICE_ACCOUNT_ACCESS_DENIED"); expect(raw).not.toHaveBeenCalled();
  });
  it("permits only the exact read queries and rejects provider mutations, extra bodies and unknown hosts", async () => {
    const raw = vi.fn(async () => new Response("[]")), safe = readOnlyMonitorFetch(raw);
    for (const [target, body] of [
      [url.replace("searchStream", "mutate"), { query: "SELECT customer.id FROM customer" }],
      [url, { query: "UPDATE campaign SET status = PAUSED" }],
      [url, { query: "SELECT customer.id FROM customer" }],
      [url, { query: "SELECT customer.id, customer.manager, customer.currency_code, customer.time_zone FROM customer LIMIT 1", operations: [] }],
      [url.replace("googleads.googleapis.com", "example.com"), { query: "SELECT customer.id FROM customer" }],
    ] as const) await expect(safe(target, { method: "POST", body: JSON.stringify(body) })).rejects.toThrow("MONITOR_PROVIDER_WRITE_OR_HOST_BLOCKED");
    expect(raw).not.toHaveBeenCalled();
  });
});
