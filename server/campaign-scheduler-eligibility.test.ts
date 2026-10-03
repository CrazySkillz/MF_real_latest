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
});
