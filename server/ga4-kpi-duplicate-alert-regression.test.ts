import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  getGA4KPIDuplicateKey,
  getLatestGA4KPIIdsByDuplicateKey,
  isLatestGA4KPIForDuplicateKey,
} from "./utils/ga4-kpi-alert-dedupe";

const readServerFile = (name: string) => readFileSync(join(process.cwd(), "server", name), "utf-8");

const expectBefore = (source: string, before: string, after: string) => {
  const beforeIndex = source.indexOf(before);
  const afterIndex = source.indexOf(after);
  expect(beforeIndex, `Missing expected text: ${before}`).toBeGreaterThan(-1);
  expect(afterIndex, `Missing expected text: ${after}`).toBeGreaterThan(-1);
  expect(beforeIndex, `${before} should appear before ${after}`).toBeLessThan(afterIndex);
};

const sliceBetween = (source: string, start: string, end: string) => {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  expect(startIndex, `Missing section start: ${start}`).toBeGreaterThan(-1);
  expect(endIndex, `Missing section end: ${end}`).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
};

describe("GA4 KPI duplicate alert latest-row behavior", () => {
  it("selects the latest GA4 KPI row per campaign and metric/name key", () => {
    const oldRevenue = {
      id: "kpi-old-revenue",
      campaignId: "campaign-a",
      platformType: "google_analytics",
      metric: "Revenue",
      name: "Revenue",
      createdAt: "2026-06-27T10:00:00.000Z",
      updatedAt: "2026-06-27T10:00:00.000Z",
    };
    const latestRevenue = {
      ...oldRevenue,
      id: "kpi-latest-revenue",
      createdAt: "2026-06-28T10:00:00.000Z",
      updatedAt: "2026-06-28T10:00:00.000Z",
    };
    const otherCampaignRevenue = {
      ...oldRevenue,
      id: "kpi-other-campaign",
      campaignId: "campaign-b",
      createdAt: "2026-06-26T10:00:00.000Z",
    };
    const nameFallback = {
      id: "kpi-name-fallback",
      campaignId: "campaign-a",
      platformType: "google_analytics",
      metric: "",
      name: "Qualified Pipeline",
      createdAt: "2026-06-28T11:00:00.000Z",
    };

    const latestIds = getLatestGA4KPIIdsByDuplicateKey([
      oldRevenue,
      latestRevenue,
      otherCampaignRevenue,
      nameFallback,
      { ...latestRevenue, id: "linkedin-revenue", platformType: "linkedin" },
    ]);

    expect(getGA4KPIDuplicateKey({ ...oldRevenue, metric: "Total Revenue" })).toBe("campaign-a:totalrevenue");
    expect(getGA4KPIDuplicateKey(nameFallback)).toBe("campaign-a:qualifiedpipeline");
    expect(latestIds.get("campaign-a:revenue")).toBe("kpi-latest-revenue");
    expect(latestIds.get("campaign-b:revenue")).toBe("kpi-other-campaign");
    expect(latestIds.get("campaign-a:qualifiedpipeline")).toBe("kpi-name-fallback");
    expect(isLatestGA4KPIForDuplicateKey(oldRevenue, latestIds)).toBe(false);
    expect(isLatestGA4KPIForDuplicateKey(latestRevenue, latestIds)).toBe(true);
    expect(isLatestGA4KPIForDuplicateKey({ ...oldRevenue, platformType: "linkedin" }, latestIds)).toBe(true);

    const afterLatestDelete = getLatestGA4KPIIdsByDuplicateKey([oldRevenue, otherCampaignRevenue]);
    expect(afterLatestDelete.get("campaign-a:revenue")).toBe("kpi-old-revenue");
    expect(afterLatestDelete.get("campaign-b:revenue")).toBe("kpi-other-campaign");
  });

  it("guards in-app alerts and email paths before older duplicate rows can create alerts", () => {
    const scheduler = readServerFile("kpi-scheduler.ts");
    const alertMonitoring = readServerFile(join("services", "alert-monitoring.ts"));
    const notifications = readServerFile("kpi-notifications.ts");

    expect(scheduler).toContain("const latestGA4KpiIdsByDuplicateKey = getLatestGA4KPIIdsByDuplicateKey(activeKPIsRaw);");
    expectBefore(
      scheduler,
      "if (!isLatestGA4KPIForDuplicateKey(rawKpi, latestGA4KpiIdsByDuplicateKey)) {",
      "const kpi = await resolveCampaignCurrentValueForAlert(rawKpi, campaignMetricCache);"
    );
    expect(scheduler).toContain("await resolveKPIAlerts(String((rawKpi as any).id), 'superseded');");

    const immediate = sliceBetween(alertMonitoring, "async sendImmediateKPIAlertIfNeeded", "async sendImmediateBenchmarkAlertIfNeeded");
    expectBefore(
      immediate,
      "if (!(await this.isLatestGA4KPIAlertCandidate(rawKpi))) return false;",
      "const kpi = await resolveCampaignCurrentValueForAlert(rawKpi);"
    );

    const retry = sliceBetween(alertMonitoring, "private async isKPIAlertRetryStillSendable", "private async isBenchmarkAlertRetryStillSendable");
    expectBefore(
      retry,
      "if (!(await this.isLatestGA4KPIAlertCandidate(rawKpi))) return false;",
      "const kpi = await resolveCampaignCurrentValueForAlert(rawKpi);"
    );

    const scheduled = sliceBetween(alertMonitoring, "async checkKPIAlerts", "async checkBenchmarkAlerts");
    expect(scheduled).toContain("const allGA4KPIsForDuplicateCheck = await db");
    expect(scheduled).toContain(".where(eq(kpis.platformType, \"google_analytics\"));");
    expectBefore(
      scheduled,
      "if (!isLatestGA4KPIForDuplicateKey(rawKpi, latestGA4KpiIdsByDuplicateKey)) continue;",
      "const kpi = await resolveCampaignCurrentValueForAlert(rawKpi, campaignMetricCache);"
    );

    expect(notifications).toContain("if (usesSingleActiveAlert) return String(meta.kpiId || '') === String(kpi.id);");
    expect(notifications).toContain("return String(meta.kpiId || '') === String(kpi.id) && !meta.resolved && !meta.dismissedAt;");
  });
});
