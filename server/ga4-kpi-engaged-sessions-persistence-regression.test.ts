import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { summarizeGA4TrafficRows } from "../shared/ga4-traffic-window";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("GA4 KPI exact engaged-session persistence", () => {
  it("uses exact provider counts for weighted Engagement Rate and retains the legacy rate fallback", () => {
    const exact = summarizeGA4TrafficRows([
      { sessions: 275, engagedSessions: 188, engagementRate: "0.6836" },
      { sessions: 277, engagedSessions: 190, engagementRate: "0.6859" },
    ]);
    expect(exact).toMatchObject({ sessions: 552, engagedSessions: 378 });
    expect(Number((exact.engagementRate * 100).toFixed(2))).toBe(68.48);

    const legacy = summarizeGA4TrafficRows([
      { sessions: 100, engagementRate: "0.20" },
      { sessions: 300, engagementRate: "80" },
    ]);
    expect(legacy).toMatchObject({ sessions: 400, engagedSessions: 260, engagementRate: 0.65 });
  });

  it("requests and carries exact engagedSessions through every GA4 daily producer", () => {
    const analytics = source("server/analytics.ts");
    const scheduler = source("server/ga4-daily-scheduler.ts");
    const jobs = source("server/ga4-kpi-benchmark-jobs.ts");
    const routes = source("server/routes-oauth.ts");

    expect(analytics).toContain("{ name: 'engagedSessions' }");
    expect(analytics).toContain("const engagedSessions = Number.parseInt(String(row.metricValues[5]?.value || '0'), 10) || 0;");
    expect(scheduler).toContain("const normalizedRows = rows.map((r: any) => normalizeGA4InsightsDailyMetricValues({");
    expect(scheduler).toContain("engagedSessions: r?.engagedSessions,");
    expect(jobs).toContain("engagedSessions: r?.engagedSessions == null ? null");
    expect(routes).toContain("const normalized = normalizeGA4InsightsDailyMetricValues(r);");
    expect(routes).toContain("...normalized,");
    expect(routes).toContain("engagedSessions: engagedSessions");
    expect(routes).toContain("engagedSessions: d.engagedSessions");
    expect(routes).toContain("addDerivedGA4EngagedSessions(row || {}).engagedSessions");
  });

  it("persists the nullable exact count without inventing values for legacy rows", () => {
    const schema = source("shared/schema.ts");
    const storage = source("server/storage.ts");

    expect(schema).toContain('engagedSessions: integer("engaged_sessions")');
    expect(storage).toContain("const engagedSessions = (r as any)?.engagedSessions == null ? null");
    expect(storage).toContain("sessions, engaged_sessions, pageviews");
    expect(storage).toContain("engaged_sessions = EXCLUDED.engaged_sessions");
  });

  it("keeps fresh-install and existing-database migrations aligned", () => {
    const startup = source("server/index.ts");
    const migration = source("migrations/0012_add_ga4_daily_engaged_sessions.sql");

    expect(startup).toContain("engaged_sessions INTEGER");
    expect(startup).toContain("ADD COLUMN IF NOT EXISTS engaged_sessions INTEGER");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS engaged_sessions INTEGER");
  });
});
