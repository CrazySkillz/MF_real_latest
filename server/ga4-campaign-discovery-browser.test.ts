import path from 'node:path';
import { build } from 'esbuild';
import { chromium, expect as browserExpect, type Browser } from '@playwright/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('GA4 campaign discovery partial-result UI', () => {
  let browser: Browser, bundle: string;
  beforeAll(async () => {
    const built = await build({ stdin: { contents: `import React from 'react';import{createRoot}from'react-dom/client';
      import{QueryClientProvider}from'@tanstack/react-query';import{createAppQueryClient}from'./client/src/lib/queryClient';
      import{GA4ConnectionFlow}from'./client/src/components/GA4ConnectionFlow';
      createRoot(document.getElementById('root')).render(<QueryClientProvider client={createAppQueryClient()}><GA4ConnectionFlow campaignId="fixture"/></QueryClientProvider>);`,
      loader: 'tsx', resolveDir: process.cwd() }, bundle: true, write: false, jsx: 'automatic', alias: { '@': path.resolve('client/src') }, define: { 'process.env.NODE_ENV': '"test"' } });
    bundle = built.outputFiles[0].text;
    browser = await chromium.launch({ headless: true });
  }, 60_000);
  afterAll(async () => { await browser?.close(); });

  it('shows usable campaigns with a warning, preserves selection on retry, and saves only explicitly selected names', async () => {
    const context = await browser.newContext({ serviceWorkers: 'block' }), page = await context.newPage();
    page.setDefaultTimeout(5_000);
    const errors: string[] = [], requests: Array<{ path: string; method: string; body: any }> = [];
    let complete = false;
    page.on('pageerror', error => errors.push(error.message));
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== 'https://ga4-timeout.fixture.invalid') { errors.push('Unexpected network request'); await route.abort(); return; }
      const reply = (body: any) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
      if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: '<div id="root"></div><script src="/fixture.js"></script>' });
      if (url.pathname === '/fixture.js') return route.fulfill({ contentType: 'application/javascript', body: bundle });
      requests.push({ path: url.pathname, method: request.method(), body: request.postData() ? JSON.parse(request.postData()!) : null });
      if (url.pathname.endsWith('ga4-connection-status')) return reply({ connected: true, pendingConnectionId: 'pending', propertyId: '', properties: [{ id: '123', name: 'Synthetic property' }] });
      if (url.pathname === '/api/ga4/select-property') return reply({ success: true });
      if (url.pathname.endsWith('ga4-campaign-values')) {
        expect(url.searchParams.get('propertyId')).toBe('123'); expect(url.searchParams.get('allowPartial')).toBe('1');
        return reply({ success: true, propertyId: '123', campaigns: [{ name: 'synthetic_campaign', users: 25 }], ...(complete ? {} : { discoveryComplete: false }) });
      }
      if (url.pathname === '/api/campaigns/fixture') return reply(request.method() === 'GET' ? { ga4CampaignFilter: null } : { success: true });
      errors.push(`Unexpected route: ${url.pathname}`); return route.abort();
    });
    try {
      await page.goto('https://ga4-timeout.fixture.invalid/');
      await page.getByRole('button', { name: 'Connect Property', exact: true }).click();
      await browserExpect(page.getByRole('alert')).toContainText('Additional campaigns could not be checked');
      await browserExpect(page.getByRole('checkbox')).not.toBeChecked();
      await browserExpect(page.getByText('No UTM campaigns found for this period.')).toHaveCount(0);
      await page.getByRole('checkbox').click();
      complete = true;
      await page.getByRole('button', { name: 'Retry campaign list', exact: true }).click();
      await browserExpect(page.getByRole('alert')).toHaveCount(0);
      await browserExpect(page.getByRole('checkbox').first()).toBeChecked();
      await page.getByPlaceholder('e.g., brand_awareness').fill('known_missing_campaign');
      await page.getByRole('button', { name: 'Add', exact: true }).click();
      await page.getByRole('button', { name: 'Import 2 campaigns', exact: true }).click();
      await browserExpect.poll(() => requests.filter(r => r.method === 'PATCH').length).toBe(1);
      expect(JSON.parse(requests.find(r => r.method === 'PATCH')!.body.ga4CampaignFilter)).toEqual(['synthetic_campaign', 'known_missing_campaign']);
      expect(requests.filter(r => r.method !== 'GET').map(r => [r.path, r.method])).toEqual([['/api/ga4/select-property', 'POST'], ['/api/campaigns/fixture', 'PATCH']]);
      expect(errors).toEqual([]);
    } finally { await context.close(); }
  }, 30_000);
});
