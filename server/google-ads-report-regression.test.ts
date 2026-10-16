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
    expect(scheduler).toContain("const SCHEDULED_REPORT_PLATFORM_TYPES = ['linkedin', 'google_analytics', 'google_ads', 'instagram', 'tiktok', 'google_sheets']");
  });

  it("persists Google Ads report revenue semantics and source provenance", () => {
    const page = readFileSync(join(process.cwd(), "client/src/pages/google-ads-analytics.tsx"), "utf-8");

    expect(page).toContain("const buildGoogleAdsReportRevenueSemantics = () => ({");
    expect(page).toContain("totalRevenueSource: hasGoogleAdsAttributedRevenue ? 'google_ads_imported_attributed_revenue' : 'unavailable'");
    expect(page).toContain("conversionValueSource: 'native_google_ads_conversion_value'");
    expect(page).toContain("sourceProvenance: googleAdsReportRevenueSourceProvenance()");
    expect(page).toContain("configuration: buildGoogleAdsReportConfiguration(configurationInput)");
    expect(page).toContain("const reportConfiguration = parseGoogleAdsReportConfiguration(report.configuration);");
  });

  it("includes Google Ads report configuration in scheduled snapshots and PDFs", () => {
    const scheduler = readFileSync(join(process.cwd(), "server/report-scheduler.ts"), "utf-8");

    expect(scheduler).toContain("const revenueSemantics = reportConfiguration?.revenueSemantics || {};");
    expect(scheduler).toContain('if (platformType !== "google_ads") return;');
    expect(scheduler).toContain('text("Revenue semantics", left, y, 12, "bold");');
    expect(scheduler).toContain('text("Conversion Value: Native Google Ads conversion value", left, y, 9, "normal", [71, 85, 105]);');
    expect(scheduler).toContain('text("Source provenance", left, y, 9, "bold", [71, 85, 105]);');
    expect(scheduler).toContain('...(snapshotPlatformType === "google_ads" ? { configuration: parseReportConfiguration((report as any).configuration) } : {})');
  });
});
