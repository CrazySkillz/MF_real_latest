import { describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { checkStoredNumbers, compareNumber, resolveMonitorScope, snapshotFingerprint, summarizeNumberChecks, type LiveNumberSnapshot } from "./live-number-checks";
import { checkFinancialProviderNumbers, compareProviderRows, googleMonitorCredential, monitorCredential, readFinancialSourceValues } from "./live-number-provider-checks";
import { liveNumberCheckIsDue, liveNumberConfigSchema, readOnlyMonitorDatabaseUrl, readOnlyMonitorFetch } from "../scripts/check-live-numbers";

const now = new Date("2026-11-05T13:30:00Z");
const fixture = (): LiveNumberSnapshot => {
  const snapshot: LiveNumberSnapshot = {
  campaign: { id: "campaign-a", ownerId: "owner-a", clientId: "client-a", status: "active", currency: "EUR",
    reportingTimeZone: "Europe/Amsterdam", ga4CampaignFilter: '["campaign-utm"]' },
  rows: {
    ga4Connections: [{ id: "connection-a", campaignId: "campaign-a", propertyId: "123", isActive: true, isPrimary: true, importStartDate: "2026-11-03" }],
    ga4OverviewSnapshots: [{ campaignId: "campaign-a", propertyId: "123", windowStart: "2026-11-03", windowEnd: "2026-11-04",
      campaignBreakdown: { meta: { propertyId: "123", currencyCode: "EUR" }, totals: { sessions: 20, users: 12, conversions: 1.5, revenue: 100 },
        rows: [{ campaign: "campaign-utm" }] } }],
    ga4DailyMetrics: ["2026-11-03", "2026-11-04"].map(date => ({ id: date, campaignId: "campaign-a", propertyId: "123", date,
      sessions: 10, users: 8, pageviews: 15, conversions: 0.75, revenue: "50.00", engagedSessions: 5, isSimulated: false })),
    revenueSources: [], revenueRecords: [], spendSources: [{ id: "spend-a", campaignId: "campaign-a", sourceType: "csv", currency: "EUR", isActive: true,
      mappingConfig: JSON.stringify({ spendColumn: "Amount", dateColumn: "Date", storedDateColumn: "Date", csvRowCount: 1,
        csvStoredSpendRows: [{ spendRaw: "100", dateRaw: "2026-11-04" }] }) }],
    spendRecords: [{ id: "record-a", campaignId: "campaign-a", spendSourceId: "spend-a", spend: "100.00", currency: "EUR", date: "2026-11-04" }],
    kpis: [{ id: "kpi-a", campaignId: "campaign-a", platformType: "google_analytics", applyTo: "all", metric: "Total Sessions", currentValue: "20" }],
    benchmarks: [{ id: "benchmark-a", campaignId: "campaign-a", platformType: "google_analytics", applyTo: "all", metric: "conversions", currentValue: "1.5" }],
    metricSnapshots: [{ id: "financial-a", campaignId: "campaign-a", snapshotType: "financial_daily", reportingDate: "2026-11-04", metrics: { financialDaily: {
      version: "financial_daily_snapshot_v1", campaignId: "campaign-a", reportingDate: "2026-11-04", currency: "EUR",
      currentValueWindow: { mode: "initial_import_to_latest_completed_day", startDate: "2026-11-03", endDate: "2026-11-04", dataThroughDate: "2026-11-04", reportingTimeZone: "Europe/Amsterdam" },
      inputs: { revenue: { available: true, value: "100.00", sources: ["ga4"] }, spend: { available: true, value: "100.00", sources: ["spend-a"] },
        conversions: { available: true, value: 1.5, sources: ["ga4"] } },
    } } }], reportSnapshots: [], linkedinReports: [], ga4RefreshWork: [],
  },
};
  const totals = Object.fromEntries(Object.entries({ users: 16, sessions: 20, conversions: 1.5, revenue: 100, spend: 100,
    cvr: 7.5, cpa: 66.67, roas: 1, roi: 0 }).map(([key, value]) => [key, { value, available: true, sources: ["ga4"] }]));
  const window = snapshot.rows.metricSnapshots[0].metrics.financialDaily.currentValueWindow;
  snapshot.rows.metricSnapshots.push({ id: "executive-a", campaignId: "campaign-a", snapshotType: "executive_summary_daily", reportingDate: "2026-11-04", metrics: { executiveSummaryDaily: {
    version: "executive_summary_daily_snapshot_v2", currency: "EUR", ga4PropertyId: "123", ga4CampaignFilter: '["campaign-utm"]',
    performanceSummaryVersion: "performance_summary_aggregate_v3", currentValueWindow: window, sourceSignature: ["ga4"], totals,
  } } });
  snapshot.rows.metricSnapshots.push({ id: "sync-a", campaignId: "campaign-a", snapshotType: "platform_sync", recordedAt: now,
    metrics: { performanceSummary: { currentValueWindow: window, totals } } });
  return snapshot;
};

describe("live-number comparisons", () => {
  it("checks fractional credits and daily summed users without equating them to unique window users", () => {
    const before = fixture(), fingerprint = snapshotFingerprint(before);
    const checks = checkStoredNumbers(before, now);
    expect(checks.length).toBeGreaterThan(10);
    expect(checks.filter(check => check.status !== "passed")).toEqual([]);
    expect(snapshotFingerprint(before)).toBe(fingerprint);
  });
  it.each([null, undefined, "", " ", NaN, Infinity, true, "2EUR"])("does not turn unavailable input %s into zero", value => {
    expect(compareNumber("test", "count", value, 0).status).toBe("unverified");
  });
  it("does not use a percentage tolerance for money or small conversion credits", () => {
    expect(compareNumber("test", "revenue", 100000, 100000.01, { decimals: 2 }).status).toBe("difference");
    expect(compareNumber("test", "conversions", 1e-12, 0, { conversions: true }).status).toBe("difference");
  });
  it.each([
    (s: LiveNumberSnapshot) => { s.rows.ga4OverviewSnapshots[0].propertyId = "999"; },
    (s: LiveNumberSnapshot) => { s.rows.ga4OverviewSnapshots[0].campaignId = "other"; },
    (s: LiveNumberSnapshot) => { s.rows.ga4OverviewSnapshots[0].campaignBreakdown.meta.currencyCode = "USD"; },
    (s: LiveNumberSnapshot) => { s.campaign.reportingTimeZone = "Invalid/Timezone"; },
    (s: LiveNumberSnapshot) => { s.rows.ga4OverviewSnapshots[0].windowEnd = "2026-11-03"; },
    (s: LiveNumberSnapshot) => { s.rows.ga4Connections.push({ ...s.rows.ga4Connections[0], id: "second", propertyId: "456" }); },
    (s: LiveNumberSnapshot) => { s.campaign.ga4CampaignFilter = ""; },
  ])("rejects ambiguous/wrong semantic scope", change => {
    const s = fixture(); change(s);
    expect(() => resolveMonitorScope(s, now)).toThrow();
    expect(checkStoredNumbers(s, now)[0].status).toBe("unverified");
  });
  it("flags missing days and duplicated zero-activity dates", () => {
    const s = fixture(); s.rows.ga4DailyMetrics[1] = { ...s.rows.ga4DailyMetrics[0] };
    expect(checkStoredNumbers(s, now)).toContainEqual(expect.objectContaining({ code: "DAILY_DATE_COVERAGE", status: "difference" }));
  });
  it("finds a KPI and financial snapshot propagation error", () => {
    const s = fixture(); s.rows.kpis[0].currentValue = "999";
    s.rows.metricSnapshots[0].metrics.financialDaily.inputs.revenue.value = "101.00";
    const checks = checkStoredNumbers(s, now);
    expect(checks).toContainEqual(expect.objectContaining({ section: "kpis", status: "difference" }));
    expect(checks).toContainEqual(expect.objectContaining({ section: "Budget & Financial Analysis / Executive Summary", code: "revenue", status: "difference" }));
  });
  it("catches a one-cent ROAS display difference at the half-cent boundary", () => {
    expect(compareNumber("Performance Summary", "roas", 28501.5 / 100, 285.01, { decimals: 2 }).status).toBe("difference");
    expect(compareNumber("Performance Summary", "roas", 28501.5 / 100, 285.02, { decimals: 2 }).status).toBe("passed");
  });
  it("checks Performance Summary inputs only when its full reporting window matches", () => {
    const s = fixture(), summary = s.rows.metricSnapshots[2].metrics.performanceSummary;
    summary.totals = structuredClone(summary.totals);
    summary.totals.sessions.value = 21;
    expect(checkStoredNumbers(s, now)).toContainEqual(expect.objectContaining({ section: "Performance Summary", code: "INPUT_sessions", status: "difference" }));
    summary.currentValueWindow = { ...summary.currentValueWindow, startDate: "2026-11-01" };
    const checks = checkStoredNumbers(s, now);
    expect(checks).toContainEqual(expect.objectContaining({ section: "Performance Summary", code: "SAVED_SOURCE_WINDOW_UNVERIFIED", status: "unverified" }));
    expect(checks.some(check => check.code === "INPUT_sessions")).toBe(false);
  });
  it("does not double count aggregate and attributed revenue grains", () => {
    const s = fixture(); s.rows.spendRecords.push({ ...s.rows.spendRecords[0], id: "attributed", subCampaignUrn: "sub-a" });
    expect(checkStoredNumbers(s, now).filter(c => c.status !== "passed")).toEqual([]);
  });
  it("flags duplicate materialized grains rather than silently summing them", () => {
    const s = fixture(); s.rows.spendRecords.push({ ...s.rows.spendRecords[0], id: "duplicate" });
    expect(checkStoredNumbers(s, now)).toContainEqual(expect.objectContaining({ code: "DUPLICATE_MATERIALIZED_GRAIN", status: "difference" }));
  });
  it("does not reuse a prior result after source edits, deletion or a concurrent refresh", () => {
    const s = fixture(), before = snapshotFingerprint(s); s.rows.spendSources[0].isActive = false;
    expect(snapshotFingerprint(s)).not.toBe(before);
    expect(summarizeNumberChecks("aaaaaaaaaaaa", checkStoredNumbers(fixture(), now), false).status).toBe("unverified");
  });
  it("cannot pass an empty check list or any unverified check", () => {
    expect(summarizeNumberChecks("aaaaaaaaaaaa", [], true).status).toBe("unverified");
    expect(summarizeNumberChecks("aaaaaaaaaaaa", [{ section: "test", code: "AUTH_FAILED", status: "unverified" }], true).status).toBe("unverified");
  });
  it("compares rows by complete dimensional keys, independent of order", () => {
    const rows = [{ date: "2026-11-03", revenue: 1 }, { date: "2026-11-04", revenue: 2 }];
    expect(compareProviderRows("test", rows, [...rows].reverse(), ["date"], ["revenue"]).every(c => c.status === "passed")).toBe(true);
    expect(compareProviderRows("test", rows, [rows[0]], ["date"], ["revenue"])).toContainEqual(expect.objectContaining({ code: "SOURCE_ROW_DIFFERENCE" }));
    expect(compareProviderRows("test", rows, [rows[0], rows[0]], ["date"], ["revenue"])[0].status).toBe("unverified");
  });
});

describe("source reads", () => {
  it("compares the complete saved CSV, not preview rows, and performs no requests", async () => {
    const s = fixture(), request = vi.fn();
    expect((await checkFinancialProviderNumbers(s, now, request as any)).every(c => c.status === "passed")).toBe(true);
    expect(request).not.toHaveBeenCalled();
    s.rows.spendRecords[0].spend = "200";
    expect(await checkFinancialProviderNumbers(s, now, request as any)).toContainEqual(expect.objectContaining({ code: "SOURCE_value", status: "difference" }));
  });
  it("rejects truncated CSV history and unsupported providers explicitly", async () => {
    const s = fixture(), config = JSON.parse(s.rows.spendSources[0].mappingConfig); config.csvRowCount = 2;
    s.rows.spendSources[0].mappingConfig = JSON.stringify(config);
    expect(await checkFinancialProviderNumbers(s, now)).toContainEqual(expect.objectContaining({ code: "CSV_ORIGINAL_ROWS_UNVERIFIED", status: "unverified" }));
    s.rows.spendSources[0].sourceType = "unknown";
    expect(await checkFinancialProviderNumbers(s, now)).toContainEqual(expect.objectContaining({ code: "PROVIDER_ADAPTER_NOT_VERIFIED" }));
  });
  it("never renews expired credentials or falls back from failed decryption to plaintext", () => {
    expect(() => monitorCredential({ accessToken: "private", expiresAt: "2000-01-01" })).toThrow("PROVIDER_CREDENTIAL_UNAVAILABLE");
    expect(() => monitorCredential({ accessToken: "private", encryptedTokens: { v: 1, accessToken: {} } })).toThrow("PROVIDER_CREDENTIAL_UNAVAILABLE");
  });
  it("obtains Google read access in memory without changing the saved credential", async () => {
    const connection = { isActive: true, accessToken: "old", expiresAt: "2000-01-01", refreshToken: "refresh", clientId: "client", clientSecret: "secret" };
    const before = JSON.stringify(connection);
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ access_token: "new", expires_in: 3600 })));
    expect(await googleMonitorCredential(connection, request)).toBe("new");
    expect(JSON.stringify(connection)).toBe(before);
    expect(request.mock.calls[0][0]).toBe("https://oauth2.googleapis.com/token");
    expect(request.mock.calls[0][1]).toEqual(expect.objectContaining({ redirect: "error", method: "POST" }));
  });
  it("checks a Sheets mapping using only GET and rejects mismatched tabs", async () => {
    const s = fixture(), source = { id: "sheet-a", campaignId: "campaign-a", sourceType: "google_sheets", currency: "EUR", mappingConfig: JSON.stringify({
      spreadsheetId: "sheet-id", sheetName: "Revenue", revenueColumn: "Amount", dateColumn: "Date", campaignColumn: "Campaign", campaignValues: ["selected"],
    }) };
    s.rows.googleSheetsConnections = [{ id: "connection", isActive: true, campaignId: "campaign-a", spreadsheetId: "sheet-id", sheetName: "Revenue", accessToken: "private" }];
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ values: [["Amount", "Date", "Campaign"], ["50", "2026-11-04", "selected"], ["9000", "2026-11-04", "other"]] })));
    expect(await readFinancialSourceValues(s, source, "revenue", request)).toEqual([{ date: "2026-11-04", value: 50 }]);
    expect(request.mock.calls[0][1]).toEqual(expect.objectContaining({ method: "GET", redirect: "error" }));
    s.rows.googleSheetsConnections[0].sheetName = "Other";
    await expect(readFinancialSourceValues(s, source, "revenue", request)).rejects.toThrow("SHEET_SCOPE_UNVERIFIED");
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("treats HTTP failure as unverified, not a zero matching empty records", async () => {
    const s = fixture(); s.rows.revenueSources = [{ id: "sheet-a", campaignId: "campaign-a", isActive: true, sourceType: "google_sheets", currency: "EUR",
      mappingConfig: JSON.stringify({ spreadsheetId: "sheet-id", sheetName: "Revenue", revenueColumn: "Amount", dateColumn: "Date" }) }];
    s.rows.googleSheetsConnections = [{ isActive: true, campaignId: "campaign-a", spreadsheetId: "sheet-id", sheetName: "Revenue", accessToken: "private" }];
    const request = vi.fn().mockResolvedValue(new Response("secret body", { status: 429 }));
    const checks = await checkFinancialProviderNumbers(s, now, request);
    expect(checks).toContainEqual(expect.objectContaining({ code: "PROVIDER_REQUEST_FAILED", status: "unverified" }));
    expect(JSON.stringify(checks)).not.toContain("secret");
  });
  it("reads scoped HubSpot deals, rejects duplicate pages and never requests a connection refresh", async () => {
    const s = fixture(); s.rows.hubspotConnections = [{ campaignId: "campaign-a", isActive: true, accessToken: "private" }];
    const source = { campaignId: "campaign-a", currency: "EUR", sourceType: "hubspot", mappingConfig: JSON.stringify({ dailyMaterialization: "selected_date_field_v1",
      lastSyncedAt: "2026-11-05T13:00:00Z", days: 30, selectedValues: ["selected"], stageIds: ["won"], dateField: "closedate", campaignProperty: "campaign", revenueProperty: "amount" }) };
    const row = { id: "deal-a", properties: { closedate: "2026-11-04", campaign: "selected", amount: "12.50", dealstage: "won", deal_currency_code: "EUR" } };
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [row], total: 1 })));
    expect(await readFinancialSourceValues(s, source, "revenue", request)).toEqual({ startDate: "2026-10-07", values: [{ date: "2026-11-04", value: 12.5 }] });
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0][0]).toBe("https://api.hubapi.com/crm/v3/objects/deals/search");
    expect(JSON.parse(request.mock.calls[0][1].body).filterGroups[0].filters).toContainEqual({ propertyName: "campaign", operator: "IN", values: ["selected"] });
    request.mockResolvedValue(new Response(JSON.stringify({ results: [row, row], total: 2 })));
    await expect(readFinancialSourceValues(s, source, "revenue", request)).rejects.toThrow();
  });
  it("reads scoped Salesforce opportunity dates/currencies and rejects hostile fields before requesting", async () => {
    const s = fixture(); s.rows.salesforceConnections = [{ campaignId: "campaign-a", isActive: true, accessToken: "private", instanceUrl: "https://tenant.my.salesforce.com" }];
    const mapping = { dailyMaterialization: "selected_date_field_v1", lastSyncedAt: "2026-11-05T13:00:00Z", days: 30,
      selectedValues: ["selected"], dateField: "CloseDate", campaignField: "Campaign__c", revenueField: "Amount" };
    const source = { campaignId: "campaign-a", currency: "EUR", sourceType: "salesforce", mappingConfig: JSON.stringify(mapping) };
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ records: [{ Id: "opp-a", Campaign__c: "selected", CloseDate: "2026-11-04", Amount: 20, CurrencyIsoCode: "EUR" }], done: true, totalSize: 1 })));
    expect(await readFinancialSourceValues(s, source, "revenue", request)).toEqual({ startDate: "2026-10-07", values: [{ date: "2026-11-04", value: 20 }] });
    expect(new URL(request.mock.calls[0][0]).searchParams.get("q")).toContain("Campaign__c IN ('selected')");
    source.mappingConfig = JSON.stringify({ ...mapping, campaignField: "Id FROM User" });
    await expect(readFinancialSourceValues(s, source, "revenue", request)).rejects.toThrow("CRM_MAPPING_UNVERIFIED");
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("reads only selected paid Shopify orders and preserves separate order identities on one date", async () => {
    const s = fixture(); s.rows.shopifyConnections = [{ campaignId: "campaign-a", isActive: true, accessToken: "private", shopDomain: "test-store.myshopify.com" }];
    const source = { campaignId: "campaign-a", sourceType: "shopify", currency: "EUR", mappingConfig: JSON.stringify({ orderWindowStart: "2026-11-01T00:00:00Z",
      revenueMetric: "current_total_price", orderDateBasis: "created_at_campaign_reporting_timezone", currencyBasis: "shop_money_campaign_parity", selectedValues: ["selected"], campaignField: "tags" }) };
    const request = vi.fn(async (url: any) => String(url).includes("access_scopes") ? new Response(JSON.stringify({ access_scopes: [{ handle: "read_orders" }, { handle: "read_all_orders" }] }))
      : new Response(JSON.stringify({ orders: [{ id: 1, tags: "selected", test: false, financial_status: "paid", current_total_price: "10.00", currency: "EUR", created_at: "2026-11-04T10:00:00Z" },
        { id: 2, tags: "other", test: false, financial_status: "paid", current_total_price: "500.00", currency: "EUR", created_at: "2026-11-04T10:00:00Z" }] }), { headers: { "X-Shopify-API-Version": "2026-07" } }));
    expect(await readFinancialSourceValues(s, source, "revenue", request as any)).toEqual([{ date: "2026-11-04", value: 10 }]);
    expect(request).toHaveBeenCalledTimes(2);
  });
});

describe("operator safety", () => {
  it("blocks provider mutations and unknown hosts before sending credentials, and refuses redirects", async () => {
    const request = vi.fn().mockResolvedValue(new Response("{}"));
    const safe = readOnlyMonitorFetch(request);
    await expect(safe("https://api.hubapi.com/crm/v3/objects/deals", { method: "POST", body: "{}" })).rejects.toThrow("MONITOR_PROVIDER_WRITE_OR_HOST_BLOCKED");
    await expect(safe("https://example.com/token", { method: "POST" })).rejects.toThrow();
    await expect(safe("https://store.myshopify.com/admin/api/2026-07/graphql.json", { method: "POST", body: JSON.stringify({ query: "mutation { orderDelete { id } }" }) })).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
    await safe("https://analyticsdata.googleapis.com/v1beta/properties/123:runReport", { method: "POST", body: "{}" });
    expect(request.mock.calls[0][1].redirect).toBe("error");
  });
  it("uses each campaign's local schedule, including daylight saving time, and only one ten-minute slot", () => {
    expect(liveNumberCheckIsDue("Europe/Amsterdam", new Date("2026-11-05T13:20:00Z"))).toBe(true);
    expect(liveNumberCheckIsDue("Europe/Amsterdam", new Date("2026-07-05T12:20:00Z"))).toBe(true);
    expect(liveNumberCheckIsDue("Europe/Amsterdam", new Date("2026-11-05T13:30:00Z"))).toBe(false);
    expect(liveNumberCheckIsDue("America/New_York", new Date("2026-11-05T13:20:00Z"))).toBe(true);
    expect(liveNumberCheckIsDue("Europe/Amsterdam", new Date("2026-11-05T13:19:59Z"))).toBe(false);
  });
  it("pins the exact database and forces read-only sessions, replacing unsafe options", () => {
    const fingerprint = createHash("sha256").update(JSON.stringify(["db.example.com", "5432", "/app_test"])).digest("hex");
    const result = new URL(readOnlyMonitorDatabaseUrl("postgresql://user:password@db.example.com/app_test?options=-c%20default_transaction_read_only=off", fingerprint));
    expect(result.searchParams.get("options")).toContain("default_transaction_read_only=on");
    expect(() => readOnlyMonitorDatabaseUrl("postgresql://user:password@db.example.com/app_live", fingerprint)).toThrow("MONITOR_DATABASE_IDENTITY_MISMATCH");
  });
  it("rejects empty or duplicate campaign configurations", () => {
    const config = { databaseEnvironmentVariable: "MONITOR_DB", databaseFingerprint: "0".repeat(64), campaigns: [] };
    expect(liveNumberConfigSchema.safeParse(config).success).toBe(false);
    const campaign = { campaignIdHash: "a".repeat(12), reportingTimeZone: "Europe/Amsterdam" };
    expect(liveNumberConfigSchema.safeParse({ ...config, campaigns: [campaign] }).success).toBe(true);
    expect(liveNumberConfigSchema.safeParse({ ...config, campaigns: [campaign, campaign] }).success).toBe(false);
  });
});
