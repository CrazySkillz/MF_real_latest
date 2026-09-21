import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { resolveCampaignDeepDiveReportWriteLimit } from "./storage";

const limits = { maxActiveReports: 50, maxScheduledActiveReports: 10 };
const activeReport = (scheduleEnabled = false) => ({ status: "active", scheduleEnabled });

describe("Campaign DeepDive report concurrency guard", () => {
  it("applies active and scheduled limits without counting archived or the updated row", () => {
    expect(resolveCampaignDeepDiveReportWriteLimit(
      Array.from({ length: 49 }, () => activeReport()),
      { incrementsActiveCount: true, incrementsScheduledActiveCount: false },
      limits,
    )).toBeNull();
    expect(resolveCampaignDeepDiveReportWriteLimit(
      Array.from({ length: 50 }, () => activeReport()),
      { incrementsActiveCount: true, incrementsScheduledActiveCount: false },
      limits,
    )).toBe("REPORT_LIMIT_REACHED");
    expect(resolveCampaignDeepDiveReportWriteLimit(
      [...Array.from({ length: 10 }, () => activeReport(true)), { status: "archived", scheduleEnabled: true }],
      { incrementsActiveCount: false, incrementsScheduledActiveCount: true },
      limits,
    )).toBe("SCHEDULED_REPORT_LIMIT_REACHED");
    expect(resolveCampaignDeepDiveReportWriteLimit(
      Array.from({ length: 50 }, () => activeReport(true)),
      { incrementsActiveCount: false, incrementsScheduledActiveCount: false },
      limits,
    )).toBeNull();
  });

  it("serializes Campaign DeepDive create and update count-and-write operations with the same campaign lock", () => {
    const source = readFileSync(join(process.cwd(), "server/storage.ts"), "utf-8");
    const createMethod = source.slice(
      source.indexOf("async createCampaignDeepDivePlatformReport"),
      source.indexOf("async updatePlatformReport", source.indexOf("async createCampaignDeepDivePlatformReport")),
    );
    const updateMethod = source.slice(
      source.indexOf("async updateCampaignDeepDivePlatformReport"),
      source.indexOf("async deletePlatformReport", source.indexOf("async updateCampaignDeepDivePlatformReport")),
    );

    for (const method of [createMethod, updateMethod]) {
      expect(method).toContain("db.transaction");
      expect(method).toContain("pg_advisory_xact_lock");
      expect(method).toContain("campaign_deepdive_reports:");
      expect(method).toContain('eq(linkedinReports.platformType, "campaign_deepdive")');
      expect(method.indexOf("pg_advisory_xact_lock")).toBeLessThan(method.indexOf("resolveCampaignDeepDiveReportWriteLimit"));
    }
    expect(createMethod.indexOf("resolveCampaignDeepDiveReportWriteLimit"))
      .toBeLessThan(createMethod.indexOf("tx.insert(linkedinReports)"));
    expect(updateMethod.indexOf("resolveCampaignDeepDiveReportWriteLimit"))
      .toBeLessThan(updateMethod.indexOf("tx.update(linkedinReports)"));
  });
});
