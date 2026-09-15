import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const state = {
    benchmarkExists: true,
    history: [] as any[],
    lockTail: Promise.resolve(),
    nextId: 1,
  };
  const execute = vi.fn();
  const insert = vi.fn();
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
            where: vi.fn(() => ({
              limit: vi.fn(async () => currentSelect === 0
                ? state.benchmarkExists ? [{ id: "benchmark-1" }] : []
                : state.history.slice(0, 1)),
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
    };
    try {
      return await callback(tx);
    } finally {
      if (lockAcquired) releaseLock?.();
    }
  });
  return { state, execute, insert, db: { transaction } };
});

vi.mock("./db", () => ({ db: mocks.db, pool: null }));

import { DatabaseStorage } from "./storage";

const automaticHistory = {
  benchmarkId: "benchmark-1",
  currentValue: "120.00",
  benchmarkValue: "100.00",
  variance: "20.00",
  performanceRating: "excellent",
  recordedAt: new Date("2026-09-12T21:59:59.000Z"),
  notes: "auto:ga4_daily:2026-09-11;ga4_scope_v1:123:Europe%2FAmsterdam:EUR:%5B%5D",
} as any;

describe("GA4 Benchmark automatic history idempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state.benchmarkExists = true;
    mocks.state.history = [];
    mocks.state.lockTail = Promise.resolve();
    mocks.state.nextId = 1;
  });

  it("stores one logical row when concurrent recomputes record the same date and scope", async () => {
    const storage = new DatabaseStorage();
    const [first, second] = await Promise.all([
      storage.recordBenchmarkHistory(automaticHistory),
      storage.recordBenchmarkHistory(automaticHistory),
    ]);

    expect(mocks.execute).toHaveBeenCalledTimes(2);
    expect(mocks.insert).toHaveBeenCalledTimes(1);
    expect(mocks.state.history).toHaveLength(1);
    expect(first.id).toBe(second.id);
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
    const start = source.indexOf("async recordBenchmarkHistory(historyData: InsertBenchmarkHistory)");
    const end = source.indexOf("// Metric Snapshot methods", start);
    const method = source.slice(start, end);

    expect(method).toContain("pg_advisory_xact_lock");
    expect(method.indexOf("pg_advisory_xact_lock")).toBeLessThan(method.indexOf("eq(benchmarkHistory.notes, notes)"));
    expect(method.indexOf("eq(benchmarkHistory.notes, notes)")).toBeLessThan(method.indexOf("tx.insert(benchmarkHistory)"));
  });
});
