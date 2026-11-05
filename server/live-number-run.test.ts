import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ spawn: vi.fn(), read: vi.fn(), write: vi.fn() }));
vi.mock("node:child_process", () => ({ spawn: mocks.spawn }));
vi.mock("node:fs", () => ({ readFileSync: mocks.read, writeSync: mocks.write }));
import { runNumberMonitorPhases, validOutputChecks } from "../scripts/check-live-number-run";

const hash = "a".repeat(12), fingerprint = "b".repeat(64), commit = "c".repeat(40);
const children: Array<EventEmitter & { stdout: EventEmitter; kill: ReturnType<typeof vi.fn> }> = [];
const receipt = (status = "passed") => ({ campaignIdHash: hash, status, inputFingerprint: fingerprint });
function finish(index: number, body: unknown, code = 0) {
  children[index].stdout.emit("data", JSON.stringify(body) + "\n"); children[index].emit("close", code);
}
beforeEach(() => {
  children.length = 0; vi.clearAllMocks();
  mocks.read.mockReturnValue(JSON.stringify({ databaseEnvironmentVariable: "PHASE_TEST_DB", databaseFingerprint: "d".repeat(64),
    credentialsEnvironmentPrefix: "PHASE_TEST_", application: { baseUrl: "https://monitor-fixture.invalid", expectedCommit: commit }, campaigns: [{ campaignIdHash: hash }] }));
  mocks.spawn.mockImplementation(() => { const child = Object.assign(new EventEmitter(), { stdout: new EventEmitter(), kill: vi.fn() }); children.push(child); return child; });
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: true, commit }), { status: 200 })));
  vi.stubEnv("PHASE_TEST_DB", "postgresql://fixture.invalid/db"); vi.stubEnv("PHASE_TEST_GOOGLE_CLIENT_ID", "fixture-client");
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("memory-bounded monitoring phases", () => {
  it("starts output replay only after the source process exits, retaining its exact fingerprint", async () => {
    const run = runNumberMonitorPhases("config.json");
    children[0].stdout.emit("data", JSON.stringify(receipt()) + "\n");
    await Promise.resolve(); expect(mocks.spawn).toHaveBeenCalledTimes(1);
    children[0].emit("close", 0);
    await vi.waitFor(() => expect(mocks.spawn).toHaveBeenCalledTimes(2));
    expect(mocks.spawn.mock.calls[1][1]).toContain("--max-old-space-size=512");
    expect(mocks.spawn.mock.calls[1][1].slice(-3)).toEqual([hash, "d".repeat(64), fingerprint]);
    expect(mocks.spawn.mock.calls[1][2].env).toMatchObject({ DATABASE_URL: "postgresql://fixture.invalid/db", GOOGLE_CLIENT_ID: "fixture-client" });
    finish(1, [{ section: "Output", code: "MATCH", status: "passed" }]); expect(await run).toBe(0);
  });
  it("continues output verification after a numeric finding but preserves failure", async () => {
    const run = runNumberMonitorPhases("config.json"); finish(0, receipt("difference"), 1);
    await vi.waitFor(() => expect(children).toHaveLength(2));
    finish(1, [{ section: "Output", code: "MATCH", status: "passed" }]); expect(await run).toBe(1);
  });
  it.each(["missing", "foreign"])("does not replay an unproven %s source capture", async mode => {
    const run = runNumberMonitorPhases("config.json");
    finish(0, mode === "missing" ? { campaignIdHash: hash, status: "unverified" } : { ...receipt(), campaignIdHash: "f".repeat(12) });
    expect(await run).toBe(1); expect(children).toHaveLength(1); expect(fetch).not.toHaveBeenCalled();
  });
  it("does no output work outside a scheduled slot", async () => {
    const run = runNumberMonitorPhases("config.json", true); finish(0, { campaignIdHash: "none", status: "not_due" });
    expect(await run).toBe(0); expect(children).toHaveLength(1); expect(fetch).not.toHaveBeenCalled();
    expect(mocks.spawn.mock.calls[0][1].at(-1)).toBe("--scheduled");
  });
  it("fails closed when an output process crashes", async () => {
    const run = runNumberMonitorPhases("config.json"); finish(0, receipt());
    await vi.waitFor(() => expect(children).toHaveLength(2)); finish(1, [], 137);
    expect(await run).toBe(1);
    expect(mocks.write.mock.calls.some(call => String(call[1]).includes("OUTPUT_PROCESS_UNVERIFIED"))).toBe(true);
  });
  it("rejects undeclared fields or unredacted subjects in child receipts", () => {
    expect(validOutputChecks([{ section: "Output", code: "VALUE", status: "passed", token: "secret" }])).toBe(false);
    expect(validOutputChecks([{ section: "Output", code: "VALUE", status: "passed", subject: "customer@example.com" }])).toBe(false);
  });
  it("compacts passing row identities while retaining the number of comparisons", async () => {
    const run = runNumberMonitorPhases("config.json"); finish(0, receipt());
    await vi.waitFor(() => expect(children).toHaveLength(2));
    finish(1, Array.from({ length: 200 }, (_, index) => ({ section: "Output", code: "VALUE", status: "passed", subject: index.toString(16).padStart(12, "0") })));
    expect(await run).toBe(0);
    const output = mocks.write.mock.calls.map(call => String(call[1])).filter(line => line.includes('"phase":"application_outputs"')).map(line => JSON.parse(line));
    expect(output).toHaveLength(1); expect(output[0].checks).toEqual([{ section: "Output", code: "VALUE", status: "passed", count: 200 }]);
  });
  it("preserves all failure subjects in log lines below Render's size limit", async () => {
    const run = runNumberMonitorPhases("config.json"); finish(0, receipt());
    await vi.waitFor(() => expect(children).toHaveLength(2));
    finish(1, Array.from({ length: 200 }, (_, index) => ({ section: "Output", code: "VALUE", status: "difference", subject: index.toString(16).padStart(12, "0") })));
    expect(await run).toBe(1);
    const lines = mocks.write.mock.calls.map(call => String(call[1])).filter(line => line.includes('"phase":"application_outputs"'));
    expect(lines).toHaveLength(4); expect(lines.every(line => Buffer.byteLength(line) < 32_000)).toBe(true);
    expect(new Set(lines.flatMap(line => JSON.parse(line).checks.map((check: any) => check.subject))).size).toBe(200);
  });
});
