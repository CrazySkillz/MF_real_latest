import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateShardReceipts } from "../scripts/ga4-kpi-current-version-test-boundary";

const context = { count: 3, commit: "exact-commit", run: "run-1", attempt: "1", deferredFiles: ["server/a.test.ts"] };
const files = ["server/a.test.ts", "server/b.test.ts", "server/c.test.ts"];
const receipts = () => files.map((file, index) => ({
  shard: `${index + 1}/3`, commit: context.commit, run: context.run, attempt: context.attempt,
  files: [file], tests: 1,
}));

describe("parallel CI release gate", () => {
  it("accepts complete, disjoint results for the exact commit and attempt", () => {
    expect(() => validateShardReceipts(receipts(), files, context)).not.toThrow();
  });
  it("rejects a missing or duplicate group", () => {
    expect(() => validateShardReceipts(receipts().slice(1), files, context)).toThrow();
    const duplicate = receipts(); duplicate[2] = duplicate[1];
    expect(() => validateShardReceipts(duplicate, files, context)).toThrow();
  });
  it.each(["commit", "run", "attempt"] as const)("rejects results from another %s", key => {
    const stale = receipts(); stale[0][key] = "other";
    expect(() => validateShardReceipts(stale, files, context)).toThrow();
  });
  it("reuses an already-passed group when only failed jobs are rerun for the same commit/run", () => {
    expect(() => validateShardReceipts(receipts(), files, { ...context, attempt: "2" })).not.toThrow();
  });
  it("rejects a receipt from a future attempt", () => {
    const future = receipts(); future[0].attempt = "2";
    expect(() => validateShardReceipts(future, files, context)).toThrow();
  });
  it.each(["0/3", "4/3", "1/2", "1/3/extra", "1.5/3"])("rejects invalid group %s", shard => {
    const invalid = receipts(); invalid[0].shard = shard;
    expect(() => validateShardReceipts(invalid, files, context)).toThrow();
  });
  it("rejects missing, extra and repeated test files", () => {
    expect(() => validateShardReceipts(receipts(), [...files, "server/missing.test.ts"], context)).toThrow();
    const extra = receipts(); extra[0].files.push("server/extra.test.ts");
    expect(() => validateShardReceipts(extra, files, context)).toThrow();
    const repeated = receipts(); repeated[2].files = repeated[0].files;
    expect(() => validateShardReceipts(repeated, files, context)).toThrow();
  });
  it("rejects a same-size inventory with a substituted test file", () => {
    const wrong = receipts(); wrong[2].files = ["server/unexpected.test.ts"];
    expect(() => validateShardReceipts(wrong, files, context)).toThrow();
  });
  it("keeps a deleted deferred test file blocking instead of dropping its identity", () => {
    expect(() => validateShardReceipts(receipts(), files, { ...context, deferredFiles: ["server/deleted.test.ts"] })).toThrow();
  });
  it.each([0, -1, 1.5, NaN])("rejects an empty or invalid assertion count %s", tests => {
    const invalid = receipts(); invalid[0].tests = tests;
    expect(() => validateShardReceipts(invalid, files, context)).toThrow();
  });
  it("requires the final check even when a dependency fails or is skipped", () => {
    const workflow = readFileSync(".github/workflows/test.yml", "utf8");
    const gate = workflow.slice(workflow.indexOf("  unit-tests:"));
    expect(gate).toContain("if: ${{ always() }}");
    expect(gate).toContain("needs: [build-checks, test-groups]");
    expect(gate).toContain('run: test "$BUILD_RESULT" = success && test "$TEST_RESULT" = success');
    expect(gate).toContain("CURRENT_VERSION_TEST_SHARD_COUNT: '3'");
    expect(gate).not.toContain("continue-on-error");
    expect(workflow.match(/continue-on-error:/g)).toHaveLength(1);
    expect(workflow).toContain("fail-fast: false");
    expect(workflow).toContain("shard: [1, 2, 3]");
    expect(workflow).toContain("overwrite: true");
  });
});
