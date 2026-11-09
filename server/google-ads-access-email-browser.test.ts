import { describe, it, expect as assert } from 'vitest';
import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';
import path from 'node:path';

describe('Google Ads access-email screen (actual component, isolated API)', () => {
  it('prepares, rejects denied access, clears changed IDs, verifies and imports selected campaigns', async () => {
    const code = `import React from 'react';import{createRoot}from'react-dom/client';import{QueryClientProvider}from'@tanstack/react-query';import{createAppQueryClient}from'./client/src/lib/queryClient';import{AddSpendWizardModal}from'./client/src/components/AddSpendWizardModal';import{Toaster}from'./client/src/components/ui/toaster';function Fixture(){const[source,setSource]=React.useState();window.fixtureEdit=()=>setSource({id:'saved-source',sourceType:'ad_platforms',mappingConfig:JSON.stringify({platform:'google_ads',selectedCampaignIds:['24273140790']})});return <AddSpendWizardModal campaignId="fixture" currency="EUR" platformContext="ga4" open={true} initialSource={source} onOpenChange={()=>{}}/>}createRoot(document.getElementById('root')).render(<QueryClientProvider client={createAppQueryClient()}><Fixture/><Toaster/></QueryClientProvider>);`;
    const bundle = await build({ stdin: { contents: code, loader: 'tsx', resolveDir: process.cwd() }, bundle: true, write: false, jsx: 'automatic', alias: { '@': path.resolve('client/src') }, define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env': '{}' } });
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const calls: any[] = [], errors: string[] = [], unexpected: string[] = []; let permitted = false;
    await context.route('**/*', async route => {
      const r = route.request(), u = new URL(r.url()), body = r.postData() ? JSON.parse(r.postData()!) : undefined;
      const reply = (data: any, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
      if (u.origin !== 'https://fixture.invalid') { unexpected.push(u.href); return route.abort(); }
      if (u.pathname === '/') return route.fulfill({ contentType: 'text/html', body: '<div id="root"></div><script src="/fixture.js"></script>' });
      if (u.pathname === '/fixture.js') return route.fulfill({ contentType: 'application/javascript', body: bundle.outputFiles[0].text });
      calls.push({ path: u.pathname, method: r.method(), body });
      if (u.pathname.endsWith('/spend-sources')) return reply({ success: true, sources: [] });
      if (u.pathname.endsWith('/google-sheets-connections')) return reply({ connections: [] });
      if (u.pathname.endsWith('/connected-platforms')) return reply({ platforms: [] });
      if (u.pathname.endsWith('/spend/meta/preview')) return reply({ connected: false, campaigns: [] });
      if (u.pathname.endsWith('/connection')) return reply({ connected: false });
      if (u.pathname.endsWith('/google-ads-service-account/status')) return reply({ success: true, enabled: true, selfService: true, email: null });
      if (u.pathname.endsWith('/google-ads-service-account/prepare')) return reply({ success: true, customerId: body.customerId, email: `acme-ads-${body.customerId}@fixture.iam.gserviceaccount.com` });
      if (u.pathname.endsWith('/google-ads-service-account/connect')) return permitted ? reply({ success: true, customer: { id: body.customerId, name: 'Fixture customer' } }) : reply({ success: false, message: 'Grant Read only access first' }, 403);
      if (u.pathname.endsWith('/refresh')) return reply({ success: true });
      if (u.pathname.endsWith('/daily-metrics')) return reply({ success: true, metrics: [{ googleCampaignId: '24273140790', googleCampaignName: 'Campaign #1', spend: '4.89', impressions: 10, clicks: 1 }, { googleCampaignId: 'other', googleCampaignName: 'Campaign #2', spend: '10.00', impressions: 20, clicks: 2 }] });
      if (u.pathname.endsWith('/spend/process/manual')) return reply({ success: true, totalSpend: 4.89, currency: 'EUR' });
      unexpected.push(u.pathname); return route.abort();
    });
    const page = await context.newPage(); page.setDefaultTimeout(5000); page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto('https://fixture.invalid/'); await page.getByText('Google Ads', { exact: true }).first().click();
      await expect(page.getByText('Connect using an access email', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Connect Google Ads', exact: true })).toBeVisible();
      const input = page.getByLabel('Google Ads Customer ID', { exact: true }), generate = page.getByRole('button', { name: 'Generate access email', exact: true }), verify = page.getByRole('button', { name: 'Verify connection', exact: true });
      await expect(generate).toBeDisabled(); await expect(verify).toBeDisabled();
      await input.fill('495-128-1615'); await generate.click();
      await expect(page.getByLabel('Access email', { exact: true })).toHaveValue('acme-ads-4951281615@fixture.iam.gserviceaccount.com');
      await verify.click(); await expect(page.getByText('Grant Read only access first', { exact: true }).first()).toBeVisible();
      await expect(verify).toBeEnabled(); assert(calls.some(c => c.path.endsWith('/daily-metrics'))).toBe(false);
      await input.fill('111-222-3333'); await expect(verify).toBeDisabled(); await expect(page.getByLabel('Access email', { exact: true })).toHaveCount(0);
      await input.fill('495-128-1615'); await generate.click(); permitted = true; await verify.click();
      await expect(page.getByText('Campaign #1', { exact: true })).toBeVisible();
      const importButton = page.getByRole('button', { name: 'Import spend', exact: true });
      const first = page.getByRole('row').filter({ hasText: 'Campaign #1' }).getByRole('checkbox');
      const second = page.getByRole('row').filter({ hasText: 'Campaign #2' }).getByRole('checkbox');
      await expect(first).not.toBeChecked(); await expect(second).not.toBeChecked();
      await expect(importButton).toBeVisible(); await expect(importButton).toBeDisabled();
      await expect(page.getByText('0 of 2 campaigns selected')).toBeVisible();
      assert(calls.some(c => c.path.endsWith('/spend/process/manual'))).toBe(false);
      await first.check(); await expect(importButton).toBeEnabled();
      await page.getByRole('button', { name: 'Refresh data', exact: true }).click();
      await expect(first).toBeChecked(); await expect(second).not.toBeChecked();
      await page.getByRole('checkbox').first().check(); await expect(second).toBeChecked();
      await page.getByRole('checkbox').first().uncheck(); await expect(importButton).toBeDisabled();
      await first.check(); await importButton.click();
      await expect.poll(() => calls.some(c => c.path.endsWith('/spend/process/manual'))).toBe(true);
      const imported = calls.find(c => c.path.endsWith('/spend/process/manual'));
      assert(imported.body.mappingConfig.selectedCampaignIds).toEqual(['24273140790']); assert(imported.body.amount).toBe(4.89); assert(imported.body.platformContext).toBe('ga4'); assert(errors).toEqual([]); assert(unexpected).toEqual([]);
      await page.evaluate(() => (window as any).fixtureEdit());
      await expect(page.getByRole('button', { name: 'Update spend', exact: true })).toBeDisabled();
      await expect(first).toBeChecked(); await expect(second).not.toBeChecked();
    } catch (error) { throw new Error(`${String(error)}\nErrors: ${JSON.stringify(errors)}\nUnexpected: ${JSON.stringify(unexpected)}\nScreen: ${await page.locator('body').innerText()}`); }
    finally { await context.close(); await browser.close(); }
  }, 30000);
});
