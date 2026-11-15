import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { BaseSequencer, type TestSpecification } from "vitest/node";

// Timings affect placement only. Vitest still discovers the complete test inventory.
export default class DurationSequencer extends BaseSequencer {
  private timings = JSON.parse(readFileSync(new URL("./ci-test-timings.json", import.meta.url), "utf8")) as {
    schemaVersion: number; workersPerGroup: number; overheadMs: number; fallbackMs: number;
    files: Record<string, number>;
  };

  private file(spec: TestSpecification): string {
    return relative(this.ctx.config.root, spec.moduleId).replace(/\\/g, "/");
  }

  private duration(spec: TestSpecification): number {
    const duration = this.timings.files[this.file(spec)] ?? this.timings.fallbackMs;
    if (this.timings.schemaVersion !== 1 || this.timings.workersPerGroup !== 2
      || !Number.isFinite(duration) || duration < 0
      || !Number.isFinite(this.timings.overheadMs) || this.timings.overheadMs <= 0) {
      throw new Error("Invalid CI test timing weights.");
    }
    return duration + this.timings.overheadMs;
  }

  async sort(files: TestSpecification[]): Promise<TestSpecification[]> {
    return [...files].sort((a, b) => this.duration(b) - this.duration(a)
      || (this.file(a) < this.file(b) ? -1 : this.file(a) > this.file(b) ? 1 : 0));
  }

  async shard(files: TestSpecification[]): Promise<TestSpecification[]> {
    const { index, count } = this.ctx.config.shard!;
    if (!Number.isInteger(count) || count < 1 || !Number.isInteger(index) || index < 1 || index > count) {
      throw new Error("Invalid CI test shard.");
    }
    const groups: TestSpecification[][] = Array.from({ length: count }, () => []);
    const loads = Array<number>(count * 2).fill(0);
    for (const spec of await this.sort(files)) {
      const worker = loads.reduce((best, load, i) => load < loads[best] ? i : best, 0);
      groups[worker % count].push(spec);
      loads[worker] += this.duration(spec);
    }
    return groups[index - 1];
  }
}
