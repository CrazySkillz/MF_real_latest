import { describe, expect, it } from "vitest";
import { buildMimosaasTrackingFinancialDailySnapshot } from "./utils/mimosaas-tracking-financial-snapshot";

const source = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  sourceType: "csv",
  currency: "EUR",
  mappingConfig: JSON.stringify({ storedDateColumn: "Date" }),
  ...overrides,
}) as any;

const base = (overrides: Record<string, unknown> = {}) => ({
  campaignId: "campaign-1",
  reportingDate: "2026-10-14",
  reportingTimeZone: "Europe/Amsterdam",
  currency: "EUR",
  conversions: 3,
  revenueSources: [source("revenue-1"), source("revenue-2")],
  spendSources: [source("spend-1")],
  revenueRecords: [
    { revenueSourceId: "revenue-1", revenue: "125.50", currency: "EUR", subCampaignUrn: null },
    { revenueSourceId: "revenue-1", revenue: "75.00", currency: "EUR", subCampaignUrn: "ad-1" },
    { revenueSourceId: "revenue-2", revenue: "0.00", currency: "EUR", subCampaignUrn: null },
  ],
  spendRecords: [
    { spendSourceId: "spend-1", spend: "20.00", currency: "EUR" },
    { spendSourceId: "spend-1", spend: "5.25", currency: "EUR" },
  ],
  ...overrides,
}) as any;

describe("Mimosaas Tracking financial snapshot", () => {
  it("builds one exact reporting day from all configured date-mapped CSV sources", () => {
    const result = buildMimosaasTrackingFinancialDailySnapshot(base());

    expect(result).toEqual({
      ready: true,
      snapshot: {
        version: "financial_daily_snapshot_v1",
        campaignId: "campaign-1",
        reportingDate: "2026-10-14",
        currency: "EUR",
        currentValueWindow: {
          mode: "initial_import_to_latest_completed_day",
          startDate: "2026-10-14",
          endDate: "2026-10-14",
          dataThroughDate: "2026-10-14",
          reportingTimeZone: "Europe/Amsterdam",
        },
        inputs: {
          revenue: {
            value: "125.50",
            available: true,
            sources: ["revenue-source:revenue-1", "revenue-source:revenue-2"],
          },
          spend: {
            value: "25.25",
            available: true,
            sources: ["spend-source:spend-1"],
          },
          conversions: { value: 3, available: true, sources: ["mimosaas_tracking"] },
        },
      },
    });
  });

  it("marks an absent financial category unavailable without inventing a value", () => {
    const result = buildMimosaasTrackingFinancialDailySnapshot(base({
      spendSources: [],
      spendRecords: [],
    }));

    expect(result).toMatchObject({
      ready: true,
      snapshot: { inputs: { spend: { value: null, available: false, sources: [] } } },
    });
  });

  it("does not guess zero when a configured source has no row for the reporting date", () => {
    const result = buildMimosaasTrackingFinancialDailySnapshot(base({
      revenueRecords: [{ revenueSourceId: "revenue-1", revenue: "125.50", currency: "EUR", subCampaignUrn: null }],
    }));

    expect(result).toEqual({ ready: false, reasons: ["revenue_source_reporting_date_missing"] });
  });

  it("blocks provider-backed, manual, and undated CSV sources", () => {
    const result = buildMimosaasTrackingFinancialDailySnapshot(base({
      revenueSources: [
        source("shopify-1", { sourceType: "shopify" }),
        source("manual-1", { sourceType: "manual" }),
      ],
      spendSources: [source("csv-1", { mappingConfig: JSON.stringify({ storedDateColumn: null }) })],
      revenueRecords: [],
      spendRecords: [],
    }));

    expect(result).toEqual({
      ready: false,
      reasons: [
        "revenue_source_refresh_unsupported:shopify",
        "revenue_source_refresh_unsupported:manual",
        "spend_source_refresh_unsupported:csv",
      ],
    });
  });

  it("rejects cross-source records, currency mismatches, invalid values, and invalid conversions", () => {
    const result = buildMimosaasTrackingFinancialDailySnapshot(base({
      conversions: -1,
      revenueRecords: [{ revenueSourceId: "foreign", revenue: "10.00", currency: "USD", subCampaignUrn: null }],
      spendRecords: [{ spendSourceId: "spend-1", spend: "invalid", currency: "EUR" }],
    }));

    expect(result).toMatchObject({
      ready: false,
      reasons: expect.arrayContaining([
        "tracker_conversions_invalid",
        "revenue_record_source_mismatch",
        "revenue_record_currency_mismatch",
        "spend_record_value_invalid",
      ]),
    });
  });

  it("fails closed when a value cannot fit the shared financial snapshot contract", () => {
    const result = buildMimosaasTrackingFinancialDailySnapshot(base({
      revenueRecords: [
        { revenueSourceId: "revenue-1", revenue: "100000000", currency: "EUR", subCampaignUrn: null },
        { revenueSourceId: "revenue-2", revenue: "0.00", currency: "EUR", subCampaignUrn: null },
      ],
    }));

    expect(result).toEqual({ ready: false, reasons: ["financial_snapshot_invalid"] });
  });
});
