import { describe, expect, it } from "vitest";
import { filterActiveSchedulerCampaigns } from "./utils/campaign-scheduler-eligibility";

describe("campaign scheduler eligibility", () => {
  it("runs active campaigns and skips inactive, draft, and missing statuses", () => {
    const campaigns = [
      { id: "active", status: "active" },
      { id: "active-normalized", status: " Active " },
      { id: "inactive", status: "inactive" },
      { id: "draft", status: "draft" },
      { id: "missing" },
    ];

    expect(filterActiveSchedulerCampaigns(campaigns).map((campaign) => campaign.id))
      .toEqual(["active", "active-normalized"]);
  });

  it("includes only the explicitly targeted draft for an initial import", () => {
    const campaigns = [
      { id: "active", status: "active" },
      { id: "target", status: "draft" },
      { id: "other-draft", status: "draft" },
    ];

    expect(filterActiveSchedulerCampaigns(campaigns, "target").map((campaign) => campaign.id))
      .toEqual(["active", "target"]);
  });
});
