import { build } from 'esbuild';
import { chromium, expect as browserExpect, type Browser } from '@playwright/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('Shopify order history wizard in Chromium with isolated HTTP', () => {
  let bundle: string, browser: Browser;
  beforeAll(async () => {
    const result = await build({ stdin: { contents: `import React from 'react';import {createRoot} from 'react-dom/client';
      import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
      import {ShopifyRevenueWizard} from './client/src/components/ShopifyRevenueWizard';
      const edit=location.search.includes('edit');
      createRoot(document.getElementById('root')).render(<QueryClientProvider client={new QueryClient()}><ShopifyRevenueWizard campaignId="a" platformContext="ga4"
      {...(edit?{mode:'edit',sourceId:'shopify-source',initialMappingConfig:{campaignField:'tags',selectedValues:['campaign3_eur_test']}}:{})}
      onSuccess={value=>window.fixtureSaved=value}/></QueryClientProvider>);`, loader: 'tsx', resolveDir: process.cwd() },
      bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"test"', 'import.meta.env': '{}' } });
    bundle = result.outputFiles[0].text; browser = await chromium.launch({ headless: true });
  }, 60_000);
  afterAll(async () => browser?.close());
  async function fixture(edit = false, blocked = false) {
    const context = await browser.newContext({ viewport: { width: 1400, height: 1000 }, serviceWorkers: 'block' });
    const page = await context.newPage(), requests: URL[] = [], bodies: any[] = [], errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.hostname !== 'shopify-window-fixture.test') { errors.push(`Blocked external request ${url.hostname}`); await route.abort(); return; }
      if (url.pathname === '/fixture.js') { await route.fulfill({ contentType: 'application/javascript', body: bundle }); return; }
      if (!url.pathname.startsWith('/api/')) { await route.fulfill({ contentType: 'text/html', body: '<html><body><div id="root"></div><script src="/fixture.js"></script></body></html>' }); return; }
      requests.push(url); let json: any = {};
      if (url.pathname.endsWith('/status')) json = { connected: true, oauthAvailable: true, authType: 'oauth', shopName: 'Fixture', shopDomain: 'fixture.myshopify.com', orderWindow: { mode: 'recent', eligible: !blocked, campaignStart: blocked ? '2026-09-28' : '2026-08-26', cutoff: blocked ? '2026-09-29' : '2026-08-26' } };
      else if (url.pathname.endsWith('/unique-values')) json = { success: true, values: [{ value: 'campaign3_eur_test', count: 1 }] };
      else if (url.pathname.endsWith('/shopify/save-mappings')) { bodies.push(request.postDataJSON()); json = { success: true, currency: 'EUR', totalRevenue: 785.95, totalConversions: 1, campaignValueRevenueTotals: [{ campaignValue: 'campaign3_eur_test', revenue: 785.95 }] }; }
      else if (request.method() !== 'GET') { errors.push(`Unexpected mutation ${url.pathname}`); await route.abort(); return; }
      await route.fulfill({ json });
    });
    await page.goto(`https://shopify-window-fixture.test/${edit ? '?edit' : ''}`);
    return { page, requests, bodies, errors, close: () => context.close() };
  }
  it('passes GA4 context, selects Tags and submits the EUR785.95 preview', async () => {
    const f = await fixture();
    try {
      await browserExpect(f.page.getByText('Orders from 2026-08-26 are available.', { exact: false })).toBeVisible();
      await f.page.getByRole('combobox').click(); await f.page.getByRole('option', { name: 'Tags', exact: true }).click();
      await f.page.getByRole('button', { name: 'Continue', exact: true }).click();
      await f.page.getByRole('button', { name: /campaign3_eur_test/ }).click();
      await f.page.getByRole('button', { name: 'Continue', exact: true }).click();
      await f.page.getByRole('button', { name: 'Continue', exact: true }).click();
      await browserExpect(f.page.getByRole('button', { name: 'Import revenue' })).toBeEnabled();
      await browserExpect(f.page.getByText('€785.95', { exact: true }).first()).toBeVisible();
      await f.page.getByRole('button', { name: 'Import revenue' }).click();
      await browserExpect.poll(() => f.page.evaluate(() => (window as any).fixtureSaved?.totalRevenue)).toBe(785.95);
      expect(f.bodies.every(body => body.platformContext === 'ga4' && body.campaignField === 'tags' && body.selectedValues.join() === 'campaign3_eur_test')).toBe(true);
      for (const url of f.requests.filter(url => /status|unique-values/.test(url.pathname))) expect(url.searchParams.get('platformContext')).toBe('ga4');
      expect(f.errors).toEqual([]);
    } finally { await f.close(); }
  });
  it('keeps the exact source ID in edit status and preview requests', async () => {
    const f = await fixture(true);
    try {
      await browserExpect(f.page.getByText('Orders from 2026-08-26 are available.', { exact: false })).toBeVisible();
      await f.page.getByRole('button', { name: 'Continue', exact: true }).click();
      await browserExpect(f.page.getByRole('button', { name: /campaign3_eur_test/ })).toBeVisible();
      await f.page.getByRole('button', { name: 'Continue', exact: true }).click();
      await f.page.getByRole('button', { name: 'Continue', exact: true }).click();
      await browserExpect(f.page.getByRole('button', { name: 'Update revenue' })).toBeVisible();
      await browserExpect.poll(() => f.bodies.length).toBeGreaterThan(0);
      expect(f.requests.find(url => url.pathname.endsWith('/status'))?.searchParams.get('sourceId')).toBe('shopify-source');
      expect(f.requests.find(url => url.pathname.endsWith('/unique-values'))?.searchParams.get('sourceId')).toBe('shopify-source');
      expect(f.bodies.every(body => body.sourceId === 'shopify-source')).toBe(true); expect(f.errors).toEqual([]);
    } finally { await f.close(); }
  }, 15_000);
  it('blocks inaccessible history before submission and explains that saved revenue is retained', async () => {
    const f = await fixture(false, true);
    try {
      await browserExpect(f.page.getByText('Historical access is required; saved revenue has not been changed.', { exact: false })).toBeVisible();
      await browserExpect(f.page.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled(); expect(f.bodies).toEqual([]); expect(f.errors).toEqual([]);
    } finally { await f.close(); }
  });
});
