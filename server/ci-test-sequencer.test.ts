import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { TestSpecification, Vitest } from "vitest/node";
import DurationSequencer from "../scripts/ci-test-sequencer";

const root = process.cwd();
const timings = JSON.parse(readFileSync("scripts/ci-test-timings.json", "utf8"));
const spec = (file: string) => ({ moduleId: resolve(root, file) }) as TestSpecification;
const sequencer = (index: number, count = 3) => new DurationSequencer({ config: { root, shard: { index, count } } } as Vitest);
const partition = (files: TestSpecification[]) => Promise.all([1, 2, 3].map(i => sequencer(i).shard(files)));

describe("duration-balanced CI groups", () => {
  it("runs the full recorded inventory and new/renamed files exactly once", async () => {
    const files = [...Object.keys(timings.files), "server/new-test.test.ts", "server/renamed-test.test.ts"].map(spec);
    const before = [...files];
    const groups = await partition(files);
    expect(new Set(groups.flat()).size).toBe(files.length);
    expect(groups.flat().map(f => f.moduleId).sort()).toEqual(files.map(f => f.moduleId).sort());
    expect(files).toEqual(before);
    expect(groups.every(g => g.length > 0)).toBe(true);
  });
  it("does not resurrect files removed from the discovered inventory", async () => {
    const files = [spec("server/ci-parallel-test-gate.test.ts")];
    expect((await partition(files)).flat()).toEqual(files);
  });
  it("assigns the same groups regardless of discovery order", async () => {
    const files = Object.keys(timings.files).map(spec);
    expect(await partition(files)).toEqual(await partition([...files].reverse()));
  });
  it("balances the measured two-worker load and separates the two longest files", async () => {
    const files = Object.keys(timings.files).map(spec);
    const groups = await partition(files);
    const ordered = await sequencer(1).sort(files);
    expect(groups.findIndex(g => g.includes(ordered[0]))).not.toBe(groups.findIndex(g => g.includes(ordered[1])));
    const loads = groups.map(group => {
      const workers = [0, 0];
      for (const file of group) {
        const name = file.moduleId.slice(root.length + 1).replace(/\\/g, "/");
        workers[workers[0] <= workers[1] ? 0 : 1] += timings.files[name] + timings.overheadMs;
      }
      return Math.max(...workers);
    });
    const durations = Object.values(timings.files).map(ms => Number(ms) + timings.overheadMs);
    // A test file cannot be split: its duration is a lower bound for the whole run.
    const lowerBound = Math.max(...durations, durations.reduce((sum, ms) => sum + ms, 0) / 6);
    expect(Math.max(...loads)).toBeLessThanOrEqual(lowerBound + 1000);
  });
  it("starts long files first and sorts equal-duration new files deterministically", async () => {
    const files = [spec("server/new-z.test.ts"), spec("server/ga4-ad-comparison-download-browser.test.ts"), spec("server/new-a.test.ts")];
    expect(await sequencer(1).sort(files)).toEqual([files[1], files[2], files[0]]);
  });
  it.each([[0, 3], [4, 3], [1, 0], [1.5, 3], [1, 2.5]])("rejects invalid shard %s/%s", async (index, count) => {
    await expect(sequencer(index, count).shard([spec("server/new.test.ts")])).rejects.toThrow("Invalid CI test shard");
  });
  it("keeps timing-based placement scoped to sharded CI and preserves two workers", () => {
    const runner = readFileSync("scripts/ga4-kpi-current-version-test-boundary.ts", "utf8");
    expect(runner).toContain('if (shard) args.push(`--shard=${shard}`, `--sequence.sequencer=${resolve(root, "scripts/ci-test-sequencer.ts")}`);');
    expect(runner).toContain('"--maxWorkers=2"');
    expect(timings.workersPerGroup).toBe(2);
  });
});
