// Isolated, synthetic UI only: actual report confirmation JSX, Radix components and app CSS.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
if (!process.argv.includes("--isolated")) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(PATH|SYSTEMROOT|WINDIR|TEMP|TMP|USERPROFILE|LOCALAPPDATA|APPDATA|COMSPEC|PATHEXT)$/i.test(key)));
  const run = spawnSync(process.execPath, [process.argv[1], ...process.argv.slice(2), "--isolated"], { env: { ...env, NODE_ENV: "test" }, stdio: "inherit", windowsHide: true, timeout: 120000 });
  process.exit(run.status ?? 1);
}
const { default: ts } = await import("typescript");
const { build } = await import("esbuild");
const { chromium, expect } = await import("@playwright/test");
const { default: postcss } = await import("postcss");
const { default: tailwind } = await import("tailwindcss");
const { default: loadConfig } = await import("tailwindcss/loadConfig.js");
const baseline = process.argv.includes("--baseline");
const outcome = { baseline, cases: [], errors: [] };
function content(path, title) {
  const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let found;
  const visit = node => {
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(source) === "AlertDialogContent" && node.getText(source).includes(title) && !found) found = node.getText(source);
    ts.forEachChild(node, visit);
  };
  visit(source); if (!found) throw Error(`Missing report delete dialog: ${path}`);
  return found;
}
const dialogs = {
  ga4: content("client/src/pages/ga4-metrics.tsx", "Delete Report"),
  campaign: content("client/src/pages/reports.tsx", "Delete report?"),
};
const fixture = `import React,{useState} from 'react'; import {createRoot} from 'react-dom/client';
import {AlertDialog,AlertDialogTrigger,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel,AlertDialogAction} from '@/components/ui/alert-dialog';
function App(){ const [deleted,setDeleted]=useState(false); const [error,setError]=useState(false);
const r={id:'fixture',name:'Fixture report'}; const reportPendingDelete=r;
const remove=()=>setTimeout(()=>window.failDelete?setError(true):setDeleted(true),60);
const deleteGA4ReportMutation={mutate:remove}; const deletePendingReport=remove;
return <main id='main' style={{margin:'0 60px',minHeight:1800,paddingTop:420}}><h1>Reports</h1>
<div id='remaining'>{deleted?'No reports created yet':'Fixture report'}</div>{error&&<p>Delete failed</p>}
<AlertDialog><AlertDialogTrigger>Delete fixture</AlertDialogTrigger>{window.fixtureKind==='ga4'?(${dialogs.ga4}):(${dialogs.campaign})}</AlertDialog></main>;}
createRoot(document.getElementById('root')).render(<App/>);`;
const config = loadConfig(resolve("tailwind.config.ts"));
config.content = [{ raw: fixture, extension: "tsx" }, "./client/src/components/ui/alert-dialog.tsx", "./client/src/components/ui/button.tsx"];
const css = (await postcss([tailwind(config)]).process(readFileSync("client/src/index.css", "utf8"), { from: undefined })).css;
const bundle = await build({ stdin: { contents: fixture, resolveDir: process.cwd(), loader: "tsx" }, bundle: true, write: false, format: "iife", jsx: "automatic",
  alias: { "@": resolve("client/src") }, define: { "process.env.NODE_ENV": '"test"' }, logLevel: "silent" });
const browser = await chromium.launch({ headless: true, args: ["--disable-features=OverlayScrollbar,OverlayScrollbars"] });
try {
  for (const kind of Object.keys(dialogs)) for (const action of ["cancel", "delete", "failure", "escape"]) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await context.route("**/*", route => route.abort()); // No live app/provider requests allowed.
    const page = await context.newPage();
    page.on("pageerror", error => outcome.errors.push(error.message));
    await page.setContent(`<html><head><style>${css}\n::-webkit-scrollbar{width:16px}</style></head><body><div id="root"></div></body></html>`);
    await page.evaluate(({kind,action}) => { window.fixtureKind=kind; window.failDelete=action==='failure'; }, {kind,action});
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    await expect(page.getByRole("button", { name: "Delete fixture" })).toBeVisible();
    await page.evaluate(() => window.scrollTo(0,300));
    const position = () => page.evaluate(() => { const r=document.querySelector('#main').getBoundingClientRect(); return { x:r.x,width:r.width,scrollY:window.scrollY,margin:getComputedStyle(document.body).marginRight }; });
    const before = await position();
    await page.getByRole("button", { name: "Delete fixture" }).click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    const opened = await position();
    if (baseline) expect(opened.width).toBeLessThan(before.width);
    else { expect(opened.x).toBe(before.x); expect(opened.width).toBe(before.width); expect(opened.scrollY).toBe(before.scrollY); }
    if (action === "escape") await page.keyboard.press("Escape");
    else await page.getByRole("alertdialog").getByRole("button", { name: action === "cancel" ? "Cancel" : "Delete", exact: true }).click();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(page.locator("body")).not.toHaveAttribute("data-scroll-locked");
    if (action === "delete") await expect(page.locator("#remaining")).toHaveText("No reports created yet");
    else await expect(page.locator("#remaining")).toHaveText("Fixture report");
    if (action === "failure") await expect(page.getByText("Delete failed", {exact:true})).toBeVisible();
    const closed = await position();
    expect(closed).toEqual(before);
    outcome.cases.push({kind,action,before,opened,closed});
    await context.close();
  }
  expect(outcome.errors).toEqual([]);
} finally {
  await browser.close();
  writeFileSync(new URL(`report-delete-layout-${baseline?'baseline':'fixed'}.json`, import.meta.url), JSON.stringify(outcome,null,2)+'\n');
}
console.log(JSON.stringify({baseline,cases:outcome.cases.length,errors:outcome.errors}));
