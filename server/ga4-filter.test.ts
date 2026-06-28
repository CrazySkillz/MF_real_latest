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
    expect(fetchMock).toHaveBeenCalledTimes(2);
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
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const trafficBody = JSON.parse(String(fetchMock.mock.calls[1][1]?.body || "{}"));
    const supplementBody = JSON.parse(String(fetchMock.mock.calls[2][1]?.body || "{}"));
    expect(JSON.stringify(trafficBody.dimensionFilter)).toContain("pageLocation");
    expect(JSON.stringify(supplementBody.dimensionFilter)).toContain('"fieldName":"campaignName"');
    expect(supplementBody.metrics).toEqual([{ name: "conversions" }, { name: "totalRevenue" }]);
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
      engagementRate: 0.64,
    }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const primaryBody = JSON.parse(String(fetchMock.mock.calls[0][1]?.body || "{}"));
    const fallbackBody = JSON.parse(String(fetchMock.mock.calls[1][1]?.body || "{}"));
    expect(JSON.stringify(primaryBody.dimensionFilter)).toContain("sessionCampaignName");
    expect(JSON.stringify(fallbackBody.dimensionFilter)).toContain("pageLocation");
    expect(fallbackBody.dimensions).toEqual([{ name: "date" }]);
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
                metricValues: [{ value: "85" }, { value: "85" }, { value: "3" }, { value: "531.349929" }],
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

    const result = await ga4Service.getAcquisitionBreakdown("campaign-1", storage, "90daysAgo", "123", 200, "summer_sale");

    expect(result.totals).toEqual({ sessions: 85, sessionsRaw: 85, users: 85, conversions: 3, revenue: 531.35 });
    expect(result.rows[0]).toMatchObject({ date: "2026-06-18", source: "google", medium: "cpc", campaign: "summer_sale" });
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
                  metricValues: [{ value: "0" }, { value: "39" }, { value: "30" }, { value: "0" }],
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
    expect(result.rows[0]).toMatchObject({ eventName: "purchase", eventCount: 39, users: 30, conversions: 39, revenue: 7068.9 });
    expect(result.rows[1]).toMatchObject({ eventName: "sign_up", eventCount: 10, users: 8, conversions: 6, revenue: 100 });
    expect(result.totals).toMatchObject({ eventCount: 49, users: 38, conversions: 45, revenue: 7168.9 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});


