import { spawn } from "node:child_process";
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
}
await run(commands[0]);
// A browser/PDF accuracy pass can cross a cron tick. Keep the existing health
// cadence during that pass without overlapping health requests or extra jobs.
let health: Promise<void> | undefined;
const timer = setInterval(() => {
  if (!health) health = run(commands[0]).finally(() => { health = undefined; });
}, 10 * 60_000);
try { for (const command of commands.slice(1)) await run(command); }
finally { clearInterval(timer); await health; }
