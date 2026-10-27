import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

// Execute only the actual read-only handler; never boot the app or its schedulers.
const source = ts.createSourceFile("server/index.ts", readFileSync("server/index.ts", "utf8"), ts.ScriptTarget.Latest, true);
let handlerSource = "";
function visit(node: ts.Node): void {
  if (ts.isCallExpression(node) && node.expression.getText(source) === "app.get"
    && ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text === "/health/scheduler") {
    handlerSource = node.arguments[1].getText(source);
  }
  ts.forEachChild(node, visit);
}
visit(source);
if (!handlerSource) throw new Error("Scheduler health handler missing");
const compiled = ts.transpileModule(`const handler = ${handlerSource}; handler;`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;

function fixture() {
  const state = {
    scheduler: { totalFailed: 0, lastError: null as string | null, lastErrorTime: null as string | null, lastSuccessTime: null as string | null },
    autoRefreshScheduler: { lastRunStatus: "success", lastError: null as string | null, lastErrorTime: null as string | null, inProgress: false },
    ga4DailyScheduler: { lastRunStatus: "success", lastError: null as string | null, lastErrorTime: null as string | null, inProgress: false },
    financialDailySnapshot: { writeFailedCampaigns: 0, blockedCampaigns: 0, writtenCampaigns: 1 },
  };
  const getters = {
    getSchedulerMetrics: vi.fn(() => state.scheduler),
    getAutoRefreshSchedulerStatus: vi.fn(() => state.autoRefreshScheduler),
    getGA4DailySchedulerStatus: vi.fn(() => state.ga4DailyScheduler),
    getFinancialDailySnapshotObservationStatus: vi.fn(() => state.financialDailySnapshot),
  };
  const handler = runInNewContext(compiled, getters);
  const response = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  const run = () => { handler({}, response); return response.json.mock.lastCall![0]; };
  return { state, getters, response, run };
}

describe("V1-010 scheduler health reports existing failure evidence", () => {
  it("reproduces the deployed false-healthy result despite failed GA4 and auto-refresh runs", () => {
    const f = fixture();
    f.state.autoRefreshScheduler.lastRunStatus = "failed";
    f.state.autoRefreshScheduler.lastError = "GA4_REFRESH_WORK_OWNERSHIP_LOST";
    f.state.ga4DailyScheduler.lastRunStatus = "failed";
    f.state.ga4DailyScheduler.lastError = "GA4 daily refresh failed for 6 campaign(s)";
    f.state.ga4DailyScheduler.inProgress = true;
    expect(f.run().status).toBe("unhealthy");
    expect(f.response.status).not.toHaveBeenCalled();
  });

  for (const key of ["autoRefreshScheduler", "ga4DailyScheduler"] as const) {
    it(`${key}: a failed result does not require nonempty error text`, () => {
      const f = fixture();
      f.state[key].lastRunStatus = "failed";
      expect(f.run().status).toBe("unhealthy");
    });
    it.each(["running", "skipped"])(`${key}: %s does not hide retained error evidence`, status => {
      const f = fixture();
      f.state[key].lastRunStatus = status;
      f.state[key].lastError = "previous run failed";
      expect(f.run().status).toBe("unhealthy");
    });
    it(`${key}: a successful run with a cleared error recovers despite its historical timestamp`, () => {
      const f = fixture();
      f.state[key].lastErrorTime = "2026-10-27T07:11:56.000Z";
      expect(f.run().status).toBe("healthy");
    });
  }

  it.each(["idle", "running", "skipped", "success"])("does not invent a failure from %s alone", status => {
    const f = fixture();
    f.state.autoRefreshScheduler.lastRunStatus = status;
    f.state.ga4DailyScheduler.lastRunStatus = status;
    expect(f.run().status).toBe("healthy");
  });

  it("retains a report error even if a different report subsequently succeeds", () => {
    const f = fixture();
    f.state.scheduler.lastError = "report preparation failed";
    f.state.scheduler.lastErrorTime = "2026-10-27T07:00:00.000Z";
    f.state.scheduler.lastSuccessTime = "2026-10-27T08:00:00.000Z";
    expect(f.run().status).toBe("unhealthy");
  });
  it("recognizes a recorded report error with empty error text", () => {
    const f = fixture();
    f.state.scheduler.lastErrorTime = "2026-10-27T07:00:00.000Z";
    f.state.scheduler.lastError = "";
    expect(f.run().status).toBe("unhealthy");
  });
  it("reports a confirmed financial snapshot write failure", () => {
    const f = fixture();
    f.state.financialDailySnapshot.writeFailedCampaigns = 1;
    expect(f.run().status).toBe("unhealthy");
    f.state.financialDailySnapshot.writeFailedCampaigns = 0;
    expect(f.run().status).toBe("healthy");
  });
  it("does not treat snapshot readiness waiting as a confirmed write failure", () => {
    const f = fixture();
    f.state.financialDailySnapshot.blockedCampaigns = 1;
    expect(f.run().status).toBe("healthy");
  });

  it("preserves every diagnostic payload, reads each getter once, and never mutates state", () => {
    const f = fixture();
    Object.values(f.state).forEach(Object.freeze);
    const before = structuredClone(f.state);
    const body = f.run();
    expect(Object.keys(body).sort()).toEqual(["status", ...Object.keys(f.state), "timestamp"].sort());
    for (const [key, value] of Object.entries(f.state)) expect(body[key]).toBe(value);
    expect(f.state).toEqual(before);
    for (const getter of Object.values(f.getters)) expect(getter).toHaveBeenCalledTimes(1);
    expect(Number.isFinite(Date.parse(body.timestamp))).toBe(true);
    expect(f.response.status).not.toHaveBeenCalled();
    expect(f.response.json).toHaveBeenCalledTimes(1);
  });
  it.each(["getSchedulerMetrics", "getAutoRefreshSchedulerStatus", "getGA4DailySchedulerStatus", "getFinancialDailySnapshotObservationStatus"] as const)(
    "preserves HTTP 500 if %s cannot provide state", getter => {
      const f = fixture();
      f.getters[getter].mockImplementation(() => { throw "state unavailable"; });
      expect(f.run()).toMatchObject({ status: "unhealthy", error: "state unavailable" });
      expect(f.response.status).toHaveBeenCalledWith(500);
    },
  );
  it("keeps Render process liveness on its separate /health route", () => {
    expect(readFileSync("render.yaml", "utf8")).toMatch(/healthCheckPath:\s*\/health\s/);
  });
});
