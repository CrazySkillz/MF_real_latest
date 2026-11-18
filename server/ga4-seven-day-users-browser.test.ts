import { build } from 'esbuild';
import { chromium, expect as ui } from '@playwright/test';
import { expect, it } from 'vitest';
import real from './fixtures/ga4-seven-day-users-real-20261116.json';

it('renders all real-GA4 seven-day Users windows, preserves zero and refuses missing totals', async () => {
  const bundle = await build({
    stdin: {contents: `import React from 'react';import {createRoot} from 'react-dom/client';
      import {QueryClientProvider} from '@tanstack/react-query';import {TooltipProvider} from './client/src/components/ui/tooltip';
      import {createAppQueryClient} from './client/src/lib/queryClient';import Page from './client/src/pages/ga4-metrics';
      createRoot(document.getElementById('root')).render(<QueryClientProvider client={createAppQueryClient()}><TooltipProvider><Page/></TooltipProvider></QueryClientProvider>);`, loader:'tsx',resolveDir:process.cwd()},
    bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"test"','import.meta.env':'{}'},
    plugins:[{name:'isolate-unrelated-setup',setup(builder){
      builder.onResolve({filter:/^@\/(components\/layout\/(navigation|sidebar)|lib\/clientContext|components\/(GA4ConnectionFlow|AddSpendWizardModal|AddRevenueWizardModal))$/},args=>({path:args.path,namespace:'fixture'}));
      builder.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:args.path.endsWith('clientContext') ? 'export const useClient=()=>({clients:[]})' : args.path.includes('layout/') ? 'export default function Stub(){return null}' : `export function ${args.path.split('/').at(-1)}(){return null}`,loader:'js'}));
    }}],
  });
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1400,height:1050},serviceWorkers:'block'});
  const page=await context.newPage(), errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  let windows: typeof real.windows=real.windows;
  await page.clock.install({time:new Date('2026-11-16T09:00:00Z')});
  await context.route('**/*',async route=>{
    const req=route.request(), url=new URL(req.url());
    if(url.hostname!=='ga4-fixture.test' || req.method()!=='GET'){errors.push('Unexpected request: '+req.method()+' '+url.hostname);await route.abort();return;}
    if(url.pathname==='/fixture.js'){await route.fulfill({contentType:'application/javascript',body:bundle.outputFiles[0].text});return;}
    if(!url.pathname.startsWith('/api/')){await route.fulfill({contentType:'text/html',body:'<html><body><div id="root"></div><script src="/fixture.js"></script></body></html>'});return;}
    let data:any={success:true};
    const property={propertyId:real.propertyId,propertyName:'Mock',isPrimary:true,lookbackDays:30};
    if(url.pathname==='/api/campaigns/a') data={id:'a',name:'Isolated Promo',currency:'EUR',status:'active',reportingTimeZone:'Europe/Amsterdam',ga4CampaignFilter:'["yesop_brand_search","yesop_retargeting"]',createdAt:'2026-10-04T00:00:00Z'};
    else if(url.pathname.startsWith('/api/ga4/check-connection/') || url.pathname.endsWith('/ga4-connections')) data={success:true,connected:true,connections:[property]};
    else if(url.pathname.endsWith('/ga4-daily')) data={success:true,propertyId:real.propertyId,startDate:real.startDate,overviewStartDate:'2026-09-04',endDate:real.endDate,dataThroughDate:real.endDate,historyDataThroughDate:real.endDate,latestStoredDailyDate:real.endDate,reportingTimeZone:'Europe/Amsterdam',refreshStatus:'current',refreshIsStale:false,overviewTotals:{users:4496,sessions:4472,conversions:440},data:real.daily.map(row=>({...row,sessions:row.users,conversions:0,revenue:0,engagementRate:0})),usersComparisons:windows};
    else if(url.pathname.endsWith('/ga4-publication-status')) data={success:true,publicationToken:'real-saved-fixture',refreshStatus:'current'};
    else if(url.pathname.endsWith('/financial-daily-snapshot')) data={success:true,snapshot:null};
    else if(url.pathname.includes('/platforms/google_analytics/')) data=[];
    else if(/revenue|spend/.test(url.pathname)) data={success:true,sources:[],rows:[],sourceIds:[],totalRevenue:0,totalSpend:0};
    await route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
  });
  const open=async()=>{
    await page.goto('http://ga4-fixture.test/campaigns/a/ga4-metrics?readOnly=1&tab=insights');
    const trends=page.getByTestId('insights-trends');
    await ui(trends).toBeVisible({timeout:10000}).catch(async error=>{throw new Error(JSON.stringify({errors,body:(await page.locator('body').innerText()).slice(0,1600)})+' '+error.message)});
    await trends.getByRole('button',{name:'7d',exact:true}).click();
    await page.getByTestId('insights-trend-metric').selectOption('users');
    return trends;
  };
  try {
    let trends=await open();
    await ui(trends.getByRole('row').filter({hasText:'Last 7 days'})).toContainText('122');
    await ui(trends.getByRole('row').filter({hasText:'Last 7 days'})).toContainText('-74.3%');
    await ui(trends.getByRole('row').filter({hasText:'Prior 7 days'})).toContainText('475');
    const series=JSON.parse((await page.getByTestId('insights-trends-chart').getAttribute('data-chart-series'))!);
    expect(series.map((point:any)=>({end:point.date,users:point.value}))).toEqual(real.windows.filter(w=>w.endDate >= "2026-11-01").map(w=>({end:w.endDate.slice(5),users:w.users})));
    await trends.getByRole("button",{name:"Previous month",exact:true}).click();
    const previous=JSON.parse((await page.getByTestId("insights-trends-chart").getAttribute("data-chart-series"))!);
    expect(previous.some((point:any)=>point.value===0)).toBe(true);
    await trends.getByRole("button",{name:"Next month",exact:true}).click();
    await ui(trends.getByRole('row').filter({hasText:'Last 7 days'})).toContainText('122');
    // The Daily-to-7d transition retains the Users selection.
    await trends.getByRole('button',{name:'Daily',exact:true}).click();
    await trends.getByRole('button',{name:'7d',exact:true}).click();
    await ui(page.getByTestId('insights-trend-metric')).toHaveValue('users');
    windows=real.windows.filter(w=>w.endDate!=='2026-11-16'); trends=await open();
    const note=page.getByTestId('insights-trends-comparison-unavailable');
    await ui(note).toContainText('Comparison end date: Nov 16, 2026.');
    await ui(note.getByRole('listitem').nth(0)).toHaveText('Selected 7 days: Nov 10, 2026 – Nov 16, 2026. The GA4 Users total for this exact period is unavailable.');
    await ui(note.getByRole('listitem').nth(1)).toHaveText('Previous 7 days: Nov 3, 2026 – Nov 9, 2026. Complete daily data.');
    await ui(note).not.toContainText('Missing dates in this app:');
    const missing=JSON.parse((await page.getByTestId('insights-trends-chart').getAttribute('data-chart-series'))!);
    expect(missing.at(-1).value).toBeNull();
    await ui(page.getByTestId('insights-trends-empty')).toHaveCount(0);
    // Recorded zeros remain a chart, even when every point is zero.
    await page.getByTestId('insights-trend-metric').selectOption('conversions');
    const zeros=JSON.parse((await page.getByTestId('insights-trends-chart').getAttribute('data-chart-series'))!);
    expect(zeros.length).toBeGreaterThan(0);
    expect(zeros.every((point:any)=>point.value===0)).toBe(true);
    await ui(page.getByTestId('insights-trends-empty')).toHaveCount(0);
    await ui(page.getByTestId('insights-trends-chart').locator('svg')).toHaveCount(1);
    windows=[]; trends=await open();
    await ui(page.getByTestId('insights-trends-empty')).toHaveText('GA4 seven-day Users totals are unavailable for this month.');
    await ui(page.getByTestId('insights-trends-chart').locator('svg')).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {await browser.close();}
},60000);
