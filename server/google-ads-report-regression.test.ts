import { readFileSync } from "fs";
import { join } from "path";

describe("Google Ads report regression guard", () => {
  it("saves Google Ads reports through platform reports, not legacy Meta reports", () => {
    const page = readFileSync(join(process.cwd(), "client/src/pages/google-ads-analytics.tsx"), "utf-8");

    expect(page).toContain("/api/platforms/google_ads/reports");
    expect(page).toContain("queryKey: ['/api/platforms/google_ads/reports', campaignId]");
    expect(page).toContain("scheduleRecipients: reportForm.scheduleEnabled");
    expect(page).toContain("scheduleTime: reportForm.scheduleEnabled ? to24HourHHMM(reportForm.scheduleTime) : undefined");
    expect(page).toContain("scheduleTimeZone: reportForm.scheduleEnabled ? userTimeZone : undefined");
    expect(page).not.toContain("/api/meta/reports?campaignId=${campaignId}&platformType=google_ads");
  });

  it("keeps scheduled Google Ads reports discoverable by the scheduler", () => {
    const scheduler = readFileSync(join(process.cwd(), "server/report-scheduler.ts"), "utf-8");

    expect(scheduler).toContain("storage.getPlatformReports('google_ads')");
    expect(scheduler).toContain("Found ${googleAdsReports.length} Google Ads platform reports");
    expect(scheduler).toContain("['linkedin', 'google_analytics', 'google_ads']");
  });
});
