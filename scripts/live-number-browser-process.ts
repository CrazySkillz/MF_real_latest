import { fork } from "node:child_process";
import { resolve } from "node:path";
import type { LiveNumberSnapshot, NumberCheck } from "../server/live-number-checks";

export type BrowserRead = (path: string) => Promise<{ status: number; body: any }>;
export function browserSafeValue(value: any): any {
  return JSON.parse(JSON.stringify(value, (key, item) => key !== "publicationToken" && /token|secret|password|private.?key|service.?account.?json|credential|encrypted/i.test(key) ? undefined : item));
}

export async function runBrowserProcess(snapshot: LiveNumberSnapshot, outputs: Record<string, any>, read: BrowserRead): Promise<NumberCheck[]> {
  return new Promise(resolveResult => {
    const env: NodeJS.ProcessEnv = {};
    for (const name of ["PATH", "Path", "SystemRoot", "SYSTEMROOT", "TEMP", "TMP", "TMPDIR", "HOME", "USERPROFILE", "LOCALAPPDATA", "PLAYWRIGHT_BROWSERS_PATH"]) if (process.env[name]) env[name] = process.env[name];
    if (process.platform === "linux") env.PLAYWRIGHT_BROWSERS_PATH ||= "0";
    const child = fork(resolve("scripts/live-number-browser-checks.ts"), ["--browser-worker"], { execArgv: ["--max-old-space-size=384", "--import", "tsx"], env, windowsHide: true, stdio: ["ignore", "ignore", "ignore", "ipc"] });
    let result: NumberCheck[] | undefined, count = 0;
    const timer = setTimeout(() => child.kill(), 180_000).unref();
    child.on("message", async (message: any) => {
      if (message?.kind === "read" && Number.isInteger(message.id) && typeof message.path === "string" && ++count <= 240) {
        let response; try { response = browserSafeValue(await read(message.path)); } catch { response = { status: 503, body: { error: "Monitor read unavailable" } }; }
        if (child.connected) child.send({ kind: "response", id: message.id, response });
      } else if (message?.kind === "result" && Array.isArray(message.checks)) result = message.checks;
    });
    const finish = () => { clearTimeout(timer); resolveResult(result || [{ section: "Browser checks", code: "BROWSER_PROCESS_UNVERIFIED", status: "unverified" }]); };
    child.once("error", finish); child.once("close", finish);
    child.send({ kind: "start", snapshot: browserSafeValue(snapshot), outputs: browserSafeValue(outputs) });
  });
}
