import { EventEmitter } from "node:events";
import { Writable } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ spawn: vi.fn(), read: vi.fn(), write: vi.fn() }));
vi.mock("node:child_process", () => ({ spawn: mocks.spawn }));
vi.mock("node:fs", () => ({ readFileSync: mocks.read }));
import { runNumberMonitorPhases, validOutputChecks, writeMonitorOutput } from "../scripts/check-live-number-run";

const hash = "a".repeat(12), fingerprint = "b".repeat(64), commit = "c".repeat(40);
const children: Array<EventEmitter & { stdout: EventEmitter; kill: ReturnType<typeof vi.fn> }> = [];
const receipt = (status = "passed") => ({ campaignIdHash: hash, status, inputFingerprint: fingerprint });
function finish(index: number, body: unknown, code = 0) {
  children[index].stdout.emit("data", JSON.stringify(body) + "\n"); children[index].emit("close", code);
}
beforeEach(() => {
  children.length = 0; vi.clearAllMocks();
  const originalWrite = process.stdout.write.bind(process.stdout);
  mocks.write.mockImplementation((_value, callback) => { callback(); return true; });
  vi.spyOn(process.stdout, "write").mockImplementation(((value: any, ...args: any[]) => String(value).startsWith('{')
    ? mocks.write(value, args.at(-1)) : (originalWrite as any)(value, ...args)) as any);
  mocks.read.mockReturnValue(JSON.stringify({ databaseEnvironmentVariable: "PHASE_TEST_DB", databaseFingerprint: "d".repeat(64),
    credentialsEnvironmentPrefix: "PHASE_TEST_", application: { baseUrl: "https://monitor-fixture.invalid", expectedCommit: commit }, campaigns: [{ campaignIdHash: hash }] }));
  mocks.spawn.mockImplementation(() => { const child = Object.assign(new EventEmitter(), { stdout: new EventEmitter(), kill: vi.fn() }); children.push(child); return child; });
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: true, commit }), { status: 200 })));
  vi.stubEnv("PHASE_TEST_DB", "postgresql://fixture.invalid/db"); vi.stubEnv("PHASE_TEST_GOOGLE_CLIENT_ID", "fixture-client");
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

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
    expect(mocks.write.mock.calls.some(call => String(call[0]).includes("OUTPUT_PROCESS_UNVERIFIED"))).toBe(true);
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
    const output = mocks.write.mock.calls.map(call => String(call[0])).filter(line => line.includes('"phase":"application_outputs"')).map(line => JSON.parse(line));
    expect(output).toHaveLength(1); expect(output[0].checks).toEqual([{ section: "Output", code: "VALUE", status: "passed", count: 200 }]);
  });
  it("preserves all failure subjects in log lines below Render's size limit", async () => {
    const run = runNumberMonitorPhases("config.json"); finish(0, receipt());
    await vi.waitFor(() => expect(children).toHaveLength(2));
    finish(1, Array.from({ length: 200 }, (_, index) => ({ section: "Output", code: "VALUE", status: "difference", subject: index.toString(16).padStart(12, "0") })));
    expect(await run).toBe(1);
    const lines = mocks.write.mock.calls.map(call => String(call[0])).filter(line => line.includes('"phase":"application_outputs"'));
    expect(lines).toHaveLength(4); expect(lines.every(line => Buffer.byteLength(line) < 32_000)).toBe(true);
    expect(new Set(lines.flatMap(line => JSON.parse(line).checks.map((check: any) => check.subject))).size).toBe(200);
  });
  it("waits for a full output pipe before proceeding and preserves every campaign result part", async () => {
    mocks.write.mockImplementation((_value, callback) => { setTimeout(callback, 2); return false; });
    const secondHash = "e".repeat(12), config = JSON.parse(mocks.read()); config.campaigns.push({ campaignIdHash: secondHash }); mocks.read.mockReturnValue(JSON.stringify(config));
    const run = runNumberMonitorPhases("config.json");
    children[0].stdout.emit("data", [receipt(), { ...receipt(), campaignIdHash: secondHash }].map(r => JSON.stringify(r)).join("\n") + "\n");
    children[0].emit("close", 0);
    await Promise.resolve(); expect(children).toHaveLength(1);
    await vi.waitFor(() => expect(children).toHaveLength(2));
    finish(1, Array.from({ length: 700 }, (_, index) => ({ section: "PDF", code: "VALUE", status: "difference", subject: index.toString(16).padStart(12, "0") })));
    await vi.waitFor(() => expect(children).toHaveLength(3)); finish(2, [{ section: "PDF", code: "MATCH", status: "passed" }]);
    expect(await run).toBe(1);
    const records = mocks.write.mock.calls.map(call => String(call[0])).filter(line => line.includes('"phase":"application_outputs"')).map(line => JSON.parse(line));
    expect(records.filter(r => r.campaignIdHash === hash).map(r => r.part)).toEqual(Array.from({ length: 11 }, (_, i) => i + 1));
    expect(records.at(-1)).toMatchObject({ campaignIdHash: secondHash, part: 1, parts: 1, status: "passed" });
  });
  it("flushes large Unicode result streams completely and rejects write failures", async () => {
    const chunks: Buffer[] = [], output = new Writable({ highWaterMark: 16, write(chunk, _encoding, callback) { setTimeout(() => { chunks.push(Buffer.from(chunk)); callback(); }, 2); } });
    const value = JSON.stringify({ results: Array.from({ length: 4000 }, (_, i) => ({ i, value: "€ — complete" })) }) + "\n";
    await writeMonitorOutput(value, output); expect(Buffer.concat(chunks).toString()).toBe(value);
    await expect(writeMonitorOutput(value, { write: (_value: any, callback: any) => { callback(new Error("failed")); return false; } } as any)).rejects.toThrow("failed");
  });
});
