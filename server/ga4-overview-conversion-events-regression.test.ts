import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ga4Service } from "./analytics";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
const between = (source: string, start: string, end: string) => {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThan(-1);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
};

const connection = {
  id: "connection-1",
  propertyId: "properties/987654",
  accessToken: "token",
  refreshToken: "refresh",
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GA4 Overview Conversion Events certification boundary", () => {
  it("keeps the exact four-column nonzero-conversion contract in UI and PDFs", () => {
    const client = read("client/src/pages/ga4-metrics.tsx");
    const scheduled = read("server/ga4-scheduled-report-pdf.ts");
    const ui = between(client, "{/* Conversion Events */}", "{/* Modals (rendered always) */}");
    const browserPdf = between(client, "if (includeOverviewConversionEvents)", "// ========== AD COMPARISON");
    const scheduledPdf = between(scheduled, "if (includeConversionEvents)", "if (sections.ads)");

    for (const section of [ui, browserPdf, scheduledPdf]) {
      expect(section).toMatch(/Event|EVENT/);
      expect(section).toMatch(/Conversions|CONVERSIONS/);
      expect(section).toMatch(/Event Count|EVENT COUNT/);
      expect(section).toMatch(/Users|USERS/);
      expect(section).not.toMatch(/Revenue|REVENUE/);
    }
    expect(ui).toContain("ga4ConversionEvents.rows.slice(0, 25)");
    expect(browserPdf).toContain("ga4ConversionEvents.rows : []).slice(0, 25)");
    expect(scheduledPdf).toContain("payload.conversionEvents?.rows || []).slice(0, 25)");
  });

  it("keeps the route on campaign access, exact property, fixed import window, and read-only validation", () => {
    const routes = read("server/routes-oauth.ts");
    const section = between(
      routes,
      'app.get("/api/campaigns/:id/ga4-conversion-events"',
      'app.get("/api/campaigns/:id/ga4-breakdown"',
    );

    expect(section).toContain("ensureCampaignAccess(req as any, res as any, campaignId)");
    expect(section).toContain("storage.getGA4Connection(campaignId, propertyId)");
    expect(section).toContain("resolveGA4ImportToDateWindow((connection as any)?.importStartDate, (campaign as any)?.reportingTimeZone)");
    expect(section).toContain("importToDateWindow?.endDate");
    expect(section).toContain("GA4_PROPERTY_SCOPE_REQUIRED");
    expect(section).toContain("GA4_CAMPAIGN_SCOPE_REQUIRED");
    expect(section).toContain("validationReadOnly");
    expect(section).toContain('res.setHeader("X-GA4-Validation-Read-Only", "1")');
  });

  it("refreshes on reload, focus, reconnect, and interval without cross-scope placeholder data", () => {
    const client = read("client/src/pages/ga4-metrics.tsx");
    const section = between(
      client,
      'queryKey: ["/api/campaigns", campaignId, "ga4-conversion-events"',
      "// Spend/Revenue to-date",
    );

    expect(section).toContain("staleTime: 0");
    expect(section).toContain("refetchOnWindowFocus: true");
    expect(section).toContain("refetchOnReconnect: true");
    expect(section).toContain("refetchInterval: 10 * 60 * 1000");
    expect(section).toContain("refetchIntervalInBackground: true");
    expect(section).toContain("previousKey?.[1] === campaignId");
    expect(section).toContain("previousKey?.[4] === selectedGA4PropertyId");
    expect(section).toContain("params.set('readOnly', '1')");
    expect(client).toContain('if (needsConversionEvents && conversionEventsUnavailable) unavailable.push("Conversion Events")');
  });

  it("uses the exact requested campaign connection, date boundary, and saved campaign filter", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        rowCount: 1,
        rows: [{
          dimensionValues: [{ value: "purchase" }],
          metricValues: [{ value: "2.5" }, { value: "7" }, { value: "5" }, { value: "19" }],
        }],
      }),
    }) as any);
    vi.stubGlobal("fetch", fetchMock);
    const getGA4Connection = vi.fn(async () => connection);

    const result = await ga4Service.getConversionEventsReport(
      "campaign-exact", { getGA4Connection }, "2026-08-01", "987654", 50,
      ["saved-a", "saved-b"], "2026-09-14",
    );

    expect(getGA4Connection).toHaveBeenCalledWith("campaign-exact", "987654");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/properties/987654:runReport");
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body || "{}"));
    expect(body.dateRanges).toEqual([{ startDate: "2026-08-01", endDate: "2026-09-14" }]);
    expect(body.dimensionFilter.orGroup.expressions.map((item: any) => item.filter.stringFilter.value)).toEqual(["saved-a", "saved-b"]);
    expect(body.dimensionFilter.orGroup.expressions.every((item: any) => item.filter.stringFilter.matchType === "EXACT")).toBe(true);
    expect(body.dimensionFilter.orGroup.expressions.every((item: any) => item.filter.stringFilter.caseSensitive === false)).toBe(true);
    expect(result.rows).toEqual([{ eventName: "purchase", conversions: 2.5, eventCount: 7, users: 5, revenue: 19 }]);
  });

  it("uses only the ordered exact first-user fallback and excludes zero-conversion events", async () => {
    const fetchMock = vi.fn(async (_url: string, init: any) => {
      const body = JSON.parse(String(init?.body || "{}"));
      const filter = JSON.stringify(body.dimensionFilter || {});
      const rows = filter.includes("firstUserCampaignName")
        ? [
            { dimensionValues: [{ value: "purchase" }], metricValues: [{ value: "3" }, { value: "4" }, { value: "2" }, { value: "10" }] },
            { dimensionValues: [{ value: "page_view" }], metricValues: [{ value: "0" }, { value: "20" }, { value: "8" }, { value: "0" }] },
          ]
        : [{ dimensionValues: [{ value: "page_view" }], metricValues: [{ value: "0" }, { value: "20" }, { value: "8" }, { value: "0" }] }];
      return { ok: true, json: async () => ({ rowCount: rows.length, rows }) } as any;
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await ga4Service.getConversionEventsReport(
      "campaign-1", { getGA4Connection: vi.fn(async () => connection) },
      "2026-08-01", "987654", 50, "saved-a", "2026-09-14",
    );

    expect(result.rows).toEqual([{ eventName: "purchase", conversions: 3, eventCount: 4, users: 2, revenue: 10 }]);
    const bodies = fetchMock.mock.calls.map(([, init]) => JSON.parse(String((init as any)?.body || "{}")));
    expect(bodies).toHaveLength(2);
    expect(JSON.stringify(bodies[0].dimensionFilter)).toContain("sessionCampaignName");
    expect(JSON.stringify(bodies[1].dimensionFilter)).toContain("firstUserCampaignName");
    expect(bodies[1].dimensionFilter.filter.stringFilter).toMatchObject({
      matchType: "EXACT", value: "saved-a", caseSensitive: false,
    });
    expect(JSON.stringify(bodies)).not.toContain("pageLocation");
  });

  it("reaches first-user manual campaign only after both preceding exact scopes have no conversions", async () => {
    const fetchMock = vi.fn(async (_url: string, init: any) => {
      const filter = JSON.stringify(JSON.parse(String(init?.body || "{}")).dimensionFilter || {});
      const rows = filter.includes("firstUserManualCampaignName")
        ? [{ dimensionValues: [{ value: "manual_purchase" }], metricValues: [{ value: "1.25" }, { value: "2" }, { value: "2" }, { value: "0" }] }]
        : [{ dimensionValues: [{ value: "page_view" }], metricValues: [{ value: "0" }, { value: "5" }, { value: "4" }, { value: "0" }] }];
      return { ok: true, json: async () => ({ rowCount: rows.length, rows }) } as any;
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await ga4Service.getConversionEventsReport(
      "campaign-1", { getGA4Connection: vi.fn(async () => connection) },
      "2026-08-01", "987654", 50, "saved-a", "2026-09-14",
    );
    const filters = fetchMock.mock.calls.map(([, init]) => JSON.stringify(JSON.parse(String((init as any)?.body || "{}")).dimensionFilter));
    expect(filters).toHaveLength(3);
    expect(filters[0]).toContain("sessionCampaignName");
    expect(filters[1]).toContain("firstUserCampaignName");
    expect(filters[2]).toContain("firstUserManualCampaignName");
    expect(result.rows).toEqual([{ eventName: "manual_purchase", conversions: 1.25, eventCount: 2, users: 2, revenue: 0 }]);
  });

  it("completes provider pagination with deterministic ordering before applying the API limit", async () => {
    const rows = [
      { dimensionValues: [{ value: "purchase" }], metricValues: [{ value: "4" }, { value: "8" }, { value: "3" }, { value: "20" }] },
      { dimensionValues: [{ value: "generate_lead" }], metricValues: [{ value: "2.5" }, { value: "6" }, { value: "4" }, { value: "0" }] },
      { dimensionValues: [{ value: "page_view" }], metricValues: [{ value: "0" }, { value: "30" }, { value: "9" }, { value: "0" }] },
    ];
    const fetchMock = vi.fn(async (_url: string, init: any) => {
      const body = JSON.parse(String(init?.body || "{}"));
      const offset = Number(body.offset || 0);
      return { ok: true, json: async () => ({ rowCount: rows.length, rows: rows.slice(offset, offset + 1) }) } as any;
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await ga4Service.getConversionEventsReport(
      "campaign-1", { getGA4Connection: vi.fn(async () => connection) },
      "2026-08-01", "987654", 1, "saved-a", "2026-09-14",
    );

    expect(result.rows).toEqual([{ eventName: "purchase", conversions: 4, eventCount: 8, users: 3, revenue: 20 }]);
    expect(result.totals).toEqual({ conversions: 4, eventCount: 8, users: 3, revenue: 20 });
    const bodies = fetchMock.mock.calls.map(([, init]) => JSON.parse(String((init as any)?.body || "{}")));
    expect(bodies.map((body) => body.offset)).toEqual([0, 1, 2]);
    expect(bodies[0].orderBys).toEqual([
      { metric: { metricName: "conversions" }, desc: true },
      { dimension: { dimensionName: "eventName" } },
    ]);
  });

  it("fails closed on duplicate provider event names", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({
        rowCount: 2,
        rows: [1, 2].map(() => ({
          dimensionValues: [{ value: "purchase" }],
          metricValues: [{ value: "1" }, { value: "1" }, { value: "1" }, { value: "1" }],
        })),
      }),
    })));

    await expect(ga4Service.getConversionEventsReport(
      "campaign-1", { getGA4Connection: vi.fn(async () => connection) },
      "2026-08-01", "987654", 50, "saved-a", "2026-09-14",
    )).rejects.toThrow("GA4_CONVERSION_EVENT_DUPLICATE_ROWS");
  });

  it("fails closed on incomplete pagination and missing saved campaign scope", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ rowCount: 2, rows: [] }),
    })));
    const storage = { getGA4Connection: vi.fn(async () => connection) };

    await expect(ga4Service.getConversionEventsReport(
      "campaign-1", storage, "2026-08-01", "987654", 1, "saved-a", "2026-09-14",
    )).rejects.toThrow("GA4_CONVERSION_EVENT_PAGINATION_INCOMPLETE");
    await expect(ga4Service.getConversionEventsReport(
      "campaign-1", storage, "2026-08-01", "987654", 50, undefined, "2026-09-14",
    )).rejects.toThrow("GA4_CAMPAIGN_SCOPE_REQUIRED");
    await expect(ga4Service.getConversionEventsReport(
      "campaign-1", storage, "2026-08-01", undefined, 50, "saved-a", "2026-09-14",
    )).rejects.toThrow("GA4_PROPERTY_SCOPE_REQUIRED");
  });

  it("accepts GA4's canonical empty default but rejects noncanonical or changing row counts", async () => {
    const storage = { getGA4Connection: vi.fn(async () => connection) };
    const canonicalEmpty = {
      dimensionHeaders: [{ name: "eventName" }],
      metricHeaders: ["conversions", "eventCount", "totalUsers", "totalRevenue"].map((name) => ({ name })),
    };
    const canonicalFetch = vi.fn(async () => ({ ok: true, json: async () => canonicalEmpty }));
    vi.stubGlobal("fetch", canonicalFetch);
    await expect(ga4Service.getConversionEventsReport(
      "campaign-1", storage, "2026-08-01", "987654", 1, "saved-a", "2026-09-14",
    )).resolves.toMatchObject({ rows: [], totals: { conversions: 0, eventCount: 0, users: 0, revenue: 0 } });
    expect(canonicalFetch).toHaveBeenCalledTimes(3);

    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ rows: [] }) })));
    await expect(ga4Service.getConversionEventsReport(
      "campaign-1", storage, "2026-08-01", "987654", 1, "saved-a", "2026-09-14",
    )).rejects.toThrow("GA4_CONVERSION_EVENT_PAGINATION_INCOMPLETE");

    let request = 0;
    vi.stubGlobal("fetch", vi.fn(async () => {
      request += 1;
      return {
        ok: true,
        json: async () => request === 1
          ? { rowCount: 2, rows: [{ dimensionValues: [{ value: "purchase" }], metricValues: [{ value: "2" }, { value: "2" }, { value: "2" }, { value: "2" }] }] }
          : { rowCount: 3, rows: [{ dimensionValues: [{ value: "sign_up" }], metricValues: [{ value: "1" }, { value: "1" }, { value: "1" }, { value: "0" }] }] },
      };
    }));
    await expect(ga4Service.getConversionEventsReport(
      "campaign-1", storage, "2026-08-01", "987654", 1, "saved-a", "2026-09-14",
    )).rejects.toThrow("rowCount changed during pagination");
  });

  it("rejects malformed native metrics instead of coercing provider values", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({
        rowCount: 1,
        rows: [{
          dimensionValues: [{ value: "purchase" }],
          metricValues: [{ value: "2.5" }, { value: "7.5" }, { value: "5" }, { value: "19" }],
        }],
      }),
    })));
    await expect(ga4Service.getConversionEventsReport(
      "campaign-1", { getGA4Connection: vi.fn(async () => connection) },
      "2026-08-01", "987654", 50, "saved-a", "2026-09-14",
    )).rejects.toThrow("GA4_CONVERSION_EVENT_PROVIDER_VALUE_UNSAFE: eventCount");
  });

  it("propagates malformed provider responses and fallback failures without returning partial data", async () => {
    const storage = { getGA4Connection: vi.fn(async () => connection) };
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => { throw new SyntaxError("malformed JSON"); },
    })));
    await expect(ga4Service.getConversionEventsReport(
      "campaign-1", storage, "2026-08-01", "987654", 50, "saved-a", "2026-09-14",
    )).rejects.toThrow("malformed JSON");

    let request = 0;
    vi.stubGlobal("fetch", vi.fn(async () => {
      request += 1;
      return request === 1
        ? { ok: true, json: async () => ({ rowCount: 0, rows: [] }) }
        : { ok: false, text: async () => "fallback provider failure" };
    }));
    await expect(ga4Service.getConversionEventsReport(
      "campaign-1", storage, "2026-08-01", "987654", 50, "saved-a", "2026-09-14",
    )).rejects.toThrow("fallback provider failure");
  });

  it("distinguishes initial failure, empty, and cached last-good UI/PDF behavior", () => {
    const client = read("client/src/pages/ga4-metrics.tsx");
    const ui = between(client, "{/* Conversion Events */}", "{/* Modals (rendered always) */}");
    expect(ui).toContain("conversionEventsLoading && ga4ConversionEvents === undefined");
    expect(ui).toContain("conversionEventsUnavailable");
    expect(ui).toContain("Conversion event data is unavailable. Refresh the page to try again.");
    expect(ui).toContain("No conversion event breakdown available yet for this property/campaign selection.");
    expect(client).toContain("conversionEventsError && ga4ConversionEvents !== undefined");
    expect(client).toContain("Last successful values remain visible where available; unavailable values are marked.");
    expect(client).toContain('if (needsConversionEvents && conversionEventsUnavailable) unavailable.push("Conversion Events")');
  });

  it("fails read-only requests before OAuth refresh can mutate credentials", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: false,
      text: async () => '{"error":{"code":401,"message":"Unauthenticated"}}',
    })));
    const updateGA4ConnectionTokens = vi.fn();
    const refresh = vi.spyOn(ga4Service, "refreshAccessToken").mockResolvedValue({
      access_token: "replacement", expires_in: 3600,
    } as any);

    await expect(ga4Service.getConversionEventsReport(
      "campaign-1",
      { getGA4Connection: vi.fn(async () => connection), updateGA4ConnectionTokens },
      "2026-08-01", "987654", 50, "saved-a", "2026-09-14", true,
    )).rejects.toThrow("TOKEN_EXPIRED");
    expect(refresh).not.toHaveBeenCalled();
    expect(updateGA4ConnectionTokens).not.toHaveBeenCalled();
  });

  it("keeps deployed reconciliation revision-locked, authenticated, and application-data read-only", () => {
    const audit = read("scripts/ga4-overview-conversion-events-live-readonly.ts");
    expect(audit).toContain("GA4_CONVERSION_EVENTS_EXPECTED_SHA must be a full Git SHA");
    expect(audit).toContain('client.query("BEGIN TRANSACTION READ ONLY")');
    expect(audit).toContain("application persistence fingerprint");
    expect(audit).toContain("x-ga4-validation-read-only");
    expect(audit).toContain("x-ga4-credential-refresh-allowed");
    expect(audit).toContain("unauthenticated denial");
    expect(audit).toContain("cross-owner denial");
    expect(audit).toContain("different-property denial");
    expect(audit).toContain('window.dispatchEvent(new Event("visibilitychange"))');
    expect(audit).toContain("focus did not refetch Conversion Events");
    expect(audit).toContain("reload row parity");
    expect(audit).toContain('getByText("Custom Report", { exact: true })');
    expect(audit).toContain('getByLabel("Conversion Events", { exact: true }).check()');
    expect(audit).toContain('scheduledPdfBuilder: "not executed against production; actual builder output and shared provider arguments are covered by the local focused fixture"');
  });
});
