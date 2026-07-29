import { describe, expect, it } from "vitest";
import { getSelectableGA4CampaignFilter } from "../client/src/lib/ga4-campaign-selection";

describe("GA4 campaign selection display and save scope", () => {
  it("excludes a stale saved campaign that is absent from the visible property list", () => {
    expect(
      getSelectableGA4CampaignFilter(
        ["old_property_campaign"],
        [{ name: "yesop_brand_search" }, { name: "yesop_prospecting" }],
      ),
    ).toEqual([]);
  });

  it("keeps only selections present in the visible property list", () => {
    expect(
      getSelectableGA4CampaignFilter(
        ["old_property_campaign", "yesop_prospecting"],
        [{ name: "yesop_brand_search" }, { name: "yesop_prospecting" }],
      ),
    ).toEqual(["yesop_prospecting"]);
  });

  it("preserves manual selections when GA4 returns no campaign list", () => {
    expect(getSelectableGA4CampaignFilter(["manual_campaign"], [])).toEqual(["manual_campaign"]);
  });
});
