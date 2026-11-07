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
    children[0].emit("close", 0);
    await vi.waitFor(() => expect(children).toHaveLength(2));
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(children).toHaveLength(3);
    expect(mocks.spawn.mock.calls[2][1]).toContain("scripts/check-hosted-health.ts");
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(children).toHaveLength(3);
    children[2].emit("close", 1);
    children[1].emit("close", 1);
    await vi.waitFor(() => expect(children).toHaveLength(4));
    expect(mocks.spawn.mock.calls[3][1]).toContain("scripts/live-number-live-monitor.json");
    children[3].emit("close", 0);
    await running;
    expect(process.exitCode).toBe(1);
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(children).toHaveLength(4);
  } finally { process.exitCode = oldCode; vi.useRealTimers(); }
});
