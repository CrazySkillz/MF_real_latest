import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const campaignDetail = readFileSync("client/src/pages/campaign-detail.tsx", "utf8");
const overview = readFileSync("client/src/components/MimosaasTrackingOverview.tsx", "utf8");

describe("Mimosaas Tracking Campaign Overview safety", () => {
  it("renders the tracker Overview only for an active Mimosaas Tracking campaign", () => {
    expect(campaignDetail).toContain('const isMimosaasTrackingCampaign = campaign?.platform === "mimosaas-tracking";');
    expect(campaignDetail).toContain('isMimosaasTrackingCampaign && campaign.status === "active"');
    expect(campaignDetail).toContain('<MimosaasTrackingOverview campaignId={campaign.id} currency={campaign.currency || "USD"} />');
  });

  it("preserves the existing GA4 card and excludes it from tracker campaigns", () => {
    expect(campaignDetail).toContain('allPlatformMetrics.filter(({ platform }) => platform === "Google Analytics")');
    expect(campaignDetail).toContain('const platformMetrics = isMimosaasTrackingCampaign');
    expect(campaignDetail).toContain('? []');
  });

  it("reads only the protected tracker snapshot and source endpoints", () => {
    expect(overview).toContain('/mimosaas-tracking/daily-snapshot`');
    expect(overview).toContain('/mimosaas-tracking/financial-sources`');
    expect(overview).not.toContain("ga4-metrics");
    expect(overview).not.toContain("outcome-totals");
    expect(overview).not.toContain("financial-daily-snapshot");
  });

  it("fails closed when finalized data is absent or unavailable", () => {
    expect(overview).toContain("No finalized daily snapshot is available yet.");
    expect(overview).toContain("Finalized tracking data is temporarily unavailable.");
    expect(overview).toContain('retry: false');
    expect(overview).not.toContain("|| 0");
  });

  it("uses snapshot availability states for Revenue and Spend", () => {
    expect(overview).toContain("snapshot.revenueStatus");
    expect(overview).toContain("snapshot.spendStatus");
    expect(overview).toContain('status !== "available"');
    expect(overview).not.toContain("ROAS");
    expect(overview).not.toContain("ROI");
    expect(overview).not.toContain("CPA");
  });

  it("shows tracker-scoped Revenue and Spend source names without replacing snapshot values", () => {
    expect(overview).toContain("sourcesData?.revenueSources");
    expect(overview).toContain("sourcesData?.spendSources");
    expect(overview).toContain('String(source.displayName || "").trim() || "Google Sheets"');
    expect(overview).toContain("Source status unavailable");
  });
});
