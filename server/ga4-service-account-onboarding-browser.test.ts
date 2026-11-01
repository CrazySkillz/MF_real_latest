import { build } from "esbuild";
import { chromium, expect as browserExpect, type Browser } from "@playwright/test";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Exercise the real auth component with synthetic HTTP only; no app, DB or Google access.
describe("GA4 service-account onboarding choice", () => {
  let bundle: string, browser: Browser;
  beforeAll(async () => {
    const result = await build({
      stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client';
        import {IntegratedGA4Auth} from './client/src/components/IntegratedGA4Auth';
        window.open=()=>({closed:false,close(){this.closed=true}});
        function App(){const [campaign,setCampaign]=React.useState('a'),[done,setDone]=React.useState(false),[error,setError]=React.useState('');
          return <><button onClick={()=>setCampaign('b')}>Change campaign</button>
            {done ? <p>Continue to property selection</p> : <IntegratedGA4Auth campaignId={campaign}
              connectionMode={window.fixture.mode} onSuccess={()=>setDone(true)} onError={setError}/>}
            <p role="status">{error}</p></>;}
        createRoot(document.getElementById('root')).render(<App/>);`, loader: "tsx", resolveDir: process.cwd() },
      bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic",
      define: { "process.env.NODE_ENV": '"test"', "import.meta.env": "{}" },
    });
    bundle = result.outputFiles[0].text;
    browser = await chromium.launch({ headless: true });
  }, 60_000);
  afterAll(async () => { await browser?.close(); });

  async function fixture(options: { enabled?: boolean; statusCode?: number; delayed?: boolean; connectCode?: number; mode?: string } = {}) {
    const context = await browser.newContext({ serviceWorkers: "block" });
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    const errors: string[] = [], posts: Array<{ path: string; body: any }> = [], statusReads: string[] = [];
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    page.on("pageerror", error => errors.push(error.message));
    await context.route("**/*", async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.hostname !== "ga4-onboarding-fixture.test") { errors.push(`Blocked host: ${url.hostname}`); await route.abort(); return; }
      if (url.pathname === "/") { await route.fulfill({ contentType: "text/html", body: `<html><body><div id="root"></div><script>window.fixture=${JSON.stringify({ mode: options.mode })}</script><script src="/fixture.js"></script></body></html>` }); return; }
      if (url.pathname === "/fixture.js") { await route.fulfill({ contentType: "application/javascript", body: bundle }); return; }
      let status = 200, data: any;
      if (request.method() === "GET" && /^\/api\/campaigns\/[ab]\/ga4-service-account\/status$/.test(url.pathname)) {
        statusReads.push(url.pathname);
        if (options.delayed && url.pathname.includes("/a/")) await pending;
        status = options.statusCode || 200;
        data = { enabled: !url.pathname.includes("/b/") && options.enabled !== false, email: "fixture-reader@example.invalid" };
      } else if (request.method() === "POST" && url.pathname === "/api/campaigns/a/ga4-service-account/connect") {
        posts.push({ path: url.pathname, body: request.postDataJSON() });
        status = options.connectCode || 200;
        data = status === 200 ? { success: true } : { success: false, message: status === 403 ? "This property is not approved for this client." : "Google Analytics could not validate this property." };
      } else if (request.method() === "POST" && url.pathname === "/api/auth/ga4/connect") {
        posts.push({ path: url.pathname, body: request.postDataJSON() });
        data = { authUrl: "http://ga4-onboarding-fixture.test/oauth" };
      } else { errors.push(`Unexpected request: ${request.method()} ${url.pathname}`); await route.abort(); return; }
      await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
    });
    await page.goto("http://ga4-onboarding-fixture.test/");
    return { page, posts, statusReads, release, close: async () => { release(); await context.close(); expect(errors).toEqual([]); } };
  }

  it("keeps OAuth usable while discovering the alternative without any automatic connection", async () => {
    const f = await fixture({ delayed: true });
    try {
      await browserExpect(f.page.getByRole("button", { name: "Connect Google Analytics", exact: true })).toBeEnabled();
      await browserExpect(f.page.getByRole("button", { name: "Use service-account access" })).toBeDisabled();
      await browserExpect(f.page.getByText(/Loading|Checking connection/)).toHaveCount(0);
      expect(f.posts).toEqual([]);
      f.release();
      await browserExpect(f.page.getByRole("button", { name: "Use service-account access" })).toBeEnabled();
      expect(f.posts).toEqual([]);
    } finally { await f.close(); }
  });

  it("connects only the entered property and returns to the existing success continuation", async () => {
    const f = await fixture();
    try {
      await f.page.getByRole("button", { name: "Use service-account access" }).click();
      await browserExpect(f.page.getByText(/fixture-reader@example.invalid/)).toContainText("approved for this client");
      await browserExpect(f.page.getByRole("button", { name: "Connect Google Analytics", exact: true })).toBeDisabled();
      await f.page.getByLabel("GA4 Property ID").fill("properties/123456789");
      await f.page.getByRole("button", { name: "Connect Google Analytics", exact: true }).click();
      await browserExpect(f.page.getByText("Continue to property selection")).toBeVisible();
      expect(f.posts).toEqual([{ path: "/api/campaigns/a/ga4-service-account/connect", body: { propertyId: "123456789", lookbackDays: 30 } }]);
    } finally { await f.close(); }
  });

  it.each([403, 502])("does not advance after a %s response and allows return to OAuth", async connectCode => {
    const f = await fixture({ connectCode });
    try {
      await f.page.getByRole("button", { name: "Use service-account access" }).click();
      await f.page.getByLabel("GA4 Property ID").fill("123456789");
      await f.page.getByRole("button", { name: "Connect Google Analytics", exact: true }).click();
      await browserExpect(f.page.getByRole("status")).toContainText(connectCode === 403 ? "not approved" : "could not validate");
      await browserExpect(f.page.getByText("Continue to property selection")).toHaveCount(0);
      await f.page.getByRole("button", { name: "Use Google sign-in" }).click();
      await browserExpect(f.page.getByText("Secure Google Sign-In")).toBeVisible();
      expect(f.posts).toHaveLength(1);
    } finally { await f.close(); }
  });

  it.each([{ enabled: false }, { statusCode: 403 }, { statusCode: 503 }])("preserves OAuth when shared access is unavailable: %j", async options => {
    const f = await fixture(options);
    try {
      await expect.poll(() => f.statusReads.length).toBe(1);
      await browserExpect(f.page.getByRole("button", { name: "Use service-account access" })).toBeDisabled();
      await f.page.getByRole("button", { name: "Connect Google Analytics", exact: true }).click();
      await browserExpect(f.page.getByRole("button", { name: "Waiting for Google..." })).toBeDisabled();
      expect(f.posts).toEqual([{ path: "/api/auth/ga4/connect", body: { campaignId: "a" } }]);
    } finally { await f.close(); }
  });

  it("does not use an old campaign's delayed availability for a different campaign", async () => {
    const f = await fixture({ delayed: true });
    try {
      await expect.poll(() => f.statusReads.length).toBe(1);
      await f.page.getByRole("button", { name: "Change campaign" }).click();
      await expect.poll(() => f.statusReads.length).toBe(2);
      // Wait for the old response and its React updates before asserting it was ignored.
      const oldResponse = f.page.waitForResponse(response => response.url().includes("/campaigns/a/ga4-service-account/status"));
      f.release();
      await oldResponse;
      await f.page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await browserExpect(f.page.getByRole("button", { name: "Use service-account access" })).toBeDisabled();
      expect(f.posts).toEqual([]);
    } finally { await f.close(); }
  });

  it("retains the existing explicit service-account mode", async () => {
    const f = await fixture({ mode: "service-account" });
    try {
      await f.page.getByRole("button", { name: "Connect Google Analytics", exact: true }).click();
      await browserExpect(f.page.getByLabel("GA4 Property ID")).toBeVisible();
      await browserExpect(f.page.getByText("Secure Google Sign-In")).toHaveCount(0);
      expect(f.posts).toEqual([]);
    } finally { await f.close(); }
  });
});
