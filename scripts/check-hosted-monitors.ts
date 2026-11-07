import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
// Keep availability checks running even if an independent accuracy check fails.
const commands = [
  ["scripts/check-hosted-health.ts", "scripts/hosted-test-monitor.json", "scripts/hosted-live-monitor.json"],
  ["scripts/check-live-number-run.ts", "scripts/live-number-test-monitor.json", "--scheduled"],
  ["scripts/check-live-number-run.ts", "scripts/live-number-live-monitor.json", "--scheduled"],
];
async function run(command: string[]) {
  const code = await new Promise<number>(resolve => {
    const child = spawn(process.execPath, ["--import", "tsx", ...command], { stdio: "inherit", windowsHide: true });
    child.once("error", () => resolve(1));
    child.once("close", code => resolve(code ?? 1));
  });
  if (code !== 0) process.exitCode = 1;
  return code;
}
const directory = mkdtempSync(join(tmpdir(), "mf-monitor-"));
const enrolled: string[][] = [];
for (const [index, mode] of ["test", "live"].entries()) {
  const numbers = join(directory, `${mode}-numbers.json`), healthConfig = join(directory, `${mode}-health.json`);
  if (await run(["scripts/discover-monitor-campaigns.ts", commands[index + 1][1], commands[0][index + 1], numbers, healthConfig]) === 0) {
    commands[0][index + 1] = healthConfig;
    enrolled.push(["scripts/check-live-number-run.ts", numbers, "--scheduled"]);
  }
}
await run(commands[0]);
// A browser/PDF accuracy pass can cross a cron tick. Keep the existing health
// cadence during that pass without overlapping health requests or extra jobs.
let health: Promise<void> | undefined;
const timer = setInterval(() => {
  if (!health) health = run(commands[0]).finally(() => { health = undefined; });
}, 10 * 60_000);
try { for (const command of enrolled) await run(command); }
finally { clearInterval(timer); await health; rmSync(directory, { recursive: true, force: true }); }
