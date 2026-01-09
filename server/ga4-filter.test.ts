import { describe, it, expect } from "vitest";
import { ga4Service } from "./analytics";

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


