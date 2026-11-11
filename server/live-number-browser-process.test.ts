import { EventEmitter } from "node:events";
import { afterEach, expect, it, vi } from "vitest";
const fork = vi.hoisted(() => vi.fn());
vi.mock("node:child_process", () => ({ fork }));
import { runBrowserProcess } from "../scripts/live-number-browser-process";
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
it.each(["true", "false", "invalid"])("passes only the reporting policy to the isolated browser: %s", async mode => {
  vi.stubEnv("GA4_INCLUDE_CURRENT_DAY", mode); vi.stubEnv("DATABASE_URL", "secret"); vi.stubEnv("GOOGLE_CLIENT_SECRET", "secret");
  const child: any = new EventEmitter(); child.send = () => queueMicrotask(() => {
    child.emit("message", { kind: "result", checks: [{ section: "test", code: "OK", status: "passed" }] }); child.emit("close", 0);
  }); child.kill = vi.fn(); fork.mockReturnValue(child);
  const checks = await runBrowserProcess({ campaign: {}, rows: {} }, {}, async () => ({ status: 200, body: {} }));
  expect(checks[0].status).toBe("passed");
  const env = fork.mock.calls[0][2].env;
  expect(env.GA4_INCLUDE_CURRENT_DAY).toBe(mode === "true" ? "true" : "false");
  expect(env.DATABASE_URL).toBeUndefined(); expect(env.GOOGLE_CLIENT_SECRET).toBeUndefined();
});
