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
  const manifestPath = join(root, "scripts/monitor-conversion-parity.json"), manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  manifest.equivalentCommits = ["b".repeat(40)]; writeFileSync(manifestPath, JSON.stringify(manifest));
  expect(monitorApplicationDirectory({ ...app, expectedCommit: "b".repeat(40) }, root)).toBe(prepared);
  const usersApp = { ...app, expectedCommit: "c".repeat(40), usersDefinition: "ga4_totalUsers_distinct_v1" };
  const extra = "shared/ga4-traffic-window.ts"; writeFileSync(join(root, extra), "old\n");
  writeFileSync(join(root, "scripts/monitor-distinct-users.json"), JSON.stringify({ expectedCommit: usersApp.expectedCommit,
    files: [...files, extra].map(path => ({ path, before: hash("old\n"), after: hash("distinct\n") })) }));
  writeFileSync(join(root, "scripts/monitor-distinct-users.patch"), [...files, extra].map(file => `diff --git a/${file} b/${file}\n--- a/${file}\n+++ b/${file}\n@@ -1 +1 @@\n-old\n+distinct\n`).join("").replaceAll("\n", "\r\n"));
  const usersPrepared = prepareMonitorApplication(root, true);
  expect(monitorApplicationDirectory(usersApp, root)).toBe(usersPrepared);
  expect(monitorApplicationDirectory(app, root)).toBe(prepared);
  expect(readFileSync(join(usersPrepared, extra), "utf8").trim()).toBe("distinct");
  expect(readFileSync(join(prepared, files[0]), "utf8").trim()).toBe("new");
  const currentApp = { ...usersApp, expectedCommit: "d".repeat(40), reportingMode: "current_day" };
  writeFileSync(join(root, "scripts/monitor-current-day.json"), JSON.stringify({ expectedCommit: currentApp.expectedCommit,
    files: [...files, extra].map(path => ({ path, before: hash("old\n"), after: hash("current\n") })) }));
  writeFileSync(join(root, "scripts/monitor-current-day.patch"), [...files, extra].map(file => `diff --git a/${file} b/${file}\n--- a/${file}\n+++ b/${file}\n@@ -1 +1 @@\n-old\n+current\n`).join(""));
  const currentPrepared = prepareMonitorApplication(root, true, true);
  expect(monitorApplicationDirectory(currentApp, root)).toBe(currentPrepared);
  expect(monitorApplicationDirectory(usersApp, root)).toBe(usersPrepared);
  expect(readFileSync(join(usersPrepared, extra), "utf8").trim()).toBe("distinct");
  expect(readFileSync(join(currentPrepared, extra), "utf8").trim()).toBe("current");
  expect(() => monitorApplicationDirectory({ ...currentApp, reportingMode: "completed_days" }, root)).toThrow();
  expect(() => monitorApplicationDirectory({ expectedCommit: currentApp.expectedCommit, reportingMode: "current_day" }, root)).toThrow();
  expect(() => monitorApplicationDirectory({ ...currentApp, reportingMode: "unknown" }, root)).toThrow();
  expect(() => monitorApplicationDirectory({ ...currentApp, expectedCommit: usersApp.expectedCommit }, root)).toThrow();
  expect(() => monitorApplicationDirectory({ ...usersApp, expectedCommit: app.expectedCommit }, root)).toThrow();
  expect(() => monitorApplicationDirectory({ ...usersApp, usersDefinition: "unknown" }, root)).toThrow();
  writeFileSync(join(usersPrepared, extra), "tampered\n"); expect(() => monitorApplicationDirectory(usersApp, root)).toThrow();
  manifest.equivalentCommits = ["unverified"]; writeFileSync(manifestPath, JSON.stringify(manifest));
  expect(() => monitorApplicationDirectory(app, root)).toThrow("MONITOR_SOURCE_MANIFEST_INVALID");
  manifest.equivalentCommits = ["b".repeat(40)]; writeFileSync(manifestPath, JSON.stringify(manifest));
  expect(() => monitorApplicationDirectory({ ...app, comparisonRateDefinition: "unknown" }, root)).toThrow();
  writeFileSync(join(prepared, files[0]), "tampered\n"); expect(() => monitorApplicationDirectory(app, root)).toThrow();
  writeFileSync(join(root, files[0]), "tampered\n"); expect(() => prepareMonitorApplication(root)).toThrow("MONITOR_SOURCE_BASE_CHANGED");
});
