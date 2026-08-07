import { afterEach, describe, it, expect, vi } from "vitest";
import { ga4Service } from "./analytics";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GA4 campaign filter builder", () => {
  it("builds null for empty filter", () => {
    const svc: any = ga4Service as any;
    expect(svc.buildCampaignDimensionFilter(undefined, "sessionCampaignName")).toBeNull();
    expect(svc.buildCampaignDimensionFilter([], "sessionCampaignName")).toBeNull();
    expect(svc.buildCampaignDimensionFilter("   ", "sessionCampaignName")).toBeNull();
  });

  it("builds EXACT filter for single campaign", () => {
    const svc: any = ga4Service as any;
    const f = svc.buildCampaignDimensionFilter("brand_search", "sessionCampaignName");
    expect(f?.dimensionFilter?.filter?.fieldName).toBe("sessionCampaignName");
    expect(f?.dimensionFilter?.filter?.stringFilter?.matchType).toBe("EXACT");
    expect(f?.dimensionFilter?.filter?.stringFilter?.value).toBe("brand_search");
  });

  it("builds OR-group filter for multiple campaigns", () => {
    const svc: any = ga4Service as any;
    const f = svc.buildCampaignDimensionFilter(["a", "b"], "sessionCampaignName");
    const expr = f?.dimensionFilter?.orGroup?.expressions;
    expect(Array.isArray(expr)).toBe(true);
    expect(expr.length).toBe(2);
    expect(expr[0].filter.fieldName).toBe("sessionCampaignName");
    expect(expr[0].filter.stringFilter.value).toBe("a");
    expect(expr[1].filter.stringFilter.value).toBe("b");
  });
});

describe("GA4 campaign value picker", () => {
  it("ignores direct traffic placeholders and falls back to manual UTM campaign dimensions", async () => {
    const fetchMock = vi.fn(async (_url: string, init: any) => {
      const body = JSON.parse(String(init?.body || "{}"));
      const dimension = body?.dimensions?.[0]?.name;
      const rows = dimension === "sessionCampaignName"
        ? [
            { dimensionValues: [{ value: "(direct)" }], metricValues: [{ value: "2" }] },
          ]
        : dimension === "sessionManualCampaignName" ? [
            { dimensionValues: [{ value: "yesop_brand_search" }], metricValues: [{ value: "12" }] },
          ] : [];

      return {
        ok: true,
        json: async () => ({ rows }),
      } as any;
    });
    vi.stubGlobal("fetch", fetchMock);

    const storage = {
      getGA4Connection: vi.fn(async () => ({
        id: "conn-1",
        propertyId: "properties/123",
        accessToken: "token",
      })),
    };

    const result = await ga4Service.getCampaignValues("campaign-1", storage, "90daysAgo", "123", 200);

    expect(result.campaigns).toEqual([{ name: "yesop_brand_search", users: 12 }]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("merges pageLocation UTM campaigns when GA4 campaign dimensions are partial", async () => {
    const fetchMock = vi.fn(async (_url: string, init: any) => {
      const body = JSON.parse(String(init?.body || "{}"));
      const dimension = body?.dimensions?.[0]?.name;
      const rows = dimension === "sessionCampaignName"
        ? [
            { dimensionValues: [{ value: "yesop_brand_search" }], metricValues: [{ value: "4" }] },
            { dimensionValues: [{ value: "yesop_retargeting" }], metricValues: [{ value: "3" }] },
            { dimensionValues: [{ value: "yesop_prospecting" }], metricValues: [{ value: "2" }] },
          ]
        : dimension === "pageLocation" ? [
            { dimensionValues: [{ value: "https://mock.test/?utm_campaign=yesop_brand_search" }], metricValues: [{ value: "80" }] },
            { dimensionValues: [{ value: "https://mock.test/?utm_campaign=yesop_prospecting" }], metricValues: [{ value: "55" }] },
            { dimensionValues: [{ value: "https://mock.test/?utm_campaign=yesop_paid_social" }], metricValues: [{ value: "45" }] },
            { dimensionValues: [{ value: "https://mock.test/?utm_campaign=yesop_retargeting" }], metricValues: [{ value: "35" }] },
            { dimensionValues: [{ value: "https://mock.test/?utm_campaign=yesop_email_nurture" }], metricValues: [{ value: "30" }] },
          ] : [];

      return {
        ok: true,
        json: async () => ({ rows }),
      } as any;
    });
    vi.stubGlobal("fetch", fetchMock);

    const storage = {
      getGA4Connection: vi.fn(async () => ({
        id: "conn-1",
        propertyId: "properties/123",
        accessToken: "token",
      })),
    };

    const result = await ga4Service.getCampaignValues("campaign-1", storage, "90daysAgo", "123", 200);

    expect(result.campaigns.map(c => c.name)).toEqual([
      "yesop_brand_search",
      "yesop_prospecting",
      "yesop_paid_social",
      "yesop_retargeting",
      "yesop_email_nurture",
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("falls back to utm_campaign values from page locations when GA4 attribution dimensions are empty", async () => {
    const fetchMock = vi.fn(async (_url: string, init: any) => {
      const body = JSON.parse(String(init?.body || "{}"));
      const dimension = body?.dimensions?.[0]?.name;
      const rows = dimension === "sessionCampaignName"
        ? [
            { dimensionValues: [{ value: "(direct)" }], metricValues: [{ value: "8" }] },
          ]
        : dimension === "pageLocation" ? [
            { dimensionValues: [{ value: "https://mock.test/landing?utm_source=google&utm_medium=cpc&utm_campaign=yesop_brand_search" }], metricValues: [{ value: "3" }] },
            { dimensionValues: [{ value: "https://mock.test/pricing?utm_campaign=yesop_brand_search" }], metricValues: [{ value: "2" }] },
            { dimensionValues: [{ value: "https://mock.test/direct" }], metricValues: [{ value: "4" }] },
          ] : [];

      return {
        ok: true,
        json: async () => ({ rows }),
      } as any;
    });
    vi.stubGlobal("fetch", fetchMock);

    const storage = {
      getGA4Connection: vi.fn(async () => ({
        id: "conn-1",
        propertyId: "properties/123",
        accessToken: "token",
      })),
    };

    const result = await ga4Service.getCampaignValues("campaign-1", storage, "90daysAgo", "123", 200);

    expect(result.campaigns).toEqual([{ name: "yesop_brand_search", users: 5 }]);
    expect(fetchMock).toHaveBeenCalledTimes(7);
  });

  it("uses pageLocation UTM fallback for to-date totals when campaign dimensions are empty", async () => {
    const fetchMock = vi.fn(async (_url: string, init: any) => {
      const body = JSON.parse(String(init?.body || "{}"));
      const scope = JSON.stringify(body?.dimensionFilter || {});
      const isPageLocationScope = scope.includes("pageLocation");

      return {
        ok: true,
        json: async () => ({
          metadata: { currencyCode: "USD" },
          rows: isPageLocationScope
            ? [{ metricValues: [{ value: "85" }, { value: "85" }, { value: "3" }, { value: "108" }, { value: "531.349929" }] }]
            : [{ metricValues: [{ value: "0" }, { value: "0" }, { value: "0" }, { value: "0" }, { value: "0" }] }],
        }),
      } as any;
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await ga4Service.getTotalsWithRevenue(
      "properties/123",
      "token",
      "2026-06-01",
      "2026-06-17",
      "summer_sale",
    );

    expect(result.totals).toEqual({
      sessions: 85,
      users: 85,
      conversions: 3,
      pageviews: 108,
      revenue: 531.35,
      engagedSessions: 0,
      engagementRate: 0,
    });
    expect(result.currencyCode).toBeUndefined();
    expect(result.reportingTimeZone).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.every((call) => JSON.parse(String(call[1]?.body || "{}")).currencyCode === undefined)).toBe(true);
    const fallbackBody = JSON.parse(String(fetchMock.mock.calls[1][1]?.body || "{}"));
    expect(JSON.stringify(fallbackBody.dimensionFilter)).toContain("pageLocation");
    expect(fallbackBody.dateRanges[0].endDate).toBe("today");
  });

  it("supplements to-date conversion and revenue values without changing traffic totals", async () => {
    const fetchMock = vi.fn(async (_url: string, init: any) => {
      const body = JSON.parse(String(init?.body || "{}"));
      const scope = JSON.stringify(body?.dimensionFilter || {});
      const isPageLocationScope = scope.includes("pageLocation");
      const isCampaignNameScope = scope.includes('"fieldName":"campaignName"');

      return {
        ok: true,
        json: async () => ({
          metadata: { currencyCode: "USD", timeZone: "Europe/Amsterdam" },
          rows: isCampaignNameScope
            ? [{ metricValues: [{ value: "7" }, { value: "123.456" }] }]
            : isPageLocationScope
              ? [{ metricValues: [{ value: "85" }, { value: "85" }, { value: "0" }, { value: "108" }, { value: "0" }, { value: "54" }, { value: "0.64" }] }]
              : [{ metricValues: [{ value: "0" }, { value: "0" }, { value: "0" }, { value: "0" }, { value: "0" }, { value: "0" }, { value: "0" }] }],
        }),
      } as any;
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await ga4Service.getTotalsWithRevenue(
      "properties/123",
      "token",
      "2026-06-01",
      "2026-06-17",
      "summer_sale",
      "USD",
    );

    expect(result.totals).toEqual({
      sessions: 85,
      users: 85,
      conversions: 7,
      pageviews: 108,
      revenue: 123.46,
      engagedSessions: 54,
      engagementRate: 0.64,
    });
    expect(result.currencyCode).toBe("USD");
    expect(result.reportingTimeZone).toBe("Europe/Amsterdam");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.every((call) => JSON.parse(String(call[1]?.body || "{}")).currencyCode === "USD")).toBe(true);
    const trafficBody = JSON.parse(String(fetchMock.mock.calls[1][1]?.body || "{}"));
    const supplementBody = JSON.parse(String(fetchMock.mock.calls[2][1]?.body || "{}"));
    expect(JSON.stringify(trafficBody.dimensionFilter)).toContain("pageLocation");
    expect(JSON.stringify(supplementBody.dimensionFilter)).toContain('"fieldName":"campaignName"');
    expect(supplementBody.metrics).toEqual([{ name: "conversions" }, { name: "totalRevenue" }]);
  });

  it("keeps any nonzero native conversion/revenue field authoritative", async () => {
    const fetchMock = vi.fn(async (_url: string, init: any) => {
      const body = JSON.parse(String(init?.body || "{}"));
      const isSupplement = (body?.metrics || []).length === 2;
      return {
        ok: true,
        json: async () => ({ rows: [{ metricValues: isSupplement
          ? [{ value: "7" }, { value: "123.45" }]
          : [{ value: "85" }, { value: "80" }, { value: "4" }, { value: "100" }, { value: "0" }, { value: "50" }, { value: "0.5" }]
        }] }),
      } as any;
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await ga4Service.getTotalsWithRevenue(
      "properties/123", "token", "2026-06-01", "2026-06-17", "summer_sale",
    );

    expect(result.totals).toMatchObject({ sessions: 85, conversions: 4, revenue: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("treats negative native revenue as authoritative instead of empty", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ rows: [{ metricValues: [
        { value: "85" }, { value: "80" }, { value: "4" }, { value: "100" },
        { value: "-25.5" }, { value: "50" }, { value: "0.5" },
      ] }] }),
    } as any));
    vi.stubGlobal("fetch", fetchMock);

    const result = await ga4Service.getTotalsWithRevenue(
      "properties/123", "token", "2026-06-01", "2026-06-17", "summer_sale",
    );

    expect(result.totals.revenue).toBe(-25.5);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("uses pageLocation UTM fallback for daily time series when campaign dimensions are empty", async () => {
    const fetchMock = vi.fn(async (_url: string, init: any) => {
      const body = JSON.parse(String(init?.body || "{}"));
      const scope = JSON.stringify(body?.dimensionFilter || {});
      const isPageLocationScope = scope.includes("pageLocation");

      return {
        ok: true,
        json: async () => ({
          rows: isPageLocationScope
            ? [{
                dimensionValues: [{ value: "20260618" }],
                metricValues: [
                  { value: "85" },
                  { value: "108" },
                  { value: "3" },
                  { value: "85" },
                  { value: "531.349929" },
                  { value: "54" },
                  { value: "0.64" },
                ],
              }]
            : [],
        }),
      } as any;
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await ga4Service.getTimeSeriesWithToken(
      "properties/123",
      "token",
      "2026-06-01",
      "summer_sale",
      "2026-06-30",
    );

    expect(result).toEqual([{
      date: "2026-06-18",
      dateLabel: "06/18",
      sessions: 85,
      pageviews: 108,
      conversions: 3,
      users: 85,
      revenue: 531.35,
      revenueMetric: "totalRevenue",
      engagedSessions: 54,
      engagementRate: 0.64,
    }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const primaryBody = JSON.parse(String(fetchMock.mock.calls[0][1]?.body || "{}"));
    const fallbackBody = JSON.parse(String(fetchMock.mock.calls[1][1]?.body || "{}"));
    expect(JSON.stringify(primaryBody.dimensionFilter)).toContain("sessionCampaignName");
    expect(primaryBody.dateRanges).toEqual([{ startDate: "2026-06-01", endDate: "2026-06-30" }]);
    expect(JSON.stringify(fallbackBody.dimensionFilter)).toContain("pageLocation");
    expect(fallbackBody.dateRanges).toEqual([{ startDate: "2026-06-01", endDate: "2026-06-30" }]);
    expect(fallbackBody.dimensions).toEqual([{ name: "date" }]);
  });

  it("propagates an explicit completed-day end date through the persisted daily fetch wrapper", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ rows: [] }),
    } as any));
    vi.stubGlobal("fetch", fetchMock);
    const storage = {
      getGA4Connection: vi.fn(async () => ({
        id: "conn-1",
        propertyId: "properties/123",
        accessToken: "token",
        method: "access_token",
      })),
    };

    await ga4Service.getTimeSeriesData(
      "campaign-1",
      storage,
      "2026-06-01",
      "properties/123",
      "summer_sale",
      "2026-06-30",
    );

    expect(fetchMock).toHaveBeenCalled();
    for (const [, init] of fetchMock.mock.calls) {
      const body = JSON.parse(String((init as any)?.body || "{}"));
      expect(body.dateRanges).toEqual([{ startDate: "2026-06-01", endDate: "2026-06-30" }]);
    }
  });

  it("supplements daily conversion and revenue values without changing daily traffic totals", async () => {
    const fetchMock = vi.fn(async (_url: string, init: any) => {
      const body = JSON.parse(String(init?.body || "{}"));
      const metricNames = (body?.metrics || []).map((m: any) => String(m?.name || ""));
      const scope = JSON.stringify(body?.dimensionFilter || {});
      const isConversionRevenueSupplement = metricNames.length === 2 && scope.includes("campaignName");

      return {
        ok: true,
        json: async () => ({
          rows: isConversionRevenueSupplement
            ? [
                {
                  dimensionValues: [{ value: "20260618" }],
                  metricValues: [{ value: "7" }, { value: "123.456" }],
                },
              ]
            : [
                {
                  dimensionValues: [{ value: "20260618" }],
                  metricValues: [
                    { value: "85" },
                    { value: "108" },
                    { value: "0" },
                    { value: "85" },
                    { value: "0" },
                    { value: "54" },
                    { value: "0.64" },
                  ],
                },
              ],
        }),
      } as any;
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await ga4Service.getTimeSeriesWithToken(
      "properties/123",
      "token",
      "2026-06-01",
      "summer_sale",
    );

    expect(result).toEqual([{
      date: "2026-06-18",
      dateLabel: "06/18",
      sessions: 85,
      pageviews: 108,
      conversions: 7,
      users: 85,
      revenue: 123.46,
      revenueMetric: "totalRevenue",
      engagedSessions: 54,
      engagementRate: 0.64,
    }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const primaryBody = JSON.parse(String(fetchMock.mock.calls[0][1]?.body || "{}"));
    const supplementBody = JSON.parse(String(fetchMock.mock.calls[1][1]?.body || "{}"));
    expect(JSON.stringify(primaryBody.dimensionFilter)).toContain("sessionCampaignName");
    expect(JSON.stringify(supplementBody.dimensionFilter)).toContain("campaignName");
    expect(supplementBody.metrics).toEqual([{ name: "conversions" }, { name: "totalRevenue" }]);
    expect(supplementBody.dimensions).toEqual([{ name: "date" }]);
  });

  it("supplements only missing daily conversion and revenue fields when another day already has values", async () => {
    const fetchMock = vi.fn(async (_url: string, init: any) => {
      const body = JSON.parse(String(init?.body || "{}"));
      const metricNames = (body?.metrics || []).map((m: any) => String(m?.name || ""));
      const isSupplement = metricNames.length === 2;
      return {
        ok: true,
        json: async () => ({
          rows: isSupplement
            ? [
                { dimensionValues: [{ value: "20260618" }], metricValues: [{ value: "7" }, { value: "123.45" }] },
                { dimensionValues: [{ value: "20260619" }], metricValues: [{ value: "5" }, { value: "80" }] },
              ]
            : [
                { dimensionValues: [{ value: "20260618" }], metricValues: [{ value: "85" }, { value: "108" }, { value: "3" }, { value: "80" }, { value: "-50" }, { value: "54" }, { value: "0.64" }] },
                { dimensionValues: [{ value: "20260619" }], metricValues: [{ value: "40" }, { value: "55" }, { value: "0" }, { value: "38" }, { value: "0" }, { value: "20" }, { value: "0.5" }] },
              ],
        }),
      } as any;
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await ga4Service.getTimeSeriesWithToken("properties/123", "token", "2026-06-01", "summer_sale");

    expect(result).toEqual([
      expect.objectContaining({ date: "2026-06-18", sessions: 85, conversions: 3, revenue: -50 }),
      expect.objectContaining({ date: "2026-06-19", sessions: 40, conversions: 5, revenue: 80 }),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("uses pageLocation UTM fallback for acquisition rows when campaign dimensions are empty", async () => {
    const fetchMock = vi.fn(async (_url: string, init: any) => {
      const body = JSON.parse(String(init?.body || "{}"));
      const dimensions = (body?.dimensions || []).map((d: any) => d?.name);
      const isPageLocationFallback = dimensions.includes("pageLocation") && JSON.stringify(body?.dimensionFilter || {}).includes("pageLocation");

      return {
        ok: true,
        json: async () => ({
          rows: isPageLocationFallback
            ? [{
                dimensionValues: [
                  { value: "20260618" },
                  { value: "https://example.com/?utm_source=google&utm_medium=cpc&utm_campaign=summer_sale" },
                ],
                metricValues: [{ value: "85" }, { value: "85" }, { value: "3" }, { value: "531.349929" }, { value: "51" }],
              }]
            : [],
          totals: isPageLocationFallback
            ? [{ metricValues: [{ value: "85" }, { value: "80" }, { value: "3" }, { value: "531.349929" }, { value: "51" }] }]
            : [],
        }),
      } as any;
    });
    vi.stubGlobal("fetch", fetchMock);

    const storage = {
      getGA4Connection: vi.fn(async () => ({
        id: "conn-1",
        propertyId: "properties/123",
        accessToken: "token",
        method: "access_token",
      })),
    };

    const result = await ga4Service.getAcquisitionBreakdown("campaign-1", storage, "90daysAgo", "123", 200, "summer_sale");

    expect(result.totals).toEqual({ sessions: 85, sessionsRaw: 85, users: 80, conversions: 3, revenue: 531.35, engagedSessions: 51, engagementRate: 0.6 });
    expect(result.rows[0]).toMatchObject({ date: "2026-06-18", source: "google", medium: "cpc", campaign: "summer_sale", engagedSessions: 51 });
    const fallbackBody = JSON.parse(String(fetchMock.mock.calls.at(-1)?.[1]?.body || "{}"));
    expect(fallbackBody.metrics).toContainEqual({ name: "engagedSessions" });
    expect(fallbackBody.metricAggregations).toEqual(["TOTAL"]);
  });

  it("uses complete landing-page UTM attribution for Insights when standard acquisition rows are partial", async () => {
    const standardRow = {
      dimensionValues: ["20260708", "Paid Social", "google", "display", "yesop_retargeting", "desktop", "NL"]
        .map((value) => ({ value })),
      metricValues: ["54", "54", "54", "0", "54"].map((value) => ({ value })),
    };
    const landingRow = (url: string, sessions: string, conversions: string) => ({
      dimensionValues: [{ value: "20260708" }, { value: url }],
      metricValues: [sessions, sessions, conversions, "0", sessions].map((value) => ({ value })),
    });
    const fetchMock = vi.fn(async (_url: string, init: any) => {
      const body = JSON.parse(String(init?.body || "{}"));
      const dimensions = (body?.dimensions || []).map((d: any) => d?.name);
      const isLandingUtm = dimensions.includes("landingPagePlusQueryString");
      return {
        ok: true,
        json: async () => ({
          rows: isLandingUtm
            ? [
                landingRow("/landing?utm_source=google&utm_medium=display&utm_campaign=yesop_retargeting", "200", "21"),
                landingRow("/landing?utm_source=facebook&utm_medium=paid_social&utm_campaign=yesop_paid_social", "140", "17"),
                landingRow("/landing?utm_source=newsletter&utm_medium=email&utm_campaign=yesop_email_nurture", "109", "16"),
              ]
            : [standardRow],
          totals: [{
            metricValues: (isLandingUtm
              ? ["449", "449", "54", "0", "449"]
              : ["54", "54", "54", "0", "54"]
            ).map((value) => ({ value })),
          }],
        }),
      } as any;
    });
    vi.stubGlobal("fetch", fetchMock);
    const storage = { getGA4Connection: vi.fn(async () => ({
      id: "conn-1", propertyId: "properties/123", accessToken: "token",
    })) };

    const result = await ga4Service.getAcquisitionBreakdown(
      "campaign-1", storage, "2026-07-08", "123", 2000,
      ["yesop_retargeting", "yesop_paid_social", "yesop_email_nurture"], "2026-08-06", false, true,
    );

    expect(result.totals.sessions).toBe(449);
    expect(result.totals.conversions).toBe(54);
    expect(result.rows.reduce((sum, item) => sum + item.sessions, 0)).toBe(449);
    expect(result.rows[0]).toMatchObject({ source: "google", medium: "display", campaign: "yesop_retargeting" });
    const landingBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body || "{}"));
    expect(landingBody.dimensions).toContainEqual({ name: "landingPagePlusQueryString" });
    expect(JSON.stringify(landingBody.dimensionFilter)).toContain("landingPagePlusQueryString");

    const defaultResult = await ga4Service.getAcquisitionBreakdown(
      "campaign-1", storage, "2026-07-08", "123", 2000,
      ["yesop_retargeting", "yesop_paid_social", "yesop_email_nurture"], "2026-08-06",
    );
    expect(defaultResult.totals.sessions).toBe(54);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('paginates acquisition rows to the provider rowCount', async () => {
    const row = (campaign: string, sessions: string) => ({
      dimensionValues: ['20260618', 'Paid Search', 'google', 'cpc', campaign, 'desktop', 'NL']
        .map((value) => ({ value })),
      metricValues: [sessions, sessions, '1', '10', sessions]
        .map((value) => ({ value })),
    });
    const fetchMock = vi.fn(async (_url: string, init: any) => {
      const body = JSON.parse(String(init?.body || '{}'));
      const offset = Number(body?.offset || 0);
      return {
        ok: true,
        json: async () => ({
          rowCount: 3,
          rows: offset === 0
            ? [row('campaign-a', '20'), row('campaign-b', '10')]
            : [row('campaign-c', '5')],
          totals: [{ metricValues: ['35', '35', '3', '30', '35'].map((value) => ({ value })) }],
        }),
      } as any;
    });
    vi.stubGlobal('fetch', fetchMock);
    const storage = { getGA4Connection: vi.fn(async () => ({
      id: 'conn-1', propertyId: 'properties/123', accessToken: 'token',
    })) };

    const result = await ga4Service.getAcquisitionBreakdown(
      'campaign-1', storage, '30daysAgo', '123', 2, 'summer_sale',
    );

    expect(result.rows.map((item) => item.campaign)).toEqual([
      'campaign-a', 'campaign-b', 'campaign-c',
    ]);
    expect(result.meta.rowCount).toBe(3);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body || '{}')).offset).toBe(2);
  });

  it("does not refresh or persist an acquisition token in read-only mode", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: false,
      text: async () => '{"code":401,"message":"unauthenticated"}',
    })) as any);
    const storage = {
      getGA4Connection: vi.fn(async () => ({
        id: "conn-1",
        propertyId: "properties/123",
        accessToken: "expired",
        refreshToken: "refresh",
      })),
      updateGA4ConnectionTokens: vi.fn(),
    };
    const refresh = vi.spyOn(ga4Service, "refreshAccessToken");

    await expect(ga4Service.getAcquisitionBreakdown(
      "campaign-1", storage, "2026-07-06", "123", 2000, "summer_sale", "2026-08-04", true,
    )).rejects.toThrow("TOKEN_EXPIRED");
    expect(refresh).not.toHaveBeenCalled();
    expect(storage.updateGA4ConnectionTokens).not.toHaveBeenCalled();
  });

  it('fails closed when a required acquisition page is empty', async () => {
    const fetchMock = vi.fn(async (_url: string, init: any) => {
      const offset = Number(JSON.parse(String(init?.body || '{}'))?.offset || 0);
      return {
        ok: true,
        json: async () => ({
          rowCount: 2,
          rows: offset === 0 ? [{
            dimensionValues: ['20260618', 'Paid Search', 'google', 'cpc', 'campaign-a', 'desktop', 'NL']
              .map((value) => ({ value })),
            metricValues: ['20', '20', '1', '10', '20'].map((value) => ({ value })),
          }] : [],
        }),
      } as any;
    });
    vi.stubGlobal('fetch', fetchMock);
    const storage = { getGA4Connection: vi.fn(async () => ({
      id: 'conn-1', propertyId: 'properties/123', accessToken: 'token',
    })) };

    await expect(
      ga4Service.getAcquisitionBreakdown(
        'campaign-1', storage, '30daysAgo', '123', 1, 'summer_sale',
      ),
    ).rejects.toThrow('GA4_API_PAGINATION_INCOMPLETE');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("derives landing page source and medium from UTM URLs when GA4 attribution dimensions are empty", async () => {
    const fetchMock = vi.fn(async (_url: string, init: any) => {
      const body = JSON.parse(String(init?.body || "{}"));
      const dimensions = (body?.dimensions || []).map((d: any) => d?.name);
      const isPageLocationFallback = dimensions.includes("pageLocation") && JSON.stringify(body?.dimensionFilter || {}).includes("pageLocation");

      return {
        ok: true,
        json: async () => ({
          rows: isPageLocationFallback
            ? [{
                dimensionValues: [
                  { value: "https://example.com/?utm_source=google&utm_medium=cpc&utm_campaign=summer_sale" },
                ],
                metricValues: [{ value: "233" }, { value: "236" }, { value: "5" }, { value: "879.834852" }],
              }]
            : [],
        }),
      } as any;
    });
    vi.stubGlobal("fetch", fetchMock);

    const storage = {
      getGA4Connection: vi.fn(async () => ({
        id: "conn-1",
        propertyId: "properties/123",
        accessToken: "token",
        method: "access_token",
      })),
    };

    const result = await ga4Service.getLandingPagesReport("campaign-1", storage, "90daysAgo", "123", 200, "summer_sale");

    expect(result.rows[0]).toMatchObject({
      landingPage: "/",
      source: "google",
      medium: "cpc",
      sessions: 233,
      users: 236,
      conversions: 5,
      revenue: 879.83,
    });
  });
  it("supplements landing page conversions from same-scope pageLocation rows by exact page/source key", async () => {
    const fetchMock = vi.fn(async (_url: string, init: any) => {
      const body = JSON.parse(String(init?.body || "{}"));
      const dimensions = (body?.dimensions || []).map((d: any) => d?.name);
      const isPageLocationFallback = dimensions.includes("pageLocation") && JSON.stringify(body?.dimensionFilter || {}).includes("pageLocation");

      return {
        ok: true,
        json: async () => ({
          rows: isPageLocationFallback
            ? [
                {
                  dimensionValues: [
                    { value: "https://example.com/landing?utm_source=facebook&utm_medium=paid_social&utm_campaign=summer_sale" },
                  ],
                  metricValues: [{ value: "318" }, { value: "318" }, { value: "39" }, { value: "7068.9" }],
                },
                {
                  dimensionValues: [
                    { value: "https://example.com/pricing?utm_source=google&utm_medium=display&utm_campaign=summer_sale" },
                  ],
                  metricValues: [{ value: "151" }, { value: "151" }, { value: "6" }, { value: "100" }],
                },
                {
                  dimensionValues: [
                    { value: "https://example.com/other?utm_source=google&utm_medium=display&utm_campaign=summer_sale" },
                  ],
                  metricValues: [{ value: "10" }, { value: "10" }, { value: "99" }, { value: "990" }],
                },
              ]
            : [
                {
                  dimensionValues: [{ value: "/landing" }, { value: "facebook" }, { value: "paid_social" }],
                  metricValues: [{ value: "318" }, { value: "318" }, { value: "0" }, { value: "0" }],
                },
                {
                  dimensionValues: [{ value: "/pricing" }, { value: "google" }, { value: "display" }],
                  metricValues: [{ value: "151" }, { value: "151" }, { value: "0" }, { value: "0" }],
                },
              ],
        }),
      } as any;
    });
    vi.stubGlobal("fetch", fetchMock);

    const storage = {
      getGA4Connection: vi.fn(async () => ({
        id: "conn-1",
        propertyId: "properties/123",
        accessToken: "token",
        method: "access_token",
      })),
    };

    const result = await ga4Service.getLandingPagesReport("campaign-1", storage, "90daysAgo", "123", 200, "summer_sale");

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({ landingPage: "/landing", source: "facebook", medium: "paid_social", sessions: 318, users: 318, conversions: 39, revenue: 7068.9 });
    expect(result.rows[1]).toMatchObject({ landingPage: "/pricing", source: "google", medium: "display", sessions: 151, users: 151, conversions: 6, revenue: 100 });
    expect(result.totals).toMatchObject({ sessions: 469, users: 469, conversions: 45, revenue: 7168.9 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("uses conversion-prioritized pageLocation rows when supplementing zero-conversion landing page traffic", async () => {
    const fetchMock = vi.fn(async (_url: string, init: any) => {
      const body = JSON.parse(String(init?.body || "{}"));
      const dimensions = (body?.dimensions || []).map((d: any) => d?.name);
      const isPageLocationFallback = dimensions.includes("pageLocation") && JSON.stringify(body?.dimensionFilter || {}).includes("pageLocation");
      const orderMetric = String(body?.orderBys?.[0]?.metric?.metricName || "");
      const requestedLimit = Number(body?.limit || 0);
      const isConversionSupplement = isPageLocationFallback && orderMetric === "conversions" && requestedLimit === 10000;

      return {
        ok: true,
        json: async () => ({
          rows: isPageLocationFallback
            ? isConversionSupplement
              ? [
                  {
                    dimensionValues: [
                      { value: "https://example.com/landing?utm_source=facebook&utm_medium=paid_social&utm_campaign=summer_sale" },
                    ],
                    metricValues: [{ value: "0" }, { value: "0" }, { value: "39" }, { value: "7068.9" }],
                  },
                  {
                    dimensionValues: [
                      { value: "https://example.com/other?utm_source=facebook&utm_medium=paid_social&utm_campaign=summer_sale" },
                    ],
                    metricValues: [{ value: "0" }, { value: "0" }, { value: "99" }, { value: "990" }],
                  },
                ]
              : [
                  {
                    dimensionValues: [
                      { value: "https://example.com/pricing?utm_source=facebook&utm_medium=paid_social&utm_campaign=summer_sale" },
                    ],
                    metricValues: [{ value: "161" }, { value: "161" }, { value: "0" }, { value: "0" }],
                  },
                ]
            : [
                {
                  dimensionValues: [{ value: "/landing" }, { value: "facebook" }, { value: "paid_social" }],
                  metricValues: [{ value: "318" }, { value: "318" }, { value: "0" }, { value: "0" }],
                },
                {
                  dimensionValues: [{ value: "/pricing" }, { value: "facebook" }, { value: "paid_social" }],
                  metricValues: [{ value: "161" }, { value: "161" }, { value: "0" }, { value: "0" }],
                },
              ],
        }),
      } as any;
    });
    vi.stubGlobal("fetch", fetchMock);

    const storage = {
      getGA4Connection: vi.fn(async () => ({
        id: "conn-1",
        propertyId: "properties/123",
        accessToken: "token",
        method: "access_token",
      })),
    };

    const result = await ga4Service.getLandingPagesReport("campaign-1", storage, "90daysAgo", "123", 50, "summer_sale");

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({ landingPage: "/landing", source: "facebook", medium: "paid_social", sessions: 318, users: 318, conversions: 39, revenue: 7068.9 });
    expect(result.rows[1]).toMatchObject({ landingPage: "/pricing", source: "facebook", medium: "paid_social", sessions: 161, users: 161, conversions: 0, revenue: 0 });
    expect(result.totals).toMatchObject({ sessions: 479, users: 479, conversions: 39, revenue: 7068.9 });

    const fallbackBodies = fetchMock.mock.calls
      .map(([, init]) => JSON.parse(String((init as any)?.body || "{}")))
      .filter((body) => (body?.dimensions || []).some((d: any) => d?.name === "pageLocation"));
    expect(fallbackBodies[0]?.orderBys?.[0]?.metric?.metricName).toBe("conversions");
    expect(fallbackBodies[0]?.limit).toBe(10000);
  });
  it("supplements pageLocation traffic fallback rows with conversion-prioritized pageLocation rows", async () => {
    const fetchMock = vi.fn(async (_url: string, init: any) => {
      const body = JSON.parse(String(init?.body || "{}"));
      const dimensions = (body?.dimensions || []).map((d: any) => d?.name);
      const isPageLocationFallback = dimensions.includes("pageLocation") && JSON.stringify(body?.dimensionFilter || {}).includes("pageLocation");
      const orderMetric = String(body?.orderBys?.[0]?.metric?.metricName || "");

      return {
        ok: true,
        json: async () => ({
          rows: isPageLocationFallback
            ? orderMetric === "conversions"
              ? [
                  {
                    dimensionValues: [
                      { value: "https://example.com/landing?utm_source=facebook&utm_medium=paid_social&utm_campaign=summer_sale" },
                    ],
                    metricValues: [{ value: "0" }, { value: "0" }, { value: "39" }, { value: "7068.9" }],
                  },
                ]
              : [
                  {
                    dimensionValues: [
                      { value: "https://example.com/landing?utm_source=facebook&utm_medium=paid_social&utm_campaign=summer_sale" },
                    ],
                    metricValues: [{ value: "318" }, { value: "318" }, { value: "0" }, { value: "0" }],
                  },
                ]
            : [],
        }),
      } as any;
    });
    vi.stubGlobal("fetch", fetchMock);

    const storage = {
      getGA4Connection: vi.fn(async () => ({
        id: "conn-1",
        propertyId: "properties/123",
        accessToken: "token",
        method: "access_token",
      })),
    };

    const result = await ga4Service.getLandingPagesReport("campaign-1", storage, "90daysAgo", "123", 50, "summer_sale");

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ landingPage: "/landing", source: "facebook", medium: "paid_social", sessions: 318, users: 318, conversions: 39, revenue: 7068.9 });
    expect(result.totals).toMatchObject({ sessions: 318, users: 318, conversions: 39, revenue: 7068.9 });

    const fallbackBodies = fetchMock.mock.calls
      .map(([, init]) => JSON.parse(String((init as any)?.body || "{}")))
      .filter((body) => (body?.dimensions || []).some((d: any) => d?.name === "pageLocation"));
    expect(fallbackBodies.map((body) => body?.orderBys?.[0]?.metric?.metricName)).toEqual(["sessions", "conversions"]);
    expect(fallbackBodies[1]?.limit).toBe(10000);
  });


  it("supplements conversion event conversions from same-scope pageLocation rows by exact event name", async () => {
    const fetchMock = vi.fn(async (_url: string, init: any) => {
      const body = JSON.parse(String(init?.body || "{}"));
      const isPageLocationFallback = JSON.stringify(body?.dimensionFilter || {}).includes("pageLocation");

      return {
        ok: true,
        json: async () => ({
          rows: isPageLocationFallback
            ? [
                {
                  dimensionValues: [{ value: "purchase" }],
                  metricValues: [{ value: "39" }, { value: "39" }, { value: "30" }, { value: "7068.9" }],
                },
                {
                  dimensionValues: [{ value: "sign_up" }],
                  metricValues: [{ value: "6" }, { value: "10" }, { value: "8" }, { value: "100" }],
                },
                {
                  dimensionValues: [{ value: "other_event" }],
                  metricValues: [{ value: "99" }, { value: "99" }, { value: "90" }, { value: "990" }],
                },
              ]
            : [
                {
                  dimensionValues: [{ value: "purchase" }],
                  metricValues: [{ value: "7" }, { value: "39" }, { value: "30" }, { value: "700" }],
                },
                {
                  dimensionValues: [{ value: "sign_up" }],
                  metricValues: [{ value: "0" }, { value: "10" }, { value: "8" }, { value: "0" }],
                },
              ],
        }),
      } as any;
    });
    vi.stubGlobal("fetch", fetchMock);

    const storage = {
      getGA4Connection: vi.fn(async () => ({
        id: "conn-1",
        propertyId: "properties/123",
        accessToken: "token",
        method: "access_token",
      })),
    };

    const result = await ga4Service.getConversionEventsReport("campaign-1", storage, "90daysAgo", "123", 200, "summer_sale");

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({ eventName: "purchase", eventCount: 39, users: 30, conversions: 7, revenue: 700 });
    expect(result.rows[1]).toMatchObject({ eventName: "sign_up", eventCount: 10, users: 8, conversions: 6, revenue: 100 });
    expect(result.totals).toMatchObject({ eventCount: 49, users: 38, conversions: 13, revenue: 800 });
    const fallbackBodies = fetchMock.mock.calls
      .map(([, init]) => JSON.parse(String((init as any)?.body || "{}")))
      .filter((body) => JSON.stringify(body?.dimensionFilter || {}).includes("pageLocation"));
    expect(fallbackBodies[0]?.limit).toBe(10000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});


