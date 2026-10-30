import { execFileSync } from "node:child_process";
import path from "node:path";
import { expect, it } from "vitest";

it("keeps current toast behavior while isolating account transitions and delayed callbacks", () => {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
    /^(PATH|SYSTEMROOT|WINDIR|TEMP|TMP|USERPROFILE|LOCALAPPDATA|APPDATA|COMSPEC|PATHEXT|NUMBER_OF_PROCESSORS|PLAYWRIGHT_BROWSERS_PATH)$/i.test(key)));
  const output = execFileSync(process.execPath, ["server/v1-toast-account-browser.cjs"], {
    encoding: "utf8", windowsHide: true, timeout: 90000,
    env: { ...env, NODE_ENV: "test", DATABASE_URL: "",
      NODE_OPTIONS: `--require=${path.resolve("docs/fixes/v1-batch-3/deployment-2026-10-22/local-network-only.cjs").replace(/\\/g, "/")}` },
  });
  const result = JSON.parse(output.trim());
  expect(result.result).toBe("PASS");
  expect(result.checks).toHaveLength(6);
  expect(result.checks.every((check: { passed: boolean }) => check.passed)).toBe(true);
}, 100000);
