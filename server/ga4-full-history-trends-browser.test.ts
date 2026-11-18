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
  let windows: any[]=real.windows;
  let daily=real.daily.map(row=>({...row,engagementRate:Number(row.engagementRate.toFixed(4))})), cutoff=real.endDate;
  let summaryTotals:any={users:4496,sessions:4472,conversions:440,conversionRate:9.593023255813954};
  await page.clock.install({time:new Date('2026-11-17T09:00:00Z')});
  await context.route('**/*',async route=>{
    const req=route.request(), url=new URL(req.url());
    if(url.hostname!=='ga4-fixture.test' || req.method()!=='GET'){errors.push('Unexpected request: '+req.method()+' '+url.hostname);await route.abort();return;}
    if(url.pathname==='/fixture.js'){await route.fulfill({contentType:'application/javascript',body:bundle.outputFiles[0].text});return;}
    if(!url.pathname.startsWith('/api/')){await route.fulfill({contentType:'text/html',body:'<html><body><div id="root"></div><script src="/fixture.js"></script></body></html>'});return;}
    let data:any={success:true};
    const property={propertyId:real.propertyId,propertyName:'Mock',isPrimary:true,lookbackDays:30};
    if(url.pathname==='/api/campaigns/a') data={id:'a',name:'Isolated Promo',currency:'EUR',status:'active',reportingTimeZone:'Europe/Amsterdam',ga4CampaignFilter:'["yesop_brand_search","yesop_retargeting"]',createdAt:'2026-11-17T00:00:00Z'};
    else if(url.pathname.startsWith('/api/ga4/check-connection/') || url.pathname.endsWith('/ga4-connections')) data={success:true,connected:true,connections:[property]};
    else if(url.pathname.endsWith('/ga4-daily')) data={success:true,propertyId:real.propertyId,startDate:real.startDate,overviewStartDate:'2026-09-04',endDate:cutoff,dataThroughDate:cutoff,historyDataThroughDate:cutoff,latestStoredDailyDate:cutoff,reportingTimeZone:'Europe/Amsterdam',refreshStatus:'current',refreshIsStale:false,overviewTotals:summaryTotals,data:daily.slice(-60),trendsData:daily,usersComparisons:windows};
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
    expect(JSON.parse(findings!).some((f:any)=>f.id==='anomaly:not-enough-history')).toBe(false);
    const summary=page.getByTestId('insights-data-summary');
    // Native session conversion rate is already a percentage; event count / sessions is a different metric.
    await ui(summary).toContainText('9.6% conversion rate across imported history');
    const originalTotals={...summaryTotals};
    for(const rate of [0,100,null,undefined,'9.593',-1,101,NaN,Infinity]) {
      summaryTotals={...originalTotals,conversionRate:rate};await open();
      await ui(page.getByTestId('insights-summary-sessions')).toContainText('4,472');
      await ui(page.getByTestId('insights-summary-conversions')).toContainText('440');
      await ui(summary).toContainText(rate===0?'0% conversion rate across imported history':rate===100?'100% conversion rate across imported history':'Conversion rate unavailable');
      expect(await page.getByTestId('insights-executive-financials').innerText()).toBe(cards);
      expect(await page.getByTestId('insights-trackers').getAttribute('data-findings')).toBe(findings);
    }
    summaryTotals={...originalTotals,sessions:0,conversions:0,conversionRate:0};await open();
    await ui(summary).toContainText('Valid zero sessions');
    summaryTotals=null;await open();
    await ui(summary).toContainText('no usable imported history was returned');
    await ui(page.getByTestId('insights-summary-conversions')).toHaveCount(0);
    summaryTotals=originalTotals;await open();
    await ui(summary).toContainText('9.6% conversion rate across imported history');
    const metrics=['sessions','users','conversions','revenue','pageviews','engagementRate'];
    const value=(rows:any[],metric:string)=>metric==='engagementRate'
      ? rows.reduce((n,r)=>n+r.engagedSessions,0)/Math.max(1,rows.reduce((n,r)=>n+r.sessions,0))*100
      : rows.reduce((n,r)=>n+r[metric],0);
    for(const mode of ['Daily','7d','30d','Monthly']) {
      await trends.getByRole('button',{name:mode,exact:true}).click();
      for(const metric of metrics) {
        await page.getByTestId('insights-trend-metric').selectOption(metric);
        for(const selected of ['2026-11-17','2026-10-31','2026-09-30']) {
          await selectMonth(selected);
          const series=JSON.parse((await page.getByTestId('insights-trends-chart').getAttribute('data-chart-series'))!);
          const rangeMonth=selected.slice(0,7);
          const expected=mode==='Monthly' ? ['2026-09','2026-10','2026-11'].filter(m=>m<=rangeMonth).map(m=>{
            const rows=real.daily.filter(r=>r.date.startsWith(m)&&r.date<=selected);
            const total=metric==='users'?real.windows.find(w=>w.startDate===rows[0].date&&w.endDate===rows.at(-1)!.date)!.users:value(rows,metric);
            return {date:new Date(m+'-01T00:00:00Z').toLocaleString('en-US',{month:'short',timeZone:'UTC'})+" '26",value:metric==='engagementRate'?total:Number(total.toFixed(2))};
          }) : real.daily.filter(r=>r.date.startsWith(rangeMonth)&&r.date<=selected).flatMap(r=>{
            const n=mode==='7d'?7:mode==='30d'?30:1;
            const start=new Date(Date.parse(r.date)-(n-1)*86400000).toISOString().slice(0,10);
            const rows=real.daily.filter(d=>d.date>=start&&d.date<=r.date);
            if(rows.length!==n)return [];
            const total=metric==='users'&&mode!=='Daily'?real.windows.find(w=>w.startDate===start&&w.endDate===r.date)!.users:value(rows,metric);
            return [{date:r.date.slice(5),value:mode==='Daily'||metric==='engagementRate'?total:Number(total.toFixed(2))}];
          });
          expect(series.map((p:any)=>({date:p.date,value:p.value})),mode+' '+metric+' '+selected).toEqual(expected);
          expect(series.length).toBeLessThanOrEqual(mode==='Monthly'?12:31);
          if(mode==='Daily'&&metric==='engagementRate') {
            const more=trends.getByRole('button',{name:'Show all',exact:true});
            if(await more.isVisible()) await more.click();
            for(const day of real.daily.filter(row=>row.date.startsWith(rangeMonth))) {
              const row=trends.getByRole('row').filter({hasText:day.date});
              const current=value([day],metric), prior=real.daily.find(r=>r.date===new Date(Date.parse(day.date)-86400000).toISOString().slice(0,10));
              await ui(row.getByRole('cell').nth(1)).toHaveText(new Intl.NumberFormat('en-US',{maximumFractionDigits:1}).format(current)+'%');
              const previous=prior?value([prior],metric):0, change=(current-previous)/Math.abs(previous)*100;
              await ui(row.getByRole('cell').last()).toHaveText(!prior?'—':previous===0?'No % baseline':(change>=0?'+':'')+change.toFixed(1)+'%');
            }
            if(selected==='2026-09-30') {
              await page.clock.runFor(2000);
              const dots=page.getByTestId('insights-trends-chart').locator('.recharts-line-dots circle');
              for(const index of [10,11]) {
                await dots.nth(index).hover({force:true});
                await ui(trends.locator('.recharts-tooltip-wrapper')).toContainText(new Intl.NumberFormat('en-US',{maximumFractionDigits:1}).format(value([real.daily[index]],metric))+'%');
              }
            }
          }
          if(expected.length===0) {
            await ui(page.getByTestId('insights-trends-empty')).toContainText('Not enough data for a 30-day chart in this month.');
            await ui(page.getByTestId('insights-trends-empty')).toContainText('The first complete 30-day period ends on 3 October 2026.');
            await ui(page.getByTestId('insights-trends-chart').locator('svg')).toHaveCount(0);
          } else await ui(page.getByTestId('insights-trends-empty')).toHaveCount(0);
          if(mode==='Monthly') {
            const september=trends.getByRole('row').filter({has:page.getByRole('cell').filter({hasText:/^September 2026/})}).getByRole('cell').last();
            await ui(september).toHaveText('Not comparable: September 2026 is incomplete.');
            if(selected>='2026-10-31') {
              const october=trends.getByRole('row').filter({has:page.getByRole('cell').filter({hasText:/^October 2026/})}).getByRole('cell').last();
              await ui(october).toHaveText('Not comparable: September 2026 is incomplete.');
              await ui(october).not.toContainText('October 2026 is incomplete');
            }
            if(selected==='2026-11-17') await ui(trends.getByRole('row').filter({has:page.getByRole('cell').filter({hasText:/^November 2026/})}).getByRole('cell').last()).toHaveText('Not comparable: November 2026 is incomplete.');
          }
          if(mode==='7d'||mode==='30d') {
            const days=mode==='7d'?7:30;
            const start=new Date(Date.parse(selected)-(days-1)*86400000).toISOString().slice(0,10);
            const priorEnd=new Date(Date.parse(start)-86400000).toISOString().slice(0,10);
            const priorStart=new Date(Date.parse(start)-days*86400000).toISOString().slice(0,10);
            const cur=real.daily.filter(r=>r.date>=start&&r.date<=selected),prior=real.daily.filter(r=>r.date>=priorStart&&r.date<=priorEnd);
            if(cur.length===days&&prior.length===days) {
              const current=metric==='users'?real.windows.find(w=>w.startDate===start&&w.endDate===selected)!.users:value(cur,metric);
              const before=metric==='users'?real.windows.find(w=>w.startDate===priorStart&&w.endDate===priorEnd)!.users:value(prior,metric);
              const table=trends.getByRole('table');
              await ui(table).toContainText(start+' → '+selected);
              await ui(table).toContainText(priorStart+' → '+priorEnd);
              if(before!==0) await ui(table.getByRole('row').filter({hasText:(selected===real.endDate?'Last ':'Selected ')+days+' days'})).toContainText(((current-before)/Math.abs(before)*100).toFixed(1)+'%');
              else await ui(table).toContainText('No % baseline');
            } else {
              const note=page.getByTestId('insights-trends-comparison-unavailable');
              await ui(note).toContainText('Cannot calculate the 30-day change.');
              await ui(note).toContainText('Imported history starts: Sep 4, 2026. Data cutoff: Nov 17, 2026.');
              if(selected==='2026-09-30') {
                await ui(note).toContainText('Comparison end date: Sep 30, 2026.');
                await ui(note.getByRole('listitem').nth(0)).toHaveText('Selected 30 days: Sep 1, 2026 – Sep 30, 2026. Missing dates in this app: Sep 1, 2026 – Sep 3, 2026.');
                await ui(note.getByRole('listitem').nth(1)).toHaveText('Previous 30 days: Aug 2, 2026 – Aug 31, 2026. Missing dates in this app: Aug 2, 2026 – Aug 31, 2026.');
              } else {
                await ui(note).toContainText('Comparison end date: Oct 31, 2026.');
                await ui(note.getByRole('listitem').nth(0)).toHaveText('Selected 30 days: Oct 2, 2026 – Oct 31, 2026. Complete daily data.');
                await ui(note.getByRole('listitem').nth(1)).toHaveText('Previous 30 days: Sep 2, 2026 – Oct 1, 2026. Missing dates in this app: Sep 2, 2026 – Sep 3, 2026.');
              }
            }
          }
        }
      }
    }
    await trends.getByRole('button',{name:'7d',exact:true}).click();
    await page.getByTestId('insights-trend-metric').selectOption('users');
    await selectMonth('2026-11-17');
    await ui(navigation.getByRole('button',{name:'Next month',exact:true})).toBeDisabled();
    await ui(trends.getByRole('row').filter({hasText:'Last 7 days'})).toContainText(String(real.windows.find(w=>w.startDate==='2026-11-11'&&w.endDate===real.endDate)!.users));
    await selectMonth('2026-10-31');
    await selectMonth('2026-09-30');
    await ui(trends.getByRole('button',{name:'Previous month',exact:true})).toBeDisabled();
    await ui(trends.getByRole('table')).toContainText('2026-09-24 → 2026-09-30');
    await ui(trends.getByRole('table')).toContainText(String(real.windows.find(w=>w.endDate==='2026-09-30')!.users));
    await ui(trends.getByRole('table')).toContainText(String(real.windows.find(w=>w.endDate==='2026-09-23')!.users));
    expect(await page.getByTestId('insights-executive-financials').innerText()).toBe(cards);
    expect(await page.getByTestId('insights-trackers').getAttribute('data-findings')).toBe(findings);
    // Missing native totals are unavailable, never summed from daily Users; zero is a valid total.
    windows=real.windows.filter(w=>!(w.startDate==='2026-10-19'&&w.endDate==='2026-11-17')&&!(w.startDate==='2026-10-01'&&w.endDate==='2026-10-31'));
    await open();await trends.getByRole('button',{name:'30d',exact:true}).click();
    await ui(page.getByTestId('insights-trend-metric')).toHaveValue('users');
    expect(JSON.parse((await page.getByTestId('insights-trends-chart').getAttribute('data-chart-series'))!).at(-1).value).toBeNull();
    await ui(trends.getByRole('table')).toContainText('The GA4 Users total for this exact period is unavailable.');
    windows=windows.map(w=>w.startDate==='2026-11-01'&&w.endDate==='2026-11-17'?{...w,users:0}:w);
    await open();await trends.getByRole('button',{name:'Monthly',exact:true}).click();
    const octoberRow=trends.getByRole('row').filter({has:page.getByRole('cell').filter({hasText:/^October 2026/})});
    await ui(octoberRow).toContainText('Unavailable');
    await ui(octoberRow).toContainText('Not comparable');
    await ui(octoberRow.getByRole('cell').last()).toHaveText('Not comparable: October 2026 GA4 Users total is unavailable.');
    const monthly=JSON.parse((await page.getByTestId('insights-trends-chart').getAttribute('data-chart-series'))!);
    expect(monthly.find((r:any)=>r.date==="Oct '26").value).toBeNull();
    expect(monthly.find((r:any)=>r.date==="Nov '26").value).toBe(0);
    windows=real.windows;
    // Gaps inside the imported period are listed exactly; recorded zero days are not missing.
    daily=real.daily.filter(r=>!['2026-10-31','2026-11-03','2026-11-04'].includes(r.date));
    await open();await trends.getByRole('button',{name:'30d',exact:true}).click();
    const note=page.getByTestId('insights-trends-comparison-unavailable');
    await ui(note.getByRole('listitem').nth(0)).toHaveText('Selected 30 days: Oct 19, 2026 – Nov 17, 2026. Missing dates in this app: Oct 31, 2026; Nov 3, 2026 – Nov 4, 2026.');
    await ui(note.getByRole('listitem').nth(1)).toHaveText('Previous 30 days: Sep 19, 2026 – Oct 18, 2026. Complete daily data.');
    await ui(note).not.toContainText('fall outside');
    await trends.getByRole('button',{name:'Monthly',exact:true}).click();
    const november=trends.getByRole('row').filter({has:page.getByRole('cell').filter({hasText:/^November 2026/})}).getByRole('cell').last();
    await ui(november).toHaveText('Not comparable: November 2026 is incomplete.');
    // Complete adjacent months keep their existing zero-baseline and percentage behavior.
    daily=Array.from({length:61},(_,i)=>({ ...real.daily[0],date:new Date(Date.UTC(2026,9,1+i)).toISOString().slice(0,10),sessions:i<31?0:1,users:i<31?0:1,engagedSessions:0,engagementRate:0 }));
    cutoff='2026-11-30';windows=[{startDate:'2026-10-01',endDate:'2026-10-31',users:0},{startDate:'2026-11-01',endDate:cutoff,users:15}];
    await open();await trends.getByRole('button',{name:'Monthly',exact:true}).click();
    await ui(november).toHaveText('No % baseline');
    daily=daily.map(r=>({...r,sessions:1,users:1}));windows[0]={...windows[0],users:10};
    await open();await trends.getByRole('button',{name:'Monthly',exact:true}).click();
    await ui(november).toHaveText('+50.0%');
    // The same explanation is present when no complete rolling window exists anywhere.
    daily=real.daily.filter(r=>r.date<='2026-09-06');cutoff='2026-09-06';
    await open();
    await ui(note).toContainText('Cannot calculate the 7-day change.');
    await ui(note).toContainText('Data cutoff: Sep 6, 2026.');
    await ui(note.getByRole('listitem').nth(0)).toHaveText('Selected 7 days: Aug 31, 2026 – Sep 6, 2026. Missing dates in this app: Aug 31, 2026 – Sep 3, 2026.');
    await ui(note.getByRole('listitem').nth(1)).toHaveText('Previous 7 days: Aug 24, 2026 – Aug 30, 2026. Missing dates in this app: Aug 24, 2026 – Aug 30, 2026.');
    await trends.getByRole('button',{name:'30d',exact:true}).click();
    await ui(note).toContainText('Cannot calculate the 30-day change.');
    await ui(note.getByRole('listitem').nth(0)).toHaveText('Selected 30 days: Aug 8, 2026 – Sep 6, 2026. Missing dates in this app: Aug 8, 2026 – Sep 3, 2026.');
    // Findings use imported history even for a newly created copy, and native exact-window rates.
    cutoff=real.endDate;daily=real.daily;windows=real.windows;
    const findingIds=async()=>JSON.parse((await page.getByTestId('insights-trackers').getAttribute('data-findings'))!);
    const native=(startDate:string,endDate:string,rate:unknown)=>({startDate,endDate,users:100,sessions:100,sessionKeyEventRate:rate});
    for(const currentRate of [0.01,0,null,undefined,'0.01',-1,2]) {
      windows=[native('2026-11-11',cutoff,currentRate),native('2026-11-04','2026-11-10',0.5)];
      await open();
      const alert=(await findingIds()).find((f:any)=>f.id==='anomaly:cr:wow');
      expect(Boolean(alert)).toBe(currentRate===0.01||currentRate===0);
      if(alert)expect(alert.description).toContain(currentRate===0?'Last 7d 0% vs prior 7d 50%':'Last 7d 1% vs prior 7d 50%');
    }
    windows=[native('2026-11-11',cutoff,0.01)];await open();
    expect((await findingIds()).some((f:any)=>f.id==='anomaly:cr:wow')).toBe(false);
    daily=real.daily.filter(r=>r.date>='2026-11-12');
    windows=[native('2026-11-15',cutoff,0.1),native('2026-11-12','2026-11-14',0.5)];await open();
    expect((await findingIds()).find((f:any)=>f.id==='anomaly:cr:3d')?.description).toContain('Last 3d 10% vs prior 3d 50%');
    windows=[];await open();
    expect((await findingIds()).some((f:any)=>f.id==='anomaly:cr:3d'||f.id==='anomaly:volume:3d')).toBe(false);
    // Truly missing dates still withhold comparisons; explicit zeros complete the windows.
    daily=real.daily.filter(r=>!['2026-11-10','2026-11-14'].includes(r.date));await open();
    expect((await findingIds()).some((f:any)=>f.id==='anomaly:not-enough-history')).toBe(true);
    daily=real.daily.map(r=>({...r,sessions:0,users:0,conversions:0,pageviews:0,revenue:0,engagedSessions:0,engagementRate:0}));await open();
    expect((await findingIds()).some((f:any)=>f.id.startsWith('anomaly:'))).toBe(false);
    expect(errors).toEqual([]);
  } finally {await browser.close();}
},120000);
