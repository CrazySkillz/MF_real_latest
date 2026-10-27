import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

const mocks = vi.hoisted(() => {
  const state = {
    benchmarkExists: true,
    history: [] as any[],
    lockTail: Promise.resolve(),
    nextId: 1,
    matches: (_row: any, _condition: any) => true,
    failUpdate: false,
    missingUpdate: false,
  };
  const execute = vi.fn();
  const insert = vi.fn();
  const update = vi.fn();
  const transaction = vi.fn(async (callback: (transaction: any) => Promise<any>) => {
    let releaseLock: (() => void) | null = null;
    let lockAcquired = false;
    let selectIndex = 0;
    const tx = {
      execute: vi.fn(async (query: any) => {
        execute(query);
        const previous = state.lockTail;
        state.lockTail = new Promise<void>((resolve) => { releaseLock = resolve; });
        await previous;
        lockAcquired = true;
      }),
      select: vi.fn(() => {
        const currentSelect = selectIndex++;
        return {
          from: vi.fn(() => ({
            where: vi.fn((condition: any) => ({
              limit: vi.fn(async (limit: number) => currentSelect === 0
                ? state.benchmarkExists ? [{ id: "benchmark-1" }] : []
                : state.history.filter((row) => state.matches(row, condition)).slice(0, limit)),
            })),
          })),
        };
      }),
      insert: vi.fn(() => ({
        values: vi.fn((values: any) => ({
          returning: vi.fn(async () => {
            insert(values);
            const row = { id: `history-${state.nextId++}`, ...values };
            state.history.push(row);
            return [row];
          }),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn((values: any) => ({
          where: vi.fn((condition: any) => ({
            returning: vi.fn(async () => {
              update(values, condition);
              if (state.failUpdate) throw new Error("history write failed");
              if (state.missingUpdate) return [];
              const changed: any[] = [];
              state.history = state.history.map((row) => {
                if (!state.matches(row, condition)) return row;
                const saved = { ...row, ...values };
                changed.push(saved);
                return saved;
              });
              return changed;
            }),
          })),
        })),
      })),
    };
    try {
      return await callback(tx);
    } finally {
      if (lockAcquired) releaseLock?.();
    }
  });
  return { state, execute, insert, update, db: { transaction,
    select: () => ({ from: () => ({ where: async () => state.benchmarkExists ? [{ id: "benchmark-1" }] : [] }) }),
  } };
});

vi.mock("./db", () => ({ db: mocks.db, pool: null }));

import { DatabaseStorage } from "./storage";

const automaticHistory = {
  benchmarkId: "benchmark-1",
  currentValue: "120.00",
  benchmarkValue: "100.00",
  variance: "20.00",
  performanceRating: "excellent",
  recordedAt: new Date("2026-09-11T23:59:59.000Z"),
  notes: "auto:ga4_daily:2026-09-11;ga4_scope_v1:123:Europe%2FAmsterdam:EUR:%5B%5D",
} as any;

describe("GA4 Benchmark automatic history idempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state.benchmarkExists = true;
    mocks.state.history = [];
    mocks.state.lockTail = Promise.resolve();
    mocks.state.nextId = 1;
    mocks.state.failUpdate = false;
    mocks.state.missingUpdate = false;
    mocks.state.matches = (row, condition) => {
      const { sql, params } = new PgDialect().sqlToQuery(condition);
      const fields: Record<string, string> = { id: "id", benchmark_id: "benchmarkId", notes: "notes" };
      const comparisons = [...sql.matchAll(/"(id|benchmark_id|notes)" = \$(\d+)/g)];
      expect(comparisons.length).toBeGreaterThan(0);
      return comparisons.every(([, field, parameter]) => row[fields[field]] === params[Number(parameter) - 1]);
    };
  });

  it.each([["80.00", "-60.00"], ["0.00", "-100.00"], ["120.00", "-40.00"]])("updates the same automatic entry to %s without changing its identity or date", async (currentValue, variance) => {
    const storage = new DatabaseStorage();
    const first = await storage.recordBenchmarkHistory(automaticHistory);
    const revised = { ...automaticHistory, currentValue, benchmarkValue: "200.00", variance, performanceRating: "poor" };
    const second = await storage.recordBenchmarkHistory(revised);
    expect(second).toEqual({ ...first, ...revised });
    expect(mocks.state.history).toEqual([second]);
    expect(mocks.insert).toHaveBeenCalledTimes(1);
    expect(mocks.update).toHaveBeenCalledTimes(1);
  });

  it("updates only the exact Benchmark/date/scope and preserves manual history and recordedAt", async () => {
    const storage = new DatabaseStorage();
    const first = await storage.recordBenchmarkHistory(automaticHistory);
    const unrelated = [
      { ...first, id: "other-benchmark", benchmarkId: "benchmark-2" },
      { ...first, id: "other-day", notes: automaticHistory.notes.replace("2026-09-11", "2026-09-10") },
      ...["123", "Europe%2FAmsterdam", "EUR", "%5B%5D"].map((part) => ({ ...first, id: `other-${part}`, notes: automaticHistory.notes.replace(part, "different") })),
      { ...first, id: "manual", notes: "manual review" },
    ];
    mocks.state.history.push(...unrelated);
    const revised = await storage.recordBenchmarkHistory({ ...automaticHistory, currentValue: "90.00", recordedAt: new Date("2026-09-20T00:00:00Z") });
    expect(revised).toEqual({ ...first, currentValue: "90.00" });
    expect(mocks.state.history).toEqual([revised, ...unrelated]);
    const query = new PgDialect().sqlToQuery(mocks.update.mock.calls[0][1]);
    expect(query.params).toEqual([first.id, automaticHistory.benchmarkId, automaticHistory.notes]);
  });

  it("creates separate automatic entries for other dates, scopes and Benchmarks", async () => {
    const storage = new DatabaseStorage();
    for (const row of [automaticHistory,
      { ...automaticHistory, benchmarkId: "benchmark-2" },
      { ...automaticHistory, notes: automaticHistory.notes.replace("2026-09-11", "2026-09-12") },
      { ...automaticHistory, notes: automaticHistory.notes.replace("123", "456") },
    ]) await storage.recordBenchmarkHistory(row);
    expect(mocks.state.history).toHaveLength(4);
    expect(mocks.insert).toHaveBeenCalledTimes(4);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("uses the revised history in average variance, trend and latest rating", async () => {
    const storage = new DatabaseStorage();
    await storage.recordBenchmarkHistory({ ...automaticHistory, currentValue: "100.00", variance: "0.00", performanceRating: "average",
      recordedAt: new Date("2026-09-10T23:59:59Z"), notes: automaticHistory.notes.replace("2026-09-11", "2026-09-10") });
    await storage.recordBenchmarkHistory(automaticHistory);
    vi.spyOn(storage, "getBenchmarkHistory").mockImplementation(async () => mocks.state.history);
    expect(await storage.getBenchmarkAnalytics("benchmark-1")).toMatchObject({ averageVariance: 10, performanceTrend: "improving", lastPerformanceRating: "excellent" });
    await storage.recordBenchmarkHistory({ ...automaticHistory, currentValue: "60.00", variance: "-40.00", performanceRating: "poor" });
    const analytics = await storage.getBenchmarkAnalytics("benchmark-1");
    expect(analytics).toMatchObject({ averageVariance: -20, performanceTrend: "declining", lastPerformanceRating: "poor" });
    expect(analytics.history).toHaveLength(2);
  });

  it("rejects ambiguous duplicate automatic entries without rewriting either", async () => {
    const storage = new DatabaseStorage();
    const first = await storage.recordBenchmarkHistory(automaticHistory);
    const duplicate = { ...first, id: "duplicate" };
    mocks.state.history.push(duplicate);
    await expect(storage.recordBenchmarkHistory({ ...automaticHistory, currentValue: "90.00" }))
      .rejects.toThrow("Benchmark automatic history is ambiguous");
    expect(mocks.state.history).toEqual([first, duplicate]);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it.each(["failure", "missing row"])("retains the saved entry and reports a failed update on %s", async (condition) => {
    const storage = new DatabaseStorage();
    const first = await storage.recordBenchmarkHistory(automaticHistory);
    mocks.state.failUpdate = condition === "failure";
    mocks.state.missingUpdate = condition === "missing row";
    await expect(storage.recordBenchmarkHistory({ ...automaticHistory, currentValue: "90.00" })).rejects.toThrow();
    expect(mocks.state.history).toEqual([first]);
  });

  it.each(["120.00", "80.00"])("stores one logical row when concurrent recomputes record the same date and scope with final value %s", async (currentValue) => {
    const storage = new DatabaseStorage();
    const [first, second] = await Promise.all([
      storage.recordBenchmarkHistory(automaticHistory),
      storage.recordBenchmarkHistory({ ...automaticHistory, currentValue }),
    ]);

    expect(mocks.execute).toHaveBeenCalledTimes(2);
    expect(mocks.insert).toHaveBeenCalledTimes(1);
    expect(mocks.state.history).toHaveLength(1);
    expect(first.id).toBe(second.id);
    expect(mocks.state.history[0].currentValue).toBe(currentValue);
  });

  it("keeps manually recorded history append-only", async () => {
    const storage = new DatabaseStorage();
    const manual = { ...automaticHistory, notes: "manual review" };
    await storage.recordBenchmarkHistory(manual);
    await storage.recordBenchmarkHistory(manual);

    expect(mocks.execute).not.toHaveBeenCalled();
    expect(mocks.insert).toHaveBeenCalledTimes(2);
    expect(mocks.state.history).toHaveLength(2);
  });

  it("fails closed before inserting history for a missing Benchmark", async () => {
    mocks.state.benchmarkExists = false;
    const storage = new DatabaseStorage();

    await expect(storage.recordBenchmarkHistory(automaticHistory)).rejects.toThrow("Benchmark not found");
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("uses a transaction-scoped advisory lock before the exact duplicate check", async () => {
    const source = await import("node:fs").then(({ readFileSync }) => readFileSync("server/storage.ts", "utf8"));
    const start = source.indexOf("async recordBenchmarkHistory(historyData: InsertBenchmarkHistory");
    const end = source.indexOf("// Metric Snapshot methods", start);
    const method = source.slice(start, end);

    expect(method).toContain("pg_advisory_xact_lock");
    expect(method.indexOf("pg_advisory_xact_lock")).toBeLessThan(method.indexOf("eq(benchmarkHistory.notes, notes)"));
    expect(method.indexOf("eq(benchmarkHistory.notes, notes)")).toBeLessThan(method.indexOf("tx.insert(benchmarkHistory)"));
  });
});
