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
});


