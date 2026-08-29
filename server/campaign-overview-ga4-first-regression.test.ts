import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

const campaignDetail = readFileSync(
  join(process.cwd(), "client", "src", "pages", "campaign-detail.tsx"),
  "utf-8",
);

describe("Campaign Overview GA4-first Connected Platforms", () => {
  it("renders only the Google Analytics main card and keeps its financial child sources", () => {
    expect(campaignDetail).toContain(
      'const platformMetrics = allPlatformMetrics.filter(({ platform }) => platform === "Google Analytics");',
    );
    expect(campaignDetail).toContain("sourceItemsByPlatform(platform.platform).length > 0");
    expect(campaignDetail).toContain("Revenue & Spend Sources");
  });
});
