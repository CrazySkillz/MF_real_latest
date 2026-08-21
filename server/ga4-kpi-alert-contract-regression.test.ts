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
  importStartDate: "2026-07-01",
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

  it("does not evaluate imported revenue with an unverified native fallback", async () => {
    storageMock.getRevenueTotalForRange.mockResolvedValue({ totalRevenue: 0, sourceIds: ["shopify-zero"] });

    const revenue = await resolveAlertCurrentValueForDecision(row("revenue"));

    expect(revenue).toMatchObject({
      currentValue: "99",
      __alertDecisionEligible: false,
      __alertDecisionReason: "unavailable",
    });
  });

  it("keeps traffic alerts on the same completed-day rows as the live KPI cards", async () => {
    const oauthConnection = {
      ...connection,
      method: "access_token",
      accessToken: "access-token",
    };
    storageMock.getGA4Connections.mockResolvedValue([oauthConnection]);
    storageMock.getGA4Connection.mockResolvedValue(oauthConnection);
    storageMock.getGA4DailyMetrics.mockResolvedValue([{
      ...sourceRow,
      users: 80,
      sessions: 100,
      conversions: 20,
    }]);
    ga4ServiceMock.getTotalsWithRevenue.mockResolvedValue({
      totals: { users: 90, sessions: 120, pageviews: 140, conversions: 30, revenue: 2 },
    });

    const sessions = await resolveAlertCurrentValueForDecision(row("sessions"));
    const conversionRate = await resolveAlertCurrentValueForDecision(row("conversionRate"));

    expect(sessions).toMatchObject({ currentValue: "100", __alertDecisionEligible: true });
    expect(conversionRate).toMatchObject({ currentValue: "20", __alertDecisionEligible: true });
    expect(ga4ServiceMock.getTotalsWithRevenue).not.toHaveBeenCalled();
  });

  it("uses campaign-to-date financial conversions for CPA alerts while traffic keeps the import boundary", async () => {
    storageMock.getCampaign.mockResolvedValue({
      ...campaign,
      startDate: "2026-06-20T00:00:00.000Z",
    });
    const oauthConnection = {
      ...connection,
      method: "access_token",
      accessToken: "access-token",
    };
    storageMock.getGA4Connections.mockResolvedValue([oauthConnection]);
    storageMock.getGA4Connection.mockResolvedValue(oauthConnection);
    storageMock.getGA4DailyMetrics.mockResolvedValue([{
      ...sourceRow,
      sessions: 100,
      conversions: 20,
    }]);
    storageMock.getSpendTotalForRange.mockResolvedValue({ totalSpend: 100, sourceIds: ["spend-source"] });
    ga4ServiceMock.getTotalsWithRevenue.mockResolvedValue({
      totals: { users: 90, sessions: 120, pageviews: 140, conversions: 25, revenue: 2 },
    });

    const cpa = await resolveAlertCurrentValueForDecision(row("cpa"));

    expect(storageMock.getGA4DailyMetrics).toHaveBeenCalledWith(
      campaign.id,
      connection.propertyId,
      "2026-06-20",
      "2026-07-31",
    );
    expect(ga4ServiceMock.getTotalsWithRevenue).toHaveBeenCalledWith(
      connection.propertyId,
      "access-token",
      "2026-06-20",
      "2026-07-31",
      "scoped_campaign",
      "USD",
    );
    expect(storageMock.getRevenueTotalForRange).toHaveBeenCalledWith(campaign.id, "1900-01-01", "2026-07-31", "ga4");
    expect(storageMock.getSpendTotalForRange).toHaveBeenCalledWith(campaign.id, "1900-01-01", "2026-07-31", "ga4");
    expect(cpa).toMatchObject({ currentValue: "4", __alertDecisionEligible: true });
  });

  it("preserves normal credential refresh but forbids it in notification validation read-only mode", async () => {
    const oauthConnection = {
      ...connection,
      method: "access_token",
      accessToken: "expired-access-token",
      refreshToken: "refresh-token",
    };
    storageMock.getGA4Connections.mockResolvedValue([oauthConnection]);
    storageMock.getGA4Connection.mockResolvedValue(oauthConnection);
    ga4ServiceMock.getTotalsWithRevenue
      .mockRejectedValueOnce(new Error("401 unauthenticated"))
      .mockResolvedValue({
        totals: { users: 7, sessions: 8, pageviews: 9, conversions: 1, revenue: 2 },
      });
    ga4ServiceMock.refreshAccessToken.mockResolvedValue({ access_token: "new-access-token", expires_in: 3600 });

    const normal = await resolveAlertCurrentValueForDecision(row("revenue"));

    expect(normal).toMatchObject({ currentValue: "2", __alertDecisionEligible: true });
    expect(ga4ServiceMock.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(storageMock.updateGA4ConnectionTokens).toHaveBeenCalledTimes(1);

    ga4ServiceMock.getTotalsWithRevenue.mockReset().mockRejectedValue(new Error("401 unauthenticated"));
    ga4ServiceMock.refreshAccessToken.mockReset();
    storageMock.updateGA4ConnectionTokens.mockReset();

    const readOnly = await resolveAlertCurrentValueForDecision(
      row("revenue"),
      undefined,
      { allowCredentialRefresh: false },
    );

    expect(readOnly).toMatchObject({ currentValue: "0", __alertDecisionEligible: true });
    expect(ga4ServiceMock.refreshAccessToken).not.toHaveBeenCalled();
    expect(storageMock.updateGA4ConnectionTokens).not.toHaveBeenCalled();
  });

  it("fails closed instead of using a rolling financial fallback", async () => {
    storageMock.getGA4DailyMetrics.mockResolvedValue([]);

    const revenue = await resolveAlertCurrentValueForDecision(
      row("revenue"),
      undefined,
      { allowCredentialRefresh: false },
    );

    expect(revenue).toMatchObject({ currentValue: "99", __alertDecisionEligible: false, __alertDecisionReason: "unavailable" });
    expect(ga4ServiceMock.getAcquisitionBreakdown).not.toHaveBeenCalled();
    expect(ga4ServiceMock.refreshAccessToken).not.toHaveBeenCalled();
    expect(storageMock.updateGA4ConnectionTokens).not.toHaveBeenCalled();
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
