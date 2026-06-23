import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const schemaSource = () => readFileSync(join(process.cwd(), "shared", "schema.ts"), "utf-8");
const migrationSource = () => readFileSync(
  join(process.cwd(), "migrations", "0010_widen_alert_benchmark_numeric_fields.sql"),
  "utf-8"
);

describe("alert numeric capacity regression guard", () => {
  it("keeps KPI live and alert audit absolute fields on enterprise-scale precision", () => {
    const schema = schemaSource();

    expect(schema).toContain('targetValue: decimal("target_value", { precision: 18, scale: 2 }).notNull(),');
    expect(schema).toContain('currentValue: decimal("current_value", { precision: 18, scale: 2 }).default("0"),');
    expect(schema).toContain('lastComputedValue: decimal("last_computed_value", { precision: 18, scale: 2 }),');
    expect(schema).toContain('alertThreshold: decimal("alert_threshold", { precision: 18, scale: 2 }),');

    const kpiAlertsStart = schema.indexOf('export const kpiAlerts = pgTable("kpi_alerts"');
    const benchmarksStart = schema.indexOf('export const benchmarks = pgTable("benchmarks"');
    const kpiAlertsSection = schema.slice(kpiAlertsStart, benchmarksStart);
    expect(kpiAlertsSection).toContain('currentValue: decimal("current_value", { precision: 18, scale: 2 }),');
    expect(kpiAlertsSection).toContain('targetValue: decimal("target_value", { precision: 18, scale: 2 }),');
    expect(kpiAlertsSection).toContain('thresholdValue: decimal("threshold_value", { precision: 18, scale: 2 }),');
  });

  it("widens Benchmark absolute values and thresholds while leaving variance percentage precision unchanged", () => {
    const schema = schemaSource();

    const benchmarksStart = schema.indexOf('export const benchmarks = pgTable("benchmarks"');
    const benchmarkHistoryStart = schema.indexOf('export const benchmarkHistory = pgTable("benchmark_history"');
    const metricSnapshotsStart = schema.indexOf('export const metricSnapshots = pgTable("metric_snapshots"');
    const benchmarksSection = schema.slice(benchmarksStart, benchmarkHistoryStart);
    const benchmarkHistorySection = schema.slice(benchmarkHistoryStart, metricSnapshotsStart);

    expect(benchmarksSection).toContain('benchmarkValue: decimal("benchmark_value", { precision: 18, scale: 2 }).notNull(),');
    expect(benchmarksSection).toContain('currentValue: decimal("current_value", { precision: 18, scale: 2 }).default("0"),');
    expect(benchmarksSection).toContain('alertThreshold: decimal("alert_threshold", { precision: 18, scale: 2 }),');
    expect(benchmarksSection).toContain('variance: decimal("variance", { precision: 10, scale: 2 }),');
    expect(benchmarkHistorySection).toContain('currentValue: decimal("current_value", { precision: 18, scale: 2 }).notNull(),');
    expect(benchmarkHistorySection).toContain('benchmarkValue: decimal("benchmark_value", { precision: 18, scale: 2 }).notNull(),');
    expect(benchmarkHistorySection).toContain('variance: decimal("variance", { precision: 10, scale: 2 }).notNull(),');
  });

  it("uses an additive widening-only migration for alert and Benchmark numeric fields", () => {
    const migration = migrationSource();

    expect(migration).toContain("ALTER TABLE kpi_alerts");
    expect(migration).toContain("ALTER COLUMN current_value TYPE numeric(18,2)");
    expect(migration).toContain("ALTER COLUMN target_value TYPE numeric(18,2)");
    expect(migration).toContain("ALTER COLUMN threshold_value TYPE numeric(18,2)");
    expect(migration).toContain("ALTER TABLE benchmarks");
    expect(migration).toContain("ALTER COLUMN benchmark_value TYPE numeric(18,2)");
    expect(migration).toContain("ALTER COLUMN alert_threshold TYPE numeric(18,2)");
    expect(migration).toContain("ALTER TABLE benchmark_history");
    expect(migration).not.toContain("DROP COLUMN");
    expect(migration).not.toContain("DROP TABLE");
    expect(migration).not.toContain("variance TYPE");
  });
});
