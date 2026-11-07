// Operator-only isolated browser. Real page components and PDF exporters; no
// customer browser, sign-in session, database credential or writable API access.
import { build } from "esbuild";
import { chromium, type Page } from "@playwright/test";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import { PDFParse } from "pdf-parse";
import { compareNumber, monitorHash, type LiveNumberSnapshot, type NumberCheck } from "../server/live-number-checks";
import { expectedOutputNumbers, expectedTargetNumbers } from "../server/live-number-output-checks";
import { checkGeneratedReportText, checkReportDetailText, checkConfiguredReportText } from "../server/live-number-generated-report-checks";

import type { BrowserRead } from "./live-number-browser-process";
let bundle: Promise<Uint8Array> | undefined;
async function browserBundle() {
  return bundle ||= (async () => {
    const result = await build({
      stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client';
        import {QueryClientProvider} from '@tanstack/react-query'; import {Route,Switch} from 'wouter';
        import {createAppQueryClient} from '@/lib/queryClient'; import {ClientProvider} from '@/lib/clientContext';
        import {TooltipProvider} from '@/components/ui/tooltip'; import GA4 from '@/pages/ga4-metrics';
        import Performance from '@/pages/campaign-performance'; import Financial from '@/pages/financial-analysis';
        import Trend from '@/pages/trend-analysis'; import Executive from '@/pages/executive-summary';
        import Notifications from '@/pages/notifications'; import Reports from '@/pages/reports';
        const client=createAppQueryClient(); window.__monitorQueries=()=>client.isFetching();
        createRoot(document.getElementById('root')).render(<QueryClientProvider client={client}><ClientProvider><TooltipProvider><Switch>
        <Route path='/campaigns/:id/ga4-metrics' component={GA4}/><Route path='/campaigns/:id/performance' component={Performance}/>
        <Route path='/campaigns/:id/financial-analysis' component={Financial}/><Route path='/campaigns/:id/trend-analysis' component={Trend}/>
        <Route path='/campaigns/:id/executive-summary' component={Executive}/><Route path='/notifications' component={Notifications}/>
        <Route path='/reports' component={Reports}/></Switch></TooltipProvider></ClientProvider></QueryClientProvider>);`,
        resolveDir: process.cwd(), loader: "tsx" },
      bundle: true, write: false, format: "esm", jsx: "automatic", logLevel: "silent",
      alias: { "@": resolve("client/src"), "@shared": resolve("shared"), "@assets": resolve("attached_assets") },
      define: { "process.env.NODE_ENV": '"production"', "import.meta.env": "{}" },
      plugins: [{ name: "monitor-boundary", setup(builder) {
        builder.onResolve({ filter: /^recharts$/ }, () => ({ path: "recharts", namespace: "monitor-charts" }));
        builder.onResolve({ filter: /^monitor-original-recharts$/ }, () => ({ path: resolve("node_modules/recharts/es6/index.js") }));
        builder.onLoad({ filter: /.*/, namespace: "monitor-charts" }, () => ({ loader: "tsx", resolveDir: process.cwd(), contents: `
          import React,{useId,useLayoutEffect} from 'react'; import * as R from 'monitor-original-recharts'; export * from 'monitor-original-recharts';
          function wrap(name){return function Chart(props){const id=useId();useLayoutEffect(()=>{window.__monitorCharts ||= {};window.__monitorCharts[id]={name,data:props.data};return()=>{delete window.__monitorCharts[id]};},[props]);const Actual=R[name];return <Actual {...props}/>;}}
          export const LineChart=wrap('LineChart'),BarChart=wrap('BarChart'),AreaChart=wrap('AreaChart'),PieChart=wrap('PieChart');` }));
        builder.onResolve({ filter: /^(@clerk\/clerk-react|@\/components\/layout\/(navigation|sidebar))$/ }, args => ({ path: args.path, namespace: "monitor-shell" }));
        builder.onLoad({ filter: /.*/, namespace: "monitor-shell" }, args => ({ loader: "js", resolveDir: process.cwd(), contents:
          args.path.startsWith("@clerk") ? 'export const useAuth=()=>({userId:"isolated-monitor"});export const useUser=()=>({user:{}});export const UserButton=()=>null;'
          : 'export default function Shell(){return null;}' }));
        builder.onLoad({ filter: /[\\/]pages[\\/]ga4-metrics\.tsx$/ }, async args => {
          const source = await readFile(args.path, "utf8"), ast = ts.createSourceFile(args.path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
          let end = -1;
          const visit = (node: ts.Node) => { if (ts.isVariableStatement(node) && node.declarationList.declarations.some(d => d.name.getText(ast) === "downloadGA4Report")) end = node.end; ts.forEachChild(node, visit); };
          visit(ast); if (end < 0) throw new Error("BROWSER_PDF_ENTRY_MISSING");
          // Expose the existing closure after render; its implementation, inputs,
          // formatting and save path are untouched. No report is saved to the DB.
          return { contents: source.slice(0, end) + '\nwindow.__monitorPdf=downloadGA4Report;\n' + source.slice(end), loader: "tsx" };
        });
      } }],
    });
    return result.outputFiles[0].contents;
  })();
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href && process.argv[2] === "--browser-worker") {
  let id = 0; const pending = new Map<number, (result: any) => void>();
  process.on("message", async (message: any) => {
    if (message?.kind === "response") { pending.get(message.id)?.(message.response); pending.delete(message.id); }
    if (message?.kind !== "start") return;
    try {
      const checks = await checkBrowserNumbers(message.snapshot, message.outputs, path => new Promise(resolveRead => { const next = ++id; pending.set(next, resolveRead); process.send!({ kind: "read", id: next, path }); }));
      process.send!({ kind: "result", checks }, () => process.disconnect());
    } catch { process.send!({ kind: "result", checks: [{ section: "Browser checks", code: "BROWSER_REPLAY_UNVERIFIED", status: "unverified" }] }, () => process.disconnect()); }
  });
}

export function checkDisplayedNumber(section: string, code: string, expected: number | null, raw: string | null, decimals = 2, currency?: string): NumberCheck {
  const unavailable = raw !== null && /^(Unavailable|Not available|N\/A|—|–)$/.test(raw.trim());
  if (expected === null) return { section, code, status: unavailable ? "passed" : raw === null ? "unverified" : "difference" };
  if (unavailable) return { section, code, status: "difference" };
  let normalized = raw?.trim();
  if (currency && normalized) {
    const symbol = new Intl.NumberFormat("en-US", { style: "currency", currency }).formatToParts(1).find(p => p.type === "currency")!.value;
    if (!normalized.includes(symbol) && !normalized.includes(currency)) return { section, code, status: "difference" };
    normalized = normalized.replace(symbol, "").replace(currency, "").trim();
  }
  normalized = normalized?.replace(/[%x]$/, "").replaceAll(",", "");
  const actual = normalized && /^-?\d+(\.\d+)?$/.test(normalized) ? Number(normalized) : null;
  return compareNumber(section, code, expected, actual, { decimals: code.includes("CONVERSIONS") ? undefined : decimals, conversions: code.includes("CONVERSIONS"), operations: 10000 });
}

export function checkBrowserReportText(snapshot: LiveNumberSnapshot, text: string, type: string, now = new Date()): NumberCheck[] {
  // Browser PDFs deliberately shorten the Shopify label. Only resolve it when
  // exactly one active source has that label; ambiguous sources remain unverified.
  const shopify = (snapshot.rows.revenueSources || []).filter(r => r.sourceType === "shopify" && r.isActive !== false);
  if (type !== "ads" && shopify.length === 1) snapshot = { ...snapshot, rows: { ...snapshot.rows,
    revenueSources: snapshot.rows.revenueSources.map(r => r.id === shopify[0].id ? { ...r, displayName: "Shopify" } : r) } };
  if (type !== "insights") {
    const normalized = text.replaceAll("Revenue SOURCES", "Revenue Sources").replaceAll("Spend SOURCES", "Spend Sources");
    const checks = [...checkGeneratedReportText(snapshot, normalized, type, now), ...checkReportDetailText(snapshot, normalized, type, now)]
      .filter(c => !["KPIS_CURRENT_TARGET", "BENCHMARKS_CURRENT_TARGET", ...(type === "ads" ? ["RATE_LEADER"] : [])].includes(c.code));
    if (type === "kpis" || type === "benchmarks") for (const target of expectedTargetNumbers(snapshot, now).filter(t => t.kind === type && t.verified)) {
      if (!target.verified) continue;
      const lines = text.split(/\r?\n/).map(s => s.trim()), index = lines.indexOf(target.row.name), subset = index < 0 ? [] : lines.slice(index + 1);
      for (const [label, value] of [["CURRENT", target.current], [type === "kpis" ? "TARGET" : "BENCHMARK", target.target]] as const) {
        const at = subset.findIndex(line => line === `${label} (${target.row.unit})`);
        checks.push({ ...checkDisplayedNumber(`Browser ${type} PDF`, label + "_" + target.identity.toUpperCase(), value, at < 0 ? null : subset[at + 1], ["users", "sessions", "pageviews"].includes(target.identity) ? 0 : 2), subject: monitorHash(target.row.id) });
      }
    }
    if (type === "ads") {
      const lines = text.split(/\r?\n/).map(s => s.trim()), at = lines.indexOf("HIGHEST CONVERSION RATE");
      const rows = expectedBrowserCampaignRows(snapshot, now), best = [...rows].filter(r => r.sessions > 0 && r.conversionRate > 0).sort((a,b) => b.conversionRate - a.conversionRate)[0];
      if (rows.length > 1 && best) {
        const prefix = `${best.conversionRate.toFixed(2)}% CR - ${expectedOutputNumbers(snapshot, now).scope.currency} ${best.revenue.toLocaleString("en-US", {minimumFractionDigits:2,maximumFractionDigits:2})}`;
        checks.push({ section: "Browser ads PDF", code: "RATE_LEADER_VALUES", status: at >= 0 && lines[at + 1] === best.name.slice(0,22) && lines[at + 2]?.startsWith(prefix) ? "passed" : "difference" });
      }
    }
    return checks;
  }
  const e = expectedOutputNumbers(snapshot, now), section = "Browser insights PDF";
  const lines = text.split(/\r?\n/).map(l => l.replace(/\s+/g, " ").trim()).filter(Boolean);
  const start = lines.indexOf("Executive Financials"), end = lines.indexOf("Trends", start);
  const financial = start >= 0 && end > start ? ["Executive Summary", ...lines.slice(start + 1, end), "Data Summary"].join("\n") : "";
  const checks = checkGeneratedReportText(snapshot, financial, type, now);
  const summaryStart = lines.indexOf("Data Summary"), summary = summaryStart < 0 ? [] : lines.slice(summaryStart + 1);
  for (const [label, wanted, decimals, money] of [["SESSIONS", e.totals.sessions, 0], ["CONVERSIONS", e.totals.conversions, 8], ["REVENUE", e.revenue, 2, true], ["TOTAL SPEND", e.spend, 2, true], ["PROFIT", e.profit, 2, true], ["ROAS", e.roas, 2], ["CPA", e.cpa, 2, true]] as const) {
    const i = summary.indexOf(label);
    // The secondary Data Summary intentionally includes only applicable cards;
    // the mandatory Executive Financials block above still checks availability.
    const shown = label === "PROFIT" ? (e.revenue || 0) > 0 && (e.spend || 0) > 0
      : label === "CPA" ? (e.totals.conversions || 0) > 0 && (e.spend || 0) > 0 : (wanted || 0) > 0;
    if (!shown) { checks.push({ section, code: "SUMMARY_" + label.replaceAll(" ", "_") + "_CONDITIONAL_ABSENCE", status: i < 0 ? "passed" : "difference" }); continue; }
    checks.push(checkDisplayedNumber(section, "SUMMARY_" + label.replaceAll(" ", "_"), wanted, i < 0 ? null : summary[i + 1], decimals, money ? e.scope.currency : undefined));
  }
  // The browser template has a selected-metric trend table, unlike the server
  // template's multi-metric table. Validate that actual layout independently.
  const dates = lines.flatMap(line => { const match = line.match(/^(\d{4}-\d{2}-\d{2}) ([\d,.]+|—|Unavailable) (.+)$/); return match ? [match] : []; });
  const byDate = new Map(e.daily.map(row => [row.date, row]));
  for (const match of dates) {
    const daily = byDate.get(match[1]);
    checks.push(checkDisplayedNumber(section, "TREND_SESSIONS", daily ? Number(daily.sessions) : null, match[2], 0));
  }
  checks.push({ section, code: "TREND_TABLE_OR_EXPLICIT_HISTORY_STATE", status: dates.length || /comparison unavailable|Need at least|No daily history/i.test(text) ? "passed" : "unverified" });
  return checks;
}

export function expectedBrowserCampaignRows(snapshot: LiveNumberSnapshot, now = new Date()) {
  const e = expectedOutputNumbers(snapshot, now), groups = new Map<string, {name:string;sessions:number;users:number;conversions:number;revenue:number;weighted:number}>();
  for (const row of e.scope.publication.campaignBreakdown?.rows || []) {
    const value = groups.get(row.campaign) || {name:row.campaign,sessions:0,users:0,conversions:0,revenue:0,weighted:0};
    for (const field of ["sessions","users","conversions","revenue"] as const) value[field] += Number(row[field]);
    value.weighted += Number(row.sessions) * Number(row.sessionKeyEventRate || 0); groups.set(row.campaign,value);
  }
  const normalize = (name: string) => name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
  for (const source of e.revenueSources) {
    const record = snapshot.rows.revenueSources.find(r => r.id === source.id);
    const cfg = typeof record?.mappingConfig === "string" ? JSON.parse(record.mappingConfig) : record?.mappingConfig || {};
    for (const item of cfg.campaignValueRevenueTotals || []) {
      const mappings = (cfg.campaignMappings || []).filter((m:any) => normalize(String(m.crmValue || "")) === normalize(String(item.campaignValue)));
      if (mappings.length !== 1) continue;
      const matches = [...groups.values()].filter(g => normalize(g.name) === normalize(String(mappings[0].linkedinCampaignName || mappings[0].linkedinCampaignUrn || "")));
      if (matches.length === 1) matches[0].revenue += Number(item.revenue);
    }
  }
  const rows = [...groups.values()].map(row => ({...row,exact:row.revenue*100,cents:Math.floor(row.revenue*100)}));
  const total = Math.round(Number(rows.reduce((n,r) => n+r.revenue,0).toFixed(2))*100);
  const removes = total < rows.reduce((n,r) => n+Math.round(Number(r.revenue.toFixed(2))*100),0);
  const ranked = [...rows].sort((a,b) => (b.exact-b.cents)-(a.exact-a.cents) || (a.name<b.name?-1:a.name>b.name?1:0)*(removes?-1:1));
  const remaining = total-rows.reduce((n,r)=>n+r.cents,0);
  if (remaining<0 || remaining>rows.length) throw new Error("BROWSER_ALLOCATION_UNVERIFIED");
  for(let i=0;i<remaining;i++)ranked[i].cents++;
  return rows.map(r=>({...r,revenue:r.cents/100,conversionRate:r.sessions>0?r.weighted/r.sessions*100:0}));
}

export function checkNarrativeWindows(snapshot: LiveNumberSnapshot, text: string, now = new Date()): NumberCheck[] {
  const e = expectedOutputNumbers(snapshot, now), checks: NumberCheck[] = [];
  // Insights Trends intentionally excludes dates before campaign creation,
  // unlike Overview's historical-import window (GA4/INSIGHTS.md).
  const created = new Date(snapshot.campaign.createdAt), start = Number.isFinite(created.getTime())
    ? new Intl.DateTimeFormat("en-CA", { timeZone: snapshot.campaign.reportingTimeZone || "Europe/Amsterdam", year: "numeric", month: "2-digit", day: "2-digit" }).format(created) : "";
  const dates = new Set(e.daily.filter(row => start && row.date >= start).map(row => row.date));
  if (!start) return [{ section: "Insights narrative", code: "CAMPAIGN_START_UNVERIFIED", status: "unverified" }];
  const pattern = /(?:Current|Prior|prior) (?:\d+-day )?window (\d{4}-\d{2}-\d{2}) to\s*(\d{4}-\d{2}-\d{2}): (\d+)\/(\d+) (?:completed|recorded|imported) days/g;
  for (const match of text.matchAll(pattern)) {
    const duration = (Date.parse(match[2]) - Date.parse(match[1])) / 86400000 + 1;
    const count = [...dates].filter(date => date >= match[1] && date <= match[2]).length;
    checks.push(compareNumber("Insights narrative", "RECORDED_DAYS", count, Number(match[3])), compareNumber("Insights narrative", "WINDOW_DAYS", duration, Number(match[4])));
  }
  return checks;
}

async function cardValue(page: Page, label: string, scope?: string): Promise<string | null> {
  return page.evaluate(({ label, scope }) => {
    const root = scope ? document.getElementById(scope) : document;
    if (!root) return null;
    const labels = [...root.querySelectorAll('p,h3,h4,div,span')].filter(el => el.children.length === 0 && el.textContent?.trim() === label && (el as HTMLElement).offsetHeight > 0);
    for (const el of labels) {
      let parent = el.parentElement;
      for (let i = 0; parent && i < 4; i++, parent = parent.parentElement) {
        const values = [...parent.querySelectorAll('[class*="text-2xl"],[class*="text-3xl"],[class*="text-4xl"],[class*="text-xl"],[class*="text-lg"][class*="font-bold"]')].filter(v => (v as HTMLElement).offsetHeight > 0 && v !== el);
        if (values.length === 1) return values[0].textContent?.trim() || null;
        if (values.length > 1) break;
      }
    }
    const inline = [...root.querySelectorAll('[class*="font-bold"]')].filter(el => el.children.length === 0 && new RegExp('^[\\d,.]+ ' + label + '$').test(el.textContent?.trim() || ""));
    return inline.length === 1 ? inline[0].textContent!.trim().slice(0, -(label.length + 1)) : null;
  }, { label, scope });
}

export async function checkBrowserNumbers(snapshot: LiveNumberSnapshot, outputs: Record<string, any>, read: BrowserRead, now = new Date(), observe?: (kind: string, key: string, text: string) => Promise<void>): Promise<NumberCheck[]> {
  const checks: NumberCheck[] = [], e = expectedOutputNumbers(snapshot, now), cid = snapshot.campaign.id;
  const js = await browserBundle();
  const css = (await postcss([tailwindcss({ config: resolve("tailwind.config.ts") })]).process(await readFile("client/src/index.css", "utf8"), { from: resolve("client/src/index.css") })).css;
  const server = createServer((req, res) => {
    res.setHeader("Content-Type", req.url === "/monitor.js" ? "application/javascript" : req.url === "/monitor.css" ? "text/css" : "text/html");
    res.end(req.url === "/monitor.js" ? js : req.url === "/monitor.css" ? css : '<html><head><link rel="stylesheet" href="/monitor.css"></head><body><div id="root"></div><script type="module" src="/monitor.js"></script></body></html>');
  });
  await new Promise<void>(r => server.listen(0, "127.0.0.1", r));
  const origin = `http://127.0.0.1:${(server.address() as any).port}`;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    browser = await chromium.launch({ headless: true, args: ["--disable-dev-shm-usage"] });
    const context = await browser.newContext({ viewport: { width: 1500, height: 1000 }, locale: "en-US", timezoneId: snapshot.campaign.reportingTimeZone || "Europe/Amsterdam" });
    await context.addInitScript(() => { Object.defineProperty(window, "showSaveFilePicker", { value: undefined, configurable: true }); });
    const page = await context.newPage(); page.setDefaultTimeout(10_000);
    let errors = 0, denied = 0;
    page.on("pageerror", () => errors++);
    await context.route("**/*", async route => {
      const req = route.request(), url = new URL(req.url());
      if (url.origin !== origin) { denied++; return route.abort(); }
      if (!url.pathname.startsWith("/api/")) {
        if (url.pathname.endsWith(".jpg")) {
          try { return await route.fulfill({ contentType: "image/jpeg", body: await readFile(resolve("client/public", url.pathname.slice(1))) }); } catch { return route.abort(); }
        }
        return route.continue();
      }
      // Opening Notifications normally requests reconciliation (a write). The
      // read-only monitor checks missing/extra alerts separately, never runs it.
      if (req.method() === "POST" && url.pathname === `/api/campaigns/${cid}/ga4-notifications/reconcile`)
        return route.fulfill({ json: { success: true, campaignId: cid } });
      if (req.method() !== "GET") { denied++; return route.abort(); }
      try {
        const result = await read(url.pathname + url.search);
        return route.fulfill({ status: result.status, json: result.body });
      } catch { denied++; return route.fulfill({ status: 503, json: { error: "Monitor read unavailable" } }); }
    });
    const settle = async () => {
      await page.evaluate(() => { (window as any).__monitorIdleSince = undefined; });
      await page.waitForFunction(() => {
        const state = window as any;
        if (typeof state.__monitorQueries !== "function" || state.__monitorQueries() !== 0) { state.__monitorIdleSince = undefined; return false; }
        state.__monitorIdleSince ??= Date.now();
        return Date.now() - state.__monitorIdleSince >= 500;
      }, undefined, { timeout: 45_000 });
    };
    const visit = async (path: string) => {
      await page.goto(origin + path);
      await settle();
      await observe?.("screen", path.split("/").at(-1)!, await page.locator("body").innerText());
    };
    const cards = async (section: string, values: [string, number | null, number?, boolean?][]) => {
      for (const [label, wanted, decimals, money] of values) {
        if (section === "Screen GA4 Overview" && label === "Profit" && (e.revenue === null || e.spend === null)) {
          checks.push({ section, code: "PROFIT_HIDDEN_WITHOUT_REQUIRED_INPUTS", status: await page.getByText("Profit", { exact: true }).count() === 0 ? "passed" : "difference" });
        } else checks.push(checkDisplayedNumber(section, label.toUpperCase().replace(/[^A-Z0-9]/g, "_"), wanted, await cardValue(page, label), decimals ?? 2, money ? e.scope.currency : undefined));
      }
    };
    const tableText = async () => {
      const rows = await page.locator("table:visible tr").evaluateAll(rows => rows.map(row => [...row.querySelectorAll("th,td")].map(cell => cell.textContent?.trim().replace(/\s+/g, " ") || "").join(" ")));
      const symbol = new Intl.NumberFormat("en-US", { style: "currency", currency: e.scope.currency }).formatToParts(1).find(p => p.type === "currency")!.value;
      return rows.join("\n").replaceAll(symbol, e.scope.currency + " ");
    };
    const charts = async (section: string, mode: "campaign" | "daily", metric = "sessions") => {
      const series: any[] = await page.evaluate(() => Object.values((window as any).__monitorCharts || {}));
      const pointCount = series.reduce((sum,chart) => sum + (chart.data?.length || 0),0);
      if(mode === "campaign") checks.push(compareNumber(section,"CHART_POINTS",Math.min(10,expectedBrowserCampaignRows(snapshot,now).length),pointCount));
      checks.push({section,code:"CHART_SVG_RENDERED",status:pointCount === 0 || await page.locator('svg.recharts-surface:visible').count() > 0 ? "passed" : "difference"});
      await observe?.("charts", mode, JSON.stringify(series));
      for (const chart of series) for (const row of chart.data || []) {
        const source = mode === "daily" ? e.daily.find(d => d.date === row.date || d.date.slice(5) === row.date)
          : expectedBrowserCampaignRows(snapshot, now).find(d => d.name === (row.fullName || row.name));
        if ("value" in row) {
          const wanted = !source ? null : metric === "engagementRate" ? Number((source as any).engagementRate) * 100 : Number((source as any)[metric]);
          checks.push(checkDisplayedNumber(section, "CHART_" + metric.toUpperCase(), wanted, row.value === null ? "Unavailable" : String(row.value), ["sessions", "users", "pageviews"].includes(metric) ? 0 : 2));
        }
        else for (const metric of ["sessions", "users", "conversions"]) if (metric in row) checks.push(compareNumber(section, "CHART_" + metric.toUpperCase(), source?.[metric], row[metric], { decimals: metric === "conversions" ? undefined : 0, conversions: metric === "conversions", operations: 10000 }));
      }
    };
    const financial: [string, number | null, number?, boolean?][] = [["Total Revenue", e.revenue, 2, true], ["Total Spend", e.spend, 2, true], ["Profit", e.profit, 2, true], ["ROAS", e.roas], ["ROI", e.roi, 1], ["CPA", e.cpa, 2, true]];
    await visit(`/campaigns/${cid}/ga4-metrics?readOnly=1`);
    if(observe) await observe("image","overview",(await page.screenshot()).toString("base64"));
    await cards("Screen GA4 Overview", [["Sessions", e.totals.sessions, 0], ["Users", e.totals.users, 0], ["Conversions", e.totals.conversions], ["Engagement Rate", e.engagementRate === null ? null : e.engagementRate * 100, 1], ["Conv. Rate", e.cvr, 1], ...financial]);
    checks.push(...checkReportDetailText(snapshot, await tableText(), "overview", now).filter(c => c.code !== "REVENUE_SOURCE_AMOUNT").map(c => ({ ...c, section: "Screen GA4 Overview tables" })));
    for (const [kind, sources] of [["revenue", e.revenueSources], ["spend", e.spendSources]] as const) {
      const title = kind === "revenue" ? "Total Revenue" : "Total Spend";
      const parent = page.getByText(title, { exact: true }).first().locator("xpath=../..");
      const button = parent.getByRole("button", { name: /^Sources \(/ });
      if (!await button.count()) { if (sources.length) checks.push({ section: "Screen source details", code: kind.toUpperCase() + "_LIST_MISSING", status: "difference" }); continue; }
      await button.click(); const dialog = page.getByRole("dialog"); await dialog.waitFor();
      const text = await dialog.innerText();
      await observe?.("source", kind, text);
      for (const source of sources) {
        const original = snapshot.rows[kind + "Sources"].find(r => r.id === source.id);
        const name = kind === "revenue" && ["shopify", "google_sheets", "csv", "ga4"].includes(original?.sourceType)
          ? ({ shopify: "Shopify", google_sheets: "Google Sheets", csv: "CSV", ga4: "Imported GA4 Revenue" } as Record<string, string>)[original.sourceType]
          : original?.displayName || original?.sourceType;
        const amount = await dialog.evaluate((root, name) => {
          const leaves=[...root.querySelectorAll('p,span,div')].filter(el=>el.children.length===0);
          const headings=[...root.querySelectorAll('p[title]')].filter(el=>el.textContent?.trim()===name);
          const labels=headings.length?headings:leaves.filter(el=>el.textContent?.trim()===name), label=labels.length===1?labels[0]:undefined;
          let parent=label?.parentElement;
          for(let i=0;parent&&i<5;i++,parent=parent.parentElement){
            const values=[...parent.querySelectorAll('p,span,div')].filter(el=>el.children.length===0 && /^(?:Unavailable|[€$£]|[A-Z]{3} )/.test(el.textContent?.trim()||''));
            if(values.length===1)return values[0].textContent?.trim()||null;
            if(values.length>1)break;
          }return null;
        }, name);
        checks.push({ ...checkDisplayedNumber("Screen source details",kind.toUpperCase()+"_SOURCE_VALUE",source.value,amount,2,e.scope.currency),subject:monitorHash(source.id) });
      }
      await page.keyboard.press("Escape"); await dialog.waitFor({ state: "hidden" });
    }
    for (const [tab, label] of [["kpis", "KPIs"], ["benchmarks", "Benchmarks"], ["campaigns", "Campaign Comparison"], ["insights", "Insights"], ["reports", "Reports"]]) {
      await page.getByRole("tab", { name: label, exact: true }).click();
      await settle();
      const text = await page.locator('[role="tabpanel"][data-state="active"]').innerText();
      await observe?.("screen", tab, text);
      checks.push({ section: `Screen GA4 ${label}`, code: "RENDERED_WITHOUT_INVALID_NUMBERS", status: text.length > 20 && !/\b(NaN|Infinity|undefined)\b/.test(text) ? "passed" : "difference" });
      if (["kpis", "benchmarks"].includes(tab)) for (const target of expectedTargetNumbers(snapshot, now).filter(t => t.kind === tab)) {
        const name = target.row.name, subject = monitorHash(target.row.id);
        checks.push({ section: `Screen GA4 ${label}`, code: "TARGET_PRESENT", subject, status: text.includes(name) ? "passed" : "difference" });
        if (target.verified) {
          const scope = `ga4-${tab === "kpis" ? "kpi" : "benchmark"}-${target.row.id}`;
          for (const [caption, expected] of [[tab === "kpis" ? "Current" : "Current Value", target.current], [tab === "kpis" ? "Target" : "Benchmark Value", target.target]] as const) {
            const actual = await cardValue(page, caption, scope);
            checks.push({ ...checkDisplayedNumber(`Screen GA4 ${label}`, `${caption.toUpperCase().replaceAll(" ", "_")}_${target.identity.toUpperCase()}`, expected, actual, ["users", "sessions", "pageviews"].includes(target.identity) ? 0 : ["conversion_rate", "engagement_rate"].includes(target.identity) ? 1 : 2, ["revenue", "cpa"].includes(target.identity) ? e.scope.currency : undefined), subject });
          }
        }
      }
      if (tab === "campaigns") {
        for (const [metric, title] of [["sessions", "Sessions"], ["users", "Users"], ["conversions", "Conversions"], ["revenue", "Revenue"], ["conversionRate", "Conversion Rate"]]) {
          if (metric !== "sessions") { await page.getByRole("tabpanel").getByRole("combobox").click(); await page.getByRole("option", { name: `${title} (High to Low)`, exact: true }).click(); }
          await charts("Screen GA4 Campaign Comparison", "campaign", metric);
        }
      }
      if (tab === "insights") {
        await cards("Screen GA4 Insights", financial.map(([label, v, d, m]) => [label.replace("Total ", ""), v, d, m]).filter(v => v[0] !== "CPA") as typeof financial);
        await charts("Screen GA4 Insights", "daily");
        checks.push(...checkNarrativeWindows(snapshot, text, now));
      }
    }
    // Exercise the actual browser PDF closure, including FileSaver's download.
    const reports = ["overview", "kpis", "benchmarks", "ads", "insights"].map(reportType => ({ reportType, configuration: undefined as any, reportName: "Monitor verification" }));
    reports.push({ reportType: "custom", reportName: "Monitor verification", configuration: {
      sections: { overview: true, kpis: true, benchmarks: true, ads: true, insights: true },
      subsections: { overview: { summary: true, revenue: true, spend: true, performance: true, campaignBreakdown: true, landingPages: true, conversionEvents: true }, kpis: { items: true }, benchmarks: { items: true }, ads: { topCampaigns: true, bestWorst: true, revenueBreakdown: true }, insights: { summaryCards: true, trends: true, dataSummary: true, actions: true } },
      selectedKpiIds: (snapshot.rows.kpis || []).map(r => r.id), selectedBenchmarkIds: (snapshot.rows.benchmarks || []).map(r => r.id),
    } });
    for (const report of (snapshot.rows.linkedinReports || []).filter(r => r.platformType === "google_analytics").slice(0, 20)) reports.push({ ...report, configuration: typeof report.configuration === "string" ? JSON.parse(report.configuration) : report.configuration, reportName: report.name });
    for (const report of reports) {
      const section = `Browser ${report.reportType} PDF`;
      try {
        const downloaded = page.waitForEvent("download", { timeout: 15_000 });
        const generated = page.evaluate(async opts => { const fn = (window as any).__monitorPdf; if (!fn) throw new Error("Missing exporter"); return fn(opts); }, report);
        const [download] = await Promise.all([downloaded, generated]);
        const stream = await download.createReadStream(); if (!stream) throw new Error();
        const chunks: Buffer[] = []; let size = 0;
        for await (const chunk of stream) { size += chunk.length; if (size > 5_000_000) throw new Error(); chunks.push(chunk); }
        const parser = new PDFParse({ data: Buffer.concat(chunks) });
        try {
          const result = await parser.getText(); if (result.total > 100 || result.text.length > 1_000_000) throw new Error();
          await observe?.("pdf", report.reportType, result.text);
          const found = report.configuration
            ? report.reportType === "custom" && report === reports[5]
              ? [...checkBrowserReportText(snapshot, result.text.split("Key Performance Indicators")[0], "overview", now), ...checkBrowserReportText(snapshot, result.text, "kpis", now), ...checkBrowserReportText(snapshot, result.text, "benchmarks", now), ...checkBrowserReportText(snapshot, result.text.slice(result.text.indexOf("Executive Financials")), "insights", now)]
              : report.reportType === "custom" ? checkConfiguredReportText(snapshot, result.text, { campaignId: cid, id: "monitor-browser", platformType: "google_analytics", ...report }, now) : checkBrowserReportText(snapshot,result.text,report.reportType,now)
            : checkBrowserReportText(snapshot, result.text, report.reportType, now);
          checks.push(...found.map(c => ({ ...c, section })), ...checkNarrativeWindows(snapshot, result.text, now), { section, code: "ACTUAL_BROWSER_DOWNLOAD", status: "passed" });
        } finally { await parser.destroy(); await download.delete(); }
      } catch (error) { await observe?.("error", report.reportType, String(error)); checks.push({ section, code: "BROWSER_EXPORT_FAILED", status: "unverified" }); }
    }
    await visit(`/reports?campaignId=${encodeURIComponent(cid)}`);
    const libraryText = await page.locator("main").innerText();
    for (const report of (snapshot.rows.linkedinReports || []).filter(r => r.platformType === "campaign_deepdive")) checks.push({ section: "Screen Reports library", code: "CONFIGURED_REPORT_VISIBLE", subject: monitorHash(report.id), status: libraryText.includes(report.name) ? "passed" : "difference" });
    checks.push({ section: "Screen Reports library", code: "LIBRARY_RENDERED", status: libraryText.includes("Reports") ? "passed" : "difference" });
    for (const [route, label] of [["performance", "Performance Summary"], ["financial-analysis", "Budget & Financial"], ["trend-analysis", "Trend Analysis"], ["executive-summary", "Executive Summary"]]) {
      await visit(`/campaigns/${cid}/${route}`);
      const text = await page.locator("main").innerText();
      checks.push({ section: `Screen ${label}`, code: "RENDERED_WITHOUT_INVALID_NUMBERS", status: text.length > 40 && !/\b(NaN|Infinity|undefined)\b/.test(text) ? "passed" : "difference" });
      if (route === "financial-analysis") await cards(`Screen ${label}`, financial);
      else if (route === "performance") await cards(`Screen ${label}`, [["Total Users", e.totals.users, 0], ["Total Sessions", e.totals.sessions, 0], ["Total Conversions", e.totals.conversions], ...financial.slice(0, 2)]);
      else if (route === "executive-summary") await cards(`Screen ${label}`, [["Users", e.totals.users, 0], ["Sessions", e.totals.sessions, 0], ["Conversions", e.totals.conversions], ["Revenue", e.revenue, 0, true]]);
      else await cards(`Screen ${label}`, [["Revenue", e.revenue, 2, true], ["Spend", e.spend, 2, true], ["ROAS", e.roas], ["ROI", e.roi, 1]]);
    }
    const notifications = (Array.isArray(outputs.notifications) ? outputs.notifications : outputs.notifications?.notifications || []).filter((n: any) => n.campaignId === cid);
    for (const item of notifications) {
      await visit(`/notifications?selected=${encodeURIComponent(item.id)}`);
      const card = page.getByTestId(`notification-${item.id}`), subject = monitorHash(item.id);
      const present = await card.count() === 1;
      const text = present ? (await card.innerText()).replace(/\s+/g, " ") : "";
      checks.push({ section: "Screen Notifications", code: "ALERT_TITLE_AND_CAMPAIGN", subject, status: present && text.includes(item.title) && text.includes(snapshot.campaign.name) ? "passed" : "difference" });
      const meta = typeof item.metadata === "string" ? JSON.parse(item.metadata) : item.metadata;
      if (meta?.kpiId || meta?.benchmarkId) {
        const target = expectedTargetNumbers(snapshot, now).find(t => t.row.id === (meta.benchmarkId || meta.kpiId));
        if (!target?.verified) checks.push({ section: "Screen Notifications", code: "ALERT_INPUTS_UNVERIFIED", subject, status: "unverified" });
        else {
          const unit = target.row.unit, currency = unit === "$" ? "USD" : /^[A-Z]{3}$/.test(unit || "") ? unit : undefined;
          const current = text.match(/Current value:\s*(.*?)\s*Threshold value:/)?.[1]?.replace(/s$/, "") || null;
          const threshold = text.match(/Threshold value:\s*(?:above|below|equal to)\s*(.*?)\s*Created date:/)?.[1]?.replace(/s$/, "") || null;
          checks.push({ ...checkDisplayedNumber("Screen Notifications", "ALERT_CURRENT", target.current, current, 4, currency), subject },
            { ...checkDisplayedNumber("Screen Notifications", "ALERT_THRESHOLD", Number(target.row.alertThreshold), threshold, 4, currency), subject },
            { section: "Screen Notifications", code: "ALERT_CONDITION", subject, status: text.includes(`Threshold value: ${target.row.alertCondition === "above" ? "above" : target.row.alertCondition === "equals" ? "equal to" : "below"} `) ? "passed" : "difference" });
        }
        await page.getByTestId(`button-view-alert-${item.id}`).click();
        const url = new URL(page.url());
        checks.push({ section: "Screen Notifications", code: "ALERT_NAVIGATION_SCOPE", subject, status: url.pathname === `/campaigns/${cid}/ga4-metrics` && url.searchParams.get("tab") === (meta.benchmarkId ? "benchmarks" : "kpis") && url.searchParams.get("highlight") === (meta.benchmarkId || meta.kpiId) ? "passed" : "difference" });
      }
    }
    if (!notifications.length) { await visit("/notifications"); checks.push({ section: "Screen Notifications", code: "EMPTY_ALERT_LIST", status: await page.locator('[data-testid^="notification-"]').count() === 0 && await page.getByText("No active alerts found", { exact: true }).count() === 1 ? "passed" : "difference" }); }
    checks.push({ section: "Browser safety", code: "NO_PAGE_ERRORS", status: errors ? "difference" : "passed" }, { section: "Browser safety", code: "READ_ONLY_BOUNDARY", status: denied ? "unverified" : "passed" });
    return checks;
  } finally { await browser?.close(); server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); }
}
