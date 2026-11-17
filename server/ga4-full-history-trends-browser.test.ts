import { build } from 'esbuild';
import { chromium, expect as ui } from '@playwright/test';
import { expect, it } from 'vitest';
import real from './fixtures/ga4-trends-history';

it('navigates every metric across the full imported GA4 history without writes or changed financials', async () => {
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
  await page.clock.install({time:new Date('2026-11-17T09:00:00Z')});
  await context.route('**/*',async route=>{
    const req=route.request(), url=new URL(req.url());
    if(url.hostname!=='ga4-fixture.test' || req.method()!=='GET'){errors.push('Unexpected request: '+req.method()+' '+url.hostname);await route.abort();return;}
    if(url.pathname==='/fixture.js'){await route.fulfill({contentType:'application/javascript',body:bundle.outputFiles[0].text});return;}
    if(!url.pathname.startsWith('/api/')){await route.fulfill({contentType:'text/html',body:'<html><body><div id="root"></div><script src="/fixture.js"></script></body></html>'});return;}
    let data:any={success:true};
    const property={propertyId:real.propertyId,propertyName:'Mock',isPrimary:true,lookbackDays:30};
    if(url.pathname==='/api/campaigns/a') data={id:'a',name:'Isolated Promo',currency:'EUR',status:'active',reportingTimeZone:'Europe/Amsterdam',ga4CampaignFilter:'["yesop_brand_search","yesop_retargeting"]',createdAt:'2026-10-04T00:00:00Z'};
    else if(url.pathname.startsWith('/api/ga4/check-connection/') || url.pathname.endsWith('/ga4-connections')) data={success:true,connected:true,connections:[property]};
    else if(url.pathname.endsWith('/ga4-daily')) data={success:true,propertyId:real.propertyId,startDate:real.startDate,overviewStartDate:'2026-09-04',endDate:real.endDate,dataThroughDate:real.endDate,historyDataThroughDate:real.endDate,latestStoredDailyDate:real.endDate,reportingTimeZone:'Europe/Amsterdam',refreshStatus:'current',refreshIsStale:false,overviewTotals:{users:4496,sessions:4472,conversions:440},data:real.daily.slice(-60),trendsData:real.daily,usersComparisons:windows};
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
    const trends=await open();
    const navigation=page.getByTestId('insights-trends-navigation');
    await ui(navigation.getByRole('button')).toHaveText(['Previous month','Next month']);
    await ui(navigation.locator('input')).toHaveCount(0);
    let visibleMonth='2026-11';
    const selectMonth=async(selected:string)=>{
      const target=selected.slice(0,7);
      while(visibleMonth!==target){
        const forward=visibleMonth<target;
        await navigation.getByRole('button',{name:forward?'Next month':'Previous month',exact:true}).click();
        const [year,month]=visibleMonth.split('-').map(Number);
        visibleMonth=new Date(Date.UTC(year,month-1+(forward?1:-1),1)).toISOString().slice(0,7);
      }
      await ui(navigation).toContainText('→ '+selected);
    };
    const cards=await page.getByTestId('insights-executive-financials').innerText();
    const findings=await page.getByTestId('insights-trackers').getAttribute('data-findings');
    const metrics=['sessions','users','conversions','revenue','pageviews','engagementRate'];
    const value=(rows:any[],metric:string)=>metric==='engagementRate'
      ? rows.reduce((n,r)=>n+r.engagedSessions,0)/Math.max(1,rows.reduce((n,r)=>n+r.sessions,0))*100
      : rows.reduce((n,r)=>n+r[metric],0);
    for(const mode of ['Daily','7d','30d','Monthly']) {
      await trends.getByRole('button',{name:mode,exact:true}).click();
      for(const metric of metrics.filter(m=>m!=='users'||['Daily','7d'].includes(mode))) {
        await page.getByTestId('insights-trend-metric').selectOption(metric);
        for(const selected of ['2026-11-17','2026-10-31','2026-09-30']) {
          await selectMonth(selected);
          const series=JSON.parse((await page.getByTestId('insights-trends-chart').getAttribute('data-chart-series'))!);
          const rangeMonth=selected.slice(0,7);
          const expected=mode==='Monthly' ? ['2026-09','2026-10','2026-11'].filter(m=>m<=rangeMonth).map(m=>{
            const rows=real.daily.filter(r=>r.date.startsWith(m)&&r.date<=selected);
            return {date:new Date(m+'-01T00:00:00Z').toLocaleString('en-US',{month:'short',timeZone:'UTC'})+" '26",value:Number(value(rows,metric).toFixed(2))};
          }) : real.daily.filter(r=>r.date.startsWith(rangeMonth)&&r.date<=selected).flatMap(r=>{
            const n=mode==='7d'?7:mode==='30d'?30:1;
            const start=new Date(Date.parse(r.date)-(n-1)*86400000).toISOString().slice(0,10);
            const rows=real.daily.filter(d=>d.date>=start&&d.date<=r.date);
            if(rows.length!==n)return [];
            const total=metric==='users'&&mode==='7d'?real.windows.find(w=>w.endDate===r.date)!.users:value(rows,metric);
            return [{date:r.date.slice(5),value:mode==='Daily'&&metric!=='engagementRate'?total:Number(total.toFixed(2))}];
          });
          expect(series.map((p:any)=>({date:p.date,value:p.value})),mode+' '+metric+' '+selected).toEqual(expected);
          expect(series.length).toBeLessThanOrEqual(mode==='Monthly'?12:31);
          if(expected.length===0) {
            await ui(page.getByTestId('insights-trends-empty')).toContainText('Not enough data for a 30-day chart in this month.');
            await ui(page.getByTestId('insights-trends-empty')).toContainText('The first complete 30-day period ends on 3 October 2026.');
            await ui(page.getByTestId('insights-trends-chart').locator('svg')).toHaveCount(0);
          } else await ui(page.getByTestId('insights-trends-empty')).toHaveCount(0);
          if(mode==='7d'||mode==='30d') {
            const days=mode==='7d'?7:30;
            const start=new Date(Date.parse(selected)-(days-1)*86400000).toISOString().slice(0,10);
            const priorEnd=new Date(Date.parse(start)-86400000).toISOString().slice(0,10);
            const priorStart=new Date(Date.parse(start)-days*86400000).toISOString().slice(0,10);
            const cur=real.daily.filter(r=>r.date>=start&&r.date<=selected),prior=real.daily.filter(r=>r.date>=priorStart&&r.date<=priorEnd);
            if(cur.length===days&&prior.length===days) {
              const current=metric==='users'?real.windows.find(w=>w.endDate===selected)!.users:value(cur,metric);
              const before=metric==='users'?real.windows.find(w=>w.endDate===priorEnd)!.users:value(prior,metric);
              const table=trends.getByRole('table');
              await ui(table).toContainText(start+' → '+selected);
              await ui(table).toContainText(priorStart+' → '+priorEnd);
              if(before!==0) await ui(table.getByRole('row').filter({hasText:(selected===real.endDate?'Last ':'Selected ')+days+' days'})).toContainText(((current-before)/Math.abs(before)*100).toFixed(1)+'%');
              else await ui(table).toContainText('No % baseline');
            } else await ui(trends).toContainText('comparison ending '+selected+' is unavailable');
          }
        }
      }
    }
    await trends.getByRole('button',{name:'7d',exact:true}).click();
    await page.getByTestId('insights-trend-metric').selectOption('users');
    await selectMonth('2026-11-17');
    await ui(navigation.getByRole('button',{name:'Next month',exact:true})).toBeDisabled();
    await ui(trends.getByRole('row').filter({hasText:'Last 7 days'})).toContainText(String(real.windows.at(-1)!.users));
    await selectMonth('2026-10-31');
    await selectMonth('2026-09-30');
    await ui(trends.getByRole('button',{name:'Previous month',exact:true})).toBeDisabled();
    await ui(trends.getByRole('table')).toContainText('2026-09-24 → 2026-09-30');
    await ui(trends.getByRole('table')).toContainText(String(real.windows.find(w=>w.endDate==='2026-09-30')!.users));
    await ui(trends.getByRole('table')).toContainText(String(real.windows.find(w=>w.endDate==='2026-09-23')!.users));
    expect(await page.getByTestId('insights-executive-financials').innerText()).toBe(cards);
    expect(await page.getByTestId('insights-trackers').getAttribute('data-findings')).toBe(findings);
    expect(errors).toEqual([]);
  } finally {await browser.close();}
},120000);
