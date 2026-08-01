import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const storageMock = vi.hoisted(() => ({
  getCampaign: vi.fn(),
  getGA4Connections: vi.fn(),
  getGA4Connection: vi.fn(),
  getGA4DailyMetrics: vi.fn(),
  getRevenueTotalForRange: vi.fn(),
  getSpendTotalForRange: vi.fn(),
  updateGA4ConnectionTokens: vi.fn(),
}));
const ga4ServiceMock = vi.hoisted(() => ({
  getTotalsWithRevenue: vi.fn(),
  getAcquisitionBreakdown: vi.fn(),
  refreshAccessToken: vi.fn(),
}));

vi.mock("./storage", () => ({ storage: storageMock }));
vi.mock("./analytics", () => ({ ga4Service: ga4ServiceMock }));

import { isAlertDecisionBreached } from "./utils/alert-decision";
import { resolveAlertCurrentValueForDecision } from "./utils/ga4-alert-current-value";

const campaign = {
  id: "campaign-alert-contract",
  createdAt: "2026-07-01T00:00:00.000Z",
  startDate: "2026-07-01T00:00:00.000Z",
  reportingTimeZone: "UTC",
  ga4CampaignFilter: "scoped_campaign",
};
const connection = {
  id: "ga4-alert-contract",
  campaignId: campaign.id,
  propertyId: "properties/123",
  method: "stored",
  isPrimary: true,
  lookbackDays: 30,
};
const sourceRow = {
  date: "2026-07-31",
  users: 0,
  sessions: 0,
  pageviews: 0,
  conversions: 0,
  revenue: "0",
  engagedSessions: 0,
  engagementRate: 0,
};
const row = (metric: string) => ({
  id: `kpi-${metric}`,
  campaignId: campaign.id,
  platformType: "google_analytics",
  metric,
  name: metric,
  currentValue: "99",
  alertThreshold: "100",
  alertCondition: "below",
  alertsEnabled: true,
});

describe("GA4 KPI Commit 6 alert/notification contract", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-01T12:00:00.000Z"));
    for (const mock of Object.values(storageMock)) mock.mockReset();
    for (const mock of Object.values(ga4ServiceMock)) mock.mockReset();
    storageMock.getCampaign.mockResolvedValue(campaign);
    storageMock.getGA4Connections.mockResolvedValue([connection]);
    storageMock.getGA4Connection.mockResolvedValue(connection);
    storageMock.getGA4DailyMetrics.mockResolvedValue([sourceRow]);
    storageMock.getRevenueTotalForRange.mockResolvedValue({ totalRevenue: 0, sourceIds: [] });
    storageMock.getSpendTotalForRange.mockResolvedValue({ totalSpend: 100, sourceIds: ["spend-source"] });
    ga4ServiceMock.getAcquisitionBreakdown.mockRejectedValue(new Error("unavailable"));
  });
  afterEach(() => vi.useRealTimers());

  it("keeps authoritative zero alert-eligible for counts and revenue", async () => {
    const users = await resolveAlertCurrentValueForDecision(row("users"));
    const revenue = await resolveAlertCurrentValueForDecision(row("revenue"));

    expect(users).toMatchObject({ currentValue: "0", __alertDecisionEligible: true });
    expect(revenue).toMatchObject({ currentValue: "0", __alertDecisionEligible: true });
    expect(isAlertDecisionBreached(users)).toBe(true);
    expect(isAlertDecisionBreached(revenue)).toBe(true);
  });

  it("blocks insufficient rate and CPA inputs before threshold evaluation", async () => {
    const conversionRate = await resolveAlertCurrentValueForDecision(row("conversionRate"));
    const cpa = await resolveAlertCurrentValueForDecision(row("cpa"));

    expect(conversionRate).toMatchObject({
      currentValue: "0",
      __alertDecisionEligible: false,
      __alertDecisionReason: "insufficient_sessions",
    });
    expect(cpa).toMatchObject({
      currentValue: "0",
      __alertDecisionEligible: false,
      __alertDecisionReason: "insufficient_conversions",
    });
    expect(isAlertDecisionBreached(conversionRate)).toBe(false);
    expect(isAlertDecisionBreached(cpa)).toBe(false);
  });

  it("preserves but never evaluates a last-good value when required source input is unavailable", async () => {
    storageMock.getGA4DailyMetrics.mockRejectedValue(new Error("daily source unavailable"));

    const users = await resolveAlertCurrentValueForDecision(row("users"));
    const revenue = await resolveAlertCurrentValueForDecision(row("revenue"));

    expect(users).toMatchObject({
      currentValue: "99",
      __alertDecisionEligible: false,
      __alertDecisionReason: "unavailable",
    });
    expect(revenue).toMatchObject({
      currentValue: "99",
      __alertDecisionEligible: false,
      __alertDecisionReason: "unavailable",
    });
    expect(isAlertDecisionBreached(users)).toBe(false);
    expect(isAlertDecisionBreached(revenue)).toBe(false);
  });

  it("routes every GA4 alert consumer through the shared resolver and decision predicate", () => {
    const files = [
      "kpi-scheduler.ts",
      "benchmark-notifications.ts",
      join("services", "alert-monitoring.ts"),
      "routes-oauth.ts",
    ].map((name) => readFileSync(join(process.cwd(), "server", name), "utf8"));
    const kpiNotifications = readFileSync(join(process.cwd(), "server", "kpi-notifications.ts"), "utf8");

    for (const source of files) expect(source).toContain("resolveAlertCurrentValueForDecision");
    for (const source of files.slice(1)) expect(source).toContain("isAlertDecisionBreached");
    expect(files[0]).toContain("shouldTriggerAlert(kpi)");
    expect(kpiNotifications).toContain("return isAlertDecisionBreached(kpi);");
    expect(files[2].match(/resolveAlertCurrentValueForDecision\(/g)).toHaveLength(6);
    expect(files[2].match(/isAlertDecisionBreached\(/g)).toHaveLength(6);
    expect(files[3]).toContain("resolveAlertCurrentValueForDecision(row);");
    expect(files[3]).toContain("isAlertDecisionBreached(resolved);");
  });
});
