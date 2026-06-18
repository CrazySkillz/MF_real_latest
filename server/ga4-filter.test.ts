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

    expect(result.totals).toEqual({ sessions: 85, users: 85, conversions: 3, pageviews: 108, revenue: 531.35 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const fallbackBody = JSON.parse(String(fetchMock.mock.calls[1][1]?.body || "{}"));
    expect(JSON.stringify(fallbackBody.dimensionFilter)).toContain("pageLocation");
    expect(fallbackBody.dateRanges[0].endDate).toBe("today");
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
});


