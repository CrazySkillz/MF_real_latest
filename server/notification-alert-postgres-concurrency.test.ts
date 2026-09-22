import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { getTableColumns } from "drizzle-orm";
import * as schema from "../shared/schema";

const mockDb = vi.hoisted(() => ({ current: null as any }));
vi.mock("./db", () => ({ db: mockDb.current, pool: null }));
vi.mock("./storage", () => ({
  storage: {
    getCampaign: vi.fn(async (id: string) => ({ id, name: "Test Campaign", ownerId: "test-owner" })),
    getLinkedInConnection: vi.fn(async () => undefined),
    updateNotification: vi.fn(),
  },
}));
vi.mock("./utils/ga4-alert-current-value", () => ({
  resolveAlertCurrentValueForDecision: vi.fn(async (row: any) => row),
}));

const configuredUrl = String(process.env.NOTIFICATION_TEST_DATABASE_URL || "").trim();

function isolatedTestUrl(): string | null {
  if (!configuredUrl) return null;
  const url = new URL(configuredUrl);
  const databaseName = decodeURIComponent(url.pathname.slice(1));
  if (!(["postgres:", "postgresql:"].includes(url.protocol)
    && url.hostname === "127.0.0.1"
    && databaseName === "notifications_test"
    && !url.searchParams.has("host")
    && !url.searchParams.has("hostaddr"))) {
    throw new Error("Notification PostgreSQL test requires 127.0.0.1/notifications_test");
  }
  const appUrl = String(process.env.DATABASE_URL || "").trim();
  if (appUrl) {
    const app = new URL(appUrl);
    if (app.hostname === url.hostname && (app.port || "5432") === (url.port || "5432") && app.pathname === url.pathname) {
      throw new Error("Notification test database must differ from DATABASE_URL");
    }
  }
  return configuredUrl;
}

const testUrl = isolatedTestUrl();
const schemaName = `notification_it_${randomUUID().replace(/-/g, "")}`;
let adminPool: Pool | undefined;
let testPool: Pool | undefined;
let schemaCreated = false;
let createKPIAlert: (kpi: any) => Promise<void>;
let checkBenchmarkAlerts: (campaignId: string, coverageDate: string) => Promise<number>;

async function runOnContendingConnections<T>(lockKey: string, run: () => Promise<T>): Promise<T[]> {
  const holder = await testPool!.connect();
  let pending: Promise<T[]> | undefined;
  let blockedConnections = 0;
  try {
    await holder.query("BEGIN");
    await holder.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [lockKey]);
    pending = Promise.all([run(), run()]);
    void pending.catch(() => undefined);
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const result = await testPool!.query(`SELECT count(DISTINCT l.pid)::int AS count FROM pg_locks l
        JOIN pg_stat_activity a ON a.pid = l.pid
        WHERE l.locktype = 'advisory' AND NOT l.granted AND a.application_name = $1`, [schemaName]);
      blockedConnections = Number(result.rows[0]?.count || 0);
      if (blockedConnections >= 2) break;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  } finally {
    await holder.query("ROLLBACK");
    holder.release();
  }
  const results = await pending!;
  expect(blockedConnections).toBeGreaterThanOrEqual(2);
  return results;
}

function testColumns(table: typeof schema.notifications | typeof schema.benchmarks): string {
  return Object.values(getTableColumns(table)).map((column: any) => {
    const defaultValue = column.name === "id"
      ? " DEFAULT md5(random()::text || clock_timestamp()::text)"
      : column.name === "created_at" ? " DEFAULT CURRENT_TIMESTAMP" : "";
    return `"${column.name}" ${column.getSQLType()}${defaultValue}`;
  }).join(", ");
}

describe.skipIf(!testUrl)("active notification PostgreSQL concurrency", () => {
  beforeAll(async () => {
    adminPool = new Pool({ connectionString: testUrl!, max: 2 });
    await adminPool.query(`CREATE SCHEMA "${schemaName}"`);
    schemaCreated = true;
    testPool = new Pool({ connectionString: testUrl!, options: `-c search_path=${schemaName}`, application_name: schemaName, max: 6 });
    await testPool.query(`CREATE TABLE notifications (${testColumns(schema.notifications)})`);
    await testPool.query(`CREATE TABLE benchmarks (${testColumns(schema.benchmarks)})`);
    mockDb.current = drizzle(testPool, { schema });
    ({ createKPIAlert } = await import("./kpi-notifications"));
    ({ checkGA4BenchmarkPerformanceAlertsForCampaign: checkBenchmarkAlerts } = await import("./benchmark-notifications"));
  });

  afterAll(async () => {
    await testPool?.end();
    if (schemaCreated) await adminPool?.query(`DROP SCHEMA "${schemaName}" CASCADE`);
    await adminPool?.end();
  });

  it("stores one active KPI alert across concurrent database transactions and preserves dismissed history", async () => {
    await testPool!.query(`INSERT INTO notifications (title, message, type, campaign_id, metadata)
      VALUES ('Dismissed', 'History', 'performance-alert', 'campaign-1',
      '{"kpiId":"kpi-1","dismissedAt":"2026-09-20T10:00:00Z"}')`);
    const kpi = {
      id: "kpi-1", campaignId: "campaign-1", platformType: "google_analytics",
      name: "Sessions", priority: "high", unit: "count", currentValue: "50",
      alertsEnabled: true, alertThreshold: "100", alertCondition: "below",
    };

    await runOnContendingConnections("active-alert:kpi:kpi-1", () => createKPIAlert(kpi));

    const result = await testPool!.query(`SELECT metadata::jsonb AS metadata FROM notifications
      WHERE metadata::jsonb->>'kpiId' = 'kpi-1'`);
    expect(result.rows).toHaveLength(2);
    expect(result.rows.filter((row) => !row.metadata.resolved && !row.metadata.dismissedAt)).toHaveLength(1);
    expect(result.rows.filter((row) => !!row.metadata.dismissedAt)).toHaveLength(1);
  });

  it("stores one active Benchmark alert concurrently and allows a new alert after resolution", async () => {
    await testPool!.query(`INSERT INTO benchmarks
      (id, campaign_id, platform_type, category, name, benchmark_value, current_value, unit,
       status, alert_threshold, alert_condition, alerts_enabled)
      VALUES ('benchmark-1', 'campaign-1', 'google_analytics', 'traffic', 'Sessions floor',
       100, 50, 'count', 'active', 100, 'below', true)`);

    const created = await runOnContendingConnections("active-alert:benchmark:benchmark-1",
      () => checkBenchmarkAlerts("campaign-1", "2026-09-20"));
    expect(created.reduce((sum, count) => sum + count, 0)).toBe(1);
    let result = await testPool!.query(`SELECT id, metadata::jsonb AS metadata FROM notifications
      WHERE metadata::jsonb->>'benchmarkId' = 'benchmark-1'`);
    expect(result.rows).toHaveLength(1);

    await testPool!.query(`UPDATE notifications
      SET metadata = (metadata::jsonb || '{"resolved":true,"resolvedReason":"cleared"}'::jsonb)::text
      WHERE id = $1`, [result.rows[0].id]);
    await expect(checkBenchmarkAlerts("campaign-1", "2026-09-20")).resolves.toBe(1);
    result = await testPool!.query(`SELECT metadata::jsonb AS metadata FROM notifications
      WHERE metadata::jsonb->>'benchmarkId' = 'benchmark-1'`);
    expect(result.rows).toHaveLength(2);
    expect(result.rows.filter((row) => !row.metadata.resolved && !row.metadata.dismissedAt)).toHaveLength(1);
  });
});
