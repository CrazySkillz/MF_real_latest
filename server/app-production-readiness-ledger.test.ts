import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const ledger = readFileSync(join(root, "APP_PRODUCTION_READINESS.md"), "utf8");

const certificateRecords = [
  "PRODUCTION_READINESS.md",
  "GA4_PRODUCTION_READY_TRACKER.md",
  "GA4_PRODUCTION_READINESS_OUTSTANDING.md",
  "GA4/OVERVIEW_PRODUCTION_READINESS.md",
  "GA4/OVERVIEW_PRODUCTION_READINESS_EVIDENCE.md",
  "GA4/OVERVIEW_PRODUCTION_READINESS_HISTORY.md",
  "GA4/OVERVIEW_REVENUE_PRODUCTION_READINESS.md",
  "GA4/OVERVIEW_REVENUE_HUBSPOT_PRODUCTION_READINESS.md",
  "GA4/OVERVIEW_REVENUE_SHOPIFY_PRODUCTION_READINESS.md",
  "GA4/OVERVIEW_SPEND_PRODUCTION_READINESS.md",
  "GA4/KPIS_PRODUCTION_READINESS.md",
  "GA4/BENCHMARKS_PRODUCTION_READINESS.md",
  "GA4/AD_COMPARISON_PRODUCTION_READINESS.md",
  "GA4/INSIGHTS_PRODUCTION_READINESS.md",
  "GA4/REPORTS_PRODUCTION_READINESS.md",
  "GA4/REPORTING_TIMEZONE_PRODUCTION_READINESS.md",
  "GA4/KPI_THRESHOLDS_PRODUCTION_READINESS.md",
  "GA4/BENCHMARK_THRESHOLDS_PRODUCTION_READINESS.md",
  "GA4/KPI_BENCHMARK_ALERTS_NOTIFICATIONS_PRODUCTION_READINESS.md",
  "CAMPAIGN_LEVEL_KPI_BENCHMARK_PRODUCTION_READY.md",
  "CAMPAIGN_DEEPDIVE_PRODUCTION_READY_STATUS.md",
  "CAMPAIGN_DEEPDIVE_PERFORMANCE_SUMMARY_PRODUCTION_READY.md",
  "CAMPAIGN_DEEPDIVE_BUDGET_FINANCIAL_ANALYSIS_PRODUCTION_READY.md",
  "CAMPAIGN_DEEPDIVE_PLATFORM_COMPARISON_PRODUCTION_READY.md",
  "CAMPAIGN_DEEPDIVE_TREND_ANALYSIS_PRODUCTION_READY.md",
  "CAMPAIGN_DEEPDIVE_EXECUTIVE_SUMMARY_PRODUCTION_READY.md",
  "CAMPAIGN_DEEPDIVE_CUSTOM_REPORT_PRODUCTION_READY.md",
  "LINKEDIN_CONNECTED_PLATFORM_PRODUCTION_READY.md",
  "LINKEDIN_REVENUE_IMPORT_PRODUCTION_READY.md",
  "GOOGLE_ADS_CONNECTED_PLATFORM_PRODUCTION_READY.md",
  "META_FACEBOOK_CONNECTED_PLATFORM_PRODUCTION_READY.md",
  "INSTAGRAM_CONNECTED_PLATFORM_PRODUCTION_READY.md",
  "TIKTOK_CONNECTED_PLATFORM_PRODUCTION_READY.md",
  "GOOGLE_SHEETS_CONNECTED_PLATFORM_PRODUCTION_READY.md",
  "CUSTOM_INTEGRATION_CONNECTED_PLATFORM_PRODUCTION_READY.md",
  "TARGETED_DESTRUCTIVE_VISIBILITY_AUDIT.md",
  "GA4/certifications/ga4-overview.json",
  "GA4/certifications/ga4-kpis.json",
  "GA4/certifications/ga4-benchmarks.json",
  "GA4/certifications/ga4-ad-comparison.json",
  "GA4/certifications/ga4-insights.json",
  "GA4/certifications/ga4-reports.json",
];

describe("application production-readiness ledger", () => {
  it("indexes every existing certificate record without promoting the whole app", () => {
    expect(ledger).toContain("<!-- app-certification-status: NOT_CERTIFIED -->");
    for (const path of certificateRecords) {
      expect(existsSync(join(root, path)), path).toBe(true);
      expect(ledger, path).toContain(`\`${path}\``);
    }
  });

  it("fails when a new readiness document is not added to the register", () => {
    const readinessName = /PRODUCTION_(?:READY|READINESS).*\.md$/;
    const discovered = [
      ...readdirSync(root)
        .filter((name) => readinessName.test(name) && name !== "APP_PRODUCTION_READINESS.md"),
      ...readdirSync(join(root, "GA4"))
        .filter((name) => readinessName.test(name))
        .map((name) => `GA4/${name}`),
    ];

    for (const path of discovered) {
      expect(certificateRecords, path).toContain(path);
    }
  });

  it("preserves current fail-closed GA4 and exact HubSpot decisions", () => {
    expect(ledger).toContain("| GA4 Overview | `UNVERIFIED`");
    expect(ledger).toContain("| GA4 KPIs | `UNVERIFIED`");
    expect(ledger).toContain("| GA4 Ad Comparison | `UNVERIFIED`");
    expect(ledger).toContain("| GA4 Reports | `UNVERIFIED`");
    expect(ledger).toContain("| GA4 Benchmarks | `CERTIFIED`");
    expect(ledger).toContain("| GA4 Insights | `CERTIFIED`");
    expect(ledger).toContain("| HubSpot Revenue and Pipeline Proxy | `CERTIFIED`");
    expect(ledger).toContain("490c8ae685821389d1f433a5943f856478f52e5c");
  });

  it("requires impact-based carry-forward instead of blanket recertification", () => {
    expect(ledger).toContain("## Durable No-Repeat Rule");
    expect(ledger).toContain("Reopen only those rows and their proven downstream dependants");
    expect(ledger).toContain("A calendar change, unrelated commit, documentation-only commit");
    expect(ledger).toContain("## App Certification Exit Gate");
  });
});
