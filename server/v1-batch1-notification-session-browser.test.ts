import { execFileSync } from "node:child_process";
import path from "node:path";
import { expect, it } from "vitest";

it("isolates the actual Notifications page, bell, selection and late responses across account changes", () => {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
    /^(PATH|SYSTEMROOT|WINDIR|TEMP|TMP|USERPROFILE|LOCALAPPDATA|APPDATA|COMSPEC|PATHEXT|NUMBER_OF_PROCESSORS|PLAYWRIGHT_BROWSERS_PATH)$/i.test(key)));
  const output = execFileSync(process.execPath, ["server/v1-batch1-notification-session-browser.cjs"], {
    encoding: "utf8", windowsHide: true, timeout: 90000,
    env: { ...env, NODE_ENV: "test", DATABASE_URL: "",
      NODE_OPTIONS: `--require=${path.resolve("docs/fixes/v1-batch-3/deployment-2026-10-22/local-network-only.cjs").replace(/\\/g, "/")}` },
  });
  expect(JSON.parse(output.trim())).toEqual({ result: "PASS", checks: 4 });
}, 100000);
