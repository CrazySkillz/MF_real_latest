const fs = require("node:fs"), ts = require("typescript"), assert = require("node:assert/strict");
const http = require("node:http"), path = require("node:path");
const { chromium } = require("playwright"), esbuild = require("esbuild");
const compile = code => ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const source = ts.createSourceFile("routes.ts", fs.readFileSync("server/routes-oauth.ts", "utf8"), ts.ScriptTarget.Latest, true);
const routes = new Map(), names = new Map();
function visit(n) {
  if (ts.isCallExpression(n) && n.expression.getText(source) === "app.get" && ts.isStringLiteral(n.arguments[0])) routes.set(n.arguments[0].text, n.arguments.at(-1).getText(source));
  if (ts.isVariableDeclaration(n)) names.set(n.name.getText(source), `const ${n.getText(source)};`);
  ts.forEachChild(n, visit);
}
visit(source);
const popupHelpers = ["serializeOAuthPopupJson", "escapeOAuthPopupHtml"].map(n => names.get(n)).join("\n");
const appSource = ts.createSourceFile("App.tsx", fs.readFileSync("client/src/App.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const app = appSource.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === "App").getText(appSource);
const harness = `
import React, {useEffect, useMemo, useState} from "react";
import {createRoot} from "react-dom/client";
import {QueryClientProvider, useQueryClient} from "@tanstack/react-query";
import {createAppQueryClient} from "./client/src/lib/queryClient";
import {ClientProvider, useClient} from "./client/src/lib/clientContext";
import {useAuth, AuthProvider} from "@clerk/clerk-react";
const ErrorBoundary=({children})=>children, TooltipProvider=ErrorBoundary, ClerkLoaded=ErrorBoundary;
const Toaster=()=>null, ClerkLoading=()=>null, AuthPage=()=> <div>Signed out</div>, PrivacyPolicy=()=>null, Redirect=()=>null;
const SignedIn=({children})=>useAuth().userId?children:null, SignedOut=({children})=>useAuth().userId?null:children;
const Switch=ErrorBoundary, Route=({path,children})=>path?null:children;
window.observations=[]; window.savedClients={};
function Probe(){
 const {userId}=useAuth(); const context=useClient(); const client=useQueryClient();
 window.savedClients[userId]=client; window.selectClient=context.setSelectedClientId;
 useEffect(()=>{window.observations.push({userId,ids:context.clients.map(c=>c.id),selected:context.selectedClientId})});
 return <div id="probe">{JSON.stringify({userId,ids:context.clients.map(c=>c.id),selected:context.selectedClientId})}</div>;
}
function ProtectedRouter(){return <ClientProvider><Probe/></ClientProvider>}
${app}
window.fetch=(url,{signal}={})=>new Promise((resolve,reject)=>{
 const owner=window.currentOwner;
 const timer=setTimeout(()=>resolve(new Response(JSON.stringify([{id:owner+"-1",name:owner},{id:owner+"-2",name:owner}]),{status:200,headers:{"Content-Type":"application/json"}})),owner==="slow"?250:0);
 signal?.addEventListener("abort",()=>{clearTimeout(timer);reject(new DOMException("Aborted","AbortError"))},{once:true});
});
function Fixture(){
 const [userId,setUser]=useState("a"); window.currentOwner=userId;
 window.switchAccount=setUser;
 return <AuthProvider value={{userId}}><App/></AuthProvider>
}
localStorage.setItem("selectedClientId","foreign-global-client");
createRoot(document.getElementById("root")).render(<Fixture/>);
`;
(async () => {
  const bundle = await esbuild.build({ stdin: { contents: harness, loader: "tsx", resolveDir: process.cwd() }, bundle: true, write: false, platform: "browser", jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' }, plugins: [{ name: "fixture-auth", setup(build) {
      build.onResolve({ filter: /^@clerk\/clerk-react$/ }, () => ({ path: "auth", namespace: "fixture" }));
      build.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: 'import {createContext,useContext} from "react"; const Context=createContext({userId:null}); export const AuthProvider=Context.Provider; export const useAuth=()=>useContext(Context);', resolveDir: process.cwd(), loader: "js" }));
    } }] });
  const server = http.createServer((req, res) => {
    res.setHeader("Content-Type", req.url === "/fixture.js" ? "application/javascript" : "text/html");
    res.end(req.url === "/fixture.js" ? bundle.outputFiles[0].text : '<div id="root"></div><script src="/fixture.js"></script>');
  });
  server.listen(0, "127.0.0.1"); await new Promise(resolve => server.once("listening", resolve));
  const browser = await chromium.launch({ headless: true }), results = [];
  try {
    const origin = `http://127.0.0.1:${server.address().port}`;
    const context = await browser.newContext();
    await context.route("**/*", route => route.request().url().startsWith(origin + "/") ? route.continue() : route.abort());
    const marker = "</script><script>window.__untrusted=731</script><script>";
    for (const [provider, field] of [["salesforce", "error"], ["salesforce", "error_description"], ["linkedin", "error_description"], ["meta", "error_description"], ["google", "error"], ["google", "state"]]) {
      const endpoint = provider === "google" && field === "state" ? "/api/auth/google/simulation-auth" : `/api/auth/${provider}/callback`;
      const handler = new Function("console", compile(popupHelpers + "\nreturn (" + routes.get(endpoint) + ");"))({ error() {}, log() {} });
      let html; await handler({ query: { error: "access_denied", [field]: marker } }, { send(v) { html = v; }, status() { return this; } });
      const page = await context.newPage(); await page.setContent(html);
      assert.equal(await page.evaluate(() => window.__untrusted ?? null), null);
      await page.close(); results.push({ name: endpoint + " " + field, result: "PASS", markerExecuted: false });
    }
    const page = await context.newPage(), errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(origin);
    await page.waitForFunction(() => document.querySelector("#probe")?.textContent.includes('"selected":"a-1"'), undefined, { timeout: 5000 }).catch(async error => {
      console.error(JSON.stringify({ errors, body: await page.locator("body").textContent() })); throw error;
    });
    await page.evaluate(() => window.selectClient("a-2"));
    await page.waitForFunction(() => document.querySelector("#probe")?.textContent.includes('"selected":"a-2"'));
    await page.evaluate(() => window.switchAccount("b"));
    await page.waitForFunction(() => document.querySelector("#probe")?.textContent.includes('"selected":"b-1"'));
    await page.evaluate(() => window.savedClients.a.setQueryData(["/api/clients"], [{ id: "a-late", name: "Old owner" }]));
    assert.ok((await page.locator("#probe").textContent()).includes('"selected":"b-1"'));
    await page.evaluate(() => window.switchAccount("slow"));
    await page.waitForFunction(() => document.querySelector("#probe")?.textContent.includes('"userId":"slow"'));
    await page.evaluate(() => window.switchAccount("b"));
    await page.waitForFunction(() => document.querySelector("#probe")?.textContent.includes('"selected":"b-1"'));
    await page.waitForTimeout(300);
    await page.evaluate(() => window.switchAccount(null));
    await page.waitForFunction(() => !document.querySelector("#probe"));
    await page.evaluate(() => window.switchAccount("a"));
    await page.waitForFunction(() => document.querySelector("#probe")?.textContent.includes('"selected":"a-2"'));
    const observations = await page.evaluate(() => window.observations);
    assert.ok(observations.every(o => o.ids.every(id => id.startsWith(o.userId + "-"))));
    assert.deepEqual(errors, []);
    results.push({ name: "Exact App account cache boundary and ClientProvider: switch, late request, signout and account-specific selection", result: "PASS", observations });
    fs.writeFileSync("docs/fixes/v1-batch-1/browser-after.json", JSON.stringify({ at: new Date().toISOString(), boundary: "Local Chromium, current callbacks/App/ClientProvider/query defaults; fixture identity/API responses; all external browser requests blocked. Does not validate Clerk deployment.", results }, null, 2) + "\n");
    console.log(`${results.length} browser checks passed`);
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
