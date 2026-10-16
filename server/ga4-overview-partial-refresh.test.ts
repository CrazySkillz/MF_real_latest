import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import { resolveGA4OverviewFinancialRefreshWarning as resolveWarning } from "../shared/ga4-financial-source";

const fixture = () => ({
  campaignId: "campaign-1", currency: "EUR", selectedPropertyId: "123", primaryPropertyId: "123",
  daily: {
    propertyId: "123", overviewStartDate: "2026-09-01", latestStoredDailyDate: "2026-10-15",
    reportingTimeZone: "Europe/Amsterdam", lastUpdated: "2026-10-16T12:05:00.000Z",
  },
  snapshot: {
    campaignId: "campaign-1", reportingDate: "2026-10-15", recordedAt: "2026-10-16T12:06:00.000Z",
    metrics: { financialDaily: {
      currency: "EUR",
      currentValueWindow: { startDate: "2026-09-01", endDate: "2026-10-15", reportingTimeZone: "Europe/Amsterdam" },
      inputs: {
        revenue: { available: true, value: "1000.00", sources: ["ga4"] },
        spend: { available: true, value: "200.00", sources: ["canonical_spend_sources"] },
        conversions: { available: true, value: 10, sources: ["ga4"] },
      },
    } },
  },
});

describe("GA4 Overview partial financial updates", () => {
  it("detects morning financial figures retained after an afternoon GA4 update on the same reporting day", () => {
    const input = fixture();
    input.snapshot.recordedAt = "2026-10-16T06:06:00.000Z";
    const before = JSON.stringify(input);
    expect(resolveWarning(input)).toBe("earlier_update");
    expect(JSON.stringify(input)).toBe(before);
  });

  it("detects an older reporting day even if its snapshot was saved more recently", () => {
    const input = fixture();
    input.snapshot.reportingDate = input.snapshot.metrics.financialDaily.currentValueWindow.endDate = "2026-10-14";
    expect(resolveWarning(input)).toBe("earlier_update");
  });

  it("clears the warning when the next financial read catches up, without changing saved values", () => {
    const input = fixture();
    input.snapshot.recordedAt = "2026-10-16T06:06:00.000Z";
    expect(resolveWarning(input)).toBe("earlier_update");
    input.snapshot.recordedAt = "2026-10-16T12:06:00.000Z";
    const before = JSON.stringify(input);
    expect(resolveWarning(input)).toBeNull();
    expect(JSON.stringify(input)).toBe(before);
  });

  it("compares timestamp instants rather than timezone-offset text", () => {
    const input = fixture();
    input.snapshot.recordedAt = "2026-10-16T14:04:00+02:00";
    expect(resolveWarning(input)).toBe("earlier_update");
    input.snapshot.recordedAt = "2026-10-16T14:05:00+02:00";
    expect(resolveWarning(input)).toBeNull();
  });

  it.each(["", "invalid"])("does not infer alignment from missing/invalid update times: %s", (time) => {
    const input = fixture();
    input.snapshot.recordedAt = time;
    expect(resolveWarning(input)).toBe("unverified");
    input.snapshot.recordedAt = fixture().snapshot.recordedAt;
    input.daily.lastUpdated = time;
    expect(resolveWarning(input)).toBe("unverified");
  });

  it("does not compare initial, missing or previous-property placeholder responses", () => {
    expect(resolveWarning({ ...fixture(), daily: undefined })).toBeNull();
    expect(resolveWarning({ ...fixture(), snapshot: null })).toBeNull();
    expect(resolveWarning({ ...fixture(), selectedPropertyId: "456" })).toBeNull();
    expect(resolveWarning({ ...fixture(), selectedPropertyId: "" })).toBeNull();
  });

  it.each(["campaign", "currency", "property", "start", "timezone"])("does not assert freshness across a different %s scope", (scope) => {
    const input = fixture();
    if (scope === "campaign") input.snapshot.campaignId = "campaign-2";
    if (scope === "currency") input.snapshot.metrics.financialDaily.currency = "USD";
    if (scope === "property") input.primaryPropertyId = "456";
    if (scope === "start") input.snapshot.metrics.financialDaily.currentValueWindow.startDate = "2026-08-01";
    if (scope === "timezone") input.snapshot.metrics.financialDaily.currentValueWindow.reportingTimeZone = "UTC";
    expect(resolveWarning(input)).toBe("unverified");
  });

  it("does not call newer financial reporting dates older when the GA4 browser response has not caught up", () => {
    const input = fixture();
    input.daily.latestStoredDailyDate = "2026-10-14";
    expect(resolveWarning(input)).toBe("unverified");
  });

  it.each(["", "2026-02-30"])("rejects missing or impossible reporting dates: %s", (date) => {
    const input = fixture();
    input.daily.latestStoredDailyDate = date;
    expect(resolveWarning(input)).toBe("unverified");
  });

  it("does not treat zero revenue or unconfigured spend as a failed refresh", () => {
    const input = fixture();
    input.snapshot.metrics.financialDaily.inputs.revenue.value = "0.00";
    input.snapshot.metrics.financialDaily.inputs.spend = { available: false, value: null, sources: [] } as any;
    expect(resolveWarning(input)).toBeNull();
    input.snapshot.recordedAt = "2026-10-16T06:06:00.000Z";
    expect(resolveWarning(input)).toBe("earlier_update");
  });

  it("does not need process-local refresh observations after restart", () => {
    const input = fixture();
    input.snapshot.recordedAt = "2026-10-16T06:06:00.000Z";
    expect(resolveWarning(JSON.parse(JSON.stringify(input)))).toBe("earlier_update");
  });

  it("wires the warning to persisted Overview responses while preserving the saved CPA denominator", () => {
    const page = readFileSync("client/src/pages/ga4-metrics.tsx", "utf8");
    expect(page).toContain("daily: ga4DailyResp, snapshot: overviewFinancialSnapshot");
    expect(page).toContain("ga4ConnectionUsable && !ga4DailyPlaceholder");
    expect(page).toContain('activeTab === "overview" && overviewFinancialRefreshWarning');
    expect(page).toContain('data-testid="ga4-financial-refresh-warning"');
    expect(page).toContain("CPA uses the conversions saved with that earlier financial update.");
    expect(page).toContain("const overviewFinancialCPA = computeCpa(overviewFinancialSpend, overviewFinancialConversions);");
    expect(page).toContain("const overviewFinancialConversions = Number(overviewFinancialInputs?.conversions?.value || 0);");
  });
});
