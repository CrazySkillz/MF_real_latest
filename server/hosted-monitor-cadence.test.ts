import { EventEmitter } from "node:events";
import { expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ spawn: vi.fn() }));
vi.mock("node:child_process", () => ({ spawn: mocks.spawn }));

it("keeps health checks running during long accuracy work, without overlap or losing failures", async () => {
  vi.useFakeTimers();
  const children: EventEmitter[] = [], oldCode = process.exitCode;
  mocks.spawn.mockImplementation(() => { const child = new EventEmitter(); children.push(child); return child; });
  try {
    const running = import("../scripts/check-hosted-monitors");
    await vi.waitFor(() => expect(children).toHaveLength(1));
    expect(mocks.spawn.mock.calls[0][1]).toContain("scripts/discover-monitor-campaigns.ts");
    children[0].emit("close", 0);
    await vi.waitFor(() => expect(children).toHaveLength(2));
    children[1].emit("close", 0);
    await vi.waitFor(() => expect(children).toHaveLength(3));
    children[2].emit("close", 0);
    await vi.waitFor(() => expect(children).toHaveLength(4));
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(children).toHaveLength(5);
    expect(mocks.spawn.mock.calls[4][1]).toContain("scripts/check-hosted-health.ts");
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(children).toHaveLength(5);
    children[4].emit("close", 1);
    children[3].emit("close", 1);
    await vi.waitFor(() => expect(children).toHaveLength(6));
    expect(mocks.spawn.mock.calls[5][1].some((arg: string) => arg.endsWith("live-numbers.json"))).toBe(true);
    children[5].emit("close", 0);
    await running;
    expect(process.exitCode).toBe(1);
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(children).toHaveLength(6);
  } finally { process.exitCode = oldCode; vi.useRealTimers(); }
});

it("retains health checks and the other app when discovery fails, without running stale number targets", async () => {
  vi.resetModules(); mocks.spawn.mockReset();
  const children: EventEmitter[] = [], oldCode = process.exitCode;
  mocks.spawn.mockImplementation(() => { const child = new EventEmitter(); children.push(child); return child; });
  try {
    const running = import("../scripts/check-hosted-monitors");
    await vi.waitFor(() => expect(children).toHaveLength(1)); children[0].emit("close", 1);
    await vi.waitFor(() => expect(children).toHaveLength(2)); children[1].emit("close", 0);
    await vi.waitFor(() => expect(children).toHaveLength(3));
    expect(mocks.spawn.mock.calls[2][1]).toContain("scripts/check-hosted-health.ts"); children[2].emit("close", 0);
    await vi.waitFor(() => expect(children).toHaveLength(4));
    expect(mocks.spawn.mock.calls[3][1].some((arg: string) => arg.endsWith("live-numbers.json"))).toBe(true);
    children[3].emit("close", 0); await running;
    expect(children).toHaveLength(4); expect(process.exitCode).toBe(1);
  } finally { process.exitCode = oldCode; }
});
