import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { financialDailySnapshotInputSchema, type FinancialDailySnapshotInput } from "../shared/schema";

const snapshotIdentity = (snapshot: FinancialDailySnapshotInput) =>
  `${snapshot.campaignId}:${snapshot.reportingDate}`;

const round2 = (value: number) => Number(value.toFixed(2));

const deriveFinancials = (dailySnapshot: FinancialDailySnapshotInput) => {
  const spend = dailySnapshot.inputs.spend.available && dailySnapshot.inputs.spend.sources.length > 0
    ? Number(dailySnapshot.inputs.spend.value)
    : null;
  const revenue = dailySnapshot.inputs.revenue.available && dailySnapshot.inputs.revenue.sources.length > 0
    ? Number(dailySnapshot.inputs.revenue.value)
    : null;
  const conversions = dailySnapshot.inputs.conversions.available && dailySnapshot.inputs.conversions.sources.length > 0
    ? dailySnapshot.inputs.conversions.value
    : null;

  return {
    profit: spend !== null && revenue !== null ? round2(revenue - spend) : null,
    roas: spend !== null && revenue !== null && spend > 0 ? round2(revenue / spend) : null,
    roi: spend !== null && revenue !== null && spend > 0 ? round2(((revenue - spend) / spend) * 100) : null,
    cpa: spend !== null && conversions !== null && conversions > 0 ? round2(spend / conversions) : null,
  };
};

const snapshot: FinancialDailySnapshotInput = {
  version: "financial_daily_snapshot_v1",
  campaignId: "campaign-1",
  reportingDate: "2026-08-21",
  currency: "USD",
  currentValueWindow: {
    mode: "initial_import_to_latest_completed_day",
    startDate: "2026-07-02",
    endDate: "2026-08-21",
    dataThroughDate: "2026-08-21",
    reportingTimeZone: "Europe/Amsterdam",
  },
  inputs: {
    spend: { value: "2699.75", available: true, sources: ["canonical_spend_sources"] },
    revenue: { value: "72766.69", available: true, sources: ["ga4", "persisted_revenue_sources"] },
    conversions: { value: 251, available: true, sources: ["ga4"] },
  },
};

describe("compact daily financial snapshot contract", () => {
  it("uses one stable identity per campaign and completed reporting day", () => {
    expect(financialDailySnapshotInputSchema.parse(snapshot)).toEqual(snapshot);
    expect(snapshotIdentity(snapshot)).toBe("campaign-1:2026-08-21");
    expect(snapshot.currentValueWindow.endDate).toBe(snapshot.reportingDate);
    expect(snapshot.currentValueWindow.dataThroughDate).toBe(snapshot.reportingDate);
  });

  it("stores authoritative inputs only and derives financial outputs", () => {
    expect(Object.keys(snapshot.inputs)).toEqual(["spend", "revenue", "conversions"]);
    expect(snapshot).not.toHaveProperty("profit");
    expect(snapshot).not.toHaveProperty("roas");
    expect(snapshot).not.toHaveProperty("roi");
    expect(snapshot).not.toHaveProperty("cpa");

    expect(deriveFinancials(snapshot)).toEqual({
      profit: 70066.94,
      roas: 26.95,
      roi: 2595.31,
      cpa: 10.76,
    });
  });

  it("keeps dependent values unavailable when an authoritative input is missing", () => {
    const missingRevenue: FinancialDailySnapshotInput = {
      ...snapshot,
      inputs: {
        ...snapshot.inputs,
        revenue: { value: null, available: false, sources: [] },
      },
    };

    expect(deriveFinancials(missingRevenue)).toEqual({
      profit: null,
      roas: null,
      roi: null,
      cpa: 10.76,
    });
    expect(financialDailySnapshotInputSchema.parse(missingRevenue)).toEqual(missingRevenue);
  });

  it("rejects rolling, mismatched, unverified, or derived values", () => {
    expect(() => financialDailySnapshotInputSchema.parse({
      ...snapshot,
      currentValueWindow: { ...snapshot.currentValueWindow, mode: "rolling_90_days" },
    })).toThrow();
    expect(() => financialDailySnapshotInputSchema.parse({
      ...snapshot,
      currentValueWindow: { ...snapshot.currentValueWindow, endDate: "2026-08-20" },
    })).toThrow();
    expect(() => financialDailySnapshotInputSchema.parse({
      ...snapshot,
      inputs: { ...snapshot.inputs, revenue: { value: "72766.69", available: false, sources: [] } },
    })).toThrow();
    expect(() => financialDailySnapshotInputSchema.parse({ ...snapshot, profit: "70066.94" })).toThrow();
  });

  it("database storage enforces one financial snapshot per campaign and reporting day", () => {
    const schema = readFileSync(join(process.cwd(), "shared", "schema.ts"), "utf-8");
    const migration = readFileSync(join(process.cwd(), "migrations", "0014_add_financial_daily_snapshot_identity.sql"), "utf-8");
    const startup = readFileSync(join(process.cwd(), "server", "index.ts"), "utf-8");
    const storage = readFileSync(join(process.cwd(), "server", "storage.ts"), "utf-8");

    expect(schema).toContain('reportingDate: text("reporting_date")');
    expect(schema).toContain('uniqueIndex("metric_snapshots_financial_day_unique")');
    expect(schema).toContain(".on(table.campaignId, table.reportingDate)");
    expect(schema).toContain(".where(sql`${table.snapshotType} = 'financial_daily' AND ${table.reportingDate} IS NOT NULL`)");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS reporting_date TEXT");
    expect(migration).toContain("ON metric_snapshots (campaign_id, reporting_date)");
    expect(migration).toContain("WHERE snapshot_type = 'financial_daily' AND reporting_date IS NOT NULL");
    expect(migration).not.toMatch(/\b(UPDATE|DELETE)\b/i);
    expect(startup).toContain("CREATE UNIQUE INDEX IF NOT EXISTS metric_snapshots_financial_day_unique");
    expect(storage).toContain("upsertFinancialDailySnapshot(snapshotData: FinancialDailySnapshotInput)");
    expect(storage).toContain("Use upsertFinancialDailySnapshot for reporting-day financial snapshots");
    expect(storage).toContain("metrics: { financialDaily }");
    expect(storage).toContain("target: [metricSnapshots.campaignId, metricSnapshots.reportingDate]");
    expect(storage).toContain("targetWhere: sql`${metricSnapshots.snapshotType} = 'financial_daily' AND ${metricSnapshots.reportingDate} IS NOT NULL`");
    expect(storage.match(/ne\(metricSnapshots\.snapshotType, 'financial_daily'\)/g)).toHaveLength(5);
    expect(readFileSync(join(process.cwd(), "server", "scheduler.ts"), "utf-8")).not.toContain(".upsertFinancialDailySnapshot(");
    expect(readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8")).not.toContain(".upsertFinancialDailySnapshot(");
  });

  it("reads financial comparisons only by their exact stored reporting dates", () => {
    const storage = readFileSync(join(process.cwd(), "server", "storage.ts"), "utf-8");
    const routes = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");
    const readerStart = storage.indexOf("async getFinancialDailyComparisonData(");
    const readerEnd = storage.indexOf("async getComparisonData(", readerStart);
    const reader = storage.slice(readerStart, readerEnd);
    const routeStart = routes.indexOf('app.get("/api/campaigns/:id/snapshots/comparison"');
    const routeEnd = routes.indexOf("// Get campaign snapshots by time period", routeStart);
    const route = routes.slice(routeStart, routeEnd);

    expect(readerStart).toBeGreaterThan(-1);
    expect(reader).toContain("eq(metricSnapshots.snapshotType, 'financial_daily')");
    expect(reader).toContain("eq(metricSnapshots.reportingDate, currentReportingDate)");
    expect(reader).toContain("eq(metricSnapshots.reportingDate, comparisonDate)");
    expect(reader).toContain("financialDailySnapshotInputSchema.safeParse({");
    expect(reader).not.toContain("recordedAt");
    expect(reader).not.toContain("orderBy");
    expect(route).toContain("snapshotType && snapshotType !== 'financial_daily'");
    expect(route).toContain("snapshotType === 'financial_daily' && !comparisonDate");
    expect(route).toContain("storage.getFinancialDailyComparisonData(id, latestComparisonDate, comparisonDate)");
  });
});
