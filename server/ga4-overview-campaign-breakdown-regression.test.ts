import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveExactGA4CampaignBreakdownRevenue } from "../shared/ga4-campaign-breakdown";
import { mergeGA4OverviewCampaignRevenueRows } from "../shared/ga4-traffic-window";

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), "utf8");
const client = read("client", "src", "pages", "ga4-metrics.tsx");
const routes = read("server", "routes-oauth.ts");
const scheduledPdf = read("server", "ga4-scheduled-report-pdf.ts");
const analytics = read("server", "analytics.ts");

const between = (source: string, startText: string, endText: string) => {
  const start = source.indexOf(startText);
  const end = source.indexOf(endText, start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
};

describe("GA4 Overview Campaign Breakdown", () => {
  it("adds imported revenue only through an exact saved mapping", () => {
    const rows = [{ name: "Paid_Social" }, { name: "Email" }];
    const result = resolveExactGA4CampaignBreakdownRevenue(rows, [
      {
        id: "mapped",
        currency: "USD",
        revenue: 40,
        mappingConfig: {
          campaignMappings: [{ crmValue: "CRM A", linkedinCampaignName: "Paid_Social" }],
          campaignValueRevenueTotals: [{ campaignValue: "CRM A", revenue: 40 }],
        },
      },
      {
        id: "same-name-but-unmapped",
        currency: "USD",
        revenue: 60,
        mappingConfig: { campaignValueRevenueTotals: [{ campaignValue: "Email", revenue: 60 }] },
      },
      {
        id: "unrelated",
        currency: "USD",
        revenue: 70,
        mappingConfig: {
          campaignMappings: [{ crmValue: "CRM B", linkedinCampaignName: "Other" }],
          campaignValueRevenueTotals: [{ campaignValue: "CRM B", revenue: 70 }],
        },
      },
    ], "USD");

    expect(Object.fromEntries(result.revenueByCampaign)).toEqual({ Paid_Social: 40 });
    expect(Array.from(result.mappedSourceIds)).toEqual(["mapped"]);
    expect(result.ambiguous).toBe(false);
    expect(result.currencyMismatch).toBe(false);
  });

  it("keeps unmatched revenue outside rows and reconciles only when every amount is mapped", () => {
    const rows = [{ name: "Alpha", revenue: 100 }, { name: "Beta", revenue: 200 }];
    const partial = resolveExactGA4CampaignBreakdownRevenue(rows, [{
      id: "source",
      currency: "USD",
      revenue: 100,
      mappingConfig: {
        campaignMappings: [{ crmValue: "mapped", linkedinCampaignName: "Alpha" }],
        campaignValueRevenueTotals: [
          { campaignValue: "mapped", revenue: 25 },
          { campaignValue: "unmatched", revenue: 75 },
        ],
      },
    }, {
      id: "aggregate-only",
      currency: "USD",
      revenue: 50,
      mappingConfig: {},
    }], "USD");
    const fullyMapped = resolveExactGA4CampaignBreakdownRevenue(rows, [{
      id: "source",
      currency: "USD",
      revenue: 100,
      mappingConfig: {
        campaignMappings: [
          { crmValue: "mapped", linkedinCampaignName: "Alpha" },
          { crmValue: "unmatched", linkedinCampaignName: "Beta" },
        ],
        campaignValueRevenueTotals: [
          { campaignValue: "mapped", revenue: 25 },
          { campaignValue: "unmatched", revenue: 75 },
        ],
      },
    }], "USD");

    expect(300 + Array.from(partial.revenueByCampaign.values()).reduce((a, b) => a + b, 0)).toBe(325);
    expect(300 + Array.from(fullyMapped.revenueByCampaign.values()).reduce((a, b) => a + b, 0)).toBe(400);
    expect(partial).toMatchObject({ mappedRevenue: 25, unmatchedRevenue: 125, allImportedRevenueMapped: false });
    expect(fullyMapped).toMatchObject({ mappedRevenue: 100, unmatchedRevenue: 0, allImportedRevenueMapped: true });
    expect(partial.mappedRevenue + partial.unmatchedRevenue).toBe(150);
  });

  it("preserves exact mapped negative adjustments and fails closed on ambiguity or currency mismatch", () => {
    const negative = resolveExactGA4CampaignBreakdownRevenue([{ name: "Alpha" }], [{
      id: "source",
      currency: "USD",
      revenue: -15,
      mappingConfig: {
        campaignMappings: [{ crmValue: "refund", linkedinCampaignName: "Alpha" }],
        campaignValueRevenueTotals: [{ campaignValue: "refund", revenue: -15 }],
      },
    }], "USD");
    expect(negative.revenueByCampaign.get("Alpha")).toBe(-15);

    const ambiguous = resolveExactGA4CampaignBreakdownRevenue([{ name: "Alpha" }], [{
      id: "source",
      currency: "EUR",
      revenue: 15,
      mappingConfig: {
        campaignMappings: [
          { crmValue: "same", linkedinCampaignName: "Alpha" },
          { crmValue: "same", linkedinCampaignName: "Alpha" },
        ],
        campaignValueRevenueTotals: [{ campaignValue: "same", revenue: 15 }],
      },
    }], "USD");
    expect(ambiguous.ambiguous).toBe(true);
    expect(ambiguous.currencyMismatch).toBe(true);
  });

  it("ignores unused mappings but fails closed when selected mapped totals are not materialized", () => {
    const unused = resolveExactGA4CampaignBreakdownRevenue([{ name: "Alpha" }], [{
      id: "source",
      currency: "USD",
      revenue: null,
      mappingConfig: {
        campaignMappings: [{ crmValue: "unused", linkedinCampaignName: "Alpha" }],
        campaignValueRevenueTotals: [{ campaignValue: "unused", revenue: 0 }],
      },
    }, {
      id: "unrelated-ambiguous",
      currency: "EUR",
      revenue: null,
      mappingConfig: {
        campaignMappings: [
          { crmValue: "outside", linkedinCampaignName: "Other" },
          { crmValue: "outside", linkedinCampaignName: "Elsewhere" },
        ],
        campaignValueRevenueTotals: [{ campaignValue: "outside", revenue: "invalid" }],
      },
    }], "USD");
    expect(unused.mappedSourceIds.size).toBe(0);
    expect(unused.ambiguous).toBe(false);
    expect(unused.currencyMismatch).toBe(false);
    expect(unused.materializationMismatch).toBe(false);

    const stale = resolveExactGA4CampaignBreakdownRevenue([{ name: "Alpha" }], [{
      id: "source",
      currency: "USD",
      revenue: 9,
      mappingConfig: {
        campaignMappings: [{ crmValue: "mapped", linkedinCampaignName: "Alpha" }],
        campaignValueRevenueTotals: [{ campaignValue: "mapped", revenue: 10 }],
      },
    }], "USD");
    expect(Array.from(stale.mappedSourceIds)).toEqual(["source"]);
    expect(stale.materializationMismatch).toBe(true);
  });

  it("merges duplicate provider rows by normalized selected key and rejects scope leakage", () => {
    const merged = mergeGA4OverviewCampaignRevenueRows(
      [
        { campaign: "Alpha", sessions: 3, users: 2, conversions: 1 },
        { campaign: " alpha ", sessions: 4, users: 3, conversions: 2 },
      ],
      [{ campaign: "ALPHA", revenue: 12.34 }],
      ["Alpha"],
    );
    expect(merged).toEqual([expect.objectContaining({ campaign: "Alpha", sessions: 7, users: 5, conversions: 3, revenue: 12.34 })]);
    expect(() => mergeGA4OverviewCampaignRevenueRows([], [{ campaign: "Other", revenue: 1 }], ["Alpha"]))
      .toThrow("GA4_OVERVIEW_CAMPAIGN_REVENUE_SCOPE_MISMATCH");
    expect(() => mergeGA4OverviewCampaignRevenueRows([], [], ["Alpha", " alpha "]))
      .toThrow("GA4_OVERVIEW_CAMPAIGN_SCOPE_AMBIGUOUS");
  });

  it("requires exact saved property and campaign scope before provider work", () => {
    const route = between(routes, 'app.get("/api/campaigns/:id/ga4-breakdown"', "// Geographic breakdown endpoint");
    const providerCall = route.indexOf("ga4Service.getAcquisitionBreakdown(");
    expect(route.indexOf("GA4_PROPERTY_SCOPE_REQUIRED")).toBeLessThan(providerCall);
    expect(route.indexOf("GA4_CAMPAIGN_SCOPE_REQUIRED")).toBeLessThan(providerCall);
    expect(route).toContain("storage.getGA4Connection(campaignId, propertyId)");
    expect(route).toContain("mergeGA4OverviewCampaignRevenueRows(result.rows, revenueResult.rows, selectedCampaignNames)");
    expect(analytics).toContain('value: `.*[?&]utm_campaign=${escapeRegex(candidate)}(?:[&#].*)?$`');
  });

  it("keeps the exact UI columns, safe conversion rate, and current row ordering", () => {
    const table = between(client, "{/* Campaign Breakdown */}", "{/* Landing Pages */}");
    expect(table).toMatch(/Campaign[\s\S]*Sessions[\s\S]*Users[\s\S]*Conversions[\s\S]*Conv\. Rate[\s\S]*Revenue/);
    expect(client).toContain("conversionRate: sessions > 0 ? (conversions / sessions) * 100 : 0");
    expect(client).toContain(".sort((a, b) => b.sessions - a.sessions)");
    expect(table).toContain("campaignBreakdownAgg.map");
  });

  it("retains last-good rows and refetches on reload, focus, reconnect, and interval", () => {
    const query = between(client, "data: ga4Breakdown", "data: adComparisonBreakdown");
    expect(query).toContain("staleTime: 0");
    expect(query).toContain("refetchOnWindowFocus: true");
    expect(query).toContain("refetchOnReconnect: true");
    expect(query).toContain("refetchInterval: 10 * 60 * 1000");
    expect(query).toContain("refetchIntervalInBackground: true");
    expect(client).toContain("(breakdownError && ga4Breakdown === undefined)");
    expect(client).toContain("revenueSourcesResp === undefined ||");
  });

  it("uses the same exact mapping resolver and exports every row to both PDF consumers", () => {
    const browserPdf = between(client, "if (includeOverviewCampaignBreakdown)", "if (includeOverviewLandingPages)");
    const serverPdf = between(scheduledPdf, "if (includeCampaignBreakdown)", "if (includeLandingPages)");
    expect(client).toContain("resolveExactGA4CampaignBreakdownRevenue(");
    expect(scheduledPdf).toContain("resolveExactGA4CampaignBreakdownRevenue(");
    expect(browserPdf).not.toContain("slice(0, 15)");
    expect(serverPdf).not.toContain("slice(0, 15)");
    expect(browserPdf).toContain("campaignBreakdownMatchedExternalRevenue.get");
    expect(serverPdf).toContain("campaignBreakdownMatchedExternalRevenue.get");
  });
});
