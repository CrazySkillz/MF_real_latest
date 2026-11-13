import { build } from 'esbuild';
import { chromium, expect as browserExpect, type Browser } from '@playwright/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Actual editor; every request is intercepted. No server, database or provider access.
describe('CSV revenue retained-data Next button', () => {
  let bundle: string, browser: Browser;
  const sampleRows = [{ Date: '2026-07-01', Campaign: 'Alpha', Revenue: '200' }, { Date: '2026-07-02', Campaign: 'Alpha', Revenue: '50' }, { Date: '2026-07-03', Campaign: 'Beta', Revenue: '1100' }];
  const mapping = { revenueColumn: 'Revenue', campaignColumn: 'Campaign', dateColumn: 'Date', campaignValues: ['Alpha', 'Beta'], valueSource: 'revenue', csvHeaders: ['Date', 'Campaign', 'Revenue'], csvSampleRows: sampleRows, csvRowCount: 3, storedRevenueColumn: 'Revenue', storedCampaignColumn: 'Campaign', storedDateColumn: 'Date', csvStoredRevenueRows: sampleRows.map(r => ({ dateRaw: r.Date, campaignKey: r.Campaign, revenueRaw: r.Revenue })) };
  beforeAll(async () => {
    const result = await build({ stdin: { contents: `import React from 'react';import{createRoot}from'react-dom/client';import{QueryClientProvider}from'@tanstack/react-query';import{createAppQueryClient}from'./client/src/lib/queryClient';import{AddRevenueWizardModal}from'./client/src/components/AddRevenueWizardModal';createRoot(document.getElementById('root')).render(<QueryClientProvider client={createAppQueryClient()}><AddRevenueWizardModal open={true} onOpenChange={()=>{}} campaignId="fixture" currency="EUR" dateRange="30days" platformContext="ga4" initialStep="csv" initialSource={window.csvSource}/></QueryClientProvider>);`, loader: 'tsx', resolveDir: process.cwd() }, bundle: true, write: false, jsx: 'automatic', define: { 'process.env.NODE_ENV': '"test"', 'import.meta.env': '{}' } });
    bundle = result.outputFiles[0].text; browser = await chromium.launch({ headless: true });
  }, 60000);
  afterAll(async () => { await browser?.close(); });

  async function fixture(config: any = mapping, newSource = false) {
    const context = await browser.newContext({ serviceWorkers: 'block' }), page = await context.newPage();
    const errors: string[] = [], saves: any[] = []; let previews = 0;
    page.setDefaultTimeout(4000); page.on('pageerror', e => errors.push(e.message));
    await context.route('**/*', async route => {
      const req = route.request(), u = new URL(req.url());
      const reply = (data: any) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
      if (u.origin !== 'https://csv-next.fixture') { errors.push('Blocked host: ' + u.origin); return route.abort(); }
      if (u.pathname === '/') return route.fulfill({ contentType: 'text/html', body: `<div id="root"></div><script>window.csvSource=${JSON.stringify(newSource ? undefined : { id: 'saved-csv', sourceType: 'csv', displayName: 'saved.csv', mappingConfig: JSON.stringify(config) })}</script><script src="/fixture.js"></script>` });
      if (u.pathname === '/fixture.js') return route.fulfill({ contentType: 'application/javascript', body: bundle });
      if (u.pathname.endsWith('/revenue/csv/process')) {
        const form = await new Request(req.url(), { method: 'POST', headers: { 'content-type': req.headers()['content-type'] }, body: req.postDataBuffer()! }).formData();
        saves.push({ mapping: JSON.parse(String(form.get('mapping'))), hasFile: form.has('file') });
        return reply({ success: true, totalRevenue: 250, currency: 'EUR' });
      }
      if (u.pathname.endsWith('/revenue/csv/preview')) { previews++; return reply({ success: true, headers: ['Date', 'Campaign', 'Revenue'], sampleRows, rowCount: 3 }); }
      if (req.method() !== 'GET') { errors.push('Unexpected mutation: ' + u.pathname); return route.abort(); }
      if (u.pathname.endsWith('/all-data-sources')) return reply({ success: true, revenueSources: [] });
      if (u.pathname.endsWith('/status')) return reply({ connected: false, oauthAvailable: true });
      if (u.pathname.endsWith('/google-sheets-connections')) return reply({ connections: [] });
      if (u.pathname.endsWith('/ga4-campaign-values')) return reply({ campaigns: [] });
      if (u.pathname.endsWith('/deals/properties')) return reply({ properties: [] });
      if (u.pathname.endsWith('/deals/pipelines')) return reply({ pipelines: [] });
      if (u.pathname.endsWith('/opportunities/fields')) return reply({ fields: [] });
      errors.push('Unexpected request: ' + u.pathname); return route.abort();
    });
    await page.goto('https://csv-next.fixture/');
    return { page, saves, previews: () => previews, close: async () => { await context.close(); expect(errors).toEqual([]); } };
  }

  it.each(['stored rows', 'complete saved preview'])('continues with %s and submits Alpha without a file', async kind => {
    const f = await fixture(kind === 'stored rows' ? mapping : { ...mapping, csvStoredRevenueRows: [] });
    try {
      await browserExpect(f.page.getByRole('button', { name: 'Next', exact: true })).toBeEnabled();
      await f.page.getByRole('button', { name: 'Next', exact: true }).click();
      const update = f.page.getByRole('button', { name: 'Update revenue', exact: true });
      await browserExpect(update).toBeDisabled();
      await browserExpect(f.page.getByRole('checkbox').nth(1)).toBeChecked();
      await f.page.getByRole('checkbox').nth(1).uncheck(); await browserExpect(update).toBeEnabled(); await update.click();
      await browserExpect.poll(() => f.saves.length).toBe(1);
      expect(f.saves[0]).toMatchObject({ hasFile: false, mapping: { sourceId: 'saved-csv', campaignValues: ['Alpha'], revenueColumn: 'Revenue', dateColumn: 'Date', campaignColumn: 'Campaign', currency: 'EUR' } });
      expect(f.previews()).toBe(0);
    } finally { await f.close(); }
  });

  it.each(['missing rows', 'partial preview', 'changed structural mapping'])('requires re-upload for %s', async kind => {
    const config = kind === 'missing rows' ? { ...mapping, csvStoredRevenueRows: [], csvSampleRows: [] } : kind === 'partial preview' ? { ...mapping, csvStoredRevenueRows: [], csvRowCount: 4 } : { ...mapping, storedRevenueColumn: 'Different column' };
    const f = await fixture(config);
    try { await browserExpect(f.page.getByRole('button', { name: 'Next', exact: true })).toBeDisabled(); expect(f.saves).toEqual([]); }
    finally { await f.close(); }
  });

  it('still requires a file for a new upload and previews the chosen file', async () => {
    const f = await fixture(undefined, true);
    try {
      const next = f.page.getByRole('button', { name: 'Next', exact: true }); await browserExpect(next).toBeDisabled();
      await f.page.locator('input[type=file]').setInputFiles({ name: 'new.csv', mimeType: 'text/csv', buffer: Buffer.from('Date,Campaign,Revenue\n2026-07-01,Alpha,200\n') });
      await browserExpect(next).toBeEnabled(); await next.click();
      await browserExpect(f.page.getByRole('button', { name: 'Import revenue', exact: true })).toBeVisible(); expect(f.previews()).toBe(1); expect(f.saves).toEqual([]);
    } finally { await f.close(); }
  });
});
