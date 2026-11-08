import { afterEach, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { monitorApplicationDirectory, prepareMonitorApplication } from "../scripts/monitor-application-source";

const temporary: string[] = [];
afterEach(() => { for (const root of temporary.splice(0)) {
  if (!resolve(root).startsWith(resolve(tmpdir()) + sep + "monitor-source-test-")) throw Error("UNSAFE_TEST_CLEANUP");
  rmSync(root, { recursive: true, force: true });
} });
it("prepares exact pinned sources, preserves the live source, and rejects changed or unknown versions", () => {
  const root = mkdtempSync(join(tmpdir(), "monitor-source-test-")); temporary.push(root);
  const files = ["client/src/pages/ga4-metrics.tsx", "client/src/pages/ga4-ad-comparison.tsx", "server/ga4-scheduled-report-pdf.ts"];
  const hash = (text: string) => createHash("sha256").update(text).digest("hex");
  for (const file of files) { mkdirSync(dirname(join(root, file)), { recursive: true }); writeFileSync(join(root, file), "old\n"); }
  mkdirSync(join(root, "scripts")); mkdirSync(join(root, "shared"));
  const expectedCommit = "a".repeat(40), app = { expectedCommit, comparisonRateDefinition: "conversions_per_session" };
  writeFileSync(join(root, "scripts/monitor-conversion-parity.json"), JSON.stringify({ expectedCommit, files: files.map(path => ({ path, before: hash("old\n"), after: hash("new\n") })) }));
  writeFileSync(join(root, "scripts/monitor-conversion-parity.patch"), files.map(file => `diff --git a/${file} b/${file}\n--- a/${file}\n+++ b/${file}\n@@ -1 +1 @@\n-old\n+new\n`).join(""));
  expect(() => monitorApplicationDirectory(app, root)).toThrow();
  const prepared = prepareMonitorApplication(root);
  expect(monitorApplicationDirectory(app, root)).toBe(prepared);
  expect(monitorApplicationDirectory({ expectedCommit: "b".repeat(40) }, root)).toBe(root);
  for (const file of files) { expect(readFileSync(join(root, file), "utf8")).toBe("old\n"); expect(readFileSync(join(prepared, file), "utf8").replaceAll("\r\n", "\n")).toBe("new\n"); }
  expect(() => monitorApplicationDirectory({ ...app, expectedCommit: "b".repeat(40) }, root)).toThrow();
  expect(() => monitorApplicationDirectory({ ...app, comparisonRateDefinition: "unknown" }, root)).toThrow();
  writeFileSync(join(prepared, files[0]), "tampered\n"); expect(() => monitorApplicationDirectory(app, root)).toThrow();
  writeFileSync(join(root, files[0]), "tampered\n"); expect(() => prepareMonitorApplication(root)).toThrow("MONITOR_SOURCE_BASE_CHANGED");
});
