import { spawn } from "node:child_process";
// Keep availability checks running even if an independent accuracy check fails.
const commands = [
  ["scripts/check-hosted-health.ts", "scripts/hosted-test-monitor.json", "scripts/hosted-live-monitor.json"],
  ["scripts/check-live-numbers.ts", "scripts/live-number-test-monitor.json", "--scheduled"],
  ["scripts/check-live-numbers.ts", "scripts/live-number-live-monitor.json", "--scheduled"],
];
for (const command of commands) {
  const code = await new Promise<number>(resolve => {
    const child = spawn(process.execPath, ["--import", "tsx", ...command], { stdio: "inherit", windowsHide: true });
    child.once("error", () => resolve(1));
    child.once("close", code => resolve(code ?? 1));
  });
  if (code !== 0) process.exitCode = 1;
}
